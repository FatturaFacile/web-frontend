import { Component, computed, DestroyRef, inject, input, OnInit, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ClientApiService,
  ContactHierarchy,
  ContactResource,
  contactDisplayName,
  HIERARCHY_TYPES,
  HierarchyNode,
  HierarchyType,
  I18nService,
  isValidationError,
} from '@core';
import { TranslatePipe } from '@shared';
import { Subject, debounceTime, switchMap } from 'rxjs';

interface HierarchyRow {
  node: HierarchyNode;
  depth: number;
}

/** Flattens the descendant tree into indented rows (depth first). */
export function flattenHierarchy(node: HierarchyNode, depth = 0): HierarchyRow[] {
  return [{ node, depth }, ...(node.children ?? []).flatMap((child) => flattenHierarchy(child, depth + 1))];
}

/** Parent company and hierarchy type of a customer, with the holding chain above it and the subsidiaries below. */
@Component({
  selector: 'app-customer-360-hierarchy',
  imports: [FormsModule, NzButtonModule, NzSelectModule, NzTagModule, TranslatePipe],
  template: `
    <div class="parent">
      <nz-select
        class="grow"
        nzShowSearch
        nzAllowClear
        nzServerSearch
        [(ngModel)]="parent"
        [nzPlaceHolder]="'CRM.CUSTOMER360.PARENT' | translate"
        [attr.aria-label]="'CRM.CUSTOMER360.PARENT' | translate"
        (nzOnSearch)="search$.next($event)"
      >
        @for (option of options(); track option.id) {
          <nz-option [nzValue]="option.id" [nzLabel]="option.label" />
        }
      </nz-select>
      <nz-select
        [(ngModel)]="type"
        nzAllowClear
        [nzPlaceHolder]="'CRM.CUSTOMER360.HIERARCHY_TYPE' | translate"
        [attr.aria-label]="'CRM.CUSTOMER360.HIERARCHY_TYPE' | translate"
      >
        @for (t of types; track t) {
          <nz-option [nzValue]="t" [nzLabel]="'CRM.CUSTOMER360.HIERARCHY_' + t.toUpperCase() | translate" />
        }
      </nz-select>
      <button nz-button nzType="primary" type="button" [nzLoading]="saving()" (click)="save()">
        {{ 'COMMON.SAVE' | translate }}
      </button>
    </div>

    @if (hierarchy(); as h) {
      @for (ancestor of h.ancestors; track ancestor.id) {
        <div class="row">
          <span>↑ {{ ancestor.name }}</span>
          @if (ancestor.hierarchy_type) {
            <nz-tag>{{ 'CRM.CUSTOMER360.HIERARCHY_' + ancestor.hierarchy_type.toUpperCase() | translate }}</nz-tag>
          }
        </div>
      }
      @for (row of rows(); track row.node.id) {
        <div class="row" [style.padding-left.px]="row.depth * 24">
          <strong [class.self]="row.depth === 0">{{ row.node.name }}</strong>
          @if (row.node.hierarchy_type) {
            <nz-tag>{{ 'CRM.CUSTOMER360.HIERARCHY_' + row.node.hierarchy_type.toUpperCase() | translate }}</nz-tag>
          }
          <span>{{ row.node.vat_number || row.node.uid_number }}</span>
        </div>
      }
    }
  `,
  styles: `
    .parent {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .grow {
      flex: 1 1 260px;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      padding: 4px 0;
    }
  `,
})
export class Customer360HierarchyComponent implements OnInit {
  private readonly api = inject(ClientApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  readonly contactId = input.required<string>();
  /** Parent and type as stored on the contact. */
  readonly parentId = input<string | null>(null);
  readonly hierarchyType = input<HierarchyType | null>(null);
  readonly changed = output<void>();

  protected readonly types = HIERARCHY_TYPES;
  protected readonly search$ = new Subject<string>();
  protected readonly options = signal<{ id: string; label: string }[]>([]);
  protected readonly hierarchy = signal<ContactHierarchy | null>(null);
  protected readonly saving = signal(false);
  protected readonly rows = computed(() => {
    const h = this.hierarchy();
    return h ? flattenHierarchy(h.tree) : [];
  });

  protected parent: string | null = null;
  protected type: HierarchyType | null = null;

  ngOnInit(): void {
    this.parent = this.parentId();
    this.type = this.hierarchyType();
    this.load();
    this.search$
      .pipe(
        debounceTime(250),
        switchMap((search) => this.api.list({ search, per_page: 20 })),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.options.set(this.toOptions(res.data)));
  }

  protected load(): void {
    this.api
      .hierarchy(this.contactId())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ next: (res) => this.hierarchy.set(res.data), error: () => this.hierarchy.set(null) });
  }

  protected save(): void {
    this.saving.set(true);
    this.api
      .update(this.contactId(), { parent_id: this.parent, hierarchy_type: this.parent ? this.type : null })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.load();
          this.changed.emit();
        },
        error: (err: unknown) => {
          this.saving.set(false);
          // A parent that would create a loop is refused by the API with a message on `parent_id`.
          const reason = isValidationError(err) ? err.error.errors['parent_id']?.[0] : undefined;
          this.message.error(reason ?? this.i18n.translate('COMMON.VALIDATION.INVALID_VALUE'));
        },
      });
  }

  /** The customer itself is never offered as its own parent. */
  private toOptions(contacts: ContactResource[]): { id: string; label: string }[] {
    return contacts
      .filter((contact) => contact.id !== this.contactId())
      .map((contact) => ({ id: contact.id, label: contactDisplayName(contact) }));
  }
}
