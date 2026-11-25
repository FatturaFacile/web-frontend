import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSliderModule } from 'ng-zorro-antd/slider';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  PermissionsService,
  SF_WHAT_IF_PARAMETERS,
  SfIndicator,
  SfWhatIf,
  SfWhatIfParameter,
  TranslateService,
} from '@core';
import { TranslatePipe } from '@shared';
import { IndicatorsStore } from './indicators.store';
import {
  alertColor,
  formatAmount,
  indicatorColor,
  indicatorValueText,
  routeDossierId,
  SfOutcome,
  STATUTORY_FINANCIALS_MODULE,
} from './statutory-financials.util';
import { WorkspaceStore } from './workspace.store';

/** The percent parameters of the what-if (a slider and a number), the others are absolute amounts. */
const PERCENT_PARAMETERS: readonly SfWhatIfParameter[] = [
  'ebitda_change_percent',
  'revenue_change_percent',
  'debt_service_change_percent',
];

/**
 * Financial ratios and the crisis alerts with the 6-month DSCR what-if simulator: the stored indicators, the parameters
 * to try, the base against the simulated DSCR and its breakdown.
 */
@Component({
  selector: 'app-sf-indicators',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzInputNumberModule,
    NzSliderModule,
    NzSpinModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  providers: [IndicatorsStore],
  styleUrl: './statutory-financials.scss',
  template: `
    @if (store.error(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }
    @if (failure(); as outcome) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        nzCloseable
        [nzMessage]="
          outcome.errorKey ?? 'statutoryFinancials.error.generic' | translate: outcome.params
        "
        (nzOnClose)="failure.set(null)"
      ></nz-alert>
    }

    <div class="toolbar">
      <span class="spacer"></span>
      <button
        nz-button
        type="button"
        [disabled]="readOnly() || store.saving() || !store.base()"
        [nzLoading]="store.saving()"
        (click)="saveToPackage()"
      >
        {{ 'statutoryFinancials.action.saveToPackage' | translate }}
      </button>
    </div>

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.current(); as result) {
        <nz-alert
          class="feedback"
          nzShowIcon
          role="status"
          [nzType]="levelType(result.alert_level)"
          [nzMessage]="
            'statutoryFinancials.indicators.alertLevel.' + result.alert_level | translate
          "
          [nzDescription]="alertsTemplate"
        ></nz-alert>
        <ng-template #alertsTemplate>
          <ul>
            @for (alert of result.alerts; track alert.code) {
              <li>{{ alert.message }}</li>
            }
          </ul>
        </ng-template>

        <nz-card class="main-card" [nzTitle]="'statutoryFinancials.section.ratios' | translate">
          <nz-table
            nzSize="small"
            [nzData]="result.indicators"
            [nzFrontPagination]="false"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '720px' }"
          >
            <thead>
              <tr>
                <th scope="col">{{ 'statutoryFinancials.indicators.ratio' | translate }}</th>
                <th scope="col" class="num">
                  {{ 'statutoryFinancials.indicators.value' | translate }}
                </th>
                <th scope="col">{{ 'statutoryFinancials.field.status' | translate }}</th>
                <th scope="col">{{ 'statutoryFinancials.indicators.message' | translate }}</th>
                <th scope="col">{{ 'statutoryFinancials.indicators.thresholds' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (indicator of result.indicators; track indicator.code) {
                <tr>
                  <th scope="row">
                    {{ indicator.label }}
                    @if (indicator.is_crisis_indicator) {
                      <nz-tag nzColor="volcano">{{
                        'statutoryFinancials.indicators.crisis' | translate
                      }}</nz-tag>
                    }
                    <small class="muted">{{ indicator.description }}</small>
                  </th>
                  <td class="num">{{ valueOf(indicator) }}</td>
                  <td>
                    <nz-tag [nzColor]="statusColor(indicator.status)">
                      {{ 'statutoryFinancials.indicators.status.' + indicator.status | translate }}
                    </nz-tag>
                  </td>
                  <td>{{ indicator.message }}</td>
                  <td>
                    @if (
                      indicator.warning_threshold !== null || indicator.critical_threshold !== null
                    ) {
                      <span
                        >{{ thresholdOf(indicator, indicator.warning_threshold) }} /
                        {{ thresholdOf(indicator, indicator.critical_threshold) }}</span
                      >
                      @if (indicator.direction) {
                        <small class="muted">{{
                          'statutoryFinancials.indicators.direction.' + indicator.direction
                            | translate
                        }}</small>
                      }
                    }
                  </td>
                </tr>
              } @empty {
                <tr>
                  <td colspan="5">{{ 'statutoryFinancials.empty.indicators' | translate }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      } @else if (!store.loading()) {
        <nz-empty
          [nzNotFoundContent]="'statutoryFinancials.empty.indicators' | translate"
        ></nz-empty>
      }

      <nz-card class="main-card" [nzTitle]="'statutoryFinancials.section.simulator' | translate">
        <p class="muted">{{ 'statutoryFinancials.hint.simulator' | translate }}</p>
        <div class="form-grid">
          @for (parameter of parameters(); track parameter) {
            <div class="field">
              <label [attr.for]="'sf-whatif-' + parameter">
                {{ 'statutoryFinancials.whatIf.' + parameter | translate }}
              </label>
              <nz-input-number
                [nzId]="'sf-whatif-' + parameter"
                [nzStep]="isPercent(parameter) ? 1 : 1000"
                [nzPrecision]="isPercent(parameter) ? 1 : 2"
                [ngModel]="store.whatIf()[parameter] ?? null"
                (ngModelChange)="change(parameter, $event)"
              ></nz-input-number>
              @if (isPercent(parameter)) {
                <nz-slider
                  [nzMin]="-100"
                  [nzMax]="100"
                  [nzStep]="1"
                  [nzTooltipVisible]="'never'"
                  [attr.aria-label]="'statutoryFinancials.whatIf.' + parameter | translate"
                  [ngModel]="store.whatIf()[parameter] ?? 0"
                  (ngModelChange)="change(parameter, $event)"
                ></nz-slider>
              }
            </div>
          }
        </div>
        <div class="actions">
          <button nz-button type="button" [disabled]="!hasWhatIf()" (click)="store.reset()">
            {{ 'statutoryFinancials.action.reset' | translate }}
          </button>
          @if (store.simulating()) {
            <span role="status">{{ 'statutoryFinancials.indicators.simulating' | translate }}</span>
          }
        </div>

        <div class="stats-grid">
          <nz-statistic
            [nzTitle]="'statutoryFinancials.dscr.base' | translate"
            [nzValue]="dscrText(store.baseDscr()?.value)"
          ></nz-statistic>
          <nz-statistic
            [nzTitle]="'statutoryFinancials.dscr.simulated' | translate"
            [nzValue]="store.isSimulation() ? dscrText(store.simulatedDscr()?.value) : '-'"
          ></nz-statistic>
        </div>

        @if (store.current()?.dscr; as dscr) {
          <nz-descriptions
            nzBordered
            nzSize="small"
            [nzTitle]="
              'statutoryFinancials.dscr.breakdown' | translate: { months: dscr.horizon_months }
            "
            [nzColumn]="{ xs: 1, md: 2 }"
          >
            <nz-descriptions-item
              [nzTitle]="'statutoryFinancials.dscr.expectedCashFlow' | translate"
              >{{ amount(dscr.expected_cash_flow) }}</nz-descriptions-item
            >
            <nz-descriptions-item
              [nzTitle]="'statutoryFinancials.dscr.openingLiquidity' | translate"
              >{{ amount(dscr.opening_liquidity) }}</nz-descriptions-item
            >
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.dscr.debtService' | translate">{{
              amount(dscr.debt_service)
            }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'statutoryFinancials.dscr.value' | translate">{{
              dscrText(dscr.value)
            }}</nz-descriptions-item>
          </nz-descriptions>
        }
      </nz-card>
    </nz-spin>
  `,
})
export class IndicatorsComponent implements OnInit {
  protected readonly store = inject(IndicatorsStore);
  private readonly workspace = inject(WorkspaceStore);
  private readonly route = inject(ActivatedRoute);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly failure = signal<SfOutcome | null>(null);
  protected readonly statusColor = indicatorColor;

