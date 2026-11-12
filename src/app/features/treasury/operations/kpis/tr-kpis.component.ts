import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TreasuryCashPosition, TreasuryKpis, TreasuryOpsApiService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

interface KpiTile {
  labelKey: string;
  value: string;
  money: boolean;
}

/** DSO / DPO / cash conversion cycle, liquidity and the cash position of the tenant. */
@Component({
  selector: 'app-tr-kpis',
  imports: [FormsModule, NzButtonModule, NzCardModule, NzInputModule, NzInputNumberModule, NzStatisticModule, NzTableModule, MoneyPipe, TranslatePipe],
  template: `
    <nz-card>
      <div>
        <label for="kp-date">{{ 'TR.AS_OF' | translate }}</label>
        <input id="kp-date" nz-input type="date" [(ngModel)]="asOf" />
        <label for="kp-days">{{ 'TR.PERIOD_DAYS' | translate }}</label>
        <nz-input-number id="kp-days" [(ngModel)]="periodDays" [nzMin]="1" [nzMax]="730" />
        <label for="kp-currency">{{ 'TR.CURRENCY' | translate }}</label>
        <input id="kp-currency" nz-input maxlength="3" [(ngModel)]="currency" />
        <button nz-button nzType="primary" type="button" [nzLoading]="loading()" (click)="load()">{{ 'TR.RUN_REPORT' | translate }}</button>
      </div>

      @if (kpis(); as k) {
        <div class="kpi-grid">
          @for (tile of tiles(); track tile.labelKey) {
            <nz-card nzSize="small">
              <nz-statistic [nzTitle]="tile.labelKey | translate" [nzValue]="tile.money ? (tile.value | money: k.currency) : tile.value" />
            </nz-card>
          }
        </div>
        @if (!k.includes_inventory) {
          <p>{{ 'TR.KPI_NO_INVENTORY' | translate }}</p>
        }
      }
    </nz-card>

    @if (position(); as p) {
      <nz-card [nzTitle]="'TR.CASH_POSITION' | translate">
        <nz-table #bankTable nzSize="small" [nzData]="p.bank_accounts" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'TR.BANK_ACCOUNT' | translate }}</th>
              <th nzAlign="right">{{ 'TR.CURRENT_BALANCE' | translate }}</th>
              <th nzAlign="right">{{ 'TR.AVAILABLE_BALANCE' | translate }}</th>
              <th nzAlign="right">{{ 'TR.OVERDRAFT_LIMIT' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (account of bankTable.data; track account.id) {
              <tr>
                <td>{{ account.bank_name }} <small>{{ account.iban }}</small></td>
                <td nzAlign="right">{{ account.current_balance | money: account.currency }}</td>
                <td nzAlign="right">{{ account.available_balance | money: account.currency }}</td>
                <td nzAlign="right">{{ account.overdraft_limit | money: account.currency }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
        <nz-table #totalTable nzSize="small" [nzData]="p.totals" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'TR.CURRENCY' | translate }}</th>
              <th nzAlign="right">{{ 'TR.BANK' | translate }}</th>
              <th nzAlign="right">{{ 'TR.CASH' | translate }}</th>
              <th nzAlign="right">{{ 'TR.TOTAL' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (total of totalTable.data; track total.currency) {
              <tr>
                <td>{{ total.currency }}</td>
                <td nzAlign="right">{{ total.bank | money: total.currency }}</td>
                <td nzAlign="right">{{ total.cash | money: total.currency }}</td>
                <td nzAlign="right">{{ total.total | money: total.currency }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class TrKpisComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);

  protected readonly kpis = signal<TreasuryKpis | null>(null);
  protected readonly position = signal<TreasuryCashPosition | null>(null);
  protected readonly loading = signal(false);
  protected asOf = '';
  protected periodDays = 90;
  protected currency = 'EUR';

  protected readonly tiles = computed<KpiTile[]>(() => {
    const k = this.kpis();
    if (!k) {
      return [];
    }
    const days = (key: string, value: string | null): KpiTile => ({ labelKey: key, value: value ?? '-', money: false });
    const money = (key: string, value: string): KpiTile => ({ labelKey: key, value, money: true });
    return [
      days('TR.KPI_DSO', k.dso_days),
      days('TR.KPI_DPO', k.dpo_days),
      days('TR.KPI_CCC', k.cash_conversion_cycle_days),
      days('TR.KPI_QUICK_RATIO', k.quick_ratio),
      money('TR.KPI_SALES', k.sales),
      money('TR.KPI_PURCHASES', k.purchases),
      money('TR.KPI_OPEN_RECEIVABLES', k.open_receivables),
      money('TR.KPI_OVERDUE_RECEIVABLES', k.overdue_receivables),
      money('TR.KPI_OPEN_PAYABLES', k.open_payables),
      money('TR.KPI_OVERDUE_PAYABLES', k.overdue_payables),
      money('TR.KPI_CASH', k.cash),
      money('TR.KPI_NET_LIQUIDITY', k.net_liquidity),
    ];
  });

  ngOnInit(): void {
    this.load();
    this.api.getCashPosition().subscribe({ next: (res) => this.position.set(res.data) });
  }

  protected load(): void {
    this.loading.set(true);
    this.api
      .getKpis({ as_of_date: this.asOf || null, period_days: this.periodDays, currency: this.currency.toUpperCase() })
      .subscribe({
        next: (res) => {
          this.kpis.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }
}
