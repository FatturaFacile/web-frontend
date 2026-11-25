import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, of } from 'rxjs';
import {
  PLM_CHANGE_REASONS,
  PLM_CHANGE_STATUSES,
  PLM_CHANGE_TYPES,
  PLM_PRIORITIES,
  PLM_STOCK_DISPOSITION_RULES,
  PlmApiService,
  PlmChangeOrder,
  PlmChangeOrderRequest,
  PlmChangeReason,
  PlmChangeStatus,
  PlmChangeType,
  PlmEcoWorkflowStage,
  PlmOption,
  PlmPriority,
  PlmStockDispositionRule,
  SettingsApiService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, blankToNull, CHANGE_STATUS_COLORS, PRIORITY_COLORS } from './plm.util';

const KANBAN_STAGES: readonly PlmEcoWorkflowStage[] = ['Draft', 'EcrSubmitted', 'UnderEvaluation', 'EcoApproved', 'EcnReleased'];

/** Engineering change orders with switchable Table and ECR/ECO/ECN Kanban views. */
@Component({
  selector: 'app-plm-change-orders',
  styleUrl: './plm.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .kanban-grid { display: grid; grid-template-columns: repeat(5, minmax(210px, 1fr)); gap: 12px; overflow-x: auto; }
    .kanban-col { background: var(--ant-color-fill-quaternary, #fafafa); border-radius: 8px; padding: 10px; border: 1px solid var(--ant-color-border-secondary, #f0f0f0); }
    .kanban-card { margin-bottom: 8px; }
  `,
  template: `
    <app-page-header [title]="'PLM.ORDERS_TITLE' | translate" [subtitle]="'PLM.ORDERS_SUBTITLE' | translate">
      <a nz-button routerLink="/plm/revisions">{{ 'PLM.REVISIONS_TITLE' | translate }}</a>
      <a nz-button routerLink="/plm/cad-import">{{ 'NAV.PLM_CAD_IMPORT' | translate }}</a>
      <a nz-button routerLink="/plm/bom-diff">{{ 'NAV.PLM_BOM_DIFF' | translate }}</a>
      <a nz-button routerLink="/plm/where-used">{{ 'NAV.PLM_WHERE_USED' | translate }}</a>
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" [nzPlaceHolder]="'PLM.STATUS' | translate">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="('PLM.STATUS_' + status.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 200px" [ngModel]="awaitingMe()" (ngModelChange)="awaitingMe.set($event); load()">
        <nz-option [nzValue]="false" [nzLabel]="'PLM.ALL_ORDERS' | translate"></nz-option>
        <nz-option [nzValue]="true" [nzLabel]="'PLM.AWAITING_ME' | translate"></nz-option>
      </nz-select>
      <span class="spacer"></span>
      <button nz-button type="button" [nzType]="viewMode() === 'table' ? 'primary' : 'default'" (click)="viewMode.set('table')">
        {{ 'PLM.VIEW_TABLE' | translate }}
      </button>
      <button nz-button type="button" [nzType]="viewMode() === 'kanban' ? 'primary' : 'default'" (click)="viewMode.set('kanban')">
        {{ 'PLM.VIEW_KANBAN' | translate }}
      </button>
    </div>

    @if (viewMode() === 'kanban') {
      <div class="kanban-grid" data-testid="plm-kanban">
        @for (stage of kanbanStages; track stage) {
          <div class="kanban-col">
            <h4>{{ ('PLM.STAGE_' + stage.toUpperCase()) | translate }} ({{ byStage()[stage].length }})</h4>
            @for (order of byStage()[stage]; track order.id) {
              <nz-card class="kanban-card" nzSize="small">
                <div><a [routerLink]="['/plm/change-orders', order.id]"><strong>{{ order.code }}</strong></a></div>
                <div>{{ order.title }}</div>
                <div style="margin-top: 6px">
                  <nz-tag [nzColor]="priorityColor(order.priority)">{{ ('PLM.PRIORITY_' + order.priority.toUpperCase()) | translate }}</nz-tag>
                  @if (order.is_safety_immediate_cutover) {
                    <nz-tag nzColor="red">{{ 'PLM.REASON_QUALITYSAFETYFIX' | translate }}</nz-tag>
                  }
                </div>
              </nz-card>
            }
          </div>
        }
      </div>
    } @else {
      <nz-card class="main-card">
        <nz-table #table [nzData]="orders()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'PLM.CODE' | translate }}</th>
              <th>{{ 'PLM.TITLE' | translate }}</th>
              <th>{{ 'PLM.CHANGE_TYPE' | translate }}</th>
              <th>{{ 'PLM.PRIORITY' | translate }}</th>
              <th>{{ 'PLM.STATUS' | translate }}</th>
              <th class="num">{{ 'PLM.AFFECTED' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.id) {
              <tr>
                <td>
                  <a [routerLink]="['/plm/change-orders', row.id]">{{ row.code }}</a>
                </td>
                <td>{{ row.title }}</td>
                <td>{{ ('PLM.TYPE_' + row.change_type.toUpperCase()) | translate }}</td>
                <td>
                  <nz-tag [nzColor]="priorityColor(row.priority)">{{ ('PLM.PRIORITY_' + row.priority.toUpperCase()) | translate }}</nz-tag>
                </td>
                <td>
                  <nz-tag [nzColor]="statusColor(row.status)">{{ ('PLM.STATUS_' + row.status.toUpperCase()) | translate }}</nz-tag>
                </td>
                <td class="num">{{ (row.affected_items?.length ?? 0) + (row.affected_boms?.length ?? 0) }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (!loading() && orders().length === 0) {
          <nz-empty [nzNotFoundContent]="'PLM.NO_ORDERS' | translate"></nz-empty>
        }
      </nz-card>
    }

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="'PLM.NEW_ORDER' | translate" nzWidth="760px" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="eco-code">{{ 'PLM.CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="eco-code" formControlName="code" maxlength="40" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="eco-title">{{ 'PLM.TITLE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="eco-title" formControlName="title" maxlength="160" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'PLM.CHANGE_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="change_type">
                  @for (type of types; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="('PLM.TYPE_' + type.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PLM.PRIORITY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="priority">
                  @for (priority of priorities; track priority) {
                    <nz-option [nzValue]="priority" [nzLabel]="('PLM.PRIORITY_' + priority.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="eco-effective">{{ 'PLM.EFFECTIVE_DATE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="eco-effective" type="date" formControlName="effective_date" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'PLM.CHANGE_REASON' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="change_reason">
                  @for (reason of reasons; track reason) {
                    <nz-option [nzValue]="reason" [nzLabel]="('PLM.REASON_' + reason.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PLM.DISPOSITION_RULE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="existing_stock_disposition_rule">
                  @for (rule of dispositions; track rule) {
                    <nz-option [nzValue]="rule" [nzLabel]="('PLM.DISP_' + rule.toUpperCase()) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="eco-reason">{{ 'PLM.REASON' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="eco-reason" rows="3" formControlName="reason" maxlength="5000"></textarea></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PLM.APPROVERS' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'PLM.APPROVERS_HINT' | translate">
              <nz-select formControlName="approvers" nzMode="multiple" nzShowSearch>
                @for (user of users(); track user.id) {
                  <nz-option [nzValue]="user.id" [nzLabel]="user.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label>{{ 'PLM.AFFECTED_ITEM' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="item_id" nzAllowClear nzShowSearch>
                  @for (item of items(); track item.id) {
                    <nz-option [nzValue]="item.id" [nzLabel]="item.label"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="eco-revision">{{ 'PLM.TO_REVISION' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="eco-revision" formControlName="to_revision" maxlength="20" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'PLM.AFFECTED_BOMS' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="bom_ids" nzMode="multiple" nzShowSearch>
                @for (bom of boms(); track bom.id) {
                  <nz-option [nzValue]="bom.id" [nzLabel]="bom.label"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class PlmChangeOrdersComponent implements OnInit {
  private readonly api = inject(PlmApiService);
  private readonly settings = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly statuses = PLM_CHANGE_STATUSES;
  readonly types = PLM_CHANGE_TYPES;
  readonly priorities = PLM_PRIORITIES;
  readonly reasons = PLM_CHANGE_REASONS;
  readonly dispositions = PLM_STOCK_DISPOSITION_RULES;
  readonly kanbanStages = KANBAN_STAGES;

  readonly viewMode = signal<'table' | 'kanban'>('table');
  readonly orders = signal<PlmChangeOrder[]>([]);
  readonly users = signal<PlmOption[]>([]);
  readonly items = signal<PlmOption[]>([]);
  readonly boms = signal<PlmOption[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly statusFilter = signal<PlmChangeStatus | null>(null);
  readonly awaitingMe = signal(false);

  readonly byStage = computed<Record<PlmEcoWorkflowStage, PlmChangeOrder[]>>(() => {
    const grouped: Record<PlmEcoWorkflowStage, PlmChangeOrder[]> = {
      Draft: [],
      EcrSubmitted: [],
      UnderEvaluation: [],
      EcoApproved: [],
      EcnReleased: [],
      Closed: [],
      Rejected: [],
      Cancelled: [],
    };
    for (const order of this.orders()) {
      const stage = order.workflow_stage ?? 'Draft';
      (grouped[stage] ?? grouped.Draft).push(order);
    }
    return grouped;
  });

  readonly form = this.fb.group({
    code: ['', [Validators.required]],
    title: ['', [Validators.required]],
    reason: ['', [Validators.required]],
    change_type: ['design' as PlmChangeType],
    priority: ['normal' as PlmPriority],
    change_reason: ['CostReduction' as PlmChangeReason],
    existing_stock_disposition_rule: ['UseUp_EsaurimentoScorte' as PlmStockDispositionRule],
    effective_date: [''],
    approvers: this.fb.control<string[]>([]),
    item_id: this.fb.control<string | null>(null),
    to_revision: [''],
    bom_ids: this.fb.control<string[]>([]),
  });

  ngOnInit(): void {
    this.load();
    this.settings
      .getTenantUsers()
      .pipe(catchError(() => of({ data: [] })))
      .subscribe((response) => this.users.set(response.data.map((user) => ({ id: user.id, label: `${user.name} (${user.email})` }))));
    this.api
      .getItemOptions()
      .pipe(catchError(() => of([])))
      .subscribe((items) => this.items.set(items));
    this.api
      .getBomOptions()
      .pipe(catchError(() => of([])))
      .subscribe((boms) => this.boms.set(boms));
  }

  load(): void {
    this.loading.set(true);
    this.api.getChangeOrders({ status: this.statusFilter() ?? undefined, awaiting_me: this.awaitingMe() || undefined, per_page: 100 }).subscribe({
      next: (response) => {
        this.orders.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('PLM.ACTION_ERROR'));
      },
    });
  }

  statusColor(status: string): string {
    return CHANGE_STATUS_COLORS[status] ?? 'default';
  }

  priorityColor(priority: string): string {
    return PRIORITY_COLORS[priority] ?? 'default';
  }

  openModal(): void {
    this.form.reset({
      code: '',
      title: '',
      reason: '',
      change_type: 'design',
      priority: 'normal',
      change_reason: 'CostReduction',
      existing_stock_disposition_rule: 'UseUp_EsaurimentoScorte',
      effective_date: '',
      approvers: [],
      item_id: null,
      to_revision: '',
      bom_ids: [],
    });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: PlmChangeOrderRequest = {
      code: value.code,
      title: value.title,
      reason: value.reason,
      change_type: value.change_type,
      priority: value.priority,
      effective_date: blankToNull(value.effective_date),
      approvers: value.approvers,
      affected_items: value.item_id && value.to_revision.trim() !== '' ? [{ mfg_item_id: value.item_id, to_revision: value.to_revision.trim() }] : [],
      affected_boms: value.bom_ids.map((bomId) => ({ bom_id: bomId })),
    };

    if (value.change_reason !== 'CostReduction') {
      payload.change_reason = value.change_reason;
    }
    if (value.existing_stock_disposition_rule !== 'UseUp_EsaurimentoScorte') {
      payload.existing_stock_disposition_rule = value.existing_stock_disposition_rule;
    }

    this.api.createChangeOrder(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('PLM.ORDER_SAVED'));
        this.modalVisible.set(false);
        this.load();
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLM.ACTION_ERROR')),
    });
  }
}
