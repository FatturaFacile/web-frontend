import { DecimalPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { TimeTravelApiService } from '@core/api/time-travel-api.service';
import {
  TT_AGING_BUCKETS,
  TtAccountLedgerState,
  TtAgingState,
  TtDomain,
  TtFilters,
  TtInventoryState,
  TtState,
  TtStateMeta,
  TtTrialBalanceState,
} from '@core/models/time-travel.model';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { failureKey } from './time-travel.util';

/**
 * Point-in-time state of one domain at the bi-temporal coordinate of the session: trial balance, account ledger, aging or inventory.
 * It replaces the live table of the host view while the time-travel mode is active.
 */
@Component({
  selector: 'app-time-travel-state-view',
  imports: [DecimalPipe, NzAlertModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    @if (error(); as key) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" data-testid="tt-state-error" />
    }
    @if (meta(); as m) {
      <p class="tt-meta" data-testid="tt-state-meta">
        <nz-tag>{{ 'TIME_TRAVEL.STATE.EVENTS' | translate: { count: m.event_count } }}</nz-tag>
        <nz-tag [nzColor]="m.checkpoint_used ? 'blue' : 'default'">
          {{ (m.checkpoint_used ? 'TIME_TRAVEL.STATE.CHECKPOINT_USED' : 'TIME_TRAVEL.STATE.FULL_REPLAY') | translate }}
        </nz-tag>
        <nz-tag>{{ 'TIME_TRAVEL.STATE.DURATION' | translate: { ms: m.duration_ms } }}</nz-tag>
      </p>
    }
    @switch (domain()) {
      @case ('trial_balance') {
        <nz-table nzSize="small" [nzData]="trialBalance()?.rows ?? []" [nzLoading]="loading()" [nzPageSize]="50" data-testid="tt-table-trial-balance">
          <thead>
            <tr>
              <th>{{ 'TIME_TRAVEL.COL.ACCOUNT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.DEBIT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.CREDIT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.BALANCE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of trialBalance()?.rows ?? []; track row.account_id) {
              <tr>
                <td>{{ row.account_code }} {{ row.account_name }}</td>
                <td nzAlign="right">{{ row.debit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.credit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.balance | number: '1.2-2' }}</td>
              </tr>
            }
            @if (trialBalance(); as state) {
              <tr class="totals">
                <th scope="row">{{ 'TIME_TRAVEL.COL.TOTAL' | translate }}</th>
                <td nzAlign="right">{{ state.totals.debit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ state.totals.credit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ state.totals.balance | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
      @case ('account_ledger') {
        <nz-table nzSize="small" [nzData]="accountLedger()?.rows ?? []" [nzLoading]="loading()" [nzPageSize]="50" data-testid="tt-table-account-ledger">
          <thead>
            <tr>
              <th>{{ 'TIME_TRAVEL.COL.DATE' | translate }}</th>
              <th>{{ 'TIME_TRAVEL.COL.ENTRY' | translate }}</th>
              <th>{{ 'TIME_TRAVEL.COL.DESCRIPTION' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.DEBIT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.CREDIT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.RUNNING_BALANCE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of accountLedger()?.rows ?? []; track row.entry_id) {
              <tr>
                <td>{{ row.posting_date }}</td>
                <td>{{ row.entry_number }}</td>
                <td>{{ row.description }}</td>
                <td nzAlign="right">{{ row.debit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.credit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.running_balance | number: '1.2-2' }}</td>
              </tr>
            }
            @if (accountLedger(); as state) {
              <tr class="totals">
                <th scope="row" colspan="3">{{ 'TIME_TRAVEL.COL.TOTAL' | translate }}</th>
                <td nzAlign="right">{{ state.totals.debit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ state.totals.credit | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ state.totals.balance | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
      @case ('aging') {
        <nz-table nzSize="small" [nzData]="aging()?.rows ?? []" [nzLoading]="loading()" [nzPageSize]="50" data-testid="tt-table-aging">
          <thead>
            <tr>
              <th>{{ 'TIME_TRAVEL.COL.DOCUMENT' | translate }}</th>
              <th>{{ 'TIME_TRAVEL.COL.PARTNER' | translate }}</th>
              <th>{{ 'TIME_TRAVEL.COL.DUE_DATE' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.AMOUNT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.OPEN_AMOUNT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.DAYS_OVERDUE' | translate }}</th>
              <th>{{ 'TIME_TRAVEL.COL.BUCKET' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of aging()?.rows ?? []; track row.document_id) {
              <tr>
                <td>{{ row.document_number }}</td>
                <td>{{ ('TIME_TRAVEL.PARTNER.' + row.partner_type.toUpperCase()) | translate }} · {{ row.partner_id }}</td>
                <td>{{ row.due_date ?? '—' }}</td>
                <td nzAlign="right">{{ row.amount | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.open_amount | number: '1.2-2' }}</td>
                <td nzAlign="right">{{ row.days_overdue }}</td>
                <td>{{ 'TIME_TRAVEL.BUCKET.' + row.bucket.toUpperCase() | translate }}</td>
              </tr>
            }
            @if (aging(); as state) {
              <tr class="totals">
                <th scope="row" colspan="4">{{ 'TIME_TRAVEL.COL.TOTAL' | translate }}</th>
                <td nzAlign="right">{{ state.totals.open_amount | number: '1.2-2' }}</td>
                <td colspan="2"></td>
              </tr>
              @for (bucket of buckets; track bucket) {
                <tr class="totals">
                  <td colspan="4">{{ 'TIME_TRAVEL.BUCKET.' + bucket.toUpperCase() | translate }}</td>
                  <td nzAlign="right">{{ state.totals.buckets[bucket] | number: '1.2-2' }}</td>
                  <td colspan="2"></td>
                </tr>
              }
            }
          </tbody>
        </nz-table>
      }
      @case ('inventory') {
        <nz-table nzSize="small" [nzData]="inventory()?.rows ?? []" [nzLoading]="loading()" [nzPageSize]="50" data-testid="tt-table-inventory">
          <thead>
            <tr>
              <th>{{ 'TIME_TRAVEL.COL.ITEM' | translate }}</th>
              <th>{{ 'TIME_TRAVEL.COL.WAREHOUSE' | translate }}</th>
              <th>{{ 'TIME_TRAVEL.COL.LOT' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.QUANTITY' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.UNIT_COST' | translate }}</th>
              <th nzAlign="right">{{ 'TIME_TRAVEL.COL.VALUE' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of inventory()?.rows ?? []; track row.item_id + row.warehouse_id + (row.lot_id ?? '')) {
              <tr>
                <td>{{ row.item_id }}</td>
                <td>{{ row.warehouse_id }}</td>
                <td>{{ row.lot_id ?? '—' }}</td>
                <td nzAlign="right">{{ row.quantity | number: '1.0-4' }}</td>
                <td nzAlign="right">{{ row.unit_cost | number: '1.2-4' }}</td>
                <td nzAlign="right">{{ row.value | number: '1.2-2' }}</td>
              </tr>
            }
            @if (inventory(); as state) {
              <tr class="totals">
                <th scope="row" colspan="3">{{ 'TIME_TRAVEL.COL.TOTAL' | translate }}</th>
                <td nzAlign="right">{{ state.totals.quantity | number: '1.0-4' }}</td>
                <td></td>
                <td nzAlign="right">{{ state.totals.value | number: '1.2-2' }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    }
  `,
})
export class TimeTravelStateViewComponent {
  private readonly api = inject(TimeTravelApiService);
  protected readonly context = inject(TimeTravelContextService);

  readonly domain = input.required<TtDomain>();
  readonly filters = input<TtFilters>({});

  protected readonly buckets = TT_AGING_BUCKETS;
  protected readonly state = signal<TtState | null>(null);
  protected readonly meta = signal<TtStateMeta | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly trialBalance = computed(() => this.typed<TtTrialBalanceState>('trial_balance'));
  protected readonly accountLedger = computed(() => this.typed<TtAccountLedgerState>('account_ledger'));
  protected readonly aging = computed(() => this.typed<TtAgingState>('aging'));
  protected readonly inventory = computed(() => this.typed<TtInventoryState>('inventory'));

  private requestId = 0;

  constructor() {
    effect(() => {
      const validAt = this.context.validAtIso();
      const knownAt = this.context.knownAtIso();
      const domain = this.domain();
      const filters = this.filters();
      if (this.context.isActive() && validAt && knownAt) {
        void this.load(domain, validAt, knownAt, filters);
      }
    });
  }

  private typed<T extends TtState>(domain: TtDomain): T | null {
    const state = this.state();
    return state !== null && state.domain === domain && this.domain() === domain ? (state as T) : null;
  }

  private async load(domain: TtDomain, validAt: string, knownAt: string, filters: TtFilters): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(this.api.state({ domain, valid_at: validAt, known_at: knownAt, ...filters }));
      if (id === this.requestId) {
        this.state.set(response.data);
        this.meta.set(response.meta ?? null);
      }
    } catch (error) {
      if (id === this.requestId) {
        this.state.set(null);
        this.meta.set(null);
        this.error.set(failureKey(error));
      }
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }
}
