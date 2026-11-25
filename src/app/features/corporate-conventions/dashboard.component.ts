import { Component, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CcvRoiRow, TranslateService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { DashboardStore } from './dashboard.store';
import {
  conventionStatusColor,
  shareOf,
  toDateString,
  toNumber,
} from './corporate-conventions.util';

/**
 * ROI dashboard of the commercial director: KPI cards, the revenue and margin of every convention as bars, and the table with
 * enrolment, conversion, discount, employer quota and net margin, exportable to CSV (Excel opens it).
 */
@Component({
  selector: 'app-ccv-dashboard',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [DashboardStore],
  styleUrl: './corporate-conventions.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.CORPORATE_CONVENTIONS_DASHBOARD' | translate">
      <button
        header-actions
        nz-button
        type="button"
        [nzLoading]="store.exporting()"
        (click)="exportCsv()"
      >
        {{ 'corporateConventions.action.exportCsv' | translate }}
      </button>
    </app-page-header>

    <div class="toolbar">
      <label class="field" for="ccv-d-currency">
        <span>{{ 'corporateConventions.field.currency' | translate }}</span>
        <nz-select
          nzId="ccv-d-currency"
          [ngModel]="store.currency()"
          (ngModelChange)="store.setFilters({ currency: $event })"
        >
          <nz-option nzValue="EUR" nzLabel="EUR"></nz-option>
          <nz-option nzValue="CHF" nzLabel="CHF"></nz-option>
        </nz-select>
      </label>
      <label class="field" for="ccv-d-country">
        <span>{{ 'corporateConventions.field.country' | translate }}</span>
        <nz-select
          nzId="ccv-d-country"
          nzAllowClear
          [ngModel]="store.filters().country_code || null"
          (ngModelChange)="store.setFilters({ country_code: $event ?? '' })"
        >
          <nz-option nzValue="IT" nzLabel="IT"></nz-option>
          <nz-option nzValue="CH" nzLabel="CH"></nz-option>
        </nz-select>
      </label>
      <label class="field" for="ccv-d-range">
        <span>{{ 'corporateConventions.field.period' | translate }}</span>
        <nz-range-picker
          nzId="ccv-d-range"
          [ngModel]="[]"
          (ngModelChange)="onRange($event)"
        ></nz-range-picker>
      </label>
    </div>

    @if (store.error(); as key) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="form-alert"
        [nzMessage]="key | translate"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.kpis(); as kpis) {
        <div class="kpi-grid">
          <nz-card>
            <nz-statistic
              [nzValue]="kpis.active_conventions"
              [nzTitle]="'corporateConventions.kpi.activeConventions' | translate"
            ></nz-statistic>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzValue]="kpis.enrolled_employees"
              [nzTitle]="'corporateConventions.kpi.enrolledEmployees' | translate"
            ></nz-statistic>
            <small class="muted"
              >+ {{ kpis.enrolled_family_members }}
              {{ 'corporateConventions.label.family' | translate }}</small
            >
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzValue]="kpis.gross_revenue | money: store.currency()"
              [nzTitle]="'corporateConventions.kpi.grossRevenue' | translate"
            ></nz-statistic>
            <small class="muted"
              >{{ 'corporateConventions.kpi.netRevenue' | translate }}:
              {{ kpis.net_revenue | money: store.currency() }}</small
            >
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzValue]="kpis.average_discount_percentage + ' %'"
              [nzTitle]="'corporateConventions.kpi.averageDiscount' | translate"
            ></nz-statistic>
            <small class="muted">{{ kpis.discount_granted | money: store.currency() }}</small>
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzValue]="kpis.net_margin | money: store.currency()"
              [nzTitle]="'corporateConventions.kpi.netMargin' | translate"
            ></nz-statistic>
            <small class="muted"
              >{{ 'corporateConventions.kpi.employerBilled' | translate }}:
              {{ kpis.employer_subsidy_billed | money: store.currency() }}</small
            >
          </nz-card>
          <nz-card>
            <nz-statistic
              [nzValue]="kpis.pending_split_billing_amount | money: store.currency()"
              [nzTitle]="'corporateConventions.kpi.pendingSplitBilling' | translate"
            ></nz-statistic>
            <small class="muted">
              {{ 'corporateConventions.kpi.pendingWelfare' | translate }}:
              {{ kpis.pending_welfare_vouchers }} ·
              {{ kpis.pending_welfare_amount | money: store.currency() }}
            </small>
          </nz-card>
        </div>

        <h3>{{ 'corporateConventions.section.roiByConvention' | translate }}</h3>
        @if (store.rows().length === 0) {
          <nz-empty [nzNotFoundContent]="'corporateConventions.empty.roi' | translate"></nz-empty>
        } @else {
          <div class="bars" role="list">
            @for (row of store.byMargin(); track row.convention_id) {
              <div class="bar-row" role="listitem">
                <span class="bar-label">{{ row.name }}</span>
                <span class="bar-track" aria-hidden="true">
                  <span class="bar revenue" [style.width.%]="share(row.net_revenue)"></span>
                  <span
                    class="bar margin"
                    [class.negative]="isNegative(row)"
                    [style.width.%]="share(absolute(row.net_margin))"
                  ></span>
                </span>
                <span class="bar-value">{{ row.net_margin | money: store.currency() }}</span>
              </div>
            }
          </div>
          <p class="legend">
            <span class="swatch revenue"></span>
            {{ 'corporateConventions.kpi.netRevenue' | translate }}
            <span class="swatch margin"></span>
            {{ 'corporateConventions.kpi.netMargin' | translate }}
          </p>

          <nz-table
            #table
            nzSize="small"
            [nzData]="store.rows()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '1200px' }"
          >
            <thead>
              <tr>
                <th>{{ 'corporateConventions.column.convention' | translate }}</th>
                <th>{{ 'corporateConventions.column.status' | translate }}</th>
                <th>{{ 'corporateConventions.column.enrolled' | translate }}</th>
                <th>{{ 'corporateConventions.column.conversion' | translate }}</th>
                <th>{{ 'corporateConventions.column.transactions' | translate }}</th>
                <th>{{ 'corporateConventions.column.grossRevenue' | translate }}</th>
                <th>{{ 'corporateConventions.column.discount' | translate }}</th>
                <th>{{ 'corporateConventions.column.employerBilled' | translate }}</th>
                <th>{{ 'corporateConventions.column.employerPending' | translate }}</th>
                <th>{{ 'corporateConventions.column.welfareFees' | translate }}</th>
                <th>{{ 'corporateConventions.column.netMargin' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of table.data; track row.convention_id) {
                <tr>
                  <td>
                    <strong>{{ row.name }}</strong>
                    <div class="muted">{{ row.partner_company_name }}</div>
                  </td>
                  <td>
                    <nz-tag [nzColor]="statusColor(row)">{{
                      'corporateConventions.status.' + row.status | translate
                    }}</nz-tag>
                  </td>
                  <td>{{ row.enrolled_employees }} + {{ row.enrolled_family_members }}</td>
                  <td>{{ row.conversion_rate === null ? '–' : row.conversion_rate + ' %' }}</td>
                  <td>{{ row.transactions }}</td>
                  <td>{{ row.gross_revenue | money: store.currency() }}</td>
                  <td>
                    {{ row.discount_granted | money: store.currency() }}
                    <span class="muted">({{ row.average_discount_percentage }} %)</span>
                  </td>
                  <td>{{ row.employer_subsidy_billed | money: store.currency() }}</td>
                  <td>{{ row.employer_subsidy_pending | money: store.currency() }}</td>
                  <td>{{ row.welfare_fees | money: store.currency() }}</td>
                  <td [class.negative-text]="isNegative(row)">
                    {{ row.net_margin | money: store.currency() }}
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      }
    </nz-spin>
  `,
})
export class DashboardComponent implements OnInit {
  protected readonly store = inject(DashboardStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly statusColor = (row: CcvRoiRow): string => conventionStatusColor(row.status);

  ngOnInit(): void {
    void this.store.init();
  }

  protected share(value: string | number): number {
    return shareOf(value, this.store.maxNetRevenue());
  }

  protected absolute(value: string): number {
    return Math.abs(toNumber(value));
  }

  protected isNegative(row: CcvRoiRow): boolean {
    return toNumber(row.net_margin) < 0;
  }

  protected onRange(range: Date[] | null): void {
    const [from, to] = range ?? [];
    void this.store.setFilters({
      from: from ? toDateString(from) : undefined,
      to: to ? toDateString(to) : undefined,
    });
  }

  protected async exportCsv(): Promise<void> {
    const outcome = await this.store.exportCsv();
    if (outcome.ok) {
      this.message.success(this.i18n.instant('corporateConventions.notification.exported'));
    } else {
      this.message.error(
        this.i18n.instant(outcome.errorKey ?? 'corporateConventions.error.generic'),
      );
    }
  }
}
