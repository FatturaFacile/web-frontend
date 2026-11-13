import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AccountLedgerReport, GeneralLedgerApiService } from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { currentYearEnd, currentYearStart, rangeEndsBeforeStart } from '../shared/gl-dates';

/** Account ledger (mastrino): running balance in the accounting currency, plus the transaction currency columns. */
@Component({
  selector: 'app-gl-account-ledger',
  styleUrl: './gl-account-ledger.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    FormsModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzInputModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <div class="filters">
      <nz-select
        class="account-select"
        nzShowSearch
        [attr.aria-label]="'GL.COL_ACCOUNT' | translate"
        [nzPlaceHolder]="'GL.COL_ACCOUNT' | translate"
        [(ngModel)]="accountId"
      >
        @for (account of lookups.accounts(); track account.id) {
          <nz-option [nzValue]="account.id" [nzLabel]="account.account_code + ' ' + account.name" />
        }
      </nz-select>
      <label for="al-from">{{ 'GL.FROM' | translate }}</label>
      <input class="date-input" id="al-from" nz-input type="date" [(ngModel)]="from" />
      <label for="al-to">{{ 'GL.TO' | translate }}</label>
      <input class="date-input" id="al-to" nz-input type="date" [(ngModel)]="to" />
      <button nz-button nzType="primary" type="button" [disabled]="!accountId || rangeInvalid()" [nzLoading]="loading()" (click)="load(1)">
        {{ 'GL.RUN_REPORT' | translate }}
      </button>
      @if (rangeInvalid()) {
        <span class="ant-form-item-explain-error" role="alert">{{ 'COMMON.VALIDATION.END_AFTER_START' | translate }}</span>
      }
    </div>

    @if (report(); as r) {
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
        [nzLoading]="loading()"
        (nzPageIndexChange)="load($event)"
      >
        <thead>
          <tr>
            <th [nzSortFn]="'posting_date' | gridSort">{{ 'GL.COL_DATE' | translate }}</th>
            <th [nzSortFn]="'entry_number' | gridSort">{{ 'GL.COL_ENTRY' | translate }}</th>
            <th [nzSortFn]="'description' | gridSort">{{ 'GL.COL_DESCRIPTION' | translate }}</th>
            <th nzAlign="right" [nzSortFn]="'debit' | gridSort">{{ 'GL.COL_DEBIT' | translate }} ({{ r.currency }})</th>
            <th nzAlign="right" [nzSortFn]="'credit' | gridSort">{{ 'GL.COL_CREDIT' | translate }} ({{ r.currency }})</th>
            <th nzAlign="right" [nzSortFn]="'running_balance' | gridSort">{{ 'GL.COL_RUNNING_BALANCE' | translate }}</th>
            <th [nzSortFn]="'transaction_debit' | gridSort">{{ 'GL.COL_TRANSACTION_CURRENCY' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (line of r.lines; track line.line_id) {
            <tr>
              <td>{{ line.posting_date }}</td>
              <td>{{ line.entry_number }}</td>
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
  `,
})
export class GlAccountLedgerComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  protected readonly lookups = inject(GlLookupStore);

  protected readonly report = signal<AccountLedgerReport | null>(null);
  protected readonly loading = signal(false);
  protected accountId: string | null = null;
  protected rangeInvalid(): boolean {
    return rangeEndsBeforeStart(this.from, this.to);
  }

  protected from = currentYearStart();
  protected to = currentYearEnd();

  protected readonly transactionTotals = computed(() =>
    Object.entries(this.report()?.transaction_totals ?? {}).map(([key, value]) => ({ key, value: String(value) })),
  );

  ngOnInit(): void {
    this.lookups.load();
  }

  protected load(page: number): void {
    if (!this.accountId) {
      return;
    }
    this.loading.set(true);
    this.api
      .getAccountLedger({ account_id: this.accountId, from: this.from, to: this.to, page, per_page: 50 })
      .subscribe({
        next: (res) => {
          this.report.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
