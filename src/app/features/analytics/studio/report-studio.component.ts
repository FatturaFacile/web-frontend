import { CdkDrag, CdkDragDrop, CdkDropList } from '@angular/cdk/drag-drop';
import { Location } from '@angular/common';
import {
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  OnInit,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { I18nService } from '@core/i18n/i18n.service';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopoverModule } from 'ng-zorro-antd/popover';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AnalyticsApiService,
  AnalyticsSemanticDataset,
  PivotResult,
  StudioCatalog,
  StudioExportFormat,
  StudioFormattingRule,
  StudioLocale,
  StudioSavedReport,
  StudioSchedule,
} from '@core';
import { PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { downloadBlob } from '../../general-ledger/shared/gl-dates';
import { analyticsErrorText } from '../analytics-designer.util';
import { CalculatedMeasureModalComponent } from './calculated-measure-modal.component';
import { FilterGroupComponent } from './filter-group.component';
import { PivotChartComponent } from './pivot-chart.component';
import { PivotGridComponent } from './pivot-grid.component';
import { SaveReportChoice, SaveReportModalComponent } from './save-report-modal.component';
import { ScheduleDrawerComponent } from './schedule-drawer.component';
import {
  CHART_KEYS,
  COLOR_KEYS,
  FORMAT_KEYS,
  GRANULARITY_KEYS,
  LOCALE_KEYS,
  OPERATOR_KEYS,
  PERIOD_KEYS,
  UNIT_KEYS,
  VALUE_FORMAT_KEYS,
} from './studio-keys';
import {
  canRun,
  cleanFilterTree,
  dropField,
  emptyStudioState,
  fromSavedReport,
  isFilterGroup,
  moveField,
  removeFromShelf,
  setGranularity,
  ShelfName,
  StudioState,
  toDefinition,
  tokenGranularity,
  tokenKey,
} from './studio-state';

/** What a pill of the catalog or a chip of a shelf carries while it is dragged. */
export interface StudioDragData {
  key: string;
  kind: 'dimension' | 'measure';
  shelf: ShelfName | 'catalog';
  index: number;
}

type ViewMode = 'grid' | 'chart' | 'split';

const LANGUAGE_LOCALE: Record<string, StudioLocale> = {
  it: 'it-CH',
  de: 'de-CH',
  fr: 'fr-CH',
  en: 'en',
};

/**
 * The Interactive Report & Pivot Studio: a governed field catalog on the left, drop zones for filters, columns, rows and
 * values in the middle (drag and drop, or the buttons of every pill for keyboard use), and the result as a pivot grid, a
 * chart or both. Everything the API validates (dimensions of the dataset, formulas, filters, formatting tokens) is
 * only ever chosen from the catalog and its allow-lists.
 */
@Component({
  selector: 'app-report-studio',
  imports: [
    RadioControlDirective,
    CdkDrag,
    CdkDropList,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDropdownModule,
    NzInputModule,
    NzPopoverModule,
    NzRadioModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
    RouterLink,
    CalculatedMeasureModalComponent,
    FilterGroupComponent,
    PageHeaderComponent,
    PivotChartComponent,
    PivotGridComponent,
    SaveReportModalComponent,
    ScheduleDrawerComponent,
    TranslatePipe,
  ],
  styleUrl: './report-studio.component.scss',
  templateUrl: './report-studio.component.html',
})
export class ReportStudioComponent implements OnInit {
  private readonly api = inject(AnalyticsApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly location = inject(Location);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly keys = {
    operator: OPERATOR_KEYS,
    granularity: GRANULARITY_KEYS,
    period: PERIOD_KEYS,
    chart: CHART_KEYS,
    format: FORMAT_KEYS,
    locale: LOCALE_KEYS,
    unit: UNIT_KEYS,
    color: COLOR_KEYS,
    valueFormat: VALUE_FORMAT_KEYS,
  };
  protected readonly exportFormats: StudioExportFormat[] = ['xlsx', 'pdf', 'csv', 'json'];
  protected readonly shelfIds = [
    'studio-filters',
    'studio-columns',
    'studio-rows',
    'studio-values',
  ];

  readonly catalog = signal<StudioCatalog | null>(null);
  readonly state = signal<StudioState>(emptyStudioState());
  readonly result = signal<PivotResult | null>(null);
  readonly loading = signal(false);
  readonly errorText = signal<string | null>(null);
  readonly view = signal<ViewMode>('grid');
  readonly search = signal('');
  readonly exportLocale = signal<StudioLocale>(
    LANGUAGE_LOCALE[this.i18n.currentLanguage()] ?? 'en',
  );
  readonly saved = signal<StudioSavedReport | null>(null);
  readonly schedule = signal<StudioSchedule | null>(null);
  readonly saveOpen = signal(false);
  readonly saving = signal(false);
  readonly saveError = signal<string | null>(null);
  readonly calcOpen = signal(false);
  readonly scheduleOpen = signal(false);
  readonly filtersOpen = signal(false);
  readonly exporting = signal(false);

  private runTimer: ReturnType<typeof setTimeout> | null = null;
  private runTicket = 0;

  protected readonly dataset = computed<AnalyticsSemanticDataset | null>(
    () => this.catalog()?.datasets.find((item) => item.key === this.state().dataset) ?? null,
  );
  readonly definition = computed(() => toDefinition(this.state()));
  readonly runnable = computed(() => canRun(this.state()));

  protected readonly dimensions = computed(() => {
    const term = this.search().trim().toLowerCase();

    return (this.dataset()?.dimensions ?? []).filter(
      (item) => term === '' || item.label.toLowerCase().includes(term),
    );
  });

  protected readonly measures = computed(() => {
    const term = this.search().trim().toLowerCase();

    return (this.dataset()?.measures ?? []).filter(
      (item) => term === '' || item.label.toLowerCase().includes(term),
    );
  });

  /** Everything a formula or a formatting rule can point at: the measures on the Values shelf and the calculated ones. */
  protected readonly valueKeys = computed(() => [
    ...this.state().values,
    ...this.state().calculated.map((field) => field.key),
  ]);

  protected readonly valueLabels = computed(() => {
    const labels = new Map<string, string>();
    for (const measure of this.dataset()?.measures ?? []) {
      labels.set(measure.key, measure.label);
    }
    for (const field of this.state().calculated) {
      labels.set(field.key, field.label);
    }

    return labels;
  });

  protected readonly dimensionOptions = computed(() =>
    [...this.state().rows, ...this.state().columns].map(tokenKey),
  );

  protected readonly filterChips = computed(() => this.flattenFilters(this.state().filters));
  protected readonly hasSubtotalLevels = computed(() => this.state().rows.length > 1);

  constructor() {
    // Runs the pivot a moment after the last change, whenever the report can be run.
    effect(() => {
      const definition = this.definition();
      const runnable = this.runnable();

      untracked(() => {
        this.clearRunTimer();
        if (!runnable) {
          this.result.set(null);

          return;
        }
        this.runTimer = setTimeout(() => this.run(definition), 350);
      });
    });

    this.destroyRef.onDestroy(() => this.clearRunTimer());
  }

  ngOnInit(): void {
    this.api
      .getStudioCatalog()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.catalog.set(response.data);
          if (this.state().dataset === null && this.route.snapshot.paramMap.get('id') === null) {
            this.selectDataset(response.data.datasets[0]?.key ?? null);
          }
          this.loadFromRoute();
        },
        error: (error: unknown) =>
          this.errorText.set(
            analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
          ),
      });
  }

  selectDataset(key: string | null): void {
    this.state.set(emptyStudioState(key));
    this.result.set(null);
  }

  // ── Shelves ─────────────────────────────────────────────────────────────

  protected readonly acceptsDimension = (drag: CdkDrag<StudioDragData>): boolean =>
    drag.data.kind === 'dimension';
  protected readonly acceptsMeasure = (drag: CdkDrag<StudioDragData>): boolean =>
    drag.data.kind === 'measure';

  /** A drop on a shelf: a pill of the catalog is added, a chip of another shelf is moved or reordered. */
  onDrop(event: CdkDragDrop<string, string, StudioDragData>, target: ShelfName): void {
    const dataset = this.dataset();
    const data = event.item.data;
    if (dataset === null) {
      return;
    }

    if (data.shelf === 'catalog' || data.shelf === 'filters') {
      this.addToShelf(target, data.key, event.currentIndex);

      return;
    }

    if (target === 'filters') {
      return;
    }

    this.state.update((state) =>
      moveField(
        state,
        dataset,
        data.shelf as Exclude<ShelfName, 'filters'>,
        target,
        data.index,
        event.currentIndex,
      ),
    );
  }

  addToShelf(shelf: ShelfName, key: string, index?: number): void {
    const dataset = this.dataset();
    if (dataset !== null) {
      this.state.update((state) => dropField(state, dataset, shelf, key, index));
    }
  }

  remove(shelf: Exclude<ShelfName, 'filters'>, key: string): void {
    this.state.update((state) => removeFromShelf(state, shelf, key));
  }

  removeCalculated(key: string): void {
    this.state.update((state) => ({
      ...state,
      calculated: state.calculated.filter((field) => field.key !== key),
      formatting: state.formatting.filter((rule) => rule.target !== key),
      chart: { ...state.chart, series: state.chart.series.filter((item) => item !== key) },
    }));
  }

  changeGranularity(shelf: 'rows' | 'columns', token: string, granularity: string): void {
    this.state.update((state) => setGranularity(state, shelf, tokenKey(token), granularity));
  }

  patch(change: Partial<StudioState>): void {
    this.state.update((state) => ({ ...state, ...change }));
  }

  patchChart(change: Partial<StudioState['chart']>): void {
    this.state.update((state) => ({ ...state, chart: { ...state.chart, ...change } }));
  }

  protected granularityOf(token: string): string | null {
    return tokenGranularity(token);
  }

  protected labelOf(key: string): string {
    const base = tokenKey(key);

    return (
      this.dataset()?.dimensions.find((item) => item.key === base)?.label ??
      this.valueLabels().get(base) ??
      base
    );
  }

  protected granularities(): string[] {
    return this.catalog()?.options.granularities ?? [];
  }

  // ── Filters ─────────────────────────────────────────────────────────────

  protected flattenFilters(group: StudioState['filters'], depth = 0): string[] {
    return group.conditions.flatMap((node) => {
      if (isFilterGroup(node)) {
        return this.flattenFilters(node, depth + 1);
      }
      const value = Array.isArray(node.value)
        ? node.value.join(', ')
        : node.value === null || node.value === undefined
          ? ''
          : String(node.value);

      return [
        `${this.labelOf(node.field)} ${this.i18n.translate(OPERATOR_KEYS[node.operator] ?? node.operator)} ${value}`.trim(),
      ];
    });
  }

  protected hasActiveFilter(): boolean {
    return cleanFilterTree(this.state().filters) !== null;
  }

  // ── Conditional formatting ──────────────────────────────────────────────

  addRule(): void {
    const target = this.valueKeys()[0];
    if (target === undefined) {
      return;
    }
    const rule: StudioFormattingRule = {
      target,
      operator: 'gt',
      value: '0',
      value2: null,
      background: 'green',
      text: 'default',
    };
    this.state.update((state) => ({ ...state, formatting: [...state.formatting, rule] }));
  }

  updateRule(index: number, change: Partial<StudioFormattingRule>): void {
    this.state.update((state) => ({
      ...state,
      formatting: state.formatting.map((rule, position) =>
        position === index ? { ...rule, ...change } : rule,
      ),
    }));
  }

  removeRule(index: number): void {
    this.state.update((state) => ({
      ...state,
      formatting: state.formatting.filter((_, position) => position !== index),
    }));
  }

  // ── Running, exporting, saving ──────────────────────────────────────────

  run(definition = this.definition()): void {
    if (!this.runnable()) {
      return;
    }
    const ticket = ++this.runTicket;
    this.loading.set(true);
    this.api.runPivot(definition).subscribe({
      next: (response) => {
        if (ticket === this.runTicket) {
          this.result.set(response.data);
          this.errorText.set(null);
          this.loading.set(false);
        }
      },
      error: (error: unknown) => {
        if (ticket === this.runTicket) {
          this.loading.set(false);
          this.errorText.set(
            analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
          );
        }
      },
    });
  }

  export(format: StudioExportFormat): void {
    if (!this.runnable()) {
      return;
    }
    this.exporting.set(true);
    this.api.exportStudio({ ...this.definition(), format, locale: this.exportLocale() }).subscribe({
      next: (blob) => {
        this.exporting.set(false);
        downloadBlob(
          blob,
          `${this.saved()?.name ?? this.state().dataset ?? 'report'}.${format === 'excel_csv' ? 'csv' : format}`,
        );
      },
      error: (error: unknown) => {
        this.exporting.set(false);
        this.errorText.set(
          analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
        );
      },
    });
  }

  openSave(): void {
    this.saveError.set(null);
    this.saveOpen.set(true);
  }

  save(choice: SaveReportChoice): void {
    const payload = {
      ...this.definition(),
      name: choice.name,
      description: choice.description,
      visibility: choice.visibility,
      shared_role_ids: choice.sharedRoleIds,
    };
    const current = this.saved();
    const request =
      current === null
        ? this.api.createStudioReport(payload)
        : this.api.updateStudioReport(current.id, payload);

    this.saving.set(true);
    this.saveError.set(null);
    request.subscribe({
      next: (response) => {
        this.saving.set(false);
        this.saveOpen.set(false);
        this.saved.set(response.data);
        this.message.success(this.i18n.translate('ANALYTICS_STUDIO.SAVED'));
        if (current === null) {
          // The URL names the saved report from now on, without rebuilding the page.
          this.location.replaceState(`/analytics/reports/designer/${response.data.id}`);
        }
      },
      error: (error: unknown) => {
        this.saving.set(false);
        this.saveError.set(
          analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
        );
      },
    });
  }

  protected saveChoice(): SaveReportChoice | null {
    const report = this.saved();

    return report === null
      ? null
      : {
          name: report.name,
          description: report.description,
          visibility: report.visibility,
          sharedRoleIds: report.shared_role_ids,
        };
  }

  openSchedule(): void {
    if (this.saved() === null) {
      this.openSave();

      return;
    }
    this.scheduleOpen.set(true);
  }

  addCalculated(field: StudioState['calculated'][number]): void {
    this.state.update((state) => ({ ...state, calculated: [...state.calculated, field] }));
  }

  private loadFromRoute(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = params.get('id');
      if (id === null || this.saved()?.id === id) {
        return;
      }
      this.api.getStudioReport(id).subscribe({
        next: (response) => {
          this.saved.set(response.data);
          this.state.set(fromSavedReport(response.data));
        },
        error: (error: unknown) =>
          this.errorText.set(
            analyticsErrorText(error) ?? this.i18n.translate('ANALYTICS_STUDIO.ACTION_ERROR'),
          ),
      });
    });
  }

  private clearRunTimer(): void {
    if (this.runTimer !== null) {
      clearTimeout(this.runTimer);
      this.runTimer = null;
    }
  }
}
