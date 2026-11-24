import { Component, computed, inject, OnDestroy, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GelatoApiService,
  GelatoCategory,
  GelatoIngredient,
  GelatoIndicator,
  GelatoLine,
  GelatoMetrics,
  GelatoSolverResult,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  curvePolyline,
  gaugePercent,
  gelatoProblem,
  localizedName,
  scaleLines,
  statusColor,
  totalGrams,
} from './gelato.util';

interface WorkbenchLine {
  ingredient_id: string | null;
  grams: number;
}

const CATEGORIES: readonly GelatoCategory[] = [
  'DAIRY_CREAM',
  'FRUIT_SORBET',
  'CHOCOLATE_FAT_PASTE',
  'SAVORY_GASTRONOMIC',
  'SEMIFREDDO_COLD_PASTRY',
  'GANACHE_CHOCOLATE',
];

const GAUGES: readonly { key: string; label: string; unit: string }[] = [
  { key: 'pod', label: 'GELATO.GAUGE.POD', unit: '' },
  { key: 'pac', label: 'GELATO.GAUGE.PAC', unit: '' },
  { key: 'total_fat', label: 'GELATO.GAUGE.FAT', unit: '%' },
  { key: 'slng', label: 'GELATO.GAUGE.SLNG', unit: '%' },
  { key: 'total_solids', label: 'GELATO.GAUGE.SOLIDS', unit: '%' },
  { key: 'serving_temp', label: 'GELATO.GAUGE.TEMP', unit: ' °C' },
];

/**
 * The scientific recipe balancing workbench: gram-by-gram live recalculation, six traffic-light gauges, the freezing curve,
 * the cost breakdown, the batch scaler and the auto-balance solver.
 */
