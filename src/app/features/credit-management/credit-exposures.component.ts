import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CreditExposure, CreditManagementApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './credit.util';

/** Exposure per customer: open invoices and orders against the credit limit and the insured limit. */
@Component({
  selector: 'app-credit-exposures',
  styleUrl: './credit-management.scss',
  imports: [DecimalPipe, FormsModule, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzSwitchModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'CREDIT.EXPOSURES_TITLE' | translate" [subtitle]="'CREDIT.EXPOSURES_SUBTITLE' | translate"></app-page-header>

    <div class="toolbar">
      <label><nz-switch [ngModel]="overLimitOnly()" (ngModelChange)="overLimitOnly.set($event); load()"></nz-switch> {{ 'CREDIT.OVER_LIMIT_ONLY' | translate }}</label>
    </div>

    <nz-card class="main-card">
      <nz-table #table [nzData]="rows()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'CREDIT.CUSTOMER' | translate }}</th>
            <th>{{ 'CREDIT.RATING' | translate }}</th>
            <th class="num">{{ 'CREDIT.CREDIT_LIMIT' | translate }}</th>
            <th class="num">{{ 'CREDIT.OPEN_INVOICES' | translate }}</th>
            <th class="num">{{ 'CREDIT.OPEN_ORDERS' | translate }}</th>
            <th class="num">{{ 'CREDIT.EXPOSURE' | translate }}</th>
            <th class="num">{{ 'CREDIT.UTILISATION' | translate }}</th>
            <th class="num">{{ 'CREDIT.OVERDUE_AMOUNT' | translate }}</th>
            <th class="num">{{ 'CREDIT.INSURED_LIMIT' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.customer_id) {
            <tr>
              <td>{{ row.customer_name }}</td>
              <td>{{ row.rating ?? '-' }}</td>
              <td class="num">{{ +row.credit_limit | number: '1.2-2' }}</td>
              <td class="num">{{ +row.open_invoices | number: '1.2-2' }}</td>
              <td class="num">{{ +row.open_orders | number: '1.2-2' }}</td>
              <td class="num">{{ +row.exposure | number: '1.2-2' }}</td>
              <td class="num">{{ row.utilisation_percent === null ? '-' : (+row.utilisation_percent | number: '1.0-1') + '%' }}</td>
              <td class="num" [class.row-overdue]="+row.overdue_amount > 0">{{ +row.overdue_amount | number: '1.2-2' }}</td>
              <td class="num">{{ +row.insured_limit | number: '1.2-2' }}</td>
              <td>
                @if (row.is_over_limit) {
                  <nz-tag nzColor="red">{{ 'CREDIT.OVER_LIMIT' | translate }}</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'CREDIT.NO_EXPOSURES' | translate"></nz-empty>
      }
    </nz-card>
  `,
})
export class CreditExposuresComponent implements OnInit {
  private readonly api = inject(CreditManagementApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly rows = signal<CreditExposure[]>([]);
  readonly loading = signal(false);
  readonly overLimitOnly = signal(false);

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getExposures(this.overLimitOnly()).subscribe({
      next: (response) => {
        this.rows.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('CREDIT.ACTION_ERROR'));
      },
    });
  }
}
