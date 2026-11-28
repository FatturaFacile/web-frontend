import { Component, computed, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, LEDGER_BOOK_CODES, LedgerBookCode } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { TimeTravelPanelComponent } from '../../time-travel/time-travel-panel.component';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { exportCsv, exportJson, printReport, trialBalanceTable } from './gl-report-export.util';
import { GlLedgerReportsStore, LedgerReportFilters } from './gl-ledger-reports.store';

/** Trial balance (bilancio di verifica) of one ledger book, in 2 or 4 columns, with drill-down, CSV / JSON export and print. */
@Component({
  selector: 'app-gl-trial-balance',
  styleUrl: './gl-trial-balance.component.scss',
  imports: [FormsModule, NzButtonModule, NzInputModule, NzSelectModule, NzTableModule, NzTagModule, GlErrorAlertComponent, MoneyPipe, TimeTravelPanelComponent, TranslatePipe],
  template: `
    <app-time-travel-panel domain="trial_balance" />
    @if (!timeTravel.isActive()) {
    <app-gl-error-alert [error]="store.error()" />
    <div class="filters">
      <label for="tb-ledger">{{ 'GL.PN_BOOK' | translate }}</label>
      <nz-select id="tb-ledger" class="select-md" [ngModel]="filters().ledger" (ngModelChange)="set({ ledger: $event })">
        @for (code of books; track code) {
          <nz-option [nzValue]="code" [nzLabel]="'GL.PN_BOOK_' + code | translate" />
        }
      </nz-select>
      <label for="tb-from">{{ 'GL.FROM' | translate }}</label>
      <input class="date-input" id="tb-from" nz-input type="date" [ngModel]="filters().from" (ngModelChange)="set({ from: $event })" />
      <label for="tb-to">{{ 'GL.TO' | translate }}</label>
      <input class="date-input" id="tb-to" nz-input type="date" [ngModel]="filters().to" (ngModelChange)="set({ to: $event })" />
      <label for="tb-cfrom">{{ 'GL.COMPARE_FROM' | translate }}</label>
      <input class="date-input" id="tb-cfrom" nz-input type="date" [ngModel]="filters().compareFrom" (ngModelChange)="set({ compareFrom: $event })" />
      <label for="tb-cto">{{ 'GL.COMPARE_TO' | translate }}</label>
      <input class="date-input" id="tb-cto" nz-input type="date" [ngModel]="filters().compareTo" (ngModelChange)="set({ compareTo: $event })" />
      <nz-select
        class="select-md"
        nzAllowClear
        [attr.aria-label]="'GL.COST_CENTER' | translate"
        [nzPlaceHolder]="'GL.COST_CENTER' | translate"
        [ngModel]="filters().costCenterId"
        (ngModelChange)="set({ costCenterId: $event ?? null })"
      >
        @for (center of lookups.costCenters(); track center.id) {
          <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name" />
        }
      </nz-select>
      <nz-select
        class="select-md"
        nzAllowClear
        [attr.aria-label]="'GL.DIVISION' | translate"
        [nzPlaceHolder]="'GL.DIVISION' | translate"
        [ngModel]="filters().profitCenterId"
        (ngModelChange)="set({ profitCenterId: $event ?? null })"
      >
        @for (center of lookups.profitCenters(); track center.id) {
          <nz-option [nzValue]="center.id" [nzLabel]="center.code + ' ' + center.name" />
        }
      </nz-select>
      <label for="tb-columns">{{ 'GL.TB_COLUMNS' | translate }}</label>
      <nz-select id="tb-columns" class="select-sm" [ngModel]="filters().columns" (ngModelChange)="set({ columns: $event })">
        <nz-option [nzValue]="2" [nzLabel]="'GL.TB_COLUMNS_2' | translate" />
        <nz-option [nzValue]="4" [nzLabel]="'GL.TB_COLUMNS_4' | translate" />
      </nz-select>
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="tb-run"
        [disabled]="store.rangeInvalid()"
        [nzLoading]="store.trialBalanceLoading()"
        (click)="store.loadTrialBalance()"
      >
        {{ 'GL.RUN_REPORT' | translate }}
      </button>
      @if (store.rangeInvalid()) {
        <span class="ant-form-item-explain-error" role="alert">{{ 'COMMON.VALIDATION.END_AFTER_START' | translate }}</span>
      }
    </div>

    @if (report(); as r) {
      <p class="summary">
        <nz-tag>{{ 'GL.REPORT_CURRENCY' | translate }}: {{ r.currency }}</nz-tag>
        <nz-tag [nzColor]="r.is_balanced ? 'green' : 'red'">{{ (r.is_balanced ? 'GL.BALANCED' : 'GL.NOT_BALANCED') | translate }}</nz-tag>
        <button nz-button nzSize="small" type="button" data-testid="tb-csv" (click)="exportAs('csv')">{{ 'GL.EXPORT_CSV' | translate }}</button>
        <button nz-button nzSize="small" type="button" data-testid="tb-json" (click)="exportAs('json')">{{ 'GL.EXPORT_JSON' | translate }}</button>
        <button nz-button nzSize="small" type="button" data-testid="tb-print" (click)="print()">{{ 'GL.PRINT' | translate }}</button>
      </p>
      <nz-table nzSize="small" [nzData]="r.accounts" [nzPageSize]="50" [nzLoading]="store.trialBalanceLoading()">
        <thead>
          <tr>
            <th>{{ 'GL.COL_ACCOUNT' | translate }}</th>
            @if (twoColumns()) {
              <th nzAlign="right">{{ 'GL.TB_DEBIT_BALANCE' | translate }}</th>
              <th nzAlign="right">{{ 'GL.TB_CREDIT_BALANCE' | translate }}</th>
            } @else {
              <th nzAlign="right">{{ 'GL.COL_OPENING' | translate }}</th>
              <th nzAlign="right">{{ 'GL.COL_DEBIT' | translate }}</th>
              <th nzAlign="right">{{ 'GL.COL_CREDIT' | translate }}</th>
              <th nzAlign="right">{{ 'GL.COL_CLOSING' | translate }}</th>
            }
            @if (r.compare_from) {
              <th nzAlign="right">{{ 'GL.COL_COMPARISON' | translate }} ({{ 'GL.COL_DEBIT' | translate }})</th>
              <th nzAlign="right">{{ 'GL.COL_COMPARISON' | translate }} ({{ 'GL.COL_CREDIT' | translate }})</th>
            }
          </tr>
        </thead>
        <tbody>
          @for (row of r.accounts; track row.account_id) {
            <tr>
              <td>
                <button class="drill" type="button" [attr.aria-label]="'GL.DRILL_DOWN' | translate" (click)="store.openAccountLedger(row.account_id)">
                  {{ row.account_code }} {{ row.account_name }}
                </button>
              </td>
              @if (twoColumns()) {
                <td nzAlign="right">{{ row.debit_balance | money: r.currency }}</td>
                <td nzAlign="right">{{ row.credit_balance | money: r.currency }}</td>
              } @else {
                <td nzAlign="right">{{ row.opening_balance | money: r.currency }}</td>
                <td nzAlign="right">{{ row.debit | money: r.currency }}</td>
                <td nzAlign="right">{{ row.credit | money: r.currency }}</td>
                <td nzAlign="right">{{ row.closing_balance | money: r.currency }}</td>
              }
              @if (r.compare_from) {
                <td nzAlign="right">{{ row.comparison_debit | money: r.currency }}</td>
                <td nzAlign="right">{{ row.comparison_credit | money: r.currency }}</td>
              }
            </tr>
          }
          <tr class="totals">
            <th scope="row">{{ 'GL.COL_TOTAL' | translate }}</th>
            @if (twoColumns()) {
              <td nzAlign="right">{{ totals()['debit_balance'] | money: r.currency }}</td>
              <td nzAlign="right">{{ totals()['credit_balance'] | money: r.currency }}</td>
            } @else {
              <td nzAlign="right">{{ totals()['opening_balance'] | money: r.currency }}</td>
              <td nzAlign="right">{{ totals()['debit'] | money: r.currency }}</td>
              <td nzAlign="right">{{ totals()['credit'] | money: r.currency }}</td>
              <td nzAlign="right">{{ totals()['closing_balance'] | money: r.currency }}</td>
            }
          </tr>
        </tbody>
      </nz-table>
    }
    }
  `,
})
export class GlTrialBalanceComponent {
  protected readonly timeTravel = inject(TimeTravelContextService);
  protected readonly store = inject(GlLedgerReportsStore);
  protected readonly lookups = inject(GlLookupStore);
  private readonly i18n = inject(I18nService);

