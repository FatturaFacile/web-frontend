import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AnalyticalCenterCategory,
  AnalyticalCenterNode,
  AnalyticalCenterPayload,
  AnalyticalCenterType,
  CENTER_CATEGORIES,
  CENTER_TYPES,
  COST_ELEMENT_TYPES,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { AnalyticalAccountingStore } from './analytical-accounting.store';
import { invalidParents, visibleRows } from './analytical-accounting.util';

interface CenterForm {
  id: string | null;
  parent_id: string | null;
  code: string;
  name: string;
  center_type: AnalyticalCenterType;
  category: AnalyticalCenterCategory;
  manager_name: string;
  is_active: boolean;
  valid_from: string;
  valid_to: string;
  default_cost_element_type: string | null;
}

const emptyForm = (): CenterForm => ({
  id: null,
  parent_id: null,
  code: '',
  name: '',
  center_type: 'COST_CENTER',
  category: 'AUXILIARY',
  manager_name: '',
  is_active: true,
  valid_from: '',
  valid_to: '',
  default_cost_element_type: null,
});

/** Cost and profit center hierarchy manager: the tree as a table, a drawer to create, edit and move a center. */
@Component({
  selector: 'app-analytical-centers',
  styleUrl: './analytical-accounting.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'ANALYTICAL.CENTERS_TITLE' | translate"
      [subtitle]="'ANALYTICAL.CENTERS_SUBTITLE' | translate"
    >
      <button nz-button nzType="primary" header-actions (click)="openNew(null)">
        {{ 'ANALYTICAL.NEW_CENTER' | translate }}
      </button>
    </app-page-header>

    @if (store.error(); as error) {
      <p class="error" role="alert">{{ error | translate }}</p>
    }

    <nz-table
      [nzData]="rows()"
      [nzLoading]="store.loading()"
      nzSize="small"
      [nzShowPagination]="false"
      [nzFrontPagination]="false"
    >
      <thead>
        <tr>
          <th>{{ 'ANALYTICAL.CODE' | translate }}</th>
          <th>{{ 'ANALYTICAL.TYPE' | translate }}</th>
          <th>{{ 'ANALYTICAL.CATEGORY' | translate }}</th>
          <th>{{ 'ANALYTICAL.MANAGER' | translate }}</th>
          <th>{{ 'ANALYTICAL.VALIDITY' | translate }}</th>
          <th>{{ 'ANALYTICAL.STATUS' | translate }}</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        @for (row of rows(); track row.node.id) {
          <tr>
            <td [style.padding-left.px]="12 + row.depth * 20">
              @if (row.node.children.length) {
                <a
                  tabindex="0"
                  (click)="toggle(row.node.id)"
                  (keydown.enter)="toggle(row.node.id)"
                  [attr.aria-expanded]="!collapsed().has(row.node.id)"
                  >{{ collapsed().has(row.node.id) ? '▸' : '▾' }}</a
                >
              }
              <strong>{{ row.node.code }}</strong> {{ row.node.name }}
            </td>
            <td>{{ 'ANALYTICAL.TYPE_' + row.node.center_type | translate }}</td>
            <td>
              <nz-tag>{{ 'ANALYTICAL.CATEGORY_' + row.node.category | translate }}</nz-tag>
            </td>
            <td>{{ row.node.manager_name ?? '—' }}</td>
            <td>{{ row.node.valid_from ?? '…' }} → {{ row.node.valid_to ?? '…' }}</td>
            <td>
              <nz-tag [nzColor]="row.node.is_active ? 'green' : 'default'">
                {{ (row.node.is_active ? 'ANALYTICAL.ACTIVE' : 'ANALYTICAL.INACTIVE') | translate }}
              </nz-tag>
            </td>
            <td class="actions">
              <button nz-button nzSize="small" (click)="openNew(row.node.id)">
                {{ 'ANALYTICAL.ADD_CHILD' | translate }}
              </button>
              <button nz-button nzSize="small" (click)="openEdit(row.node)">
                {{ 'ANALYTICAL.EDIT' | translate }}
              </button>
              @if (row.node.is_active) {
                <button
                  nz-button
                  nzSize="small"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'ANALYTICAL.CONFIRM_DEACTIVATE' | translate"
                  (nzOnConfirm)="deactivate(row.node)"
                >
                  {{ 'ANALYTICAL.DEACTIVATE' | translate }}
                </button>
              }
              <button
                nz-button
                nzSize="small"
                nzDanger
                nz-popconfirm
                [nzPopconfirmTitle]="'ANALYTICAL.CONFIRM_DELETE' | translate"
                (nzOnConfirm)="remove(row.node)"
              >
                {{ 'ANALYTICAL.DELETE' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    <nz-drawer
      [nzVisible]="drawerOpen()"
      [nzWidth]="440"
      [nzTitle]="(form().id ? 'ANALYTICAL.EDIT_CENTER' : 'ANALYTICAL.NEW_CENTER') | translate"
      (nzOnClose)="drawerOpen.set(false)"
    >
      <ng-container *nzDrawerContent>
        <div class="form-grid">
          <label>{{ 'ANALYTICAL.CODE' | translate }}
            <input nz-input [ngModel]="form().code" (ngModelChange)="patch({ code: $event })" />
          </label>
          <label>{{ 'ANALYTICAL.NAME' | translate }}
            <input nz-input [ngModel]="form().name" (ngModelChange)="patch({ name: $event })" />
          </label>
          <label for="analytical-centers-ctl-1">{{ 'ANALYTICAL.TYPE' | translate }}
            <nz-select nzId="analytical-centers-ctl-1" [ngModel]="form().center_type" (ngModelChange)="patch({ center_type: $event })">
              @for (type of types; track type) {
                <nz-option [nzValue]="type" [nzLabel]="'ANALYTICAL.TYPE_' + type | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label for="analytical-centers-ctl-2">{{ 'ANALYTICAL.CATEGORY' | translate }}
            <nz-select nzId="analytical-centers-ctl-2" [ngModel]="form().category" (ngModelChange)="patch({ category: $event })">
              @for (category of categories; track category) {
                <nz-option [nzValue]="category" [nzLabel]="'ANALYTICAL.CATEGORY_' + category | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label for="analytical-centers-ctl-3">{{ 'ANALYTICAL.PARENT' | translate }}
            <nz-select nzId="analytical-centers-ctl-3"
              nzAllowClear
              [ngModel]="form().parent_id"
              (ngModelChange)="patch({ parent_id: $event ?? null })"
            >
              @for (parent of parentOptions(); track parent.id) {
                <nz-option [nzValue]="parent.id" [nzLabel]="parent.code + ' ' + parent.name"></nz-option>
              }
            </nz-select>
          </label>
          <label>{{ 'ANALYTICAL.MANAGER' | translate }}
            <input nz-input [ngModel]="form().manager_name" (ngModelChange)="patch({ manager_name: $event })" />
          </label>
          <label>{{ 'ANALYTICAL.VALID_FROM' | translate }}
            <input nz-input type="date" [ngModel]="form().valid_from" (ngModelChange)="patch({ valid_from: $event })" />
          </label>
          <label>{{ 'ANALYTICAL.VALID_TO' | translate }}
            <input nz-input type="date" [ngModel]="form().valid_to" (ngModelChange)="patch({ valid_to: $event })" />
          </label>
          <label for="analytical-centers-ctl-4">{{ 'ANALYTICAL.DEFAULT_ELEMENT' | translate }}
            <nz-select nzId="analytical-centers-ctl-4"
              nzAllowClear
              [ngModel]="form().default_cost_element_type"
              (ngModelChange)="patch({ default_cost_element_type: $event ?? null })"
            >
              @for (element of elements; track element) {
                <nz-option [nzValue]="element" [nzLabel]="'ANALYTICAL.ELEMENT_' + element | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label for="analytical-centers-ctl-5">{{ 'ANALYTICAL.ACTIVE' | translate }}
            <nz-switch nzId="analytical-centers-ctl-5" [ngModel]="form().is_active" (ngModelChange)="patch({ is_active: $event })"></nz-switch>
          </label>
        </div>
        <button
          nz-button
          nzType="primary"
          [nzLoading]="store.saving()"
          [disabled]="!form().code || !form().name"
          (click)="save()"
        >
          {{ 'ANALYTICAL.SAVE' | translate }}
        </button>
      </ng-container>
    </nz-drawer>
  `,
})
export class AnalyticalCentersComponent implements OnInit {
  protected readonly store = inject(AnalyticalAccountingStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly types = CENTER_TYPES;
  protected readonly categories = CENTER_CATEGORIES;
  protected readonly elements = COST_ELEMENT_TYPES;
  protected readonly collapsed = signal<ReadonlySet<string>>(new Set());
  protected readonly drawerOpen = signal(false);
  protected readonly form = signal<CenterForm>(emptyForm());

  protected readonly rows = computed(() => visibleRows(this.store.tree(), this.collapsed()));

  /** Centers the edited one may sit under: never itself or one of its descendants. */
  protected readonly parentOptions = computed(() => {
    const id = this.form().id;
    const blocked = id ? invalidParents(this.store.tree(), id) : new Set<string>();
    return this.store.centers().filter((center) => !blocked.has(center.id));
  });

  ngOnInit(): void {
    void this.store.loadCenters();
  }

  protected toggle(id: string): void {
    this.collapsed.update((current) => {
      const next = new Set(current);
      if (!next.delete(id)) {
        next.add(id);
      }
      return next;
    });
  }

  protected patch(change: Partial<CenterForm>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  protected openNew(parentId: string | null): void {
    const parent = parentId ? this.store.centers().find((c) => c.id === parentId) : null;
    this.form.set({
      ...emptyForm(),
      parent_id: parentId,
      center_type: parent?.center_type ?? 'COST_CENTER',
    });
    this.drawerOpen.set(true);
  }

  protected openEdit(node: AnalyticalCenterNode): void {
    this.form.set({
      id: node.id,
      parent_id: node.parent_id,
      code: node.code,
      name: node.name,
      center_type: node.center_type,
      category: node.category,
      manager_name: node.manager_name ?? '',
      is_active: node.is_active,
      valid_from: node.valid_from ?? '',
      valid_to: node.valid_to ?? '',
      default_cost_element_type: node.default_cost_element_type ?? null,
    });
    this.drawerOpen.set(true);
  }

  protected async save(): Promise<void> {
    const form = this.form();
    const payload: AnalyticalCenterPayload = {
      parent_id: form.parent_id,
      code: form.code.trim(),
      name: form.name.trim(),
      center_type: form.center_type,
      category: form.category,
      manager_name: form.manager_name || null,
      is_active: form.is_active,
      valid_from: form.valid_from || null,
      valid_to: form.valid_to || null,
      default_cost_element_type: form.default_cost_element_type as AnalyticalCenterPayload['default_cost_element_type'],
    };
    const outcome = await this.store.saveCenter(form.id, payload);
    if (outcome.ok) {
      this.drawerOpen.set(false);
      this.message.success(this.translate.instant('ANALYTICAL.SAVED'));
    } else {
      this.message.error(this.translate.instant(outcome.message ?? 'ANALYTICAL.SAVE_ERROR'));
    }
  }

  protected async deactivate(node: AnalyticalCenterNode): Promise<void> {
    const outcome = await this.store.deactivateCenter(node.id, node.children.length > 0);
    this.report(outcome.ok, outcome.message);
  }

  protected async remove(node: AnalyticalCenterNode): Promise<void> {
    const outcome = await this.store.deleteCenter(node.id);
    this.report(outcome.ok, outcome.message);
  }

  private report(ok: boolean, reason: string | null): void {
    if (ok) {
      this.message.success(this.translate.instant('ANALYTICAL.SAVED'));
    } else {
      this.message.error(this.translate.instant(reason ?? 'ANALYTICAL.SAVE_ERROR'));
    }
  }
}
