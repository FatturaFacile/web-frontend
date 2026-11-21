import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { catchError, forkJoin, of } from 'rxjs';
import { TranslatePipe } from '@shared';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CorporateGroupApiService } from '../../core/api/corporate-group-api.service';
import { GeneralLedgerApiService } from '../../core/api/general-ledger-api.service';
import { ComparisonMode, DisplayCurrency, PeriodPreset } from './kpi-dashboards.models';
import { KpiDashboardsStore } from './kpi-dashboards.store';
import { presetKey } from './kpi-dashboards.utils';

interface Option {
  value: string;
  label: string;
}

export const PRESETS: readonly PeriodPreset[] = ['mtd', 'qtd', 'ytd', 'last_12m', 'custom'];
export const COMPARISONS: readonly ComparisonMode[] = ['yoy', 'mom', 'budget'];
export const CURRENCIES: readonly DisplayCurrency[] = ['CHF', 'EUR'];

/**
 * The sticky global filter bar: legal entities with the consolidation toggle, period preset (or custom range), comparison, cost
 * centers and the CHF/EUR switch with the exchange rate in force. It only writes the store; the page reloads the cockpit when
 * the filters change.
 */
@Component({
  selector: 'app-kpi-filter-bar',
  imports: [FormsModule, TranslatePipe, NzRadioModule, NzSelectModule, NzSwitchModule, NzTagModule],
  styles: [
    `
      :host {
        display: block;
        position: sticky;
        top: 0;
        z-index: 5;
      }
      .bar {
        display: flex;
        flex-wrap: wrap;
        gap: 16px;
        align-items: flex-end;
        padding: 12px 16px;
        background: var(--ant-color-bg-container, #fff);
        border-bottom: 1px solid var(--ant-color-border-secondary, #f0f0f0);
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-width: 160px;
      }
      .field .label {
        font-size: 12px;
        color: var(--ant-color-text-secondary, #595959);
      }
      .field nz-select {
        min-width: 200px;
      }
      .toggle {
        display: flex;
        align-items: center;
        gap: 8px;
      }
    `,
  ],
  template: `
    <div class="bar" role="search" [attr.aria-label]="'KPI_DASHBOARDS.FILTER_PERIOD' | translate">
      <div class="field">
        <span class="label" id="kpi-entities-label">{{
          'KPI_DASHBOARDS.FILTER_ENTITIES' | translate
        }}</span>
        <nz-select
          nzMode="multiple"
          nzAllowClear
          aria-labelledby="kpi-entities-label"
          [ngModel]="filters().companyIds"
          (ngModelChange)="store.patchFilters({ companyIds: $event })"
          data-testid="kpi-filter-entities"
        >
          @for (option of companies(); track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.label"></nz-option>
          }
        </nz-select>
      </div>

      <div class="field toggle">
        <nz-switch
          [ngModel]="filters().consolidated"
          (ngModelChange)="store.setConsolidated($event)"
          data-testid="kpi-filter-consolidated"
          [attr.aria-label]="'KPI_DASHBOARDS.FILTER_CONSOLIDATED' | translate"
        ></nz-switch>
        <span>{{ 'KPI_DASHBOARDS.FILTER_CONSOLIDATED' | translate }}</span>
      </div>

      <div class="field">
        <span class="label">{{ 'KPI_DASHBOARDS.FILTER_PERIOD' | translate }}</span>
        <nz-radio-group
          [ngModel]="filters().preset"
          (ngModelChange)="store.setPreset($event)"
          nzButtonStyle="solid"
          data-testid="kpi-filter-preset"
        >
          @for (preset of presets; track preset) {
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label nz-radio-button [nzValue]="preset">{{ presetKey(preset) | translate }}</label>
          }
        </nz-radio-group>
      </div>

      @if (filters().preset === 'custom') {
        <div class="field">
          <label for="kpi-from">{{ 'KPI_DASHBOARDS.FILTER_FROM' | translate }}</label>
          <input
            id="kpi-from"
            type="date"
            [ngModel]="filters().from"
            (ngModelChange)="store.patchFilters({ from: $event })"
            data-testid="kpi-filter-from"
          />
        </div>
        <div class="field">
          <label for="kpi-to">{{ 'KPI_DASHBOARDS.FILTER_TO' | translate }}</label>
          <input
            id="kpi-to"
            type="date"
            [ngModel]="filters().to"
            (ngModelChange)="store.patchFilters({ to: $event })"
            data-testid="kpi-filter-to"
          />
        </div>
      }

      <div class="field">
        <span class="label" id="kpi-compare-label">{{
          'KPI_DASHBOARDS.FILTER_COMPARISON' | translate
        }}</span>
        <nz-select
          aria-labelledby="kpi-compare-label"
          [ngModel]="filters().comparison"
          (ngModelChange)="store.setComparison($event)"
          data-testid="kpi-filter-comparison"
        >
          @for (mode of comparisons; track mode) {
            <nz-option
              [nzValue]="mode"
              [nzLabel]="'KPI_DASHBOARDS.COMPARE_' + mode.toUpperCase() | translate"
            ></nz-option>
          }
        </nz-select>
      </div>

      <div class="field">
        <span class="label" id="kpi-cc-label">{{
          'KPI_DASHBOARDS.FILTER_COST_CENTERS' | translate
        }}</span>
        <nz-select
          nzMode="multiple"
          nzAllowClear
          aria-labelledby="kpi-cc-label"
          [ngModel]="filters().costCenterIds"
          (ngModelChange)="store.patchFilters({ costCenterIds: $event })"
          data-testid="kpi-filter-cost-centers"
        >
          @for (option of costCenters(); track option.value) {
            <nz-option [nzValue]="option.value" [nzLabel]="option.label"></nz-option>
          }
        </nz-select>
      </div>

      <div class="field">
        <span class="label">{{ 'KPI_DASHBOARDS.FILTER_CURRENCY' | translate }}</span>
        <nz-radio-group
          [ngModel]="filters().currency"
          (ngModelChange)="store.setCurrency($event)"
          nzButtonStyle="solid"
          data-testid="kpi-filter-currency"
        >
          @for (currency of currencies; track currency) {
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label nz-radio-button [nzValue]="currency">{{ currency }}</label>
          }
        </nz-radio-group>
      </div>

      @if (fxBadge(); as badge) {
        <nz-tag [nzColor]="badge.available ? 'blue' : 'orange'" data-testid="kpi-fx-badge">
          @if (badge.available) {
            {{ badge.label }}
          } @else {
            {{ 'KPI_DASHBOARDS.FX_MISSING' | translate }}
          }
        </nz-tag>
      }
    </div>
  `,
})
export class KpiFilterBarComponent implements OnInit {
  protected readonly store = inject(KpiDashboardsStore);
  private readonly groupApi = inject(CorporateGroupApiService);
  private readonly ledgerApi = inject(GeneralLedgerApiService);

