import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, SfCashFlowMethod, SfLine, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { ProfitAllocationComponent } from './profit-allocation.component';
import { StatementTableComponent } from './statement-table.component';
import {
  formatAmount,
  labelTitle,
  roundingLines,
  SfOutcome,
  sideKey,
  STATUTORY_FINANCIALS_MODULE,
} from './statutory-financials.util';
import { WorkspaceStore } from './workspace.store';

/**
 * Statements inspector: generate or regenerate the statements, the balance sheet, income statement and cash flow as
 * indented tables, the rounding quadrature, the bifront and unmapped accounts, the warnings and the profit allocation.
 */
@Component({
  selector: 'app-sf-statements',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzSelectModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    ProfitAllocationComponent,
    StatementTableComponent,
    TranslatePipe,
  ],
  styleUrl: './statutory-financials.scss',
  template: `
    @if (failure(); as outcome) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          outcome.errorKey ?? 'statutoryFinancials.error.generic' | translate: outcome.params
        "
        [nzDescription]="outcome.detail"
        (nzOnClose)="failure.set(null)"
      ></nz-alert>
    }

    <div class="toolbar">
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="readOnly() || store.busy()"
        [nzLoading]="store.busy()"
        (click)="generate()"
      >
        {{
          (store.hasStatements()
            ? 'statutoryFinancials.action.regenerate'
            : 'statutoryFinancials.action.generate'
          ) | translate
        }}
      </button>
      <label class="field" for="sf-cashflow-method">
        <span
          >{{ cashFlowTitle() }} ·
          {{ 'statutoryFinancials.field.cashFlowMethod' | translate }}</span
        >
        <nz-select
          nzId="sf-cashflow-method"
          [disabled]="readOnly()"
          [ngModel]="cashFlowMethod()"
          (ngModelChange)="cashFlowMethod.set($event)"
        >
          @for (method of cashFlowMethods(); track method) {
            <nz-option
              [nzValue]="method"
              [nzLabel]="'statutoryFinancials.cashFlowMethod.' + method | translate"
            ></nz-option>
          }
        </nz-select>
      </label>
      <button
        nz-button
        type="button"
        [disabled]="readOnly() || store.busy() || !store.hasStatements()"
        (click)="generateCashFlow()"
      >
        {{ 'statutoryFinancials.action.generateCashFlow' | translate }}
      </button>
    </div>

    @if (!store.hasStatements()) {
      <nz-empty [nzNotFoundContent]="'statutoryFinancials.empty.statements' | translate"></nz-empty>
    } @else if (store.dossier(); as dossier) {
      <div class="stats-grid">
        <nz-statistic
          [nzTitle]="'statutoryFinancials.statement.totalAssets' | translate"
          [nzValue]="amount(dossier.statements.balance_sheet?.total_assets)"
        ></nz-statistic>
        <nz-statistic
          [nzTitle]="'statutoryFinancials.statement.totalLiabilitiesEquity' | translate"
          [nzValue]="amount(dossier.statements.balance_sheet?.total_liabilities_equity)"
        ></nz-statistic>
        <nz-statistic
          [nzTitle]="'statutoryFinancials.field.netResult' | translate"
          [nzValue]="amount(dossier.statements.income_statement?.net_result)"
        ></nz-statistic>
      </div>

      <nz-card class="main-card">
        <nz-tabs
          nzType="card"
          [nzSelectedIndex]="statementTab()"
          (nzSelectedIndexChange)="statementTab.set($event)"
        >
          <nz-tab [nzTitle]="title('report.balance_sheet', 'balance_sheet')">
            @if (dossier.statements.balance_sheet; as sheet) {
              <app-sf-statement-table
                [lines]="sheet.lines"
                [jurisdiction]="store.jurisdiction()"
                [scale]="store.scale()"
                [showComparative]="hasComparative()"
                [caption]="title('report.balance_sheet', 'balance_sheet')"
                [currentLabel]="title('report.current', 'current')"
                [comparativeLabel]="title('report.comparative', 'comparative')"
              ></app-sf-statement-table>
            }
          </nz-tab>
          <nz-tab [nzTitle]="title('report.income_statement', 'income_statement')">
            @if (dossier.statements.income_statement; as income) {
              <app-sf-statement-table
                [lines]="income.lines"
                [jurisdiction]="store.jurisdiction()"
                [scale]="store.scale()"
                [showComparative]="hasComparative()"
                [caption]="title('report.income_statement', 'income_statement')"
                [currentLabel]="title('report.current', 'current')"
                [comparativeLabel]="title('report.comparative', 'comparative')"
              ></app-sf-statement-table>
            }
          </nz-tab>
          <nz-tab [nzTitle]="cashFlowTitle()">
            @if (dossier.statements.cash_flow; as flow) {
              <app-sf-statement-table
                [lines]="flow.lines"
                [jurisdiction]="store.jurisdiction()"
                [scale]="store.scale()"
                [showComparative]="hasComparative()"
                [caption]="cashFlowTitle()"
                [currentLabel]="title('report.current', 'current')"
                [comparativeLabel]="title('report.comparative', 'comparative')"
              ></app-sf-statement-table>
              <nz-descriptions
                class="feedback"
                nzBordered
                nzSize="small"
                [nzColumn]="{ xs: 1, md: 2, xl: 3 }"
              >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.cashFlow.reconciled' | translate"
                >
                  <nz-tag [nzColor]="flow.reconciled ? 'green' : 'red'">
                    {{
                      (flow.reconciled
                        ? 'statutoryFinancials.cashFlow.reconciledYes'
                        : 'statutoryFinancials.cashFlow.reconciledNo'
                      ) | translate
                    }}
                  </nz-tag>
                </nz-descriptions-item>
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.cashFlow.openingCash' | translate"
                  >{{ amount(flow.opening_cash) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.cashFlow.closingCash' | translate"
                  >{{ amount(flow.closing_cash) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.cashFlow.balanceSheetCash' | translate"
                  >{{ amount(flow.balance_sheet_cash) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.cashFlow.unexplained' | translate"
                  >{{ amount(flow.unexplained) }}</nz-descriptions-item
                >
                <nz-descriptions-item
                  [nzTitle]="'statutoryFinancials.cashFlow.residual' | translate"
                  >{{ amount(flow.residual) }}</nz-descriptions-item
                >
              </nz-descriptions>
            } @else {
              <nz-empty
                [nzNotFoundContent]="'statutoryFinancials.empty.cashFlow' | translate"
              ></nz-empty>
            }
          </nz-tab>
        </nz-tabs>
      </nz-card>

      @if (quadrature(); as q) {
        <nz-card class="main-card" [nzTitle]="'statutoryFinancials.section.quadrature' | translate">
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="{ xs: 1, md: 2, xl: 3 }">
            <nz-descriptions-item [nzTitle]="reserveTitle()">{{
              amount(q.rounding_reserve)
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.quadrature.income' | translate">{{
              amount(q.rounding_income)
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.quadrature.cost' | translate">{{
              amount(q.rounding_cost)
            }}</nz-descriptions-item>
            <nz-descriptions-item
              [nzTitle]="'statutoryFinancials.quadrature.balanceSheetResidual' | translate"
              >{{ amount(q.balance_sheet_residual) }}</nz-descriptions-item
            >
            <nz-descriptions-item
              [nzTitle]="'statutoryFinancials.quadrature.incomeStatementResidual' | translate"
              >{{ amount(q.income_statement_residual) }}</nz-descriptions-item
            >
          </nz-descriptions>
          @for (line of rounded(); track line.code) {
            <nz-tag class="feedback" nzColor="gold"
              >{{ line.label }}: {{ amount(line.amount) }}</nz-tag
            >
          }
        </nz-card>
      }

      @if (dossier.reclassification; as reclassification) {
        @for (warning of reclassification.warnings; track $index) {
          <nz-alert
            class="feedback"
            nzShowIcon
            [nzType]="warning.severity === 'warning' ? 'warning' : 'info'"
            [nzMessage]="warning.message"
          ></nz-alert>
        }

        <nz-card class="main-card" [nzTitle]="'statutoryFinancials.section.bifront' | translate">
          <nz-table
            nzSize="small"
            [nzData]="reclassification.bifront"
            [nzFrontPagination]="false"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '640px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'statutoryFinancials.field.account' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'statutoryFinancials.field.balance' | translate }}
                </th>
                <th scope="col">{{ 'statutoryFinancials.field.landedOn' | translate }}</th>
                <th scope="col">{{ 'statutoryFinancials.field.side' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (account of reclassification.bifront; track account.account_code) {
                <tr>
                  <th scope="row">
                    {{ account.account_code }}
                    <small class="muted">{{ account.account_name }}</small>
                  </th>
                  <td class="num">{{ amount(account.balance) }}</td>
                  <td>{{ account.line_label }}</td>
                  <td>
                    <nz-tag [nzColor]="account.side === 'normal' ? 'blue' : 'purple'">{{
                      sideTitle(account.side)
                    }}</nz-tag>
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="4">{{ 'statutoryFinancials.empty.bifront' | translate }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        @if (reclassification.unmapped.length > 0) {
          <nz-card class="main-card" [nzTitle]="'statutoryFinancials.section.unmapped' | translate">
            <ul>
              @for (account of reclassification.unmapped; track account.account_code) {
                <li>
                  <strong>{{ account.account_code }}</strong> {{ account.account_name }}
                  @if (account.line_label) {
                    <small class="muted">{{ account.line_label }}</small>
                  }
                </li>
              }
            </ul>
          </nz-card>
        }
      }

      <app-sf-profit-allocation
        [proposal]="dossier.profit_allocation_proposal"
        [hiddenReserves]="dossier.hidden_reserves_config"
        [jurisdiction]="store.jurisdiction()"
        [scale]="store.scale()"
      ></app-sf-profit-allocation>
    }
  `,
})
export class StatementsComponent {
  protected readonly store = inject(WorkspaceStore);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly failure = signal<SfOutcome | null>(null);
  protected readonly statementTab = signal(0);
  protected readonly cashFlowMethod = signal<SfCashFlowMethod>('indirect');

