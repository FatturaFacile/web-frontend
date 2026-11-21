import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GeneralLedgerApiService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, EMPTY } from 'rxjs';
import { BoardPackFormat, ComparisonBaseline, PeriodPreset, ReportingCurrency } from './dss.models';
import {
  COMPARISON_BASELINES,
  fromIsoDay,
  PERIOD_PRESETS,
  REPORTING_CURRENCIES,
  toIsoDay,
} from './dss.utils';
import { ExecutiveDssStore } from './executive-dss.store';

/**
 * The sticky global strategic filter: legal entities, reporting currency with the live FX rate, period, comparison baseline,
 * cost centers and the board pack export.
 */
@Component({
  selector: 'app-dss-filter-bar',
  styleUrl: './dss.scss',
  imports: [
    DecimalPipe,
    FormsModule,
    TranslatePipe,
    NzButtonModule,
    NzDatePickerModule,
    NzSegmentedModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    <section class="filter-bar" [attr.aria-label]="'EXEC_DSS.FILTERS' | translate">
      <nz-select
        class="grow"
        data-testid="entity-select"
        nzMode="multiple"
        nzAllowClear
        [nzMaxTagCount]="2"
        [nzPlaceHolder]="'EXEC_DSS.ALL_ENTITIES' | translate"
        [ngModel]="store.filters().legalEntityIds"
        (ngModelChange)="store.setLegalEntities($event)"
      >
        @for (entity of store.legalEntities(); track entity.id) {
          <nz-option [nzValue]="entity.id" [nzLabel]="entity.name"></nz-option>
        }
      </nz-select>

      <nz-segmented
        data-testid="currency-toggle"
        [nzOptions]="currencyOptions"
        [ngModel]="store.currency()"
        (nzValueChange)="onCurrency($event)"
      ></nz-segmented>
      @if (store.fxRate(); as fx) {
        <nz-tag
          data-testid="fx-badge"
          [attr.title]="'EXEC_DSS.FX_AS_OF' | translate: { date: fx.asOf }"
        >
          1 {{ fx.from }} = {{ fx.rate | number: '1.4-4' }} {{ fx.to }}
        </nz-tag>
      }

      <nz-segmented
        data-testid="period-switcher"
        [nzOptions]="periodOptions()"
        [ngModel]="shownPreset()"
        (nzValueChange)="onPreset($event)"
      ></nz-segmented>
      @if (shownPreset() === 'CUSTOM') {
        <nz-range-picker
          data-testid="custom-range"
          [ngModel]="customRange()"
          (ngModelChange)="onRange($event)"
        ></nz-range-picker>
      }

      <nz-select
        class="grow"
        data-testid="baseline-select"
        [ngModel]="store.filters().comparisonBaseline"
        (ngModelChange)="store.setBaseline($event)"
      >
        @for (baseline of baselines; track baseline) {
          <nz-option [nzValue]="baseline" [nzLabel]="baselineLabel(baseline)"></nz-option>
        }
      </nz-select>

      <nz-select
        class="grow"
        data-testid="cost-center-select"
        nzMode="multiple"
        nzAllowClear
        [nzMaxTagCount]="2"
        [nzPlaceHolder]="'EXEC_DSS.ALL_COST_CENTERS' | translate"
        [ngModel]="store.filters().costCenterIds"
        (ngModelChange)="store.setCostCenters($event)"
      >
        @for (center of costCenters(); track center.id) {
          <nz-option
            [nzValue]="center.id"
            [nzLabel]="center.code + ' · ' + center.name"
          ></nz-option>
        }
      </nz-select>

      <span class="spacer"></span>
      <button
        nz-button
        nzType="primary"
        data-testid="export-board-pack"
        [nzLoading]="store.exporting()"
        (click)="exportPack.emit('pdf')"
      >
        {{ 'EXEC_DSS.EXPORT_BOARD_PACK' | translate }}
      </button>
      <button
        nz-button
        data-testid="export-board-pack-xlsx"
        [disabled]="store.exporting()"
        (click)="exportPack.emit('xlsx')"
      >
        {{ 'EXEC_DSS.EXPORT_XLSX' | translate }}
      </button>
    </section>
  `,
})
export class DssFilterBarComponent implements OnInit {
  protected readonly store = inject(ExecutiveDssStore);
  private readonly i18n = inject(TranslateService);
  private readonly ledger = inject(GeneralLedgerApiService);

  /** The user asked for the board pack in the format. */
  readonly exportPack = output<BoardPackFormat>();

  protected readonly currencyOptions = REPORTING_CURRENCIES.map((value: ReportingCurrency) => ({
    label: value,
    value,
  }));
  protected readonly baselines = COMPARISON_BASELINES;
  protected readonly costCenters = signal<{ id: string; code: string; name: string }[]>([]);

  protected readonly periodOptions = computed(() =>
    PERIOD_PRESETS.map((value) => ({
      label: this.i18n.instant(`EXEC_DSS.PERIOD_${value}`),
      value,
    })),
  );
  /** The preset on screen: a custom period still waiting for its dates is shown as selected. */
  protected readonly shownPreset = computed<PeriodPreset>(() =>
    this.store.customPending() ? 'CUSTOM' : this.store.filters().periodPreset,
  );
  protected readonly customRange = computed<Date[]>(() => {
    const range = this.store.filters().customDateRange;

    return range === null ? [] : [fromIsoDay(range[0]), fromIsoDay(range[1])];
  });

  ngOnInit(): void {
    this.ledger
      .getCostCenters()
      .pipe(catchError(() => EMPTY))
      .subscribe((res) => this.costCenters.set(res.data.filter((center) => center.is_active)));
  }

  protected baselineLabel(baseline: ComparisonBaseline): string {
    return this.i18n.instant(`EXEC_DSS.BASELINE_${baseline}`);
  }

  protected onCurrency(value: string | number): void {
    this.store.setCurrency(value === 'EUR' ? 'EUR' : 'CHF');
  }

  protected onPreset(value: string | number): void {
    this.store.setPeriodPreset(String(value) as PeriodPreset);
  }

  protected onRange(range: Date[] | null): void {
    if (range && range.length === 2) {
      this.store.setCustomDateRange([toIsoDay(range[0]), toIsoDay(range[1])]);
    }
  }
}