  protected readonly presets = PRESETS;
  protected readonly comparisons = COMPARISONS;
  protected readonly currencies = CURRENCIES;
  protected readonly presetKey = presetKey;
  protected readonly filters = this.store.filters;
  protected readonly companies = signal<Option[]>([]);
  protected readonly costCenters = signal<Option[]>([]);

  /** The average and closing rate in force for the display currency, as the badge states them. */
  protected readonly fxBadge = computed(() => {
    const fx = this.store.fx();

    if (fx === null || fx.average.from === fx.average.to) {
      return null;
    }

    const rate = fx.closing.available ? fx.closing : fx.average;

    return {
      available: rate.available,
      label: `${fx.average.from}/${fx.average.to}  Ø ${fx.average.rate.toFixed(4)} · ${fx.closing.rate.toFixed(4)}${fx.closing.as_of ? ` (${fx.closing.as_of})` : ''}`,
    };
  });

  ngOnInit(): void {
    forkJoin({
      companies: this.groupApi.listCompanies().pipe(catchError(() => of(null))),
      costCenters: this.ledgerApi.getCostCenters().pipe(catchError(() => of(null))),
    }).subscribe(({ companies, costCenters }) => {
      this.companies.set(
        (companies?.data ?? []).map((company) => ({
          value: company.id,
          label: String(company['legal_name'] ?? company['code'] ?? company.id),
        })),
      );
      this.costCenters.set(
        (costCenters?.data ?? []).map((center) => ({
          value: center.id,
          label: `${center.code} · ${center.name}`,
        })),
      );
    });
  }
}
