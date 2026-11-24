import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import {
  AGC_ACCRUAL_BASES,
  AGC_ENTRY_STATUSES,
  AgcAccrualBasis,
  AgcEntryStatus,
  PermissionsService,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import {
  AGENT_COMMISSIONS_MODULE,
  entryStatusColor,
  formatRate,
  isLockedEntry,
  LOCK_HINT_KEY,
} from './agent-commissions.util';
import { LedgerStore } from './ledger.store';

/**
 * Commission ledger (Mod 041): the commission accrued per invoice, invoiced or collected, the totals, and the lock of the
 * cash-basis entries that wait for a collection reconciled with the bank. Each entry opens a drawer with its movements.
 */
@Component({
  selector: 'app-ledger',
  imports: [
    FormsModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
  ],
  providers: [LedgerStore],
  template: `
    <app-page-header [title]="'PAGE_TITLE.AGENT_COMMISSIONS_LEDGER' | translate"></app-page-header>

    <div class="toolbar">
      <label class="field" for="agc-ledger-agent">
        <span>{{ 'agentCommissions.field.agent' | translate }}</span>
        <nz-select
          nzId="agc-ledger-agent"
          nzAllowClear
          [nzPlaceHolder]="'agentCommissions.action.all' | translate"
          [ngModel]="store.filters().agent_profile_id ?? null"
          (ngModelChange)="setFilter({ agent_profile_id: $event ?? undefined })"
        >
          @for (option of store.agentOptions(); track option.id) {
            <nz-option [nzValue]="option.id" [nzLabel]="option.name"></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="agc-ledger-status">
        <span>{{ 'agentCommissions.field.status' | translate }}</span>
        <nz-select
          nzId="agc-ledger-status"
          nzAllowClear
          [nzPlaceHolder]="'agentCommissions.action.all' | translate"
          [ngModel]="store.filters().status ?? null"
          (ngModelChange)="setFilter({ status: $event ?? undefined })"
        >
          @for (status of statuses; track status) {
            <nz-option
              [nzValue]="status"
              [nzLabel]="'agentCommissions.entryStatus.' + status | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="agc-ledger-basis">
        <span>{{ 'agentCommissions.field.accrualBasis' | translate }}</span>
        <nz-select
          nzId="agc-ledger-basis"
          nzAllowClear
          [nzPlaceHolder]="'agentCommissions.action.all' | translate"
          [ngModel]="store.filters().accrual_basis ?? null"
          (ngModelChange)="setFilter({ accrual_basis: $event ?? undefined })"
        >
          @for (basis of bases; track basis) {
            <nz-option
              [nzValue]="basis"
              [nzLabel]="'agentCommissions.accrualBasis.' + basis | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="agc-ledger-from">
        <span>{{ 'agentCommissions.field.from' | translate }}</span>
        <input
          nz-input
          id="agc-ledger-from"
          type="date"
          [ngModel]="store.filters().from ?? ''"
          (ngModelChange)="setFilter({ from: $event || undefined })"
        />
      </label>
      <label class="field" for="agc-ledger-to">
        <span>{{ 'agentCommissions.field.to' | translate }}</span>
        <input
          nz-input
          id="agc-ledger-to"
          type="date"
          [ngModel]="store.filters().to ?? ''"
          (ngModelChange)="setFilter({ to: $event || undefined })"
        />
      </label>
      <label class="field" for="agc-ledger-search">
        <span>{{ 'agentCommissions.field.search' | translate }}</span>
        <input
          nz-input
          id="agc-ledger-search"
          maxlength="60"
          [ngModel]="search()"
          (ngModelChange)="search.set($event)"
          (keydown.enter)="applySearch()"
          (blur)="applySearch()"
        />
      </label>
      <button nz-button type="button" (click)="reload()">
        {{ 'agentCommissions.action.refresh' | translate }}
      </button>
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" (click)="syncOpen.set(true)">
          {{ 'agentCommissions.action.sync' | translate }}
        </button>
      }
    </div>

    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (syncError(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    @if (store.totals(); as totals) {
      <section class="stats" [attr.aria-label]="'PAGE_TITLE.AGENT_COMMISSIONS_LEDGER' | translate">
        <nz-statistic
          [nzValue]="totals.commission | money: currency()"
          [nzTitle]="'agentCommissions.ledger.totalCommission' | translate"
        ></nz-statistic>
        <nz-statistic
          [nzValue]="totals.eligible | money: currency()"
          [nzTitle]="'agentCommissions.ledger.totalEligible' | translate"
        ></nz-statistic>
        <nz-statistic
          [nzValue]="totals.settled | money: currency()"
          [nzTitle]="'agentCommissions.ledger.totalSettled' | translate"
        ></nz-statistic>
        <nz-statistic
          class="blocked"
          [nzValue]="totals.blocked | money: currency()"
          [nzTitle]="'agentCommissions.ledger.totalBlocked' | translate"
        ></nz-statistic>
      </section>
    }

    <p class="hint">{{ 'agentCommissions.ledger.lockHint' | translate }}</p>

    <nz-spin [nzSpinning]="store.loading()">
      <nz-table
        #table
        nzSize="small"
        [nzData]="store.entries()"
        [nzTotal]="store.total()"
        [nzPageIndex]="store.page()"
        [nzPageSize]="store.pageSize()"
        [nzFrontPagination]="false"
        (nzPageIndexChange)="store.setPage($event)"
      >
        <thead>
          <tr>
            <th scope="col">{{ 'agentCommissions.field.invoice' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.agent' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.role' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.accrualBasis' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.field.base' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.field.rate' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.field.effective' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.field.payable' | translate }}</th>
            <th scope="col" class="num">{{ 'agentCommissions.field.blocked' | translate }}</th>
            <th scope="col">{{ 'agentCommissions.field.status' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (entry of table.data; track entry.id) {
            <tr [class.locked]="locked(entry)">
              <th scope="row">
                {{ entry.invoice_number }}
                <small class="muted">{{ entry.invoice_date }}</small>
              </th>
              <td>{{ entry.agent_name }}</td>
              <td>{{ 'agentCommissions.role.' + entry.role | translate }}</td>
              <td>{{ 'agentCommissions.accrualBasis.' + entry.accrual_basis | translate }}</td>
              <td class="num">{{ entry.base_amount | money: entry.currency }}</td>
              <td class="num">{{ rate(entry.rate) }}</td>
              <td class="num">{{ entry.effective_amount | money: entry.currency }}</td>
              <td class="num">{{ entry.payable_amount | money: entry.currency }}</td>
              <td class="num">
                @if (locked(entry)) {
                  <span
                    class="lock"
                    role="img"
                    nz-tooltip
                    [nzTooltipTitle]="lockHintKey | translate"
                    [attr.aria-label]="lockHintKey | translate"
                  >
                    <i class="fa-solid fa-lock" aria-hidden="true"></i>
                    {{ entry.blocked_amount | money: entry.currency }}
                  </span>
                } @else {
                  {{ entry.blocked_amount | money: entry.currency }}
                }
              </td>
              <td>
                <nz-tag [nzColor]="statusColor(entry.status)">{{
                  'agentCommissions.entryStatus.' + entry.status | translate
                }}</nz-tag>
              </td>
              <td>
                <button nz-button nzSize="small" type="button" (click)="store.openDetail(entry.id)">
                  {{ 'agentCommissions.action.details' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loading() && store.entries().length === 0) {
        <nz-empty [nzNotFoundContent]="'agentCommissions.ledger.empty' | translate"></nz-empty>
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="store.detail() !== null || store.loadingDetail()"
      [nzWidth]="560"
      [nzTitle]="'agentCommissions.action.details' | translate"
      (nzOnClose)="store.closeDetail()"
    >
      <ng-container *nzDrawerContent>
        <nz-spin [nzSpinning]="store.loadingDetail()">
          @if (store.detail(); as entry) {
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.invoice' | translate">
                {{ entry.invoice_number }} · {{ entry.invoice_date }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.agent' | translate">
                {{ entry.agent_name }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.role' | translate">
                {{ 'agentCommissions.role.' + entry.role | translate }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.accrualBasis' | translate">
                {{ 'agentCommissions.accrualBasis.' + entry.accrual_basis | translate }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.status' | translate">
                <nz-tag [nzColor]="statusColor(entry.status)">{{
                  'agentCommissions.entryStatus.' + entry.status | translate
                }}</nz-tag>
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.base' | translate">
                {{ entry.base_amount | money: entry.currency }} ({{ rate(entry.rate) }})
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.commission' | translate">
                {{ entry.commission_amount | money: entry.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.credited' | translate">
                {{ entry.credited_amount | money: entry.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.effective' | translate">
                {{ entry.effective_amount | money: entry.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.eligible' | translate">
                {{ entry.eligible_amount | money: entry.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.settled' | translate">
                {{ entry.settled_amount | money: entry.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.blocked' | translate">
                {{ entry.blocked_amount | money: entry.currency }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'agentCommissions.field.collectedRatio' | translate">
                {{ rate(percentOf(entry.collected_ratio)) }}
              </nz-descriptions-item>
              <nz-descriptions-item
                [nzTitle]="'agentCommissions.field.reconciledRatio' | translate"
              >
                {{ rate(percentOf(entry.reconciled_ratio)) }}
              </nz-descriptions-item>
            </nz-descriptions>

            @if (locked(entry)) {
              <nz-alert
                class="feedback"
                nzType="warning"
                nzShowIcon
                [nzMessage]="lockHintKey | translate"
              ></nz-alert>
            }

            <h4 class="movements-title">{{ 'agentCommissions.ledger.movements' | translate }}</h4>
            <nz-table
              nzSize="small"
              [nzData]="entry.movements ?? []"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th scope="col">{{ 'agentCommissions.field.date' | translate }}</th>
                  <th scope="col">{{ 'agentCommissions.field.role' | translate }}</th>
                  <th scope="col" class="num">{{ 'agentCommissions.field.amount' | translate }}</th>
                  <th scope="col">{{ 'agentCommissions.field.note' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (movement of entry.movements ?? []; track $index) {
                  <tr>
                    <td>{{ movement.occurred_on }}</td>
                    <td>{{ 'agentCommissions.movement.' + movement.kind | translate }}</td>
                    <td class="num">{{ movement.amount | money: entry.currency }}</td>
                    <td>{{ movement.note }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        </nz-spin>
      </ng-container>
    </nz-drawer>

    <nz-modal
      [nzVisible]="syncOpen()"
      [nzTitle]="'agentCommissions.action.sync' | translate"
      [nzOkText]="'agentCommissions.action.sync' | translate"
      [nzCancelText]="'agentCommissions.action.cancel' | translate"
      [nzOkLoading]="store.syncing()"
      (nzOnOk)="sync()"
      (nzOnCancel)="syncOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <p class="hint">{{ 'agentCommissions.ledger.syncRange' | translate }}</p>
        <div class="editor">
          <label class="field" for="agc-sync-from">
            <span>{{ 'agentCommissions.field.from' | translate }}</span>
            <input
              nz-input
              id="agc-sync-from"
              type="date"
              [ngModel]="syncFrom()"
              (ngModelChange)="syncFrom.set($event)"
            />
          </label>
          <label class="field" for="agc-sync-to">
            <span>{{ 'agentCommissions.field.to' | translate }}</span>
            <input
              nz-input
              id="agc-sync-to"
              type="date"
              [ngModel]="syncTo()"
              (ngModelChange)="syncTo.set($event)"
            />
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar,
    .editor {
      display: flex;
      flex-wrap: wrap;
      align-items: flex-end;
      gap: 16px;
      margin-bottom: 16px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 160px;
      font-size: 12px;
    }

    .feedback {
      margin-bottom: 12px;
    }

    .stats {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }

    .hint {
      margin: 0 0 12px;
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .muted {
      display: block;
      font-weight: normal;
      color: var(--ant-text-color-secondary, #595959);
    }

    .lock {
      color: var(--ant-warning-color, #d48806);
      font-weight: 600;
    }

    tr.locked {
      background: var(--ant-warning-color-deprecated-bg, #fffbe6);
    }

    .movements-title {
      margin: 24px 0 8px;
    }
  `,
})
export class LedgerComponent implements OnInit {
  readonly store = inject(LedgerStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  /** The synchronisation changes the ledger: it is a `manage` action, not available to the read-only roles. */
  readonly canWrite = inject(PermissionsService).canWrite(AGENT_COMMISSIONS_MODULE);

  readonly statuses = AGC_ENTRY_STATUSES;
  readonly bases = AGC_ACCRUAL_BASES;
  readonly lockHintKey = LOCK_HINT_KEY;

  readonly search = signal('');
  readonly syncOpen = signal(false);
  readonly syncFrom = signal('');
  readonly syncTo = signal('');
  readonly syncError = signal<string | null>(null);

  readonly rate = formatRate;
  readonly locked = isLockedEntry;
  readonly statusColor = entryStatusColor;

  /** The currency of the amounts of the page: the ledger of a company is in one currency. */
  readonly currency = computed(() => this.store.entries()[0]?.currency ?? 'EUR');

  ngOnInit(): void {
    void this.store.init();
  }

  setFilter(patch: {
    agent_profile_id?: string;
    status?: AgcEntryStatus;
    accrual_basis?: AgcAccrualBasis;
    from?: string;
    to?: string;
  }): Promise<void> {
    return this.store.setFilters(patch);
  }

  applySearch(): Promise<void> {
    const term = this.search().trim();
    if (term !== (this.store.filters().search ?? '')) {
      return this.store.setFilters({ search: term || undefined });
    }
    return Promise.resolve();
  }

  reload(): void {
    this.syncError.set(null);
    void this.store.load();
  }

  /** `0.5` shown as `50%`: the collected and reconciled shares come as fractions. */
  percentOf(ratio: string): number | null {
    const value = Number(ratio);
    return Number.isFinite(value) ? value * 100 : null;
  }

  async sync(): Promise<void> {
    this.syncError.set(null);
    const from = this.syncFrom();
    const to = this.syncTo();
    const outcome = await this.store.sync(from && to ? { from, to } : {});
    if (outcome.ok) {
      this.syncOpen.set(false);
      this.message.success(this.translate.instant('agentCommissions.message.synced'));
    } else {
      this.syncError.set(outcome.errorKey);
      this.syncOpen.set(false);
    }
  }
}
