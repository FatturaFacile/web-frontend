import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  EnterpriseAuthApiService,
  I18nService,
  ScimLogStatus,
  ScimOperation,
  ScimProvisioningLog,
  ScimResource,
} from '@core';
import { TranslatePipe } from '@shared';
import { enterpriseErrorText } from './enterprise-security.util';

const RESOURCES: readonly ScimResource[] = ['user', 'group'];
const OPERATIONS: readonly ScimOperation[] = ['create', 'replace', 'patch', 'delete'];
const STATUSES: readonly ScimLogStatus[] = ['success', 'failure'];

/** Provisioning log of the identity provider: every SCIM operation, filterable, with server side pagination. */
@Component({
  selector: 'app-scim-logs',
  imports: [DatePipe, FormsModule, NzAlertModule, NzCardModule, NzSelectModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <nz-card [nzTitle]="'security.scim.groups.logs.title' | translate" class="block">
      <div class="filters">
        <nz-select
          class="filter"
          nzAllowClear
          data-testid="logs-filter-resource"
          [nzPlaceHolder]="'security.scim.groups.logs.resource' | translate"
          [ngModel]="resource()"
          (ngModelChange)="onFilter('resource', $event)"
        >
          @for (item of resources; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'security.scim.groups.logs.resource_' + item | translate"></nz-option>
          }
        </nz-select>
        <nz-select
          class="filter"
          nzAllowClear
          data-testid="logs-filter-operation"
          [nzPlaceHolder]="'security.scim.groups.logs.operation' | translate"
          [ngModel]="operation()"
          (ngModelChange)="onFilter('operation', $event)"
        >
          @for (item of operations; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'security.scim.groups.logs.operation_' + item | translate"></nz-option>
          }
        </nz-select>
        <nz-select
          class="filter"
          nzAllowClear
          data-testid="logs-filter-status"
          [nzPlaceHolder]="'security.scim.groups.logs.status' | translate"
          [ngModel]="status()"
          (ngModelChange)="onFilter('status', $event)"
        >
          @for (item of statuses; track item) {
            <nz-option [nzValue]="item" [nzLabel]="'security.scim.groups.logs.status_' + item | translate"></nz-option>
          }
        </nz-select>
      </div>

      @if (errorText(); as text) {
        <nz-alert class="gap" nzType="error" nzShowIcon [nzMessage]="text" data-testid="logs-error" />
      }

      <nz-table
        [nzData]="logs()"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="perPage()"
        (nzPageIndexChange)="onPage($event)"
        (nzPageSizeChange)="onPageSize($event)"
        nzShowSizeChanger
        nzSize="small"
      >
        <thead>
          <tr>
            <th>{{ 'security.scim.groups.logs.time' | translate }}</th>
            <th>{{ 'security.scim.groups.logs.resource' | translate }}</th>
            <th>{{ 'security.scim.groups.logs.operation' | translate }}</th>
            <th>{{ 'security.scim.groups.logs.name' | translate }}</th>
            <th>{{ 'security.scim.groups.logs.status' | translate }}</th>
            <th>{{ 'security.scim.groups.logs.error' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (log of logs(); track log.id) {
            <tr data-testid="scim-log-row">
              <td>{{ log.occurred_at | date: 'dd/MM/yyyy HH:mm:ss' }}</td>
              <td>{{ 'security.scim.groups.logs.resource_' + log.resource | translate }}</td>
              <td>{{ 'security.scim.groups.logs.operation_' + log.operation | translate }}</td>
              <td>{{ log.resource_name || log.resource_id || '-' }}</td>
              <td>
                <nz-tag [nzColor]="log.status === 'success' ? 'green' : 'red'">{{ 'security.scim.groups.logs.status_' + log.status | translate }}</nz-tag>
              </td>
              <td>{{ log.error || '-' }}</td>
            </tr>
          } @empty {
            @if (!loading()) {
              <tr>
                <td colspan="6" class="muted" data-testid="scim-logs-empty">{{ 'security.scim.groups.logs.empty' | translate }}</td>
              </tr>
            }
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    .block { display: block; margin-top: 16px; }
    .filters { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 16px; }
    .filter { width: 200px; }
    .gap { display: block; margin-bottom: 16px; }
    .muted { color: var(--text-secondary); text-align: center; }
  `,
})
export class ScimLogsComponent implements OnInit {
  private readonly api = inject(EnterpriseAuthApiService);
  private readonly i18n = inject(I18nService);

  protected readonly resources = RESOURCES;
  protected readonly operations = OPERATIONS;
  protected readonly statuses = STATUSES;

  protected readonly logs = signal<ScimProvisioningLog[]>([]);
  protected readonly loading = signal(false);
  protected readonly errorText = signal<string | null>(null);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly perPage = signal(10);
  protected readonly resource = signal<ScimResource | null>(null);
  protected readonly operation = signal<ScimOperation | null>(null);
  protected readonly status = signal<ScimLogStatus | null>(null);

  ngOnInit(): void {
    this.load();
  }

  protected onFilter(field: 'resource' | 'operation' | 'status', value: string | null): void {
    if (field === 'resource') {
      this.resource.set((value as ScimResource | null) ?? null);
    } else if (field === 'operation') {
      this.operation.set((value as ScimOperation | null) ?? null);
    } else {
      this.status.set((value as ScimLogStatus | null) ?? null);
    }
    this.page.set(1);
    this.load();
  }

  protected onPage(page: number): void {
    this.page.set(page);
    this.load();
  }

  protected onPageSize(size: number): void {
    this.perPage.set(size);
    this.page.set(1);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.errorText.set(null);
    this.api
      .getScimLogs({
        resource: this.resource() ?? undefined,
        operation: this.operation() ?? undefined,
        status: this.status() ?? undefined,
        page: this.page(),
        per_page: this.perPage(),
      })
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.logs.set(res.data ?? []);
          this.total.set(res.meta?.total ?? 0);
        },
        error: (err: unknown) => {
          this.loading.set(false);
          this.errorText.set(enterpriseErrorText(err) ?? this.i18n.translate('security.scim.groups.logs.load_error'));
        },
      });
  }
}