  protected readonly readOnly = computed(
    () => !this.permissions.canWrite(STATUTORY_FINANCIALS_MODULE) || this.store.locked(),
  );
  protected readonly cashFlowMethods = computed<SfCashFlowMethod[]>(
    () => this.store.standardLookup()?.cash_flow_methods ?? ['indirect', 'direct'],
  );
  protected readonly cashFlowTitle = computed(
    () =>
      this.store.dossier()?.statements.cash_flow?.standard_label ??
      this.store.standardLookup()?.cash_flow_label ??
      this.i18n.instant('statutoryFinancials.statement.cash_flow'),
  );
  protected readonly hasComparative = computed(
    () => this.store.dossier()?.comparative_prior_year_id != null,
  );
  protected readonly quadrature = computed(() => {
    const dossier = this.store.dossier();
    const quadrature = dossier?.quadrature ?? null;
    if (quadrature === null) {
      return null;
    }
    return quadrature.scale === 0 || this.rounded().length > 0 ? quadrature : null;
  });
  /** Lines of every statement that only exist to round it to whole units. */
  protected readonly rounded = computed<SfLine[]>(() => {
    const statements = this.store.dossier()?.statements;
    return [
      ...roundingLines(statements?.balance_sheet?.lines ?? []),
      ...roundingLines(statements?.income_statement?.lines ?? []),
    ];
  });