  protected readonly books: readonly LedgerBookCode[] = LEDGER_BOOK_CODES;
  protected readonly filters = this.store.filters;
  protected readonly report = this.store.trialBalance;
  /** The layout of the loaded report: a change of the selector applies at the next run. */
  protected readonly twoColumns = computed(() => this.report()?.accounts[0]?.debit_balance !== undefined);
  protected readonly totals = computed<Record<string, string>>(() => {
    const totals = this.report()?.totals;
    return totals && !Array.isArray(totals) ? totals : {};
  });

  protected set(changes: Partial<LedgerReportFilters>): void {
    this.store.setFilters(changes);
  }

  protected exportAs(kind: 'csv' | 'json'): void {
    const report = this.report();
    if (!report) {
      return;
    }
    const name = `trial-balance-${this.filters().ledger}-${report.from}-${report.to}`;
    if (kind === 'json') {
      exportJson(report, name);
      return;
    }
    exportCsv(this.table(), name);
  }

  protected print(): void {
    if (this.report()) {
      printReport(this.table());
    }
  }

  private table() {
    const report = this.report();
    if (!report) {
      throw new Error('No trial balance loaded');
    }
    return trialBalanceTable(report, this.twoColumns() ? 2 : 4, (key) => this.i18n.translate(key));
  }
}
