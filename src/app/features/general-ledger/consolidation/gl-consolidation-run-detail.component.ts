import { NgTemplateOutlet } from '@angular/common';
import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ConsolidatedBalanceSheet,
  ConsolidatedIncomeStatement,
  ConsolidatedReclassifiedStatement,
  ConsolidatedTrialBalance,
  ConsolidationRun,
  ConsolidationRunVerification,
  GeneralLedgerConsolidationApiService,
  GeneralLedgerFiscalApiService,
  GoodwillSchedule,
  I18nService,
  PermissionsService,
  StatementScheme,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { snapshotName } from './gl-consolidation.util';

type StatementKind = 'trial' | 'balance' | 'income' | 'goodwill' | 'reclassified';

/** Result of a consolidation run: balances, warnings, adjustments and the consolidated statements, with verify, lock and delete. */
@Component({
  selector: 'app-gl-consolidation-run-detail',
  styleUrl: './gl-consolidation.scss',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    GlErrorAlertComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <app-gl-error-alert [error]="error()" />
    @if (run(); as current) {
      <div class="toolbar">
        <a nz-button [routerLink]="['/general-ledger/consolidation', current.group_id]">{{ 'GL.CONS_BACK_TO_GROUP' | translate }}</a>
        <span class="spacer"></span>
        <button nz-button type="button" [nzLoading]="verifying()" (click)="verify()">{{ 'GL.CONS_VERIFY' | translate }}</button>
        @if (canWrite && current.status !== 'locked') {
          <button
            nz-button
            nzType="primary"
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'GL.CONS_CONFIRM_LOCK' | translate"
            (nzOnConfirm)="lock()"
          >
            {{ 'GL.CONS_LOCK' | translate }}
          </button>
          <button
            nz-button
            nzDanger
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'GL.CONFIRM_DELETE' | translate"
            (nzOnConfirm)="remove()"
          >
            {{ 'COMMON.DELETE' | translate }}
          </button>
        }
      </div>

      @if (verification(); as check) {
        <nz-alert
          [nzType]="check.matches ? 'success' : 'warning'"
          nzShowIcon
          [nzMessage]="(check.matches ? 'GL.CONS_VERIFY_OK' : 'GL.CONS_VERIFY_CHANGED') | translate"
        />
      }

      <nz-card [nzTitle]="('GL.CONS_RUN_TITLE' | translate) + ' v' + current.version">
        <div class="summary-grid">
          <div>
            <span class="muted">{{ 'GL.PERIOD' | translate }}</span>
            <div>{{ current.period_start }} / {{ current.period_end }}</div>
          </div>
          <div>
            <span class="muted">{{ 'GL.STATUS' | translate }}</span>
            <div>
              <nz-tag [nzColor]="current.status === 'locked' ? 'blue' : 'green'">{{ 'GL.CONS_RUN_' + current.status.toUpperCase() | translate }}</nz-tag>
            </div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_GROUP_CURRENCY' | translate }}</span>
            <div>{{ current.group_currency }}</div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_TOTAL_ASSETS' | translate }}</span>
            <div>{{ current.totals.total_assets | money: current.group_currency }}</div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_TOTAL_LIABILITIES' | translate }}</span>
            <div>{{ current.totals.total_liabilities | money: current.group_currency }}</div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_TOTAL_EQUITY' | translate }}</span>
            <div>{{ current.totals.total_equity | money: current.group_currency }}</div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_BALANCED' | translate }}</span>
            <div>
              <nz-tag [nzColor]="current.totals.trial_balance_is_balanced ? 'green' : 'red'">{{ 'GL.CONS_TRIAL_BALANCE' | translate }}</nz-tag>
              <nz-tag [nzColor]="current.totals.balance_sheet_is_balanced ? 'green' : 'red'">{{ 'GL.CONS_BALANCE_SHEET' | translate }}</nz-tag>
            </div>
          </div>
          <div>
            <span class="muted">{{ 'GL.CONS_FINGERPRINT' | translate }}</span>
            <div class="muted">{{ current.input_fingerprint.slice(0, 16) }}</div>
          </div>
        </div>
      </nz-card>

      <nz-tabs nzType="card" (nzSelectedIndexChange)="onTab($event)">
        <nz-tab [nzTitle]="'GL.CONS_TAB_SUMMARY' | translate">
          <div class="section-title">{{ 'GL.CONS_WARNINGS' | translate }}</div>
          @for (warning of current.warnings ?? []; track $index) {
            <nz-alert nzType="warning" nzShowIcon [nzMessage]="warning.message" />
          } @empty {
            <span class="muted">{{ 'GL.CONS_NO_WARNINGS' | translate }}</span>
          }

          <div class="section-title">{{ 'GL.CONS_MEMBERS' | translate }}</div>
          <nz-table nzSize="small" [nzData]="current.members ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'GL.COL_NAME' | translate }}</th>
                <th>{{ 'GL.CONS_METHOD' | translate }}</th>
                <th class="num">{{ 'GL.CONS_OWNERSHIP' | translate }}</th>
                <th class="num">{{ 'GL.CONS_SHARE' | translate }}</th>
                <th>{{ 'GL.CONS_ENTITY_CURRENCY' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (member of current.members ?? []; track member.tenant_id) {
                <tr>
                  <td>{{ member.name }}</td>
                  <td>{{ 'GL.CONS_METHOD_' + member.consolidation_method.toUpperCase() | translate }}</td>
                  <td class="num">{{ member.ownership_percentage }}%</td>
                  <td class="num">{{ member.consolidation_share }}%</td>
                  <td>{{ member.currency }}</td>
                </tr>
              }
            </tbody>
          </nz-table>

          <div class="section-title">{{ 'GL.CONS_RATES' | translate }}</div>
          <nz-table nzSize="small" [nzData]="current.rates ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'GL.CONS_ENTITY' | translate }}</th>
                <th>{{ 'GL.CONS_ENTITY_CURRENCY' | translate }}</th>
                <th class="num">{{ 'GL.CONS_RATE_CLOSING' | translate }}</th>
                <th class="num">{{ 'GL.CONS_RATE_AVERAGE' | translate }}</th>
                <th class="num">{{ 'GL.CONS_RATE_HISTORICAL' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (rate of current.rates ?? []; track rate.tenant_id) {
                <tr>
                  <td>{{ entityName(rate.tenant_id) }}</td>
                  <td>{{ rate.currency }}</td>
                  <td class="num">{{ rate.closing }}</td>
                  <td class="num">{{ rate.average }}</td>
                  <td class="num">{{ rate.historical }}</td>
                </tr>
              }
            </tbody>
          </nz-table>

          <div class="section-title">{{ 'GL.CONS_ADJUSTMENTS' | translate }}</div>
          <nz-table #adjustmentTable nzSize="small" [nzData]="current.adjustments ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th></th>
                <th>{{ 'GL.CONS_ADJUSTMENT_TYPE' | translate }}</th>
                <th>{{ 'GL.COL_DESCRIPTION' | translate }}</th>
                <th class="num">{{ 'GL.CONS_AMOUNT' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (adjustment of adjustmentTable.data; track adjustment.id) {
                <tr>
                  <td [nzExpand]="expandedAdjustment() === adjustment.id" (nzExpandChange)="expandedAdjustment.set(expandedAdjustment() === adjustment.id ? null : adjustment.id)"></td>
                  <td>{{ adjustment.adjustment_type }}</td>
                  <td>{{ adjustment.description }}</td>
                  <td class="num">{{ adjustment.amount | money: current.group_currency }}</td>
                </tr>
                <tr [nzExpand]="expandedAdjustment() === adjustment.id">
                  <nz-table nzSize="small" [nzData]="adjustment.lines" [nzShowPagination]="false">
                    <thead>
                      <tr>
                        <th>{{ 'GL.COL_CODE' | translate }}</th>
                        <th>{{ 'GL.COL_NAME' | translate }}</th>
                        <th class="num">{{ 'GL.COL_DEBIT' | translate }}</th>
                        <th class="num">{{ 'GL.COL_CREDIT' | translate }}</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (line of adjustment.lines; track $index) {
                        <tr>
                          <td>{{ line.account_code }}</td>
                          <td>{{ line.account_name }}</td>
                          <td class="num">{{ line.debit | money: current.group_currency }}</td>
                          <td class="num">{{ line.credit | money: current.group_currency }}</td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-tab>

        <nz-tab [nzTitle]="'GL.CONS_TRIAL_BALANCE' | translate">
          @if (trial(); as report) {
            <nz-table nzSize="small" [nzData]="report.accounts" [nzShowPagination]="false" [nzScroll]="{ x: '860px' }">
              <thead>
                <tr>
                  <th>{{ 'GL.COL_CODE' | translate }}</th>
                  <th>{{ 'GL.COL_NAME' | translate }}</th>
                  <th class="num">{{ 'GL.CONS_AGGREGATED' | translate }}</th>
                  <th class="num">{{ 'GL.CONS_ADJUSTMENTS' | translate }}</th>
                  <th class="num">{{ 'GL.COL_DEBIT' | translate }}</th>
                  <th class="num">{{ 'GL.COL_CREDIT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of report.accounts; track row.account_code) {
                  <tr>
                    <td>{{ row.account_code }}</td>
                    <td>{{ row.account_name }}</td>
                    <td class="num">{{ row.aggregated_net | money: report.currency }}</td>
                    <td class="num">{{ row.adjustments_net | money: report.currency }}</td>
                    <td class="num">{{ row.debit | money: report.currency }}</td>
                    <td class="num">{{ row.credit | money: report.currency }}</td>
                  </tr>
                }
              </tbody>
              <tfoot>
                <tr>
                  <td colspan="4"><strong>{{ 'GL.CONS_TOTAL' | translate }}</strong></td>
                  <td class="num">{{ report.total_debit | money: report.currency }}</td>
                  <td class="num">{{ report.total_credit | money: report.currency }}</td>
                </tr>
              </tfoot>
            </nz-table>
            <nz-tag [nzColor]="report.is_balanced ? 'green' : 'red'">{{ 'GL.CONS_BALANCED' | translate }}</nz-tag>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'GL.CONS_BALANCE_SHEET' | translate">
          @if (balance(); as sheet) {
            <ng-container [ngTemplateOutlet]="linesTpl" [ngTemplateOutletContext]="{ title: 'GL.CONS_ASSETS', lines: sheet.assets, total: sheet.total_assets, currency: sheet.currency }" />
            <ng-container [ngTemplateOutlet]="linesTpl" [ngTemplateOutletContext]="{ title: 'GL.CONS_LIABILITIES', lines: sheet.liabilities, total: sheet.total_liabilities, currency: sheet.currency }" />
            <ng-container [ngTemplateOutlet]="linesTpl" [ngTemplateOutletContext]="{ title: 'GL.CONS_EQUITY', lines: sheet.equity, total: sheet.total_equity_reserves, currency: sheet.currency }" />
            <div class="summary-grid">
              <div>
                <span class="muted">{{ 'GL.CONS_RESULT_OF_PERIOD' | translate }}</span>
                <div>{{ sheet.result_of_the_period | money: sheet.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_TOTAL_EQUITY' | translate }}</span>
                <div>{{ sheet.total_equity | money: sheet.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_NCI' | translate }}</span>
                <div>{{ sheet.non_controlling_interests | money: sheet.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_EQUITY_OWNERS' | translate }}</span>
                <div>{{ sheet.equity_attributable_to_owners | money: sheet.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_TOTAL_LIABILITIES_EQUITY' | translate }}</span>
                <div>{{ sheet.total_liabilities_and_equity | money: sheet.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_BALANCED' | translate }}</span>
                <div>
                  <nz-tag [nzColor]="sheet.is_balanced ? 'green' : 'red'">{{ (sheet.is_balanced ? 'GL.CONS_YES' : 'GL.CONS_NO') | translate }}</nz-tag>
                </div>
              </div>
            </div>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'GL.CONS_INCOME_STATEMENT' | translate">
          @if (income(); as statement) {
            <ng-container [ngTemplateOutlet]="linesTpl" [ngTemplateOutletContext]="{ title: 'GL.CONS_REVENUES', lines: statement.revenues, total: statement.total_revenue, currency: statement.currency }" />
            <ng-container [ngTemplateOutlet]="linesTpl" [ngTemplateOutletContext]="{ title: 'GL.CONS_COGS', lines: statement.cogs, total: statement.total_cogs, currency: statement.currency }" />
            <ng-container [ngTemplateOutlet]="linesTpl" [ngTemplateOutletContext]="{ title: 'GL.CONS_OPERATING_EXPENSES', lines: statement.operating_expenses, total: statement.total_operating_expenses, currency: statement.currency }" />
            <div class="summary-grid">
              <div>
                <span class="muted">{{ 'GL.CONS_GROSS_PROFIT' | translate }}</span>
                <div>{{ statement.gross_profit | money: statement.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_INCOME_TAX' | translate }}</span>
                <div>{{ statement.income_tax | money: statement.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_NET_INCOME' | translate }}</span>
                <div>{{ statement.net_income | money: statement.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_NET_INCOME_NCI' | translate }}</span>
                <div>{{ statement.net_income_attributable_to_non_controlling_interests | money: statement.currency }}</div>
              </div>
              <div>
                <span class="muted">{{ 'GL.CONS_NET_INCOME_OWNERS' | translate }}</span>
                <div>{{ statement.net_income_attributable_to_owners | money: statement.currency }}</div>
              </div>
            </div>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'GL.CONS_GOODWILL_SCHEDULE' | translate">
          @if (goodwill(); as schedule) {
            @for (acquisition of schedule.acquisitions; track acquisition.member_tenant_id) {
              <div class="section-title">{{ acquisition.name }} - {{ acquisition.acquisition_date }} - {{ acquisition.goodwill | money: schedule.currency }}</div>
              <nz-table nzSize="small" [nzData]="acquisition.rows" [nzShowPagination]="false">
                <thead>
                  <tr>
                    <th>{{ 'GL.CONS_FISCAL_YEAR' | translate }}</th>
                    <th class="num">{{ 'GL.CONS_OPENING_BALANCE' | translate }}</th>
                    <th class="num">{{ 'GL.CONS_AMORTISATION' | translate }}</th>
                    <th class="num">{{ 'GL.CONS_IMPAIRMENT' | translate }}</th>
                    <th class="num">{{ 'GL.CONS_CLOSING_BALANCE' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (row of acquisition.rows; track row.fiscal_year) {
                    <tr>
                      <td>
                        {{ row.fiscal_year }}
                        @if (row.is_run_year) {
                          <nz-tag nzColor="blue">{{ 'GL.CONS_RUN_YEAR' | translate }}</nz-tag>
                        }
                      </td>
                      <td class="num">{{ row.opening_balance | money: schedule.currency }}</td>
                      <td class="num">{{ row.amortisation | money: schedule.currency }}</td>
                      <td class="num">{{ row.impairment | money: schedule.currency }}</td>
                      <td class="num">{{ row.closing_balance | money: schedule.currency }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            } @empty {
              <span class="muted">{{ 'GL.CONS_NO_GOODWILL' | translate }}</span>
            }
          }
        </nz-tab>

        <nz-tab [nzTitle]="'GL.CONS_RECLASSIFIED' | translate">
          <div class="toolbar">
            <label for="cons-scheme">{{ 'GL.CONS_SCHEME' | translate }}</label>
            <nz-select id="cons-scheme" class="select-md" [(ngModel)]="schemeId" [nzPlaceHolder]="'GL.CONS_SCHEME' | translate" (ngModelChange)="loadReclassified()">
              @for (scheme of schemes(); track scheme.id) {
                <nz-option [nzValue]="scheme.id" [nzLabel]="scheme.name" />
              }
            </nz-select>
          </div>
          @if (reclassified(); as statement) {
            <nz-table nzSize="small" [nzData]="statement.rows" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th>{{ 'GL.COL_CODE' | translate }}</th>
                  <th>{{ 'GL.COL_NAME' | translate }}</th>
                  <th class="num">{{ 'GL.COL_AMOUNT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of statement.rows; track row.code) {
                  <tr>
                    <td>{{ row.code }}</td>
                    <td>{{ row.label }}</td>
                    <td class="num">{{ row.amount === null ? '' : (row.amount | money: statement.currency) }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            @if (statement.unmapped_accounts.length > 0) {
              <div class="section-title">{{ 'GL.CONS_UNMAPPED_ACCOUNTS' | translate }}</div>
              <nz-table nzSize="small" [nzData]="statement.unmapped_accounts" [nzShowPagination]="false">
                <tbody>
                  @for (account of statement.unmapped_accounts; track account.account_code) {
                    <tr>
                      <td>{{ account.account_code }}</td>
                      <td>{{ account.account_name }}</td>
                      <td class="num">{{ account.amount | money: statement.currency }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            }
          }
        </nz-tab>
      </nz-tabs>

      <ng-template #linesTpl let-title="title" let-lines="lines" let-total="total" let-currency="currency">
        <div class="section-title">{{ title | translate }}</div>
        <nz-table nzSize="small" [nzData]="lines" [nzShowPagination]="false">
          <tbody>
            @for (line of lines; track line.account_code) {
              <tr>
                <td>{{ line.account_code }}</td>
                <td>{{ line.account_name }}</td>
                <td class="num">{{ line.amount | money: currency }}</td>
              </tr>
            }
          </tbody>
          <tfoot>
            <tr>
              <td colspan="2"><strong>{{ 'GL.CONS_TOTAL' | translate }}</strong></td>
              <td class="num">{{ total | money: currency }}</td>
            </tr>
          </tfoot>
        </nz-table>
      </ng-template>
    }
  `,
})
export class GlConsolidationRunDetailComponent implements OnInit {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fiscalApi = inject(GeneralLedgerFiscalApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  /** Run id; read from the route (`:runId`) when the page is not given one. */
  readonly runId = input<string>();

  protected readonly id = computed(() => this.runId() ?? this.route.snapshot.paramMap.get('runId') ?? '');
  protected readonly run = signal<ConsolidationRun | null>(null);
  protected readonly error = signal<unknown>(null);
  protected readonly verification = signal<ConsolidationRunVerification | null>(null);
  protected readonly verifying = signal(false);
  protected readonly expandedAdjustment = signal<string | null>(null);

  protected readonly trial = signal<ConsolidatedTrialBalance | null>(null);
  protected readonly balance = signal<ConsolidatedBalanceSheet | null>(null);
  protected readonly income = signal<ConsolidatedIncomeStatement | null>(null);
  protected readonly goodwill = signal<GoodwillSchedule | null>(null);
  protected readonly reclassified = signal<ConsolidatedReclassifiedStatement | null>(null);
  protected readonly schemes = signal<StatementScheme[]>([]);
  protected schemeId: string | null = null;

  /** Tabs after the summary load their statement the first time they are opened. */
  private readonly tabs: (StatementKind | null)[] = [null, 'trial', 'balance', 'income', 'goodwill', 'reclassified'];
  private readonly loaded = new Set<StatementKind>();

  ngOnInit(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.api.getRun(id).subscribe({
      next: (res) => this.run.set(res.data ?? null),
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected entityName(tenantId: string): string {
    return snapshotName(this.run(), tenantId);
  }

  protected onTab(index: number): void {
    const kind = this.tabs[index];
    if (!kind || this.loaded.has(kind)) {
      return;
    }
    this.loaded.add(kind);
    const id = this.id();
    const fail = (err: unknown): void => {
      this.loaded.delete(kind);
      this.error.set(err);
    };
    switch (kind) {
      case 'trial':
        this.api.getRunTrialBalance(id).subscribe({ next: (res) => this.trial.set(res.data ?? null), error: fail });
        break;
      case 'balance':
        this.api.getRunBalanceSheet(id).subscribe({ next: (res) => this.balance.set(res.data ?? null), error: fail });
        break;
      case 'income':
        this.api.getRunIncomeStatement(id).subscribe({ next: (res) => this.income.set(res.data ?? null), error: fail });
        break;
      case 'goodwill':
        this.api.getRunGoodwillSchedule(id).subscribe({ next: (res) => this.goodwill.set(res.data ?? null), error: fail });
        break;
      case 'reclassified':
        this.fiscalApi.getStatementSchemes().subscribe({ next: (res) => this.schemes.set(res.data ?? []), error: fail });
        break;
    }
  }

  protected loadReclassified(): void {
    if (!this.schemeId) {
      this.reclassified.set(null);
      return;
    }
    this.api.getRunReclassified(this.id(), this.schemeId).subscribe({
      next: (res) => this.reclassified.set(res.data ?? null),
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected verify(): void {
    this.verifying.set(true);
    this.api.verifyRun(this.id()).subscribe({
      next: (res) => {
        this.verification.set(res.data ?? null);
        this.verifying.set(false);
      },
      error: (err: unknown) => {
        this.error.set(err);
        this.verifying.set(false);
      },
    });
  }

  protected lock(): void {
    this.api.lockRun(this.id()).subscribe({
      next: (res) => {
        this.run.update((current) => (current ? { ...current, ...res.data } : res.data));
        this.message.success(this.i18n.translate('GL.CONS_RUN_LOCKED_DONE'));
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected remove(): void {
    const groupId = this.run()?.group_id;
    this.api.deleteRun(this.id()).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.CONS_DELETED'));
        void this.router.navigate(['/general-ledger/consolidation', groupId ?? '']);
      },
      error: (err: unknown) => this.error.set(err),
    });
  }
}
