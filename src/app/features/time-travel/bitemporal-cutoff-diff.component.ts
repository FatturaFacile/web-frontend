import { DecimalPipe, JsonPipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { firstValueFrom } from 'rxjs';
import { TimeTravelApiService } from '@core/api/time-travel-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TtBackdatedEntry, TtCutOffDiff, TtDiffStatus, TtDomain, TtFilters } from '@core/models/time-travel.model';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { TranslatePipe } from '@shared/pipes/translate.pipe';
import { deltaSign, failureKey, formatDateTime, shortHash } from './time-travel.util';

/**
 * Cut-off diff (Mod 354): the same economic date (`valid_at`) as it was known at two instants. The side-by-side table shows every
 * balance before and after, flags the lines that changed and lists the backdated entries recorded in between, each with its audit
 * trail (recording time, actor, event, SHA-256 chain hash) in a drawer.
 */
@Component({
  selector: 'app-bitemporal-cutoff-diff',
  imports: [
    DecimalPipe,
    JsonPipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzEmptyModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (error(); as key) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="key | translate" data-testid="tt-diff-error" />
    }
    @if (diff(); as d) {
      <h3 class="tt-diff-title">{{ 'TIME_TRAVEL.DIFF.TITLE' | translate }}</h3>
      <nz-table
        nzSize="small"
        [nzData]="d.rows"
        [nzLoading]="loading()"
        [nzPageSize]="50"
        [nzNoResult]="noResult"
        data-testid="tt-diff-table"
      >
        <thead>
          <tr>
            <th>{{ 'TIME_TRAVEL.DIFF.COL_LINE' | translate }}</th>
            <th nzAlign="right">{{ beforeHeader() }}</th>
            <th nzAlign="right">{{ afterHeader() }}</th>
            <th nzAlign="right">{{ 'TIME_TRAVEL.DIFF.COL_DELTA' | translate }}</th>
            <th>{{ 'TIME_TRAVEL.DIFF.COL_STATUS' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of d.rows; track row.key) {
            <tr [class]="'tt-row-' + row.status">
              <td>{{ row.label }}</td>
              <td nzAlign="right">{{ row.before | number: '1.2-2' }}</td>
              <td nzAlign="right">{{ row.after | number: '1.2-2' }}</td>
              <td nzAlign="right" [class]="'tt-delta tt-delta-' + sign(row.delta)">{{ row.delta | number: '1.2-2' }}</td>
              <td>
                <nz-tag [nzColor]="statusColor(row.status)" [attr.data-testid]="'tt-status-' + row.status">
                  {{ 'TIME_TRAVEL.DIFF.STATUS_' + row.status.toUpperCase() | translate }}
                </nz-tag>
              </td>
            </tr>
          }
          <tr class="totals">
            <th scope="row">{{ 'TIME_TRAVEL.COL.TOTAL' | translate }}</th>
            <td nzAlign="right">{{ d.totals.before | number: '1.2-2' }}</td>
            <td nzAlign="right">{{ d.totals.after | number: '1.2-2' }}</td>
            <td nzAlign="right" [class]="'tt-delta tt-delta-' + sign(d.totals.delta)">{{ d.totals.delta | number: '1.2-2' }}</td>
            <td></td>
          </tr>
        </tbody>
      </nz-table>
      <ng-template #noResult>
        <nz-empty [nzNotFoundContent]="'TIME_TRAVEL.DIFF.NO_DIFFERENCES' | translate" />
      </ng-template>

      <h3 class="tt-diff-title">{{ 'TIME_TRAVEL.DIFF.BACKDATED_TITLE' | translate }}</h3>
      <nz-table
        nzSize="small"
        [nzData]="d.backdated_entries"
        [nzPageSize]="20"
        [nzNoResult]="noBackdated"
        data-testid="tt-backdated-table"
      >
        <thead>
          <tr>
            <th>{{ 'TIME_TRAVEL.DIFF.COL_EVENT' | translate }}</th>
            <th>{{ 'TIME_TRAVEL.DIFF.COL_SOURCE' | translate }}</th>
            <th>{{ 'TIME_TRAVEL.AUDIT.VALID_AT' | translate }}</th>
            <th>{{ 'TIME_TRAVEL.AUDIT.RECORDED_AT' | translate }}</th>
            <th>{{ 'TIME_TRAVEL.AUDIT.ACTOR' | translate }}</th>
            <th nzAlign="right">{{ 'TIME_TRAVEL.DIFF.COL_DELTA' | translate }}</th>
            <th><span class="tt-visually-hidden">{{ 'TIME_TRAVEL.DIFF.COL_ACTIONS' | translate }}</span></th>
          </tr>
        </thead>
        <tbody>
          @for (entry of d.backdated_entries; track entry.event_id) {
            <tr>
              <td>
                <nz-tag nzColor="orange">{{ 'TIME_TRAVEL.DIFF.BADGE_BACKDATED' | translate }}</nz-tag>
                {{ entry.event_type }}
              </td>
              <td>{{ entry.source_document ?? '—' }}</td>
              <td>{{ format(entry.valid_at) }}</td>
              <td>{{ format(entry.recorded_at) }}</td>
              <td>{{ entry.actor_name ?? entry.actor_user_id ?? '—' }}</td>
              <td nzAlign="right" [class]="'tt-delta tt-delta-' + sign(entry.amount_delta)">{{ entry.amount_delta | number: '1.2-2' }}</td>
              <td>
                <button nz-button nzSize="small" type="button" data-testid="tt-open-trail" (click)="open(entry)">
                  {{ 'TIME_TRAVEL.DIFF.OPEN_TRAIL' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      <ng-template #noBackdated>
        <nz-empty [nzNotFoundContent]="'TIME_TRAVEL.DIFF.NO_BACKDATED' | translate" />
      </ng-template>
    }

    <nz-drawer
      [nzVisible]="selected() !== null"
      [nzWidth]="560"
      [nzTitle]="'TIME_TRAVEL.AUDIT.TITLE' | translate"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (selected(); as entry) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1" data-testid="tt-audit-trail">
            <nz-descriptions-item [nzTitle]="'TIME_TRAVEL.AUDIT.EVENT_TYPE' | translate">{{ entry.event_type }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'TIME_TRAVEL.AUDIT.AGGREGATE' | translate">
              {{ 'TIME_TRAVEL.AGGREGATE.' + entry.aggregate_type.toUpperCase() | translate }} · {{ entry.aggregate_id }}
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'TIME_TRAVEL.AUDIT.VALID_AT' | translate">{{ format(entry.valid_at) }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'TIME_TRAVEL.AUDIT.RECORDED_AT' | translate">{{ format(entry.recorded_at) }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'TIME_TRAVEL.AUDIT.ACTOR' | translate">{{ entry.actor_name ?? entry.actor_user_id ?? '—' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'TIME_TRAVEL.AUDIT.SOURCE' | translate">{{ entry.source_document ?? '—' }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'TIME_TRAVEL.AUDIT.HASH' | translate">
              <code [attr.title]="entry.cryptographic_chain_hash">{{ hash(entry.cryptographic_chain_hash) }}</code>
            </nz-descriptions-item>
          </nz-descriptions>
          <h4 class="tt-diff-title">{{ 'TIME_TRAVEL.AUDIT.PAYLOAD' | translate }}</h4>
          <pre class="tt-payload">{{ entry.payload | json }}</pre>
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .tt-diff-title {
      margin: 16px 0 8px;
    }
    .tt-row-backdated td {
      background: #fff7e6;
    }
    .tt-delta-positive {
      color: var(--ant-color-success, #389e0d);
    }
    .tt-delta-negative {
      color: var(--ant-color-error, #cf1322);
    }
    .tt-payload {
      max-height: 320px;
      overflow: auto;
    }
    .tt-visually-hidden {
      position: absolute;
      width: 1px;
      height: 1px;
      overflow: hidden;
      clip: rect(0 0 0 0);
    }
  `,
})
export class BitemporalCutoffDiffComponent {
  private readonly api = inject(TimeTravelApiService);
  private readonly i18n = inject(I18nService);
  protected readonly context = inject(TimeTravelContextService);

  readonly domain = input.required<TtDomain>();
  readonly filters = input<TtFilters>({});

  protected readonly diff = signal<TtCutOffDiff | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly selected = signal<TtBackdatedEntry | null>(null);

  protected readonly beforeHeader = computed(() =>
    this.i18n.translate('TIME_TRAVEL.DIFF.COL_BEFORE', { knownAt: this.format(this.diff()?.known_at_from ?? null) }),
  );
  protected readonly afterHeader = computed(() =>
    this.i18n.translate('TIME_TRAVEL.DIFF.COL_AFTER', { knownAt: this.format(this.diff()?.known_at_to ?? null) }),
  );

  private requestId = 0;

  constructor() {
    effect(() => {
      const validAt = this.context.validAtIso();
      const from = this.context.knownAtIso();
      const to = this.context.comparisonKnownAtIso();
      const domain = this.domain();
      const filters = this.filters();
      if (this.context.isDiffMode() && this.context.diffRangeValid() && validAt && from && to) {
        void this.load(domain, validAt, from, to, filters);
      } else {
        this.diff.set(null);
      }
    });
  }

  protected format(value: string | null): string {
    return formatDateTime(value, this.i18n.dictionaryLocale());
  }

  protected sign(value: string): 'positive' | 'negative' | 'zero' {
    return deltaSign(value);
  }

  protected hash(value: string): string {
    return shortHash(value);
  }

  protected statusColor(status: TtDiffStatus): string {
    switch (status) {
      case 'backdated':
        return 'orange';
      case 'delta':
        return 'blue';
      default:
        return 'default';
    }
  }

  protected open(entry: TtBackdatedEntry): void {
    this.selected.set(entry);
  }

  protected close(): void {
    this.selected.set(null);
  }

  private async load(domain: TtDomain, validAt: string, from: string, to: string, filters: TtFilters): Promise<void> {
    const id = ++this.requestId;
    this.loading.set(true);
    this.error.set(null);
    try {
      const response = await firstValueFrom(
        this.api.cutOffDiff({ domain, valid_at: validAt, known_at_from: from, known_at_to: to, ...filters }),
      );
      if (id === this.requestId) {
        this.diff.set(response.data);
      }
    } catch (error) {
      if (id === this.requestId) {
        this.diff.set(null);
        this.error.set(failureKey(error));
      }
    } finally {
      if (id === this.requestId) {
        this.loading.set(false);
      }
    }
  }
}
