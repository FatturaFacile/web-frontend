import { DecimalPipe } from '@angular/common';
import { Component, effect, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PlanningApiService, PlanningBalance, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText, BALANCE_STATUS_COLORS, monthLabel } from './planning.util';

/** Demand-supply balance of a scenario: the gap per item and month, with or without carry-over. */
@Component({
  selector: 'app-planning-balance',
  styleUrl: './planning.scss',
  imports: [DecimalPipe, FormsModule, TranslatePipe, NzCardModule, NzEmptyModule, NzSwitchModule, NzTableModule, NzTagModule],
  template: `
    <div class="toolbar">
      <nz-switch [ngModel]="carryOver()" (ngModelChange)="carryOver.set($event); load()" [attr.aria-label]="'PLANNING.CARRY_OVER' | translate"></nz-switch>
      <span>{{ 'PLANNING.CARRY_OVER' | translate }}</span>
    </div>

    @if (balance(); as data) {
      <div class="stats-grid">
        <nz-card>{{ 'PLANNING.TOTAL_DEMAND' | translate }}: <strong>{{ data.totals.total_demand | number: '1.0-3' }}</strong></nz-card>
        <nz-card>{{ 'PLANNING.TOTAL_SUPPLY' | translate }}: <strong>{{ data.totals.total_supply | number: '1.0-3' }}</strong></nz-card>
        <nz-card>{{ 'PLANNING.TOTAL_GAP' | translate }}: <strong>{{ data.totals.total_gap | number: '1.0-3' }}</strong></nz-card>
        <nz-card>{{ 'PLANNING.SHORTAGE_ITEMS' | translate }}: <strong>{{ data.totals.shortage_items }}</strong></nz-card>
      </div>

      @for (item of data.items; track item.item_code) {
        <nz-card class="main-card" [nzTitle]="item.item_code + (item.item_name ? ' - ' + item.item_name : '')">
          <div class="balance-table">
            <nz-table #table [nzData]="item.periods" nzSize="small" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'PLANNING.PERIOD' | translate }}</th>
                  <th class="num">{{ 'PLANNING.DEMAND' | translate }}</th>
                  <th class="num">{{ 'PLANNING.SUPPLY' | translate }}</th>
                  <th class="num">{{ 'PLANNING.GAP' | translate }}</th>
                  <th class="num">{{ 'PLANNING.BALANCE' | translate }}</th>
                  <th>{{ 'PLANNING.STATUS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of table.data; track row.period) {
                  <tr>
                    <td>{{ monthLabel(row.period) }}</td>
                    <td class="num">{{ row.demand | number: '1.0-3' }}</td>
                    <td class="num">{{ row.supply | number: '1.0-3' }}</td>
                    <td class="num" [class.row-overdue]="row.status === 'shortage'">{{ row.gap | number: '1.0-3' }}</td>
                    <td class="num">{{ row.balance | number: '1.0-3' }}</td>
                    <td><nz-tag [nzColor]="statusColor(row.status)">{{ ('PLANNING.BALANCE_' + row.status.toUpperCase()) | translate }}</nz-tag></td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </div>
        </nz-card>
      }
      @if (data.items.length === 0) {
        <nz-empty [nzNotFoundContent]="'PLANNING.NO_LINES' | translate"></nz-empty>
      }
    }
  `,
})
export class PlanningBalanceComponent {
  private readonly api = inject(PlanningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly scenarioId = input.required<string>();
  /** Bumped by the parent when the lines changed. */
  readonly refresh = input(0);

  readonly monthLabel = monthLabel;
  readonly carryOver = signal(true);
  readonly balance = signal<PlanningBalance | null>(null);

  constructor() {
    effect(() => {
      this.scenarioId();
      this.refresh();
      this.load();
    });
  }

  statusColor(status: string): string {
    return BALANCE_STATUS_COLORS[status] ?? 'default';
  }

  load(): void {
    this.api.getBalance(this.scenarioId(), this.carryOver()).subscribe({
      next: (response) => this.balance.set(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('PLANNING.ACTION_ERROR')),
    });
  }
}
