import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminApiService,
  FetchGridModel,
  I18nService,
  QueryFilterParams,
  TenantAccessRequestRecord,
  TenantAccessRequestStatus,
} from '@core';
import { BaseTableComponent, ModalActionsDirective, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable, tap } from 'rxjs';
import {
  ActionFormComponent,
  ActionFormConfig,
} from '../../../hr/shared/action-form/action-form.component';
import { CrudField } from '../../../hr/shared/crud/crud.types';
import { reportHttpError } from '../../../hr/shared/hr-http.util';

type Decision = 'approve' | 'move' | 'reject';

interface AccessRequestFilter extends QueryFilterParams {
  status?: TenantAccessRequestStatus | null;
}

const ROLES = [
  'owner',
  'admin',
  'accountant',
  'accountant_readonly',
  'secretary',
  'customs',
  'childcare_manager',
  'educator',
  'receptionist',
  'technician',
  'member',
];
const STATUSES: TenantAccessRequestStatus[] = ['pending', 'approved', 'rejected'];

/** Platform administration: requests of users to join an existing company (approve, move to another company, reject) and the document quota. */
@Component({
  selector: 'app-access-requests',
  styleUrl: './access-requests.component.scss',
  imports: [
    BaseTableComponent,
    ActionFormComponent,
    DatePipe,
    FormsModule,
    ModalActionsDirective,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzModalModule,
    NzSelectModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'adminAccess.title' | translate"
      [subtitle]="'adminAccess.subtitle' | translate"
    />
    <nz-alert
      nzType="info"
      nzShowIcon
      class="mb-3"
      [nzMessage]="'adminAccess.platformOnly' | translate"
    />
    <nz-card [nzTitle]="'adminAccess.requests' | translate" class="mb-3">
      <div class="mb-3">
        <label for="ar-status">{{ 'hrmCommon.statusCol' | translate }}</label>
        <nz-select
          id="ar-status"
          class="w-field-sm"
          nzAllowClear
          [ngModel]="status()"
          (ngModelChange)="setStatus($event)"
        >
          @for (value of statuses; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'adminAccess.statuses.' + value | translate" />
          }
        </nz-select>
      </div>
      <app-base-table [grid]="grid" [columns]="columns()" [actionsTemplate]="actionsTpl" [exportFileName]="'access-requests'" />

      <ng-template #userTpl let-row>
        {{ row.user.name }}<br /><span class="text-xs">{{ row.user.email }}</span>
      </ng-template>
      <ng-template #statusTpl let-row>
        <nz-tag [nzColor]="statusColor(row.status)">{{ 'adminAccess.statuses.' + row.status | translate }}</nz-tag>
        @if (row.rejection_reason) {
          <div class="text-xs">{{ row.rejection_reason }}</div>
        }
      </ng-template>
      <ng-template #createdTpl let-row>{{ row.created_at | date: 'medium' }}</ng-template>
      <ng-template #actionsTpl let-row>
        @if (row.status === 'pending') {
          <button
            nz-button
            nzType="primary"
            nzSize="small"
            type="button"
            (click)="open(row, 'approve')"
          >
            {{ 'adminAccess.approve' | translate }}
          </button>
          <button nz-button nzSize="small" type="button" (click)="open(row, 'move')">
            {{ 'adminAccess.move' | translate }}
          </button>
          <button
            nz-button
            nzDanger
            nzSize="small"
            type="button"
            (click)="open(row, 'reject')"
          >
            {{ 'adminAccess.reject' | translate }}
          </button>
        }
      </ng-template>
    </nz-card>

    <nz-card [nzTitle]="'adminAccess.quotaTitle' | translate">
      <p>{{ 'adminAccess.quotaHint' | translate }}</p>
      <app-action-form [config]="quotaConfig" />
    </nz-card>

    <nz-modal
      [nzVisible]="decision() !== null"
      [nzTitle]="decisionTitle()"
      [nzFooter]="null"
      (nzOnCancel)="decision.set(null)"
    >
      <ng-container *nzModalContent>
        <p>{{ selected()?.requested_company_name }} &middot; {{ selected()?.user?.email }}</p>
        <app-action-form [config]="decisionConfig()" />
      </ng-container>
    </nz-modal>
  `,
})
export class AccessRequestsComponent {
  private readonly api = inject(AdminApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly statuses = STATUSES;
  protected readonly grid = new FetchGridModel<TenantAccessRequestRecord, AccessRequestFilter>((query) =>
    this.api.getTenantAccessRequests(query).pipe(
      tap({ error: (err: unknown) => reportHttpError(err, this.message, this.i18n) }),
    ),
  );
  protected readonly status = signal<TenantAccessRequestStatus | null>('pending');
  protected readonly selected = signal<TenantAccessRequestRecord | null>(null);
  protected readonly decision = signal<Decision | null>(null);
  protected readonly decisionTitle = computed(() =>
    this.i18n.translate(`adminAccess.${this.decision() ?? 'approve'}Title`),
  );

  private readonly roleField: CrudField = {
    key: 'role',
    labelKey: 'adminAccess.role',
    type: 'select',
    nullable: true,
    options: () => ROLES.map((value) => ({ value, labelKey: `adminAccess.roles.${value}` })),
  };

  protected readonly decisionConfig = computed<ActionFormConfig>(() => {
    const request = this.selected();
    const decision = this.decision() ?? 'approve';
    const id = request?.id ?? '';
    const fields: Record<Decision, CrudField[]> = {
      approve: [this.roleField],
      move: [
        {
          key: 'tenant_id',
          labelKey: 'adminAccess.targetTenant',
          type: 'text',
          required: true,
          maxLength: 36,
        },
        this.roleField,
      ],
      reject: [
        {
          key: 'reason',
          labelKey: 'hrmCommon.reason',
          type: 'textarea',
          nullable: true,
          maxLength: 500,
        },
      ],
    };
    return {
      submitLabelKey: `adminAccess.${decision}`,
      successKey: `adminAccess.${decision}Done`,
      fields: fields[decision],
      submit: (payload) => this.decide(decision, id, payload),
    };
  });

  protected readonly quotaConfig: ActionFormConfig = {
    submitLabelKey: 'adminAccess.saveQuota',
    successKey: 'adminAccess.quotaSaved',
    fields: [
      {
        key: 'tenant_id',
        labelKey: 'adminAccess.targetTenant',
        type: 'text',
        required: true,
        maxLength: 36,
      },
      {
        key: 'document_quota_points',
        labelKey: 'adminAccess.quotaPoints',
        type: 'integer',
        nullable: true,
      },
    ],
    submit: (payload) =>
      this.api.setDocumentQuota(
        String(payload['tenant_id']),
        (payload['document_quota_points'] as number | null) ?? null,
      ),
  };

  private readonly userTpl = viewChild<TemplateRef<{ $implicit: TenantAccessRequestRecord; value: unknown }>>('userTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: TenantAccessRequestRecord; value: unknown }>>('statusTpl');
  private readonly createdTpl = viewChild<TemplateRef<{ $implicit: TenantAccessRequestRecord; value: unknown }>>('createdTpl');

  protected readonly columns = computed<TableColumnDef<TenantAccessRequestRecord>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'requested_company_name', header: 'adminAccess.company' },
      { key: 'requested_tax_id', header: 'adminAccess.taxId' },
      { key: 'requested_country', header: 'adminAccess.country' },
      {
        key: 'user',
        serverKey: 'user.name',
        header: 'adminAccess.user',
        valueGetter: (row) => row.user?.name,
        customCellTemplate: this.userTpl(),
      },
      {
        key: 'status',
        header: 'hrmCommon.statusCol',
        filterable: false,
        groupable: false,
        valueLabel: (value) => this.i18n.translate('adminAccess.statuses.' + value),
        customCellTemplate: this.statusTpl(),
      },
      { key: 'created_at', header: 'adminAccess.createdAt', customCellTemplate: this.createdTpl() },
    ];
  });

  constructor() {
    this.grid.setPageSize(20);
    this.grid.setFilter({ status: this.status() });
  }

  protected statusColor(status: string): string {
    return status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'orange';
  }

  protected setStatus(status: TenantAccessRequestStatus | null): void {
    this.status.set(status);
    this.grid.setFilter({ status });
  }

  protected open(request: TenantAccessRequestRecord, decision: Decision): void {
    this.selected.set(request);
    this.decision.set(decision);
  }

  private decide(
    decision: Decision,
    id: string,
    payload: Record<string, unknown>,
  ): Observable<unknown> {
    const body = payload as { role?: string | null; tenant_id?: string; reason?: string | null };
    const request =
      decision === 'approve'
        ? this.api.approveTenantAccessRequest(id, { role: body.role })
        : decision === 'move'
          ? this.api.moveTenantAccessRequest(id, { tenant_id: body.tenant_id, role: body.role })
          : this.api.rejectTenantAccessRequest(id, { reason: body.reason });
    return request.pipe(
      tap(() => {
        this.decision.set(null);
        this.grid.reload();
      }),
    );
  }
}
