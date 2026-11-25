import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { BankingApiService } from '@core/api/banking-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TreasuryBankingApiService } from '@core/api/treasury-banking-api.service';
import { BankStatement } from '@core/models/banking.model';
import {
  ReconciliationProposal,
  SmartReconciliationFilters,
  SmartReconciliationLine,
  SmartReconciliationSummary,
} from '@core/models/treasury-banking.model';
import { TranslatePipe } from '@shared';
import {
  apiErrorMessages,
  confidenceTone,
  kindLabelKey,
  ruleLabelKey,
} from './treasury-banking.util';

/**
 * Smart reconciliation workbench: statement lines with the ranked proposals of the engine (structured reference, exact
 * amount + counterparty, fuzzy invoice number with fee and exchange tolerances). A proposal is applied in one click; the
 * API settles the document and posts the prima nota (payment, bank charges, exchange difference) atomically, and a
 * reconciled line can be taken back.
 */
@Component({
  selector: 'app-tr-smart-reconciliation',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzBadgeModule,
    NzButtonModule,
    NzCardModule,
    NzGridModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    NzTooltipModule,
    TranslatePipe,
  ],
  template: `
    @if (summary(); as s) {
      <div nz-row [nzGutter]="16" class="stats" data-testid="summary">
        <div nz-col [nzXs]="12" [nzMd]="5">
          <nz-statistic [nzTitle]="'tbk.smart.stat.open' | translate" [nzValue]="s.open_lines" />
        </div>
        <div nz-col [nzXs]="12" [nzMd]="5">
          <nz-statistic
            [nzTitle]="'tbk.smart.stat.withProposals' | translate"
            [nzValue]="s.lines_with_proposals"
          />
        </div>
        <div nz-col [nzXs]="12" [nzMd]="5">
          <nz-statistic
            [nzTitle]="'tbk.smart.stat.highConfidence' | translate"
            [nzValue]="s.high_confidence"
          />
        </div>
        <div nz-col [nzXs]="12" [nzMd]="5">
          <nz-statistic
            [nzTitle]="'tbk.smart.stat.reconciled' | translate"
            [nzValue]="s.reconciled_lines"
          />
        </div>
        <div nz-col [nzXs]="12" [nzMd]="4">
          <nz-statistic
            [nzTitle]="'tbk.smart.stat.applied' | translate"
            [nzValue]="s.applied_proposals"
          />
        </div>
      </div>
    }

    <nz-card [nzTitle]="'tbk.smart.title' | translate">
      <div class="filters">
        <nz-select
          [ngModel]="filters().status"
          (ngModelChange)="patch({ status: $event })"
          data-testid="status"
          [attr.aria-label]="'tbk.smart.filter.status' | translate"
        >
          <nz-option nzValue="open" [nzLabel]="'tbk.smart.open' | translate" />
          <nz-option nzValue="reconciled" [nzLabel]="'tbk.smart.reconciled' | translate" />
          <nz-option nzValue="all" [nzLabel]="'tbk.smart.all' | translate" />
        </nz-select>
        <nz-select
          nzAllowClear
          [ngModel]="filters().direction || null"
          (ngModelChange)="patch({ direction: $event ?? '' })"
          [nzPlaceHolder]="'tbk.smart.filter.direction' | translate"
        >
          <nz-option nzValue="credit" [nzLabel]="'tbk.smart.credit' | translate" />
          <nz-option nzValue="debit" [nzLabel]="'tbk.smart.debit' | translate" />
        </nz-select>
        <nz-select
          nzAllowClear
          [ngModel]="filters().min_confidence ?? null"
          (ngModelChange)="patch({ min_confidence: $event })"
          [nzPlaceHolder]="'tbk.smart.filter.confidence' | translate"
          data-testid="confidence"
        >
          <nz-option [nzValue]="95" [nzLabel]="'≥ 95%'" />
          <nz-option [nzValue]="80" [nzLabel]="'≥ 80%'" />
          <nz-option [nzValue]="60" [nzLabel]="'≥ 60%'" />
        </nz-select>
        <nz-select
          nzAllowClear
          nzShowSearch
          [ngModel]="filters().statement_id ?? null"
          (ngModelChange)="patch({ statement_id: $event ?? undefined })"
          [nzPlaceHolder]="'tbk.smart.filter.statement' | translate"
        >
          @for (statement of statements(); track statement.id) {
            <nz-option
              [nzValue]="statement.id"
              [nzLabel]="statement.statement_date + ' · ' + statement.account_iban"
            />
          }
        </nz-select>
        <input
          nz-input
          [attr.aria-label]="'tbk.smart.filter.search' | translate"
          [placeholder]="'tbk.smart.filter.search' | translate"
          [ngModel]="filters().search ?? ''"
          (ngModelChange)="patch({ search: $event })"
          data-testid="search"
        />
        <button
          nz-button
          type="button"
          [disabled]="!filters().statement_id"
          [nzLoading]="running()"
          (click)="run(false)"
          data-testid="run"
        >
          {{ 'tbk.smart.run' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!filters().statement_id"
          [nzLoading]="running()"
          (click)="run(true)"
          data-testid="run-apply"
        >
          {{ 'tbk.smart.runApply' | translate }}
        </button>
      </div>

      @if (errors().length > 0) {
        <nz-alert
          class="gap"
          nzType="error"
          nzShowIcon
          [nzMessage]="errors()[0]"
          data-testid="errors"
        />
      }
      @if (notice(); as key) {
        <nz-alert
          class="gap"
          nzType="success"
          nzShowIcon
          [nzMessage]="key | translate"
          data-testid="notice"
        />
      }

      <nz-table
        #table
        [nzData]="lines()"
        nzSize="small"
        [nzLoading]="loading()"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="filters().page ?? 1"
        [nzPageSize]="filters().per_page ?? 25"
        (nzPageIndexChange)="patch({ page: $event }, false)"
      >
        <thead>
          <tr>
            <th></th>
            <th>{{ 'tbk.smart.col.date' | translate }}</th>
            <th>{{ 'tbk.smart.col.counterparty' | translate }}</th>
            <th>{{ 'tbk.smart.col.description' | translate }}</th>
            <th class="num">{{ 'tbk.smart.col.amount' | translate }}</th>
            <th>{{ 'tbk.smart.col.match' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (line of table.data; track line.id) {
            <tr>
              <td>
                <button
                  nz-button
                  nzType="link"
                  type="button"
                  [attr.aria-expanded]="expanded() === line.id"
                  (click)="toggle(line.id)"
                >
                  {{ expanded() === line.id ? '−' : '+' }}
                </button>
              </td>
              <td>{{ line.booking_date }}</td>
              <td>
                {{ line.counterpart_name }}<br /><small>{{ line.counterpart_iban }}</small>
              </td>
              <td>
                {{ line.description }}<br /><small>{{ line.qr_reference ?? line.reference }}</small>
              </td>
              <td class="num">
                <span [class.debit]="line.direction === 'debit'"
                  >{{ line.direction === 'debit' ? '-' : '' }}{{ line.amount }}
                  {{ line.currency }}</span
                >
                @if (line.fee_amount !== '0.00') {
                  <br /><small>{{ 'tbk.smart.fee' | translate }}: {{ line.fee_amount }}</small>
                }
              </td>
              <td>
                @if (line.reconciled) {
                  <nz-tag nzColor="green">{{ 'tbk.smart.reconciled' | translate }}</nz-tag>
                } @else if (best(line); as top) {
                  <nz-tag [nzColor]="tone(top.confidence)"
                    >{{ top.confidence }}% · {{ ruleKey(top.rule) | translate }}</nz-tag
                  >
                } @else {
                  <nz-tag>{{ 'tbk.smart.noProposal' | translate }}</nz-tag>
                }
              </td>
              <td>
                @if (line.reconciled) {
                  <button
                    nz-button
                    type="button"
                    nzDanger
                    (click)="confirmUnmatch(line)"
                    [attr.data-testid]="'unmatch-' + line.id"
                  >
                    {{ 'tbk.smart.unmatch' | translate }}
                  </button>
                } @else {
                  @if (best(line); as top) {
                    <button
                      nz-button
                      nzType="primary"
                      type="button"
                      [nzLoading]="busy() === top.id"
                      (click)="apply(top)"
                      [attr.data-testid]="'apply-' + top.id"
                    >
                      {{ 'tbk.smart.apply' | translate }}
                    </button>
                  }
                  <button
                    nz-button
                    type="button"
                    [nzLoading]="busy() === line.id"
                    (click)="refresh(line)"
                  >
                    {{ 'tbk.smart.refresh' | translate }}
                  </button>
                }
              </td>
            </tr>
            @if (expanded() === line.id) {
              <tr class="detail">
                <td colspan="7">
                  @if (line.proposals.length === 0) {
                    <em>{{ 'tbk.smart.noProposal' | translate }}</em>
                  }
                  @for (proposal of line.proposals; track proposal.id) {
                    <div class="proposal" [attr.data-testid]="'proposal-' + proposal.id">
                      <nz-tag [nzColor]="tone(proposal.confidence)"
                        >{{ proposal.confidence }}%</nz-tag
                      >
                      <strong>{{ proposal.document_number }}</strong>
                      <span
                        >{{ ruleKey(proposal.rule) | translate }} ·
                        {{ kindKey(proposal) | translate }}</span
                      >
                      <span
                        >{{ 'tbk.smart.settles' | translate }} {{ proposal.matched_amount }}
                        {{ proposal.currency }}</span
                      >
                      @if (proposal.fee_amount !== '0.00') {
                        <nz-tag nzColor="gold"
                          >{{ 'tbk.smart.fee' | translate }} {{ proposal.fee_amount }}</nz-tag
                        >
                      }
                      @if (proposal.fx_difference !== '0.00') {
                        <nz-tag nzColor="purple"
                          >{{ 'tbk.smart.fx' | translate }} {{ proposal.fx_difference }}</nz-tag
                        >
                      }
                      @if (proposal.residual_amount !== '0.00') {
                        <nz-tag nzColor="orange"
                          >{{ 'tbk.smart.residual' | translate }}
                          {{ proposal.residual_amount }}</nz-tag
                        >
                      }
                      @for (reason of proposal.reasons; track reason) {
                        <nz-tag>{{ 'tbk.reason.' + reason | translate }}</nz-tag>
                      }
                      @if (proposal.status === 'pending' && !line.reconciled) {
                        <button
                          nz-button
                          nzType="primary"
                          nzSize="small"
                          type="button"
                          (click)="apply(proposal)"
                        >
                          {{ 'tbk.smart.apply' | translate }}
                        </button>
                        <button nz-button nzSize="small" type="button" (click)="reject(proposal)">
                          {{ 'tbk.smart.reject' | translate }}
                        </button>
                      }
                    </div>
                  }
                </td>
              </tr>
            }
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
  styles: `
    :host {
      display: block;
    }
    .stats,
    .gap {
      margin-bottom: 16px;
    }
    .filters {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 8px;
      margin-bottom: 16px;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .debit {
      color: #cf1322;
    }
    .proposal {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      padding: 4px 0;
    }
  `,
})
export class TrSmartReconciliationComponent implements OnInit {
  private readonly api = inject(TreasuryBankingApiService);
  private readonly banking = inject(BankingApiService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly summary = signal<SmartReconciliationSummary | null>(null);
  protected readonly statements = signal<BankStatement[]>([]);
  protected readonly lines = signal<SmartReconciliationLine[]>([]);
  protected readonly total = signal(0);
  protected readonly filters = signal<SmartReconciliationFilters>({
    status: 'open',
    page: 1,
    per_page: 25,
  });
  protected readonly expanded = signal<string | null>(null);
  protected readonly loading = signal(false);
  protected readonly running = signal(false);
  protected readonly busy = signal<string | null>(null);
  protected readonly errors = signal<string[]>([]);
  protected readonly notice = signal<string | null>(null);

  protected readonly tone = confidenceTone;
  protected readonly ruleKey = ruleLabelKey;

  ngOnInit(): void {
    this.banking
      .getBankStatements({ per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.statements.set(res.data));
    this.load();
  }

  protected kindKey(proposal: ReconciliationProposal): string {
    return kindLabelKey(proposal.kind);
  }

  /** The proposal with the highest confidence still open on the line. */
  protected best(line: SmartReconciliationLine): ReconciliationProposal | null {
    return line.proposals.find((proposal) => proposal.status === 'pending') ?? null;
  }

  protected patch(change: Partial<SmartReconciliationFilters>, resetPage = true): void {
    this.filters.update((filters) => ({
      ...filters,
      ...change,
      page: resetPage ? 1 : (change.page ?? filters.page),
    }));
    this.load();
  }

  protected toggle(id: string): void {
    this.expanded.update((current) => (current === id ? null : id));
  }

  protected run(autoApply: boolean): void {
    const statementId = this.filters().statement_id;

    if (!statementId) {
      return;
    }

    this.running.set(true);
    this.errors.set([]);
    this.api
      .runSmartReconciliation(statementId, autoApply)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.running.set(false);
          this.notice.set('tbk.smart.runDone');
          this.load();
        },
        error: (error: unknown) => {
          this.running.set(false);
          this.errors.set(apiErrorMessages(error));
        },
      });
  }

  protected apply(proposal: ReconciliationProposal): void {
    this.busy.set(proposal.id);
    this.errors.set([]);
    this.api
      .applyProposal(proposal.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.busy.set(null);
          this.notice.set('tbk.smart.applied');
          this.load();
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.errors.set(apiErrorMessages(error));
        },
      });
  }

  protected reject(proposal: ReconciliationProposal): void {
    this.api
      .rejectProposal(proposal.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => this.load(),
        error: (error: unknown) => this.errors.set(apiErrorMessages(error)),
      });
  }

  protected refresh(line: SmartReconciliationLine): void {
    this.busy.set(line.id);
    this.api
      .refreshSmartLine(line.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.busy.set(null);
          this.lines.update((lines) => lines.map((row) => (row.id === line.id ? res.data : row)));
          this.expanded.set(line.id);
        },
        error: (error: unknown) => {
          this.busy.set(null);
          this.errors.set(apiErrorMessages(error));
        },
      });
  }

  protected confirmUnmatch(line: SmartReconciliationLine): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('tbk.smart.unmatchTitle'),
      nzContent: this.i18n.translate('tbk.smart.unmatchBody'),
      nzOkDanger: true,
      nzOkText: this.i18n.translate('tbk.smart.unmatch'),
      nzCancelText: this.i18n.translate('tbk.common.cancel'),
      nzOnOk: () => this.unmatch(line),
    });
  }

  private unmatch(line: SmartReconciliationLine): void {
    this.api
      .unmatchSmartLine(line.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.notice.set('tbk.smart.unmatched');
          this.load();
        },
        error: (error: unknown) => this.errors.set(apiErrorMessages(error)),
      });
  }

  private load(): void {
    this.loading.set(true);
    const { direction, ...rest } = this.filters();
    this.api
      .getSmartLines({ ...rest, direction: direction || undefined, with_proposals: false })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.lines.set(res.data);
          this.total.set(res.meta?.total ?? res.data.length);
          this.loading.set(false);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.errors.set(apiErrorMessages(error));
        },
      });
    this.api
      .getSmartSummary()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.summary.set(res.data));
  }
}
