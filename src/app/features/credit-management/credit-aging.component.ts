import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { CREDIT_AGING_BUCKETS, CreditAging, CreditManagementApiService, CrmApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, CreditCustomerOption, loadCustomers } from './credit.util';

/** Open receivables by days overdue, in total and per customer. */
@Component({
  selector: 'app-credit-aging',
  styleUrl: './credit-management.scss',
  imports: [DecimalPipe, FormsModule, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzSelectModule, NzTableModule],
  template: `
    <app-page-header [title]="'CREDIT.AGING_TITLE' | translate" [subtitle]="'CREDIT.AGING_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <nz-select style="width: 280px" nzAllowClear nzShowSearch [ngModel]="customerId()" (ngModelChange)="customerId.set($event); load()" [nzPlaceHolder]="'CREDIT.CUSTOMER' | translate">
        @for (customer of customers(); track customer.id) {
          <nz-option [nzValue]="customer.id" [nzLabel]="customer.name"></nz-option>
        }
      </nz-select>
      @if (aging(); as data) {
        <span class="muted">{{ 'CREDIT.AS_OF' | translate }}: {{ data.as_of }}</span>
      }
    </div>

    @if (aging(); as data) {
      <nz-card class="main-card" [nzTitle]="'CREDIT.OVERDUE_BY_BUCKET' | translate">
        <nz-table [nzData]="data.buckets" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.AGING_BUCKET' | translate }}</th>
              <th class="num">{{ 'CREDIT.INVOICES' | translate }}</th>
              <th class="num">{{ 'CREDIT.AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.buckets; track row.key) {
              <tr>
                <td>{{ ('CREDIT.BUCKET_' + row.key.toUpperCase()) | translate }}</td>
                <td class="num">{{ row.invoices_count }}</td>
                <td class="num">{{ +row.amount | number: '1.2-2' }}</td>
              </tr>
            }
            <tr>
              <td><strong>{{ 'CREDIT.TOTAL' | translate }}</strong></td>
              <td></td>
              <td class="num"><strong>{{ +data.total | number: '1.2-2' }}</strong></td>
            </tr>
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'CREDIT.AGING_BY_CUSTOMER' | translate">
        <nz-table #table [nzData]="data.customers" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
              @for (bucket of buckets; track bucket) {
                <th class="num">{{ ('CREDIT.BUCKET_' + bucket.toUpperCase()) | translate }}</th>
              }
              <th class="num">{{ 'CREDIT.TOTAL' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.customer_id) {
              <tr>
                <td>{{ row.customer_name }}</td>
                @for (bucket of buckets; track bucket) {
                  <td class="num">{{ +row.buckets[bucket] | number: '1.2-2' }}</td>
                }
                <td class="num">{{ +row.total | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.customers.length === 0) {
          <nz-empty [nzNotFoundContent]="'CREDIT.NO_DATA' | translate"></nz-empty>
        }
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'CREDIT.NO_DATA' | translate"></nz-empty>
    }
  `,
})
export class CreditAgingComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly crm = inject(CrmApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly buckets = CREDIT_AGING_BUCKETS;
  readonly aging = signal<CreditAging | null>(null);
  readonly customers = signal<CreditCustomerOption[]>([]);
  readonly customerId = signal<string | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.load();
    loadCustomers(this.crm).subscribe((customers) => this.customers.set(customers));
  }

  load(): void {
    this.loading.set(true);
    this.api.getAging(this.customerId() ?? undefined).subscribe({
      next: (response) => {
        this.aging.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }
}
