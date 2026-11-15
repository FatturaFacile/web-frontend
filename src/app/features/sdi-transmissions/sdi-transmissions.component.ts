import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  I18nService,
  PermissionsService,
  SDI_TRANSMISSION_STATUSES,
  SdiTransmission,
  SdiTransmissionsApiService,
  SdiTransmissionStatus,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError } from '../hr/shared/hr-http.util';

const STATUS_COLORS: Record<string, string> = {
  draft: 'default',
  sending: 'processing',
  sent: 'blue',
  delivered: 'success',
  accepted: 'success',
  rejected: 'error',
  not_delivered: 'warning',
  failed: 'error',
};

/** History of the invoices handed to SDI: status, identifier, the last provider error and a retry for a failed transmission. */
@Component({
  selector: 'app-sdi-transmissions',
  imports: [DatePipe, FormsModule, NzButtonModule, NzCardModule, NzEmptyModule, NzInputModule, NzSelectModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  styles: ['.toolbar { display: flex; gap: var(--space-2); margin-bottom: var(--space-3); } .sdi-error { display: block; color: var(--text-secondary); }'],
  template: `
    <app-page-header [title]="'sdiTransmissions.title' | translate" [subtitle]="'sdiTransmissions.subtitle' | translate" />
    <nz-card>
      <div class="toolbar">
        <input nz-input style="width: 240px" [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="reload()" [placeholder]="'sdiTransmissions.search' | translate" [attr.aria-label]="'sdiTransmissions.search' | translate" />
        <nz-select style="width: 220px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); reload()" [nzPlaceHolder]="'sdiTransmissions.allStatuses' | translate" [attr.aria-label]="'sdiTransmissions.status' | translate">
          @for (value of statuses; track value) {
            <nz-option [nzValue]="value" [nzLabel]="'sdiTransmissions.statuses.' + value | translate"></nz-option>
          }
        </nz-select>
        <button nz-button type="button" (click)="reload()">{{ 'sdiTransmissions.refresh' | translate }}</button>
      </div>
      <nz-table #table nzSize="small" [nzFrontPagination]="false" [nzData]="rows()" [nzLoading]="loading()" [nzTotal]="total()" [nzPageIndex]="page()" [nzPageSize]="25" (nzPageIndexChange)="goTo($event)">
        <thead>
          <tr>
            <th>{{ 'sdiTransmissions.invoice' | translate }}</th>
            <th>{{ 'sdiTransmissions.status' | translate }}</th>
            <th>{{ 'sdiTransmissions.identifier' | translate }}</th>
            <th>{{ 'sdiTransmissions.sentAt' | translate }}</th>
            <th>{{ 'sdiTransmissions.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.invoice_number }} <span class="sdi-error">{{ row.file_name }}</span></td>
              <td>
                <nz-tag [nzColor]="color(row.sdi_status)">{{ 'sdiTransmissions.statuses.' + row.sdi_status | translate }}</nz-tag>
                @if (row.last_error) {
                  <span class="sdi-error">{{ row.last_error }}</span>
                }
              </td>
              <td>{{ row.sdi_identifier ?? '-' }}</td>
              <td>{{ row.sent_at ? (row.sent_at | date: 'short') : '-' }}</td>
              <td>
                @if (row.can_retry && canWrite()) {
                  <button nz-button nzSize="small" type="button" (click)="retry(row)">{{ 'sdiTransmissions.retry' | translate }}</button>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'sdiTransmissions.empty' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class SdiTransmissionsComponent implements OnInit {
  private readonly api = inject(SdiTransmissionsApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly statuses = SDI_TRANSMISSION_STATUSES;
  protected readonly rows = signal<SdiTransmission[]>([]);
  protected readonly loading = signal(false);
  protected readonly total = signal(0);
  protected readonly page = signal(1);
  protected readonly status = signal<SdiTransmissionStatus | null>(null);
  protected readonly search = signal('');

  protected canWrite(): boolean {
    return this.permissions.canWrite('invoicing');
  }

  ngOnInit(): void {
    this.reload();
  }

  protected color(status: string): string {
    return STATUS_COLORS[status] ?? 'default';
  }

  reload(): void {
    this.goTo(1);
  }

  goTo(page: number): void {
    this.page.set(page);
    this.loading.set(true);
    this.api.list({ status: this.status() ?? undefined, search: this.search() || undefined, page, per_page: 25 }).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.total.set(response.meta?.total ?? response.data.length);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }

  retry(row: SdiTransmission): void {
    this.api.retry(row.invoice_id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('sdiTransmissions.retried'));
        this.goTo(this.page());
      },
      error: (error: unknown) => {
        reportHttpError(error, this.message, this.i18n);
        this.goTo(this.page());
      },
    });
  }
}
