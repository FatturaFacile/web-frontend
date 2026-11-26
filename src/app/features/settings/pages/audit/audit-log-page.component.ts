import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzResultModule } from 'ng-zorro-antd/result';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AUDIT_CATEGORIES,
  AUDIT_CHANNELS,
  AuditCategory,
  AuditChannel,
  AuditEntry,
  AuditEntryFilters,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AuditEntryDrawerComponent } from './audit-entry-drawer.component';
import { AuditExportDialogComponent } from './audit-export-dialog.component';
import { AuditLedgerStore } from './audit-ledger.store';
import {
  actionKey,
  categoryColor,
  failureTitleKey,
  isErasedActor,
  isoDay,
  windowIsTooLong,
} from './audit-ledger.util';
import { IntegrityStatusCardComponent } from './integrity-status-card.component';

/**
 * Audit trail of the tenant (Mod 005): the integrity card, the filters, the cursor-paginated entries with infinite scroll and
 * the entry drawer with the old/new diff. An API error shows an error result; the page never falls back to sample data.
 */
@Component({
  selector: 'app-audit-log-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AuditLedgerStore],
  imports: [
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzInputModule,
    NzResultModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    AuditEntryDrawerComponent,
    AuditExportDialogComponent,
    IntegrityStatusCardComponent,
  ],
  template: `
    <app-page-header
      [title]="'settings.audit.title' | translate"
      [subtitle]="'settings.audit.subtitle' | translate"
    >
      <button header-actions nz-button nzType="primary" (click)="exportOpen.set(true)">
        {{ 'audit.export.button' | translate }}
      </button>
    </app-page-header>

    <app-audit-integrity-card />

    <nz-card class="filters">
      <div class="filter-grid">
        <label>
          <span>{{ 'settings.audit.filter.date_range' | translate }}</span>
          <nz-range-picker [(ngModel)]="range" nzFormat="yyyy-MM-dd" />
        </label>
        <label>
          <span>{{ 'settings.audit.filter.actor' | translate }}</span>
          <input nz-input [(ngModel)]="actor" (keydown.enter)="apply()" />
        </label>
        <label>
          <span>{{ 'settings.audit.filter.action' | translate }}</span>
          <input nz-input [(ngModel)]="action" (keydown.enter)="apply()" />
        </label>
        <label>
          <span>{{ 'settings.audit.filter.resource_type' | translate }}</span>
          <input nz-input [(ngModel)]="resourceType" (keydown.enter)="apply()" />
        </label>
        <label>
          <span>{{ 'settings.audit.filter.category' | translate }}</span>
          <nz-select [(ngModel)]="category" nzAllowClear>
            @for (value of categories; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'settings.audit.category.' + value | translate" />
            }
          </nz-select>
        </label>
        <label>
          <span>{{ 'settings.audit.filter.channel' | translate }}</span>
          <nz-select [(ngModel)]="channel" nzAllowClear>
            @for (value of channels; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'settings.audit.channel.' + value | translate" />
            }
          </nz-select>
        </label>
      </div>
      @if (rangeTooLong()) {
        <nz-alert nzType="warning" nzShowIcon [nzMessage]="'settings.audit.filter.range_too_long' | translate" />
      }
      <div class="filter-actions">
        <button nz-button nzType="primary" [disabled]="rangeTooLong()" (click)="apply()">
          {{ 'settings.audit.filter.apply' | translate }}
        </button>
        <button nz-button (click)="reset()">{{ 'settings.audit.filter.reset' | translate }}</button>
      </div>
    </nz-card>

    <nz-card>
      @if (store.failure(); as failure) {
        <nz-result
          nzStatus="error"
          [nzTitle]="failureTitleKey(failure) | translate"
          [nzSubTitle]="'settings.audit.error.subtitle' | translate"
        >
          <div nz-result-extra>
            <button nz-button nzType="primary" (click)="apply()">
              {{ 'settings.audit.error.retry' | translate }}
            </button>
          </div>
        </nz-result>
      } @else {
        <nz-spin [nzSpinning]="store.loading()">
          <nz-table
            #table
            [nzData]="store.entries()"
            [nzShowPagination]="false"
            [nzPageSize]="store.entries().length || 1"
            nzSize="small"
            [nzNoResult]="empty"
          >
            <thead>
              <tr>
                <th nzWidth="90px">{{ 'settings.audit.col.sequence' | translate }}</th>
                <th nzWidth="190px">{{ 'settings.audit.col.occurred_at' | translate }}</th>
                <th>{{ 'settings.audit.col.action' | translate }}</th>
                <th>{{ 'settings.audit.col.actor' | translate }}</th>
                <th>{{ 'settings.audit.col.resource' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (entry of table.data; track entry.id) {
                <tr class="row" tabindex="0" (click)="open(entry)" (keydown.enter)="open(entry)">
                  <td>{{ entry.sequence }}</td>
                  <td class="mono">{{ entry.occurred_at | date: 'yyyy-MM-dd HH:mm:ss' : 'UTC' }}</td>
                  <td>
                    <nz-tag [nzColor]="categoryColor(entry.category)">
                      {{ actionLabel(entry.action) | translate }}
                    </nz-tag>
                  </td>
                  <td>{{ actorLabel(entry.display_actor) }}</td>
                  <td>{{ shortType(entry.resource_type) }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
          <ng-template #empty>
            <nz-empty [nzNotFoundContent]="'settings.audit.empty' | translate" />
          </ng-template>
        </nz-spin>

        <div #sentinel class="sentinel">
          @if (store.loadingMore()) {
            <nz-spin nzSimple />
            <span>{{ 'settings.audit.loading_more' | translate }}</span>
          } @else if (store.nextCursor() !== null) {
            <button nz-button nzType="link" (click)="store.loadMore()">
              {{ 'settings.audit.load_more' | translate }}
            </button>
          } @else if (store.entries().length > 0) {
            <span class="muted">{{ 'settings.audit.end_of_list' | translate }}</span>
          }
        </div>
      }
    </nz-card>

    <app-audit-entry-drawer [entry]="store.selected()" (closed)="store.select(null)" />
    <app-audit-export-dialog [open]="exportOpen()" (closed)="exportOpen.set(false)" />
  `,
  styles: `
    .filters,
    app-audit-integrity-card {
      display: block;
      margin-bottom: 16px;
    }
    .filter-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px;
    }
    .filter-grid label {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .filter-actions {
      display: flex;
      gap: 8px;
      margin-top: 12px;
    }
    .row {
      cursor: pointer;
    }
    .mono {
      font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    }
    .sentinel {
      display: flex;
      justify-content: center;
      align-items: center;
      gap: 8px;
      min-height: 40px;
    }
    .muted {
      color: var(--ant-text-color-secondary, #8c8c8c);
    }
  `,
})
export class AuditLogPageComponent implements OnInit {
  protected readonly store = inject(AuditLedgerStore);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);

  protected readonly categories = AUDIT_CATEGORIES;
  protected readonly channels = AUDIT_CHANNELS;
  protected readonly categoryColor = categoryColor;
  protected readonly failureTitleKey = failureTitleKey;

  protected readonly exportOpen = signal(false);

  protected range: Date[] = [];
  protected actor = '';
  protected action = '';
  protected resourceType = '';
  protected category: AuditCategory | null = null;
  protected channel: AuditChannel | null = null;

  private readonly sentinel = viewChild<ElementRef<HTMLElement>>('sentinel');

  constructor() {
    // Infinite scroll: the sentinel below the table loads the next page when it scrolls into view.
    afterNextRender(() => {
      if (typeof IntersectionObserver === 'undefined') {
        return;
      }
      const observer = new IntersectionObserver((hits) => {
        if (hits.some((hit) => hit.isIntersecting)) {
          void this.store.loadMore();
        }
      });
      this.destroyRef.onDestroy(() => observer.disconnect());
      effect(
        () => {
          const element = this.sentinel()?.nativeElement;
          observer.disconnect();
          if (element) {
            observer.observe(element);
          }
        },
        { injector: this.injector },
      );
    });
  }

  ngOnInit(): void {
    void this.store.load({});
  }

  protected rangeTooLong(): boolean {
    return windowIsTooLong(this.range[0] ?? null, this.range[1] ?? null);
  }

  protected apply(): void {
    if (this.rangeTooLong()) {
      return;
    }
    void this.store.load(this.filters());
  }

  protected reset(): void {
    this.range = [];
    this.actor = '';
    this.action = '';
    this.resourceType = '';
    this.category = null;
    this.channel = null;
    void this.store.load({});
  }

  protected open(entry: AuditEntry): void {
    this.store.select(entry);
  }

  protected actionLabel(action: string): string {
    return actionKey(action, (key) => this.i18n.translate(key) !== key);
  }

  protected actorLabel(label: string | null): string {
    if (label === null || label === '') {
      return this.i18n.translate('settings.audit.system_actor');
    }
    return isErasedActor(label) ? this.i18n.translate('settings.audit.erased') : label;
  }

  /** `App\Models\Invoice` → `Invoice`. */
  protected shortType(type: string): string {
    return type.split('\\').pop() ?? type;
  }

  private filters(): AuditEntryFilters {
    const [from, to] = this.range;
    return {
      from: from ? isoDay(from) : undefined,
      to: to ? isoDay(to) : undefined,
      actor: this.actor.trim() || undefined,
      action: this.action.trim() || undefined,
      resource_type: this.resourceType.trim() || undefined,
      category: this.category ?? undefined,
      channel: this.channel ?? undefined,
    };
  }
}
