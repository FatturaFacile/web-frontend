import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  AdminApiService,
  I18nService,
  TenantAccessRequestRecord,
  TenantAccessRequestStatus,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable, tap } from 'rxjs';
import {
  ActionFormComponent,
  ActionFormConfig,
} from '../../../hr/shared/action-form/action-form.component';
import { CrudField } from '../../../hr/shared/crud/crud.types';
import { reportHttpError } from '../../../hr/shared/hr-http.util';

type Decision = 'approve' | 'move' | 'reject';

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
    ActionFormComponent,
    DatePipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
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
      <nz-table
        #table
        nzSize="middle"
        [nzFrontPagination]="false"
        [nzData]="rows()"
        [nzLoading]="loading()"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize"
        (nzQueryParams)="onQuery($event)"
      >
        <thead>
          <tr>
            <th>{{ 'adminAccess.company' | translate }}</th>
            <th>{{ 'adminAccess.taxId' | translate }}</th>
            <th>{{ 'adminAccess.country' | translate }}</th>
            <th>{{ 'adminAccess.user' | translate }}</th>
            <th>{{ 'hrmCommon.statusCol' | translate }}</th>
            <th>{{ 'adminAccess.createdAt' | translate }}</th>
            <th>{{ 'hrmCommon.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.requested_company_name }}</td>
              <td>{{ row.requested_tax_id }}</td>
              <td>{{ row.requested_country }}</td>
              <td>
                {{ row.user.name }}<br /><span class="text-xs">{{ row.user.email }}</span>
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)">{{
                  'adminAccess.statuses.' + row.status | translate
                }}</nz-tag>
                @if (row.rejection_reason) {
                  <div class="text-xs">{{ row.rejection_reason }}</div>
                }
              </td>
              <td>{{ row.created_at | date: 'medium' }}</td>
              <td>
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
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
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
export class AccessRequestsComponent implements OnInit {
  private readonly api = inject(AdminApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly statuses = STATUSES;
  protected readonly pageSize = 20;
  protected readonly rows = signal<TenantAccessRequestRecord[]>([]);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly status = signal<TenantAccessRequestStatus | null>('pending');
  protected readonly loading = signal(false);
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

  ngOnInit(): void {
    this.load();
  }

  protected statusColor(status: string): string {
    return status === 'approved' ? 'green' : status === 'rejected' ? 'red' : 'orange';
  }

  protected setStatus(status: TenantAccessRequestStatus | null): void {
    this.status.set(status);
    this.page.set(1);
    this.load();
  }

  protected onQuery(params: NzTableQueryParams): void {
    if (params.pageIndex !== this.page()) {
      this.page.set(params.pageIndex);
      this.load();
    }
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
        this.load();
      }),
    );
  }

  private load(): void {
    this.loading.set(true);
    this.api
      .getTenantAccessRequests({
        status: this.status(),
        per_page: this.pageSize,
        page: this.page(),
      })
      .subscribe({
        next: (res) => {
          this.rows.set(res.data);
          this.total.set(res.meta?.total ?? res.data.length);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          reportHttpError(err, this.message, this.i18n);
        },
      });
  }
}
