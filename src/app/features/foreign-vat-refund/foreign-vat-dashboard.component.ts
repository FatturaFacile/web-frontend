import { CurrencyPipe, DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { FVR_KPIS, FvrMonitorRow } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { ForeignVatDashboardStore } from './foreign-vat-refund.stores';
import { alertColor, eligibilityColor, mandateColor, progressStatus, toNumber } from './foreign-vat-refund.util';

/**
 * Foreign VAT recovery dashboard: the KPI cards (accumulating, ready to claim, awaiting refund, refunded this year), the priority
 * alert banners 60/30/15 days before the peremptory deadlines and, per country and year, the accumulated recoverable VAT against
 * the minimum thresholds with the reciprocity badge, the countdown to 30 June (ESTV) / 30 September (EU, Pescara) and the state of the mandate.
 */
@Component({
  selector: 'app-foreign-vat-dashboard',
  imports: [
    CurrencyPipe,
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzProgressModule,
    NzSpinModule,
    NzTagModule,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
  ],
  providers: [ForeignVatDashboardStore],
  styleUrl: './foreign-vat-refund.scss',
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.FOREIGN_VAT_DASHBOARD' | translate"
      [subtitle]="'foreignVat.section.monitorSubtitle' | translate"
    ></app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      <div class="kpi-grid">
        @for (kpi of kpis; track kpi) {
          <div class="kpi" [attr.data-test]="'kpi-' + kpi">
            <div class="kpi-title">{{ 'foreignVat.kpi.' + kpi | translate }}</div>
            @for (money of moneyOf(kpi); track money.currency) {
              <div class="kpi-value">{{ num(money.amount) | currency: money.currency }}</div>
            } @empty {
              <div class="kpi-value muted">{{ 0 | currency: 'EUR' }}</div>
            }
          </div>
        }
      </div>

      @for (row of alerts(); track row.country_code + row.fiscal_year) {
        <nz-alert
          class="feedback"
          data-test="deadline-alert"
          nzShowIcon
          [nzType]="row.alert_level === 'EXPIRED' || row.alert_level === 15 ? 'error' : 'warning'"
          [nzMessage]="
            'foreignVat.alert.' + row.alert_level
              | translate
                : {
                    country: ('foreignVat.country.' + row.country_code | translate),
                    year: row.fiscal_year,
                    deadline: row.deadline_date,
                    days: row.days_remaining,
                    amount: row.accumulated_amount,
                    currency: row.currency_code,
                  }
          "
        ></nz-alert>
      }

      <h3 class="section-title">{{ 'foreignVat.section.monitor' | translate }}</h3>

      <div class="monitor-grid">
        @for (row of monitor(); track row.country_code + row.fiscal_year) {
          <nz-card class="monitor-card" [attr.data-test]="'monitor-' + row.country_code + '-' + row.fiscal_year">
            <div class="monitor-head">
              <strong>{{ 'foreignVat.country.' + row.country_code | translate }} · {{ row.fiscal_year }}</strong>
              <nz-tag [nzColor]="reciprocityColor(row)">{{
                (row.has_reciprocity ? 'foreignVat.reciprocity.yes' : 'foreignVat.reciprocity.no') | translate
              }}</nz-tag>
            </div>
            <div class="hint">{{ 'foreignVat.regime.' + row.regime_type | translate }}</div>

            <div class="amount">{{ num(row.accumulated_amount) | currency: row.currency_code }}</div>
            @if (row.threshold_annual !== null) {
              <nz-progress
                [nzPercent]="num(row.progress_percent)"
                [nzStatus]="status(row)"
                [nzFormat]="noFormat"
              ></nz-progress>
              <div class="hint">
                {{ 'foreignVat.monitor.threshold' | translate }}:
                {{ num(row.threshold_annual) | currency: row.currency_code }}
                <nz-tag [nzColor]="eligibility(row)">{{ 'foreignVat.eligibility.' + row.eligibility_status | translate }}</nz-tag>
              </div>
            }

            @if (row.quarters.length > 0) {
              <div class="quarters">
                @for (quarter of row.quarters; track quarter.quarter) {
                  <div class="quarter" [attr.data-test]="'quarter-' + quarter.quarter">
                    <span>{{ 'foreignVat.monitor.quarter' | translate: { quarter: quarter.quarter } }}</span>
                    <nz-progress
                      nzSize="small"
                      [nzPercent]="num(quarter.progress_percent)"
                      [nzStatus]="quarterStatus(quarter.eligibility_status)"
                      [nzFormat]="noFormat"
                    ></nz-progress>
                    <span class="hint">{{ num(quarter.amount) | currency: row.currency_code }} / {{ num(quarter.threshold) | currency: row.currency_code }}</span>
                  </div>
                }
              </div>
            }

            <div class="deadline">
              <span>{{ 'foreignVat.monitor.deadline' | translate }}: {{ row.deadline_date | date: 'mediumDate' }}</span>
              <nz-tag [nzColor]="deadlineColor(row)" data-test="countdown">
                @if (row.alert_level === 'EXPIRED') {
                  {{ 'foreignVat.monitor.expired' | translate }}
                } @else {
                  {{ 'foreignVat.monitor.daysLeft' | translate: { days: row.days_remaining } }}
                }
              </nz-tag>
            </div>

            @if (row.requires_fiscal_representative || row.requires_taxable_status_certificate) {
              <div class="hint">
                {{ 'foreignVat.monitor.representative' | translate }}:
                <nz-tag [nzColor]="mandate(row)">{{ 'foreignVat.mandateStatus.' + row.representative.status | translate }}</nz-tag>
              </div>
            }
            @if (row.other_currency_items > 0) {
              <div class="hint">{{ 'foreignVat.monitor.otherCurrency' | translate: { count: row.other_currency_items } }}</div>
            }
          </nz-card>
        } @empty {
          <nz-empty [nzNotFoundContent]="'foreignVat.empty.monitor' | translate"></nz-empty>
        }
      </div>

      <div class="actions">
        <a nz-button nzType="primary" routerLink="/foreign-vat-refund/claims">{{ 'foreignVat.action.openClaims' | translate }}</a>
        <a nz-button routerLink="/foreign-vat-refund/ledger">{{ 'foreignVat.action.openLedger' | translate }}</a>
      </div>
    </nz-spin>
  `,
})
export class ForeignVatDashboardComponent implements OnInit {
  protected readonly store = inject(ForeignVatDashboardStore);

  protected readonly kpis = FVR_KPIS;
  protected readonly num = toNumber;
  protected readonly noFormat = (): string => '';
  protected readonly monitor = computed(() => this.store.dashboard()?.monitor ?? []);
  protected readonly alerts = computed(() => this.monitor().filter((row) => row.alert_level !== null));

  ngOnInit(): void {
    void this.store.load();
  }

  protected moneyOf(kpi: (typeof FVR_KPIS)[number]): { currency: string; amount: string }[] {
    return this.store.dashboard()?.kpis[kpi] ?? [];
  }

  protected status(row: FvrMonitorRow): 'success' | 'active' {
    return progressStatus(row.eligibility_status);
  }

  protected quarterStatus(eligibility: FvrMonitorRow['eligibility_status']): 'success' | 'active' {
    return progressStatus(eligibility);
  }

  protected eligibility(row: FvrMonitorRow): string {
    return eligibilityColor(row.eligibility_status);
  }

  protected reciprocityColor(row: FvrMonitorRow): string {
    return row.has_reciprocity ? 'green' : 'red';
  }

  protected deadlineColor(row: FvrMonitorRow): string {
    return alertColor(row.alert_level);
  }

  protected mandate(row: FvrMonitorRow): string {
    return mandateColor(row.representative.status);
  }
}
