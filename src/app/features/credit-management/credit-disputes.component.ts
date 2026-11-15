import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CreditDispute, CreditDisputeStatus, CreditManagementApiService, CrmApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, CreditCustomerOption, loadCustomers, statusColor } from './credit.util';

/** Invoice disputes of the customers, filtered by status and customer; they are handled on their collection case. */
@Component({
  selector: 'app-credit-disputes',
  styleUrl: './credit-management.scss',
  imports: [DecimalPipe, FormsModule, RouterLink, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'CREDIT.DISPUTES_TITLE' | translate" [subtitle]="'CREDIT.DISPUTES_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="status()" (ngModelChange)="status.set($event); changeFilter()" [nzPlaceHolder]="'CREDIT.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="('CREDIT.DISPUTE_' + value.toUpperCase()) | translate"></nz-option>
        }
      </nz-select>
      <nz-select style="width: 280px" nzAllowClear nzShowSearch [ngModel]="customerId()" (ngModelChange)="customerId.set($event); changeFilter()" [nzPlaceHolder]="'CREDIT.CUSTOMER' | translate">
        @for (customer of customers(); track customer.id) {
          <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table
        #table
        [nzData]="disputes()"
        [nzLoading]="loading()"
        nzSize="small"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize"
        (nzPageIndexChange)="changePage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'CREDIT.OPENED_ON' | translate }}</th>
            <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
            <th>{{ 'CREDIT.REASON' | translate }}</th>
            <th class="num">{{ 'CREDIT.DISPUTED_AMOUNT' | translate }}</th>
            <th class="num">{{ 'CREDIT.CREDITED_AMOUNT' | translate }}</th>
            <th>{{ 'CREDIT.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.opened_on }}</td>
              <td>{{ row.customer_name ?? '-' }}</td>
              <td>{{ ('CREDIT.REASON_' + row.reason_code.toUpperCase()) | translate }}</td>
              <td class="num">{{ +row.disputed_amount | number: '1.2-2' }}</td>
              <td class="num">{{ row.credited_amount === null ? '-' : (+row.credited_amount | number: '1.2-2') }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ ('CREDIT.DISPUTE_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
              <td>
                @if (row.case_id) {
                  <a [routerLink]="['/credit-management/cases', row.case_id]">{{ 'CREDIT.OPEN_CASE' | translate }}</a>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && disputes().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_DISPUTES' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class CreditDisputesComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly statuses: readonly CreditDisputeStatus[] = ['open', 'under_review', 'upheld', 'rejected'];
  readonly pageSize = 25;
  readonly disputes = signal<CreditDispute[]>([]);
  readonly customers = signal<CreditCustomerOption[]>([]);
  readonly status = signal<CreditDisputeStatus | null>(null);
  readonly customerId = signal<string | null>(null);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
    loadCustomers(this.crm).subscribe((customers) => this.customers.set(customers));
  }

  color(status: string): string {
    return statusColor(status);
  }

  changeFilter(): void {
    this.page.set(1);
    this.load();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getDisputes({ status: this.status() ?? undefined, customer_id: this.customerId() ?? undefined, page: this.page(), per_page: this.pageSize }).subscribe({
      next: (response) => {
        this.disputes.set(response.data);
        this.total.set(response.meta?.total ?? response.data.length);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }
}