  protected readonly readOnly = computed(
    () => !this.permissions.canWrite(STATUTORY_FINANCIALS_MODULE) || this.workspace.locked(),
  );
  /** The parameters the API accepts (the lookup), in the order of the contract. */
  protected readonly parameters = computed<SfWhatIfParameter[]>(() => {
    const listed = this.workspace.lookups()?.what_if_parameters ?? [];
    return listed.length === 0
      ? [...SF_WHAT_IF_PARAMETERS]
      : SF_WHAT_IF_PARAMETERS.filter((parameter) => listed.includes(parameter));
  });
  protected readonly hasWhatIf = computed(() => Object.keys(this.store.whatIf()).length > 0);

  constructor() {
    inject(DestroyRef).onDestroy(() => this.store.dispose());
  }

  private get id(): string {
    return routeDossierId(this.route) ?? '';
  }

  ngOnInit(): void {
    void this.store.load(this.id);
  }

  protected levelType(level: 'ok' | 'warning' | 'critical'): 'success' | 'warning' | 'error' {
    return alertColor(level);
  }

  protected isPercent(parameter: SfWhatIfParameter): boolean {
    return PERCENT_PARAMETERS.includes(parameter);
  }

  protected change(parameter: SfWhatIfParameter, value: number | null): void {
    const patch: SfWhatIf = { [parameter]: value };
    this.store.setWhatIf(this.id, patch);
  }

  protected valueOf(indicator: SfIndicator): string {
    return indicatorValueText(indicator.value, indicator.unit, this.workspace.jurisdiction());
  }

  protected thresholdOf(indicator: SfIndicator, value: string | null): string {
    return value === null
      ? '-'
      : indicatorValueText(value, indicator.unit, this.workspace.jurisdiction());
  }

  protected amount(value: string | null | undefined): string {
    return formatAmount(value, this.workspace.jurisdiction(), 2);
  }

  protected dscrText(value: string | null | undefined): string {
    return value === null || value === undefined
      ? '-'
      : formatAmount(value, this.workspace.jurisdiction(), 2);
  }

  protected async saveToPackage(): Promise<void> {
    const outcome = await this.store.saveToPackage(this.id);
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('statutoryFinancials.message.indicatorsSaved'));
    }
  }
}
