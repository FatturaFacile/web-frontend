import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { CreditDashboard, CreditManagementApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './credit.util';

/** DSO, receivables, overdue per aging bucket, cases, promises, disputes and the rating distribution. */
@Component({
  selector: 'app-credit-dashboard',
  styleUrl: './credit-management.scss',
  imports: [DecimalPipe, RouterLink, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzStatisticModule, NzTableModule],
  template: `
    <app-page-header [title]="'CREDIT.DASHBOARD_TITLE' | translate" [subtitle]="'CREDIT.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    @if (dashboard(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'CREDIT.DSO' | translate" [nzValue]="data.dso_days ?? '-'"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'CREDIT.RECEIVABLES_TOTAL' | translate" [nzValue]="(+data.receivables_total | number: '1.2-2')!"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'CREDIT.OVERDUE_TOTAL' | translate" [nzValue]="(+data.overdue_total | number: '1.2-2')!"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'CREDIT.OVERDUE_PERCENTAGE' | translate" [nzValue]="(+data.overdue_percentage | number: '1.1-2')! + '%'"></nz-statistic></nz-card>
        <nz-card>
          <a routerLink="/credit-management/cases"><nz-statistic [nzTitle]="'CREDIT.OPEN_CASES' | translate" [nzValue]="data.cases.open_count"></nz-statistic></a>
        </nz-card>
        <nz-card><nz-statistic [nzTitle]="'CREDIT.CUSTOMERS_OVER_LIMIT' | translate" [nzValue]="data.customers_over_limit"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'CREDIT.OPEN_DISPUTES' | translate" [nzValue]="data.disputes.open_count"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'CREDIT.PROMISES_PAST_DUE' | translate" [nzValue]="data.promises.past_due_count"></nz-statistic></nz-card>
        <nz-card>
          <a routerLink="/credit-management/limit-requests"><nz-statistic [nzTitle]="'CREDIT.PENDING_LIMIT_REQUESTS' | translate" [nzValue]="data.pending_limit_requests"></nz-statistic></a>
        </nz-card>
      </div>

      <nz-card class="main-card" [nzTitle]="'CREDIT.OVERDUE_BY_BUCKET' | translate">
        <nz-table [nzData]="data.overdue_by_bucket" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.AGING_BUCKET' | translate }}</th>
              <th class="num">{{ 'CREDIT.INVOICES' | translate }}</th>
              <th class="num">{{ 'CREDIT.AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.overdue_by_bucket; track row.key) {
              <tr>
                <td>{{ ('CREDIT.BUCKET_' + row.key.toUpperCase()) | translate }}</td>
                <td class="num">{{ row.invoices_count }}</td>
                <td class="num">{{ +row.amount | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'CREDIT.TOP_OVERDUE_CUSTOMERS' | translate">
        <nz-table [nzData]="data.top_overdue_customers" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
              <th class="num">{{ 'CREDIT.MAX_DAYS_OVERDUE' | translate }}</th>
              <th class="num">{{ 'CREDIT.OVERDUE_AMOUNT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.top_overdue_customers; track row.customer_id) {
              <tr>
                <td>{{ row.customer_name }}</td>
                <td class="num">{{ row.max_days_overdue }}</td>
                <td class="num">{{ +row.overdue_amount | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'CREDIT.RATING_DISTRIBUTION' | translate">
        <nz-table [nzData]="data.rating_distribution" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'CREDIT.RATING' | translate }}</th>
              <th class="num">{{ 'CREDIT.CUSTOMERS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of data.rating_distribution; track row.rating) {
              <tr>
                <td>{{ row.rating }}</td>
                <td class="num">{{ row.count }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    } @else if (!loading()) {
      <nz-empty [nzNotFoundContent]="'CREDIT.NO_DATA' | translate"></nz-empty>
    }
  `,
})
export class CreditDashboardComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly dashboard = signal<CreditDashboard | null>(null);
  readonly loading = signal(false);

  ngOnInit(): void {
    this.loading.set(true);
    this.api.getDashboard().subscribe({
      next: (response) => {
        this.dashboard.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }
}
