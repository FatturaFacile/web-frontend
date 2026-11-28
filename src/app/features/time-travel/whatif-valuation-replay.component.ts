import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, model, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { firstValueFrom } from 'rxjs';
import { TimeTravelApiService } from '@core/api/time-travel-api.service';
import { TT_VALUATION_METHODS, TtFilters, TtValuationMethod, TtWhatIfResult } from '@core/models/time-travel.model';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { deltaSign, failureKey } from './time-travel.util';

/**
 * What-if valuation replay (Mod 354): replays the inventory event stream up to the bi-temporal coordinate with another valuation
 * method (WAC, FIFO, LIFO) in a sandbox and compares it with the official valuation. Nothing is written to the ledger or the stock.
 */
@Component({
  selector: 'app-whatif-valuation-replay',
  imports: [
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzWidth]="860"
      [nzTitle]="'TIME_TRAVEL.WHATIF.TITLE' | translate"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <p class="tt-whatif-note">{{ 'TIME_TRAVEL.WHATIF.SANDBOX_NOTE' | translate }}</p>
        <div class="tt-whatif-form">
          <div class="tt-field">
            <label for="tt-whatif-valid-at">{{ 'TIME_TRAVEL.BAR.VALID_AT' | translate }}</label>
            <nz-date-picker nzId="tt-whatif-valid-at" nzShowTime nzFormat="yyyy-MM-dd HH:mm" [(ngModel)]="validAt" />
          </div>
          <div class="tt-field">
            <label for="tt-whatif-known-at">{{ 'TIME_TRAVEL.BAR.KNOWN_AT' | translate }}</label>
            <nz-date-picker nzId="tt-whatif-known-at" nzShowTime nzFormat="yyyy-MM-dd HH:mm" [(ngModel)]="knownAt" />
          </div>
          <div class="tt-field">
            <label for="tt-whatif-method">{{ 'TIME_TRAVEL.WHATIF.METHOD' | translate }}</label>
            <nz-select nzId="tt-whatif-method" class="tt-method" [(ngModel)]="method">
              @for (option of methods; track option) {
                <nz-option [nzValue]="option" [nzLabel]="'TIME_TRAVEL.METHOD.' + option | translate" />
              }
            </nz-select>
          </div>
          <div class="tt-field">
            <label for="tt-whatif-name">{{ 'TIME_TRAVEL.WHATIF.NAME' | translate }}</label>
            <input id="tt-whatif-name" nz-input maxlength="120" [(ngModel)]="simulationName" />
          </div>
          <button
            nz-button
            nzType="primary"
            type="button"
            data-testid="tt-whatif-run"
            [disabled]="!canRun()"
            [nzLoading]="running()"
            (click)="run()"
          >
            {{ 'TIME_TRAVEL.WHATIF.RUN' | translate }}
          </button>
        </div>

        @if (error(); as key) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" data-testid="tt-whatif-error" />
        }

        @if (result(); as r) {
          <div class="tt-kpis" data-testid="tt-whatif-kpis">
            <nz-statistic [nzTitle]="'TIME_TRAVEL.WHATIF.OFFICIAL_VALUE' | translate" [nzValue]="(r.baseline_summary.total_value | number: '1.2-2') ?? ''" />
            <nz-statistic [nzTitle]="'TIME_TRAVEL.WHATIF.SIMULATED_VALUE' | translate" [nzValue]="(r.simulated_summary.total_value | number: '1.2-2') ?? ''" />
            <nz-statistic
              [nzTitle]="'TIME_TRAVEL.WHATIF.VARIANCE' | translate"
              [nzValue]="(r.delta_summary.total_value | number: '1.2-2') ?? ''"
              [nzValueStyle]="varianceStyle(r.delta_summary.total_value)"
            />
            <nz-statistic
              [nzTitle]="'TIME_TRAVEL.WHATIF.VARIANCE_PCT' | translate"
              [nzValue]="(r.delta_summary.pct | number: '1.2-2') ?? ''"
              nzSuffix="%"
              [nzValueStyle]="varianceStyle(r.delta_summary.pct)"
            />
          </div>
          <nz-table nzSize="small" [nzData]="r.items" [nzPageSize]="20" data-testid="tt-whatif-table">
            <thead>
              <tr>
                <th>{{ 'TIME_TRAVEL.COL.ITEM' | translate }}</th>
                <th>{{ 'TIME_TRAVEL.COL.WAREHOUSE' | translate }}</th>
                <th nzAlign="right">{{ 'TIME_TRAVEL.COL.QUANTITY' | translate }}</th>
                <th nzAlign="right">{{ 'TIME_TRAVEL.WHATIF.OFFICIAL_VALUE' | translate }}</th>
                <th nzAlign="right">{{ 'TIME_TRAVEL.WHATIF.SIMULATED_VALUE' | translate }}</th>
                <th nzAlign="right">{{ 'TIME_TRAVEL.WHATIF.VARIANCE' | translate }}</th>
                <th nzAlign="right">{{ 'TIME_TRAVEL.WHATIF.VARIANCE_PCT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of r.items; track item.item_id + item.warehouse_id) {
                <tr>
                  <td>{{ item.item_id }}</td>
                  <td>{{ item.warehouse_id }}</td>
                  <td nzAlign="right">{{ item.quantity | number: '1.0-4' }}</td>
                  <td nzAlign="right">{{ item.official_value | number: '1.2-2' }}</td>
                  <td nzAlign="right">{{ item.simulated_value | number: '1.2-2' }}</td>
                  <td nzAlign="right" [class]="'tt-delta tt-delta-' + sign(item.variance)">{{ item.variance | number: '1.2-2' }}</td>
                  <td nzAlign="right" [class]="'tt-delta tt-delta-' + sign(item.variance_pct)">{{ item.variance_pct | number: '1.2-2' }}%</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .tt-whatif-form {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 12px;
      margin-bottom: 16px;
    }
    .tt-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .tt-method {
      min-width: 220px;
    }
    .tt-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 16px;
      margin: 16px 0;
    }
    .tt-delta-positive {
      color: var(--ant-color-success, #389e0d);
    }
    .tt-delta-negative {
      color: var(--ant-color-error, #cf1322);
    }
  `,
})
export class WhatifValuationReplayComponent {
  private readonly api = inject(TimeTravelApiService);
  protected readonly context = inject(TimeTravelContextService);

  /** Two-way: the host opens the drawer, the drawer closes itself. */
  readonly open = model(false);
  readonly filters = input<TtFilters>({});

  protected readonly methods = TT_VALUATION_METHODS;
  protected validAt: Date | null = null;
  protected knownAt: Date | null = null;
  protected method: TtValuationMethod = 'FIFO';
  protected simulationName = '';

  protected readonly result = signal<TtWhatIfResult | null>(null);
  protected readonly running = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly canRun = computed(() => !this.running());

  constructor() {
    // Opening the drawer starts from the coordinate of the session (or now) so the user only has to pick the method.
    effect(() => {
      if (this.open()) {
        this.validAt = this.context.validAt() ?? this.validAt ?? new Date();
        this.knownAt = this.context.knownAt() ?? this.knownAt ?? new Date();
      }
    });
  }

  protected sign(value: string): 'positive' | 'negative' | 'zero' {
    return deltaSign(value);
  }

  protected varianceStyle(value: string): Record<string, string> {
    const sign = deltaSign(value);
    if (sign === 'zero') {
      return {};
    }
    return { color: sign === 'positive' ? '#389e0d' : '#cf1322' };
  }

  protected async run(): Promise<void> {
    if (!this.validAt || !this.knownAt) {
      this.error.set('TIME_TRAVEL.ERROR.INVALID');
      return;
    }
    this.running.set(true);
    this.error.set(null);
    try {
      const name = this.simulationName.trim();
      const response = await firstValueFrom(
        this.api.whatIfReplay({
          valid_at: this.validAt.toISOString(),
          known_at: this.knownAt.toISOString(),
          valuation_method: this.method,
          ...this.filters(),
          ...(name !== '' ? { simulation_name: name } : {}),
        }),
      );
      this.result.set(response.data);
    } catch (error) {
      this.result.set(null);
      this.error.set(failureKey(error));
    } finally {
      this.running.set(false);
    }
  }
}
