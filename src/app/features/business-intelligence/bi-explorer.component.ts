import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import {
  BI_PERIOD_PRESETS,
  BI_SNAPSHOT_FREQUENCIES,
  BiDataset,
  BiFilter,
  BiPivotLayout,
  BiQueryOutcome,
  BiSavedQuery,
  BiSnapshotFrequency,
  BiSpec,
  BusinessIntelligenceApiService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { BiPivotTableComponent } from './bi-pivot-table.component';
import { apiErrorText, BI_OPERATOR_KEYS, blankToNull, dimensionKey, findDimension, formatBiValue } from './bi.util';

interface FilterRow {
  field: string | null;
  operator: string | null;
  value: string;
}

/**
 * The self-service explorer: pick a dataset of the semantic layer, drag dimensions and measures (calculated ones included)
 * into a query, filter it, lay it out as a pivot and run it. Nothing typed here is SQL: the API accepts only keys the
 * dataset declares. A query can be saved, shared and scheduled for snapshots.
 */
@Component({
  selector: 'app-bi-explorer',
  styleUrl: './business-intelligence.scss',
  imports: [
    FormsModule,
    BiPivotTableComponent,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
  ],
  template: `
    <app-page-header [title]="'BI.EXPLORER_TITLE' | translate" [subtitle]="'BI.EXPLORER_SUBTITLE' | translate">
      <button nz-button (click)="saveVisible.set(true)" [disabled]="!canRun()"><i class="fa-solid fa-floppy-disk" aria-hidden="true"></i> {{ 'BI.SAVE_QUERY' | translate }}</button>
      <button nz-button nzType="primary" (click)="run()" [disabled]="!canRun() || running()"><i class="fa-solid fa-play" aria-hidden="true"></i> {{ 'BI.RUN' | translate }}</button>
    </app-page-header>

    <nz-card class="main-card">
      <div class="form-row">
        <div>
          <label for="explorer-dataset">{{ 'BI.DATASET' | translate }}</label>
          <nz-select id="explorer-dataset" style="width: 100%" nzShowSearch [ngModel]="datasetKey()" (ngModelChange)="onDataset($event)">
            @for (item of datasets(); track item.key) {
              <nz-option [nzValue]="item.key" [nzLabel]="item.label"></nz-option>
            }
          </nz-select>
          @if (dataset(); as current) {
            <small class="muted">{{ current.description }}</small>
          }
        </div>
        <div>
          <label for="explorer-dimensions">{{ 'BI.DIMENSIONS' | translate }}</label>
          <nz-select id="explorer-dimensions" style="width: 100%" nzMode="multiple" [ngModel]="dimensions()" (ngModelChange)="dimensions.set($event)">
            @for (dimension of dataset()?.dimensions ?? []; track dimension.key) {
              <nz-option [nzValue]="dimension.key" [nzLabel]="dimension.label"></nz-option>
            }
          </nz-select>
        </div>
        <div>
          <label for="explorer-measures">{{ 'BI.MEASURES' | translate }}</label>
          <nz-select id="explorer-measures" style="width: 100%" nzMode="multiple" [ngModel]="measures()" (ngModelChange)="measures.set($event)">
            @for (measure of dataset()?.measures ?? []; track measure.key) {
              <nz-option [nzValue]="measure.key" [nzLabel]="measure.label"></nz-option>
            }
          </nz-select>
        </div>
        @if ((dataset()?.calculated_measures ?? []).length > 0) {
          <div>
            <label for="explorer-calculated">{{ 'BI.CALCULATED_MEASURES' | translate }}</label>
            <nz-select id="explorer-calculated" style="width: 100%" nzMode="multiple" [ngModel]="calculated()" (ngModelChange)="calculated.set($event)">
              @for (measure of dataset()?.calculated_measures ?? []; track measure.key) {
                <nz-option [nzValue]="measure.key" [nzLabel]="measure.label"></nz-option>
              }
            </nz-select>
          </div>
        }
        @if (dataset()?.supports_period) {
          <div>
            <label for="explorer-period">{{ 'BI.PERIOD' | translate }}</label>
            <nz-select id="explorer-period" style="width: 100%" nzAllowClear [ngModel]="period()" (ngModelChange)="period.set($event)">
              @for (preset of presets; track preset) {
                <nz-option [nzValue]="preset" [nzLabel]="('BI.PERIOD_' + preset.toUpperCase()) | translate"></nz-option>
              }
            </nz-select>
          </div>
        }
      </div>

      @for (dimension of dateDimensions(); track dimension.key) {
        <div class="bi-granularity">
          <label [for]="'granularity-' + dimension.key">{{ 'BI.GRANULARITY' | translate }}: {{ dimension.label }}</label>
          <nz-select [id]="'granularity-' + dimension.key" style="width: 160px" nzAllowClear [ngModel]="granularity()[dimension.key] ?? null" (ngModelChange)="setGranularity(dimension.key, $event)">
            @for (value of dimension.granularities; track value) {
              <nz-option [nzValue]="value" [nzLabel]="('BI.GRANULARITY_' + value.toUpperCase()) | translate"></nz-option>
            }
          </nz-select>
        </div>
      }

      <h3 class="bi-section">{{ 'BI.FILTERS' | translate }}</h3>
      @for (row of filters(); track $index; let index = $index) {
        <div class="bi-filter">
          <nz-select style="width: 200px" [ngModel]="row.field" (ngModelChange)="patchFilter(index, { field: $event, operator: null, value: '' })" [attr.aria-label]="'BI.FILTER_FIELD' | translate">
            @for (dimension of dataset()?.dimensions ?? []; track dimension.key) {
              <nz-option [nzValue]="dimension.key" [nzLabel]="dimension.label"></nz-option>
            }
          </nz-select>
          <nz-select style="width: 180px" [ngModel]="row.operator" (ngModelChange)="patchFilter(index, { operator: $event })" [attr.aria-label]="'BI.FILTER_OPERATOR' | translate">
            @for (operator of operatorsOf(row.field); track operator) {
              <nz-option [nzValue]="operator" [nzLabel]="operatorLabel(operator) | translate"></nz-option>
            }
          </nz-select>
          @if (needsValue(row.operator)) {
            <input nz-input style="width: 240px" [ngModel]="row.value" (ngModelChange)="patchFilter(index, { value: $event })" [attr.aria-label]="'BI.FILTER_VALUE' | translate" [placeholder]="valueHint(row.operator) | translate" />
          }
          <button nz-button nzType="text" nzDanger type="button" (click)="removeFilter(index)" [attr.aria-label]="'BI.REMOVE_FILTER' | translate"><i class="fa-solid fa-xmark" aria-hidden="true"></i></button>
        </div>
      }
      <button nz-button type="button" (click)="addFilter()" [disabled]="!dataset()"><i class="fa-solid fa-plus" aria-hidden="true"></i> {{ 'BI.ADD_FILTER' | translate }}</button>

      <h3 class="bi-section">{{ 'BI.PIVOT_LAYOUT' | translate }}</h3>
      <div class="form-row">
        <div>
          <label for="pivot-rows">{{ 'BI.PIVOT_ROWS' | translate }}</label>
          <nz-select id="pivot-rows" style="width: 100%" nzMode="multiple" [ngModel]="pivotRows()" (ngModelChange)="pivotRows.set($event)">
            @for (key of chosenDimensions(); track key) {
              <nz-option [nzValue]="key" [nzLabel]="dimensionLabel(key)"></nz-option>
            }
          </nz-select>
        </div>
        <div>
          <label for="pivot-columns">{{ 'BI.PIVOT_COLUMNS' | translate }}</label>
          <nz-select id="pivot-columns" style="width: 100%" nzMode="multiple" [ngModel]="pivotColumns()" (ngModelChange)="pivotColumns.set($event)">
            @for (key of chosenDimensions(); track key) {
              <nz-option [nzValue]="key" [nzLabel]="dimensionLabel(key)"></nz-option>
            }
          </nz-select>
        </div>
        <div>
          <label for="pivot-values">{{ 'BI.PIVOT_VALUES' | translate }}</label>
          <nz-select id="pivot-values" style="width: 100%" nzMode="multiple" [ngModel]="pivotValues()" (ngModelChange)="pivotValues.set($event)">
            @for (option of measureOptions(); track option.key) {
              <nz-option [nzValue]="option.key" [nzLabel]="option.label"></nz-option>
            }
          </nz-select>
        </div>
      </div>
    </nz-card>

    <nz-spin [nzSpinning]="running()">
      @if (outcome(); as shown) {
        <nz-card class="main-card" [nzTitle]="shown.pivot ? ('BI.PIVOT_RESULT' | translate) : ('BI.RESULT' | translate)">
          @if (shown.pivot) {
            <app-bi-pivot-table [pivot]="shown.pivot"></app-bi-pivot-table>
          } @else {
            <nz-table #table [nzData]="shown.result.rows" nzSize="small" [nzPageSize]="25">
              <thead>
                <tr>
                  @for (column of shown.result.columns; track column.key) {
                    <th [class.num]="column.kind !== 'dimension'">{{ column.label }}</th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (row of table.data; track $index) {
                  <tr>
                    @for (column of shown.result.columns; track column.key) {
                      <td [class.num]="column.kind !== 'dimension'">{{ column.kind === 'dimension' ? (row[column.key] ?? '-') : format(row[column.key], column.unit) }}</td>
                    }
                  </tr>
                }
              </tbody>
            </nz-table>
          }
          @if (shown.result.meta.truncated) {
            <small class="muted">{{ 'BI.TRUNCATED' | translate: { count: shown.result.meta.row_limit } }}</small>
          }
        </nz-card>
      } @else {
        <nz-empty [nzNotFoundContent]="'BI.EXPLORER_EMPTY' | translate"></nz-empty>
      }
    </nz-spin>

    <nz-modal [(nzVisible)]="saveVisible" [nzTitle]="'BI.SAVE_QUERY' | translate" (nzOnCancel)="saveVisible.set(false)" (nzOnOk)="save()" [nzOkDisabled]="name().trim() === ''">
      <ng-container *nzModalContent>
        <label for="query-name">{{ 'BI.NAME' | translate }}</label>
        <input nz-input id="query-name" maxlength="160" [ngModel]="name()" (ngModelChange)="name.set($event)" />
        <label for="query-description" class="bi-label">{{ 'BI.DESCRIPTION' | translate }}</label>
        <textarea nz-input id="query-description" rows="2" [ngModel]="description()" (ngModelChange)="description.set($event)"></textarea>
        <label for="query-visibility" class="bi-label">{{ 'BI.VISIBILITY' | translate }}</label>
        <nz-select id="query-visibility" style="width: 100%" [ngModel]="visibility()" (ngModelChange)="visibility.set($event)">
          <nz-option nzValue="private" [nzLabel]="'BI.VISIBILITY_PRIVATE' | translate"></nz-option>
          <nz-option nzValue="company" [nzLabel]="'BI.VISIBILITY_COMPANY' | translate"></nz-option>
        </nz-select>
        <label for="query-frequency" class="bi-label">{{ 'BI.SNAPSHOT_FREQUENCY' | translate }}</label>
        <nz-select id="query-frequency" style="width: 100%" nzAllowClear [ngModel]="frequency()" (ngModelChange)="frequency.set($event)">
          @for (value of frequencies; track value) {
            <nz-option [nzValue]="value" [nzLabel]="('BI.FREQUENCY_' + value.toUpperCase()) | translate"></nz-option>
          }
        </nz-select>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .bi-section { margin: 16px 0 8px; }
    .bi-filter, .bi-granularity { display: flex; gap: 8px; align-items: center; margin-bottom: 8px; flex-wrap: wrap; }
    .bi-label { display: block; margin-top: 12px; }
  `,
})
export class BiExplorerComponent implements OnInit {
  private readonly api = inject(BusinessIntelligenceApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly presets = BI_PERIOD_PRESETS;
  readonly frequencies = BI_SNAPSHOT_FREQUENCIES;
  readonly datasets = signal<BiDataset[]>([]);
  readonly datasetKey = signal<string | null>(null);
  readonly dimensions = signal<string[]>([]);
  readonly granularity = signal<Record<string, string>>({});
  readonly measures = signal<string[]>([]);
  readonly calculated = signal<string[]>([]);
  readonly filters = signal<FilterRow[]>([]);
  readonly period = signal<string | null>(null);
  readonly pivotRows = signal<string[]>([]);
  readonly pivotColumns = signal<string[]>([]);
  readonly pivotValues = signal<string[]>([]);
  readonly outcome = signal<BiQueryOutcome | null>(null);
  readonly running = signal(false);

  readonly saveVisible = signal(false);
  readonly name = signal('');
  readonly description = signal('');
  readonly visibility = signal<'private' | 'company'>('private');
  readonly frequency = signal<BiSnapshotFrequency | null>(null);

  readonly dataset = computed(() => this.datasets().find((item) => item.key === this.datasetKey()));
  readonly dateDimensions = computed(() => (this.dataset()?.dimensions ?? []).filter((dimension) => dimension.type === 'date' && this.dimensions().includes(dimension.key)));
  readonly chosenDimensions = computed(() => this.dimensions().map(dimensionKey));
  readonly canRun = computed(() => this.datasetKey() !== null && (this.measures().length > 0 || this.calculated().length > 0));

  /** Measures a pivot can show: the chosen base measures and calculated measures. */
  readonly measureOptions = computed(() => {
    const dataset = this.dataset();
    return [
      ...(dataset?.measures ?? []).filter((measure) => this.measures().includes(measure.key)),
      ...(dataset?.calculated_measures ?? []).filter((measure) => this.calculated().includes(measure.key)),
    ];
  });

  ngOnInit(): void {
    this.api.getDatasets().subscribe({
      next: (response) => {
        this.datasets.set(response.data);
        const queryId = this.route.snapshot.queryParamMap.get('query');
        if (queryId) {
          this.loadQuery(queryId);
        }
      },
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  onDataset(key: string | null): void {
    this.datasetKey.set(key);
    this.dimensions.set([]);
    this.granularity.set({});
    this.measures.set([]);
    this.calculated.set([]);
    this.filters.set([]);
    this.period.set(null);
    this.pivotRows.set([]);
    this.pivotColumns.set([]);
    this.pivotValues.set([]);
    this.outcome.set(null);
  }

  setGranularity(key: string, value: string | null): void {
    this.granularity.update((current) => {
      const next = { ...current };
      if (value) {
        next[key] = value;
      } else {
        delete next[key];
      }
      return next;
    });
  }

  addFilter(): void {
    this.filters.update((rows) => [...rows, { field: null, operator: null, value: '' }]);
  }

  patchFilter(index: number, patch: Partial<FilterRow>): void {
    this.filters.update((rows) => rows.map((row, position) => (position === index ? { ...row, ...patch } : row)));
  }

  removeFilter(index: number): void {
    this.filters.update((rows) => rows.filter((_, position) => position !== index));
  }

  operatorsOf(field: string | null): string[] {
    return field ? (findDimension(this.dataset(), field)?.operators ?? []) : [];
  }

  operatorLabel(operator: string): string {
    return BI_OPERATOR_KEYS[operator] ?? operator;
  }

  needsValue(operator: string | null): boolean {
    return operator !== null && operator !== 'is_null' && operator !== 'not_null';
  }

  valueHint(operator: string | null): string {
    return operator === 'between' ? 'BI.HINT_BETWEEN' : operator === 'in' || operator === 'not_in' ? 'BI.HINT_LIST' : 'BI.FILTER_VALUE';
  }

  dimensionLabel(key: string): string {
    return findDimension(this.dataset(), key)?.label ?? key;
  }

  format(value: unknown, unit: string | undefined): string {
    return formatBiValue(value, unit as never);
  }

  /** The specification of the semantic layer the form describes. */
  spec(): BiSpec {
    const granularity = this.granularity();
    const spec: BiSpec = {
      dimensions: this.dimensions().map((key) => (granularity[key] ? `${key}:${granularity[key]}` : key)),
      measures: this.measures(),
    };
    const filters = this.apiFilters();
    if (filters.length > 0) {
      spec.filters = filters;
    }
    if (this.period()) {
      spec.period = { preset: this.period() as string };
    }

    return spec;
  }

  /** The pivot layout, or none when no row or column is chosen; the values default to every measure of the query. */
  pivot(): BiPivotLayout | null {
    const chosen = new Set(this.chosenDimensions());
    const rows = this.pivotRows().filter((key) => chosen.has(key));
    const columns = this.pivotColumns().filter((key) => chosen.has(key));
    if (rows.length === 0 && columns.length === 0) {
      return null;
    }

    const options = this.measureOptions().map((measure) => measure.key);
    const values = this.pivotValues().filter((key) => options.includes(key));

    return { rows, columns, values: values.length > 0 ? values : options };
  }

  run(): void {
    const dataset = this.datasetKey();
    if (!dataset || !this.canRun()) {
      return;
    }

    this.running.set(true);
    this.api.explore({ dataset, spec: this.spec(), calculated_measures: this.calculated(), pivot: this.pivot() }).subscribe({
      next: (response) => {
        this.outcome.set(response.data);
        this.running.set(false);
      },
      error: (error: unknown) => {
        this.running.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR'));
      },
    });
  }

  save(): void {
    const dataset = this.datasetKey();
    if (!dataset) {
      return;
    }

    this.api
      .createSavedQuery({
        name: this.name().trim(),
        description: blankToNull(this.description()),
        dataset,
        spec: this.spec(),
        calculated_measures: this.calculated(),
        pivot: this.pivot(),
        visibility: this.visibility(),
        snapshot_frequency: this.frequency(),
      })
      .subscribe({
        next: () => {
          this.saveVisible.set(false);
          this.message.success(this.translate.instant('BI.QUERY_SAVED'));
        },
        error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
      });
  }

  private loadQuery(id: string): void {
    this.api.getSavedQuery(id).subscribe({
      next: (response) => this.fill(response.data),
      error: (error: unknown) => this.message.error(apiErrorText(error) ?? this.translate.instant('BI.ACTION_ERROR')),
    });
  }

  private fill(query: BiSavedQuery): void {
    this.datasetKey.set(query.dataset);
    const granularity: Record<string, string> = {};
    this.dimensions.set(
      query.spec.dimensions.map((entry) => {
        const [key, grain] = entry.split(':');
        if (grain) {
          granularity[key] = grain;
        }
        return key;
      }),
    );
    this.granularity.set(granularity);
    this.measures.set(query.spec.measures);
    this.calculated.set(query.calculated_measures);
    this.period.set(query.spec.period?.preset ?? null);
    this.filters.set((query.spec.filters ?? []).map((filter) => ({ field: filter.field, operator: filter.operator, value: Array.isArray(filter.value) ? filter.value.join(',') : String(filter.value ?? '') })));
    this.pivotRows.set(query.pivot?.rows ?? []);
    this.pivotColumns.set(query.pivot?.columns ?? []);
    this.pivotValues.set(query.pivot?.values ?? []);
    this.name.set(query.name);
    this.description.set(query.description ?? '');
    this.frequency.set(query.snapshot_frequency);
    this.run();
  }

  /** The filters the API takes: complete rows only, lists split on commas, numbers and booleans typed. */
  private apiFilters(): BiFilter[] {
    const result: BiFilter[] = [];
    for (const row of this.filters()) {
      if (!row.field || !row.operator) {
        continue;
      }

      if (!this.needsValue(row.operator)) {
        result.push({ field: row.field, operator: row.operator });
        continue;
      }

      const type = findDimension(this.dataset(), row.field)?.type;
      const typed = (text: string): string | number | boolean => (type === 'number' ? Number(text) : type === 'boolean' ? text === 'true' || text === '1' : text);
      if (row.value.trim() === '') {
        continue;
      }

      const listed = ['in', 'not_in', 'between'].includes(row.operator);
      result.push({ field: row.field, operator: row.operator, value: listed ? row.value.split(',').map((part) => typed(part.trim())) : typed(row.value.trim()) });
    }

    return result;
  }
}
