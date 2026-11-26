import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CurrencyApiService, CurrencySyncRun, I18nService } from '@core';
import { currencyProblemText, isCurrencyFailure, TranslatePipe } from '@shared';
import { isSyncActive, syncStatusColor } from './currency-fx.util';

/** How often the list refreshes while a run is queued or running. */
export const SYNC_POLL_MS = 5000;

/**
 * The ECB / SNB / ESTV synchronisation runs, with the status of each one and its error, and the "update now" action
 * (202 queued; 409 = a synchronisation is already running, shown as a warning).
 */
@Component({
  selector: 'app-fx-sync-runs',
  imports: [
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  styleUrl: './currency-fx.scss',
  template: `
    <div class="toolbar">
      @if (canWrite()) {
        <button
          nz-button
          nzType="primary"
          type="button"
          class="sync-now"
          [nzLoading]="syncing()"
          (click)="syncNow()"
        >
          {{ 'FINANCE.CURRENCIES.ACTION.SYNC_NOW' | translate }}
        </button>
      }
      <button nz-button type="button" class="refresh" (click)="load()">
        {{ 'FINANCE.CURRENCIES.ACTION.REFRESH' | translate }}
      </button>
    </div>

    @if (warning(); as key) {
      <nz-alert
        class="form-alert"
        nzType="warning"
        nzShowIcon
        [nzMessage]="key | translate"
      ></nz-alert>
    }
    @if (error(); as key) {
      <nz-alert
        class="form-alert"
        nzType="error"
        nzShowIcon
        [nzMessage]="key | translate"
        [nzDescription]="detail()"
      ></nz-alert>
    }

    <nz-spin [nzSpinning]="loading()">
      <nz-table
        #table
        nzSize="middle"
        [nzData]="runs()"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'FINANCE.CURRENCIES.COLUMN.PROVIDER' | translate }}</th>
            <th>{{ 'FINANCE.CURRENCIES.COLUMN.STATUS' | translate }}</th>
            <th>{{ 'FINANCE.CURRENCIES.COLUMN.TRIGGER' | translate }}</th>
            <th>{{ 'FINANCE.CURRENCIES.COLUMN.STARTED_AT' | translate }}</th>
            <th>{{ 'FINANCE.CURRENCIES.COLUMN.FINISHED_AT' | translate }}</th>
            <th class="num">{{ 'FINANCE.CURRENCIES.COLUMN.RATES_COUNT' | translate }}</th>
            <th class="num">{{ 'FINANCE.CURRENCIES.COLUMN.DERIVED_COUNT' | translate }}</th>
            <th>{{ 'FINANCE.CURRENCIES.COLUMN.ERROR' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (run of table.data; track run.id) {
            <tr>
              <td>{{ 'FINANCE.CURRENCIES.PROVIDER.' + run.provider | translate }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(run)">{{
                  'FINANCE.CURRENCIES.SYNC_STATUS.' + run.status | translate
                }}</nz-tag>
              </td>
              <td>{{ 'FINANCE.CURRENCIES.TRIGGER.' + run.trigger | translate }}</td>
              <td>{{ run.started_at ? (run.started_at | date: 'short') : '' }}</td>
              <td>{{ run.finished_at ? (run.finished_at | date: 'short') : '' }}</td>
              <td class="num">{{ run.rates_count }}</td>
              <td class="num">{{ run.derived_count }}</td>
              <td class="sync-error">{{ run.error_message }}</td>
            </tr>
          } @empty {
            <tr>
              <td colspan="8">
                <nz-empty
                  [nzNotFoundContent]="'FINANCE.CURRENCIES.EMPTY.SYNC_RUNS' | translate"
                ></nz-empty>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-spin>
  `,
})
export class SyncRunsComponent implements OnInit {
  private readonly api = inject(CurrencyApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  /** Write access (finance roles): without it the "update now" action is hidden. */
  readonly canWrite = input(true);
  readonly synced = signal(0);

  protected readonly runs = signal<CurrencySyncRun[]>([]);
  protected readonly loading = signal(false);
  protected readonly syncing = signal(false);
  protected readonly warning = signal<string | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<string | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;

  protected readonly statusColor = (run: CurrencySyncRun): string => syncStatusColor(run.status);

  constructor() {
    this.destroyRef.onDestroy(() => this.stopPolling());
  }

  ngOnInit(): void {
    void this.load();
  }

  async load(): Promise<void> {
    this.loading.set(true);
    this.error.set(null);
    this.detail.set(null);
    try {
      const response = await firstValueFrom(this.api.listSyncRuns());
      this.runs.set(response.data);
      this.schedulePoll();
    } catch (error) {
      this.error.set('FINANCE.CURRENCIES.ERROR.LOAD_FAILED');
      this.detail.set(currencyProblemText(error));
    } finally {
      this.loading.set(false);
    }
  }

  /** "Update now": queues the synchronisation of every provider. */
  async syncNow(): Promise<void> {
    this.syncing.set(true);
    this.warning.set(null);
    this.error.set(null);
    try {
      await firstValueFrom(this.api.syncRates());
      this.message.success(this.i18n.translate('FINANCE.CURRENCIES.MESSAGE.SYNC_QUEUED'));
      this.synced.update((count) => count + 1);
      await this.load();
    } catch (error) {
      if (isCurrencyFailure(error, 409)) {
        this.warning.set('FINANCE.CURRENCIES.MESSAGE.SYNC_ALREADY_RUNNING');
      } else {
        this.error.set('FINANCE.CURRENCIES.ERROR.SYNC_FAILED');
        this.detail.set(currencyProblemText(error));
      }
    } finally {
      this.syncing.set(false);
    }
  }

  private schedulePoll(): void {
    this.stopPolling();
    if (this.runs().some((run) => isSyncActive(run.status))) {
      this.timer = setTimeout(() => void this.load(), SYNC_POLL_MS);
    }
  }

  private stopPolling(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }
}