  /** A seeded heading from the API, or the translated chrome text when the seeder sent none. */
  protected title(labelKey: string, fallback: string): string {
    return (
      labelTitle(this.store.labels(), labelKey) ||
      this.i18n.instant(`statutoryFinancials.statement.${fallback}`)
    );
  }

  /** Title of the reserve in the quadrature: the label of the reserve line the API names. */
  protected reserveTitle(): string {
    const code = this.store.dossier()?.quadrature?.reserve_line_code;
    const line = this.rounded().find((entry) => entry.code === code);
    return (
      line?.label ??
      (labelTitle(this.store.labels(), 'rounding.reserve_label') ||
        this.i18n.instant('statutoryFinancials.quadrature.reserve'))
    );
  }

  protected sideTitle(side: 'normal' | 'opposite'): string {
    const key = sideKey(side);
    return (
      labelTitle(this.store.labels(), key) ||
      this.i18n.instant(
        `statutoryFinancials.statement.${side === 'normal' ? 'asset_side' : 'liability_side'}`,
      )
    );
  }

  protected amount(value: string | null | undefined): string {
    return formatAmount(value, this.store.jurisdiction(), this.store.scale());
  }

  protected async generate(): Promise<void> {
    const outcome = await this.store.generate();
    this.finish(outcome, 'generated');
  }

  protected async generateCashFlow(): Promise<void> {
    const outcome = await this.store.generateCashFlow(this.cashFlowMethod());
    this.finish(outcome, 'cashFlowGenerated');
  }

  private finish(outcome: SfOutcome, done: string): void {
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant(`statutoryFinancials.message.${done}`));
    }
  }
}
