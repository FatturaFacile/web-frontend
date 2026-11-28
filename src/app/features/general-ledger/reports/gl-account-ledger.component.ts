import { Component, computed, inject, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
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
import { accountLedgerTable, exportCsv, exportJson, printReport } from './gl-report-export.util';
import { GlLedgerReportsStore, LedgerReportFilters } from './gl-ledger-reports.store';

/** Account ledger (mastrino): running balance in the accounting currency, per ledger book, with export and print. */
@Component({
  selector: 'app-gl-account-ledger',
  styleUrl: './gl-account-ledger.component.scss',
  imports: [
    FormsModule,
    RouterLink,
    NzButtonModule,
    NzDescriptionsModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    GlErrorAlertComponent,
    MoneyPipe,
    TimeTravelPanelComponent,
    TranslatePipe,
  ],
  template: `
    @if (timeTravel.isActive()) {
      <nz-select
        class="account-select"
        nzShowSearch
        data-testid="tt-account-select"
        [attr.aria-label]="'GL.COL_ACCOUNT' | translate"
        [nzPlaceHolder]="'GL.COL_ACCOUNT' | translate"
        [ngModel]="store.accountId()"
        (ngModelChange)="store.setAccountId($event)"
      >
        @for (account of lookups.accounts(); track account.id) {
          <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
        }
      </nz-select>
    }
    <app-time-travel-panel domain="account_ledger" [filters]="ledgerFilters()" />
    @if (!timeTravel.isActive()) {
    <app-gl-error-alert [error]="store.error()" />
    <div class="filters">
      <nz-select
        class="account-select"
        nzShowSearch
        [attr.aria-label]="'GL.COL_ACCOUNT' | translate"
        [nzPlaceHolder]="'GL.COL_ACCOUNT' | translate"
        [ngModel]="store.accountId()"
        (ngModelChange)="store.setAccountId($event)"
      >
        @for (account of lookups.accounts(); track account.id) {
          <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
        }
      </nz-select>
      <label for="al-ledger">{{ 'GL.PN_BOOK' | translate }}</label>
      <nz-select id="al-ledger" class="select-md" [ngModel]="filters().ledger" (ngModelChange)="set({ ledger: $event })">
        @for (code of books; track code) {
          <nz-option [nzValue]="code" [nzLabel]="'GL.PN_BOOK_' + code | translate" />
        }
      </nz-select>
      <label for="al-from">{{ 'GL.FROM' | translate }}</label>
      <input class="date-input" id="al-from" nz-input type="date" [ngModel]="filters().from" (ngModelChange)="set({ from: $event })" />
      <label for="al-to">{{ 'GL.TO' | translate }}</label>
      <input class="date-input" id="al-to" nz-input type="date" [ngModel]="filters().to" (ngModelChange)="set({ to: $event })" />
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
      <button
        nz-button
        nzType="primary"
        type="button"
        data-testid="al-run"
        [disabled]="!store.accountId() || store.rangeInvalid()"
        [nzLoading]="store.accountLedgerLoading()"
        (click)="store.loadAccountLedger(1)"
      >
        {{ 'GL.RUN_REPORT' | translate }}
      </button>
      @if (store.rangeInvalid()) {
        <span class="ant-form-item-explain-error" role="alert">{{ 'COMMON.VALIDATION.END_AFTER_START' | translate }}</span>
      }
    </div>

    @if (store.accountLedger(); as r) {
      <p class="summary">
        <button nz-button nzSize="small" type="button" data-testid="al-csv" (click)="exportAs('csv')">{{ 'GL.EXPORT_CSV' | translate }}</button>
        <button nz-button nzSize="small" type="button" data-testid="al-json" (click)="exportAs('json')">{{ 'GL.EXPORT_JSON' | translate }}</button>
        <button nz-button nzSize="small" type="button" data-testid="al-print" (click)="print()">{{ 'GL.PRINT' | translate }}</button>
      </p>
      <nz-descriptions class="ledger-summary" nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 3 }">
        <nz-descriptions-item [nzTitle]="'GL.REPORT_CURRENCY' | translate">{{ r.currency }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'GL.COL_OPENING' | translate">{{ r.opening_balance | money: r.currency }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'GL.COL_CLOSING' | translate">{{ r.closing_balance | money: r.currency }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'GL.COL_DEBIT' | translate">{{ r.total_debit | money: r.currency }}</nz-descriptions-item>
        <nz-descriptions-item [nzTitle]="'GL.COL_CREDIT' | translate">{{ r.total_credit | money: r.currency }}</nz-descriptions-item>
        @if (transactionTotals().length > 0) {
          <nz-descriptions-item [nzTitle]="'GL.TRANSACTION_TOTALS' | translate">
            @for (total of transactionTotals(); track total.key) {
              <div>{{ total.key }}: {{ total.value }}</div>
            }
          </nz-descriptions-item>
        }
      </nz-descriptions>

      <nz-table
        nzSize="small"
        [nzData]="r.lines"
        [nzFrontPagination]="false"
        [nzTotal]="r.meta.total"
        [nzPageIndex]="r.meta.current_page"
        [nzPageSize]="r.meta.per_page"
        [nzLoading]="store.accountLedgerLoading()"
        (nzPageIndexChange)="store.loadAccountLedger($event)"
      >
        <thead>
          <tr>
            <th>{{ 'GL.COL_DATE' | translate }}</th>
            <th>{{ 'GL.COL_ENTRY' | translate }}</th>
            <th>{{ 'GL.COL_DESCRIPTION' | translate }}</th>
            <th nzAlign="right">{{ 'GL.COL_DEBIT' | translate }} ({{ r.currency }})</th>
            <th nzAlign="right">{{ 'GL.COL_CREDIT' | translate }} ({{ r.currency }})</th>
            <th nzAlign="right">{{ 'GL.COL_RUNNING_BALANCE' | translate }}</th>
            <th>{{ 'GL.COL_TRANSACTION_CURRENCY' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (line of r.lines; track line.line_id) {
            <tr>
              <td>{{ line.posting_date }}</td>
              <td>
                <a [routerLink]="['/general-ledger/journals']" [queryParams]="{ entry: line.journal_entry_id }">{{ line.entry_number }}</a>
              </td>
              <td>{{ line.description }}</td>
              <td nzAlign="right">{{ line.debit | money: r.currency }}</td>
              <td nzAlign="right">{{ line.credit | money: r.currency }}</td>
              <td nzAlign="right">{{ line.running_balance | money: r.currency }}</td>
              <td>
                @if (line.transaction_currency !== r.currency) {
                  {{ line.transaction_debit | money: line.transaction_currency }} /
                  {{ line.transaction_credit | money: line.transaction_currency }}
                  <nz-tag>{{ line.exchange_rate }}</nz-tag>
                }
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    }
    }
  `,
})
export class GlAccountLedgerComponent implements OnInit {
  protected readonly timeTravel = inject(TimeTravelContextService);
  protected readonly store = inject(GlLedgerReportsStore);
  protected readonly lookups = inject(GlLookupStore);
  private readonly i18n = inject(I18nService);

  protected readonly books: readonly LedgerBookCode[] = LEDGER_BOOK_CODES;
  protected readonly filters = this.store.filters;
  protected readonly ledgerFilters = computed(() => {
    const accountId = this.store.accountId();
    return accountId ? { account_id: accountId } : {};
  });

  protected readonly transactionTotals = computed(() =>
    Object.entries(this.store.accountLedger()?.transaction_totals ?? {}).map(([key, value]) => ({ key, value: String(value) })),
  );

  ngOnInit(): void {
    this.lookups.load();
  }

  protected set(changes: Partial<LedgerReportFilters>): void {
    this.store.setFilters(changes);
  }

  protected exportAs(kind: 'csv' | 'json'): void {
    const report = this.store.accountLedger();
    if (!report) {
      return;
    }
    const name = `account-ledger-${report.account.account_code ?? report.account.id}-${this.filters().ledger}-${report.from}-${report.to}`;
    if (kind === 'json') {
      exportJson(report, name);
      return;
    }
    exportCsv(accountLedgerTable(report, (key) => this.i18n.translate(key)), name);
  }

  protected print(): void {
    const report = this.store.accountLedger();
    if (report) {
      printReport(accountLedgerTable(report, (key) => this.i18n.translate(key)));
    }
  }
}