@Component({
  selector: 'app-gelato-workbench',
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzInputNumberModule,
    NzModalModule,
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'GELATO.WORKBENCH.TITLE' | translate"
      [subtitle]="'GELATO.WORKBENCH.SUBTITLE' | translate"
    >
      <button nz-button (click)="solverOpen.set(true)">
        {{ 'GELATO.AUTO_BALANCE' | translate }}
      </button>
    </app-page-header>

    <nz-card>
      <div class="gelato-toolbar">
        <nz-select [ngModel]="category()" (ngModelChange)="setCategory($event)" class="gelato-category">
          @for (c of categories; track c) {
            <nz-option [nzValue]="c" [nzLabel]="('GELATO.CATEGORY.' + c) | translate" />
          }
        </nz-select>
        <label for="gelato-workbench-ctl-1">
          {{ 'GELATO.OVERRUN' | translate }}
          <nz-input-number nzId="gelato-workbench-ctl-1" [ngModel]="overrun()" (ngModelChange)="setOverrun($event)" [nzMin]="0" [nzMax]="200" />
        </label>
        <label for="gelato-workbench-ctl-2">
          {{ 'GELATO.BATCH_WEIGHT' | translate }}
          <nz-input-number nzId="gelato-workbench-ctl-2" [ngModel]="batchWeight()" (ngModelChange)="batchWeight.set($event ?? 0)" [nzMin]="1" />
        </label>
        <button nz-button (click)="scaleBatch()">{{ 'GELATO.SCALE_BATCH' | translate }}</button>
      </div>

      <nz-table #table [nzData]="lines()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'GELATO.INGREDIENT' | translate }}</th>
            <th>{{ 'GELATO.GRAMS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (line of lines(); track $index; let i = $index) {
            <tr>
              <td>
                <nz-select
                  nzShowSearch
                  class="gelato-ingredient"
                  [ngModel]="line.ingredient_id"
                  (ngModelChange)="setIngredient(i, $event)"
                >
                  @for (ingredient of ingredients(); track ingredient.id) {
                    <nz-option [nzValue]="ingredient.id" [nzLabel]="label(ingredient)" />
                  }
                </nz-select>
              </td>
              <td>
                <nz-input-number [ngModel]="line.grams" (ngModelChange)="setGrams(i, $event)" [nzMin]="0" [nzStep]="1" />
              </td>
              <td><button nz-button nzType="link" nzDanger (click)="removeLine(i)">×</button></td>
            </tr>
          }
        </tbody>
      </nz-table>
      <button nz-button nzType="dashed" (click)="addLine()">{{ 'GELATO.ADD_LINE' | translate }}</button>
      <strong class="gelato-total">{{ total() }} g</strong>
    </nz-card>

    @if (metrics(); as m) {
      @if (m.lactose_risk.status !== 'OK') {
        <nz-alert
          nzType="warning"
          nzShowIcon
          [nzMessage]="'GELATO.LACTOSE_RISK' | translate: { max: m.lactose_risk.slng_max }"
        />
      }

      <div class="gelato-gauges">
        @for (gauge of gauges(); track gauge.key) {
          <nz-card nzSize="small" [nzTitle]="gauge.label | translate">
            <nz-progress
              [nzPercent]="gauge.percent"
              [nzStrokeColor]="gauge.color"
              [nzShowInfo]="false"
            />
            <div class="gelato-gauge-value">
              <strong>{{ gauge.indicator.value }}{{ gauge.unit }}</strong>
              <nz-tag [nzColor]="gauge.color">{{ 'GELATO.STATUS.' + gauge.indicator.status | translate }}</nz-tag>
            </div>
            <small>{{ gauge.indicator.min }} – {{ gauge.indicator.max }}{{ gauge.unit }}</small>
          </nz-card>
        }
      </div>

      <div class="gelato-panels">
        <nz-card [nzTitle]="'GELATO.FREEZING_CURVE' | translate" nzSize="small">
          <svg viewBox="0 0 240 90" class="gelato-curve" role="img">
            <polyline fill="none" stroke="#1890ff" stroke-width="2" [attr.points]="polyline()" />
          </svg>
          <table class="gelato-curve-table">
            @for (point of m.freezing_curve; track point.temperature_celsius) {
              <tr>
                <td>{{ point.temperature_celsius }} °C</td>
                <td>{{ point.frozen_water_percent }} %</td>
              </tr>
            }
          </table>
        </nz-card>

        <nz-card [nzTitle]="'GELATO.COST' | translate" nzSize="small">
          <dl class="gelato-cost">
            <dt>{{ 'GELATO.COST_PER_KG' | translate }}</dt>
            <dd>{{ m.cost.cost_per_kg }}</dd>
            <dt>{{ 'GELATO.COST_PER_LITRE_GELATO' | translate }}</dt>
            <dd>{{ m.cost.cost_per_litre_gelato }}</dd>
            <dt>{{ 'GELATO.COST_PER_TUB' | translate }}</dt>
            <dd>{{ m.cost.cost_per_tub }}</dd>
            <dt>{{ 'GELATO.COST_PER_PORTION' | translate }}</dt>
            <dd>{{ m.cost.cost_per_portion }}</dd>
          </dl>
        </nz-card>
      </div>
    }

    <nz-modal
      [nzVisible]="solverOpen()"
      [nzTitle]="'GELATO.AUTO_BALANCE' | translate"
      [nzOkText]="'GELATO.AUTO_BALANCE.RUN' | translate"
      [nzOkLoading]="solving()"
      (nzOnOk)="solve()"
      (nzOnCancel)="solverOpen.set(false)"
    >
      <ng-container *nzModalContent>
        @for (field of targetFields; track field.key) {
          <label class="gelato-target" [for]="'gelato-target-' + field.key">
            {{ 'GELATO.TARGET' | translate }} {{ field.label | translate }}
            <nz-input-number [nzId]="'gelato-target-' + field.key" [ngModel]="targets()[field.key]" (ngModelChange)="setTarget(field.key, $event)" [nzMin]="0" />
          </label>
        }
        @if (solution(); as s) {
          <nz-alert
            [nzType]="s.status === 'EXACT' ? 'success' : 'warning'"
            nzShowIcon
            [nzMessage]="(s.status === 'EXACT' ? 'GELATO.AUTO_BALANCE.EXACT' : 'GELATO.AUTO_BALANCE.CLOSEST') | translate"
          />
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .gelato-toolbar { display: flex; gap: 16px; flex-wrap: wrap; align-items: center; margin-bottom: 12px; }
    .gelato-category { min-width: 240px; }
    .gelato-ingredient { min-width: 280px; }
    .gelato-total { margin-left: 16px; }
    .gelato-gauges { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 12px; margin: 12px 0; }
    .gelato-gauge-value { display: flex; justify-content: space-between; align-items: center; }
    .gelato-panels { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 12px; }
    .gelato-curve { width: 100%; height: 90px; }
    .gelato-curve-table { width: 100%; font-size: 12px; }
    .gelato-cost { display: grid; grid-template-columns: 1fr auto; gap: 4px 12px; margin: 0; }
    .gelato-cost dd { margin: 0; text-align: right; font-weight: 600; }
    .gelato-target { display: flex; justify-content: space-between; margin-bottom: 8px; }
  `,
})
export class GelatoWorkbenchComponent implements OnInit, OnDestroy {
  private readonly api = inject(GelatoApiService);
  private readonly translate = inject(TranslateService);
  private readonly message = inject(NzMessageService);
  private timer: ReturnType<typeof setTimeout> | null = null;

  readonly categories = CATEGORIES;
  readonly targetFields: readonly { key: 'weight' | 'pod' | 'pac' | 'total_fat' | 'slng'; label: string }[] = [
    { key: 'weight', label: 'GELATO.GRAMS' },
    { key: 'pod', label: 'GELATO.GAUGE.POD' },
    { key: 'pac', label: 'GELATO.GAUGE.PAC' },
    { key: 'total_fat', label: 'GELATO.GAUGE.FAT' },
    { key: 'slng', label: 'GELATO.GAUGE.SLNG' },
  ];

  readonly ingredients = signal<GelatoIngredient[]>([]);
  readonly category = signal<GelatoCategory>('DAIRY_CREAM');
  readonly overrun = signal(30);
  readonly batchWeight = signal(3500);
  readonly lines = signal<WorkbenchLine[]>([{ ingredient_id: null, grams: 0 }]);
  readonly metrics = signal<GelatoMetrics | null>(null);
  readonly solverOpen = signal(false);
  readonly solving = signal(false);
  readonly solution = signal<GelatoSolverResult | null>(null);
  readonly targets = signal<Record<string, number | null>>({ weight: 1000, pod: 170, pac: 260, total_fat: 8, slng: 9 });

  readonly total = computed(() => totalGrams(this.lines()));
  readonly polyline = computed(() => curvePolyline(this.metrics()?.freezing_curve ?? [], 240, 90));
  readonly gauges = computed(() => {
    const evaluation = this.metrics()?.evaluation;
    if (!evaluation) return [];
    return GAUGES.map((gauge) => {
      const indicator: GelatoIndicator = evaluation.indicators[gauge.key];
      return {
        ...gauge,
        indicator,
        percent: gaugePercent(indicator),
        color: { green: '#52c41a', gold: '#faad14', red: '#f5222d' }[statusColor(indicator.status)],
      };
    });
  });

  ngOnInit(): void {
    this.api.getIngredients().subscribe({
      next: (response) => this.ingredients.set(response.data),
      error: () => this.message.error(this.translate.instant('GELATO.LOAD_ERROR')),
    });
  }

  ngOnDestroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  label(ingredient: GelatoIngredient): string {
    return `${localizedName(ingredient.name, this.translate.currentLanguage() as 'it')} (${ingredient.code})`;
  }

  setCategory(category: GelatoCategory): void {
    this.category.set(category);
    this.recalculate();
  }

  setOverrun(value: number | null): void {
    this.overrun.set(value ?? 0);
    this.recalculate();
  }

  addLine(): void {
    this.lines.update((lines) => [...lines, { ingredient_id: null, grams: 0 }]);
  }

  removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
    this.recalculate();
  }

  setIngredient(index: number, id: string | null): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, ingredient_id: id } : line)));
    this.recalculate();
  }

  setGrams(index: number, grams: number | null): void {
    this.lines.update((lines) => lines.map((line, i) => (i === index ? { ...line, grams: grams ?? 0 } : line)));
    this.recalculate();
  }

  setTarget(key: string, value: number | null): void {
    this.targets.update((targets) => ({ ...targets, [key]: value }));
  }

  scaleBatch(): void {
    this.lines.update((lines) => scaleLines(lines, this.batchWeight()));
    this.recalculate();
  }

  /** Debounced live recalculation: the API answers with the indexes of the lines on screen. */
  recalculate(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.runPreview(), 250);
  }

  private runPreview(): void {
    const usable: GelatoLine[] = this.lines()
      .filter((line) => line.ingredient_id && line.grams > 0)
      .map((line) => ({ ingredient_id: line.ingredient_id, grams: line.grams }));
    if (usable.length === 0) {
      this.metrics.set(null);
      return;
    }
    this.api.preview(this.category(), usable, { overrun_percent: this.overrun() }).subscribe({
      next: (response) => this.metrics.set(response.data.metrics),
      error: (error) => this.message.error(gelatoProblem(error, this.translate.instant('GELATO.LOAD_ERROR'))),
    });
  }

  /** Auto-balance of the ingredients already chosen on the grid towards the targets. */
  solve(): void {
    const pool = this.lines()
      .filter((line) => line.ingredient_id)
      .map((line) => ({ ingredient_id: line.ingredient_id as string }));
    const targets = this.targets();
    if (pool.length === 0 || !targets['weight']) return;
    this.solving.set(true);
    this.api
      .autoBalance(
        this.category(),
        {
          weight: targets['weight'],
          pod: targets['pod'],
          pac: targets['pac'],
          total_fat: targets['total_fat'],
          slng: targets['slng'],
        },
        pool,
      )
      .subscribe({
        next: (response) => {
          this.solving.set(false);
          this.solution.set(response.data);
          this.lines.update((lines) =>
            lines.map((line) => ({ ...line, grams: response.data.weights[line.ingredient_id ?? ''] ?? line.grams })),
          );
          this.metrics.set(response.data.achieved);
        },
        error: (error) => {
          this.solving.set(false);
          this.message.error(gelatoProblem(error, this.translate.instant('GELATO.LOAD_ERROR')));
        },
      });
  }
}
