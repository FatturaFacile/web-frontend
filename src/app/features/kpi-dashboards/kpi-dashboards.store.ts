import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { catchError, finalize, Observable, of, tap } from 'rxjs';
import { KpiDashboardsApiService } from './kpi-dashboards-api.service';
import {
  CatalogEntry,
  Cockpit,
  CockpitFilters,
  CockpitWidget,
  ComparisonMode,
  DisplayCurrency,
  DrillDown,
  DrillSegment,
  PeriodPreset,
  RoleCode,
} from './kpi-dashboards.models';
import {
  DEFAULT_FILTERS,
  DraftWidget,
  draftOf,
  moveItem,
  nextWidth,
  packLayout,
} from './kpi-dashboards.utils';

/**
 * Signal state of the KPI cockpits. The global filter bar is a single signal: every control writes it with `patchFilters`, and
 * the page reloads the cockpit when it changes, so a currency switch, the consolidation toggle or a date preset recomputes
 * every widget from one place. The drill-down drawer and the layout editor keep their own state beside it.
 *
 * Every action returns the underlying observable, already wired to the signals, so a component only subscribes and reports
 * the outcome to the user.
 */
@Service()
export class KpiDashboardsStore {
  private readonly api = inject(KpiDashboardsApiService);

  readonly role = signal<RoleCode>('ceo');
  readonly filters = signal<CockpitFilters>(DEFAULT_FILTERS);
  readonly cockpit = signal<Cockpit | null>(null);
  readonly loading = signal(false);
  /** The member's role may not open the cockpit (403). */
  readonly forbidden = signal(false);
  readonly failed = signal(false);
  readonly catalog = signal<CatalogEntry[]>([]);

  readonly widgets = computed<CockpitWidget[]>(() =>
    [...(this.cockpit()?.widgets ?? [])].sort((a, b) => a.sort_order - b.sort_order),
  );
  readonly fx = computed(() => this.cockpit()?.fx ?? null);
  readonly refreshIntervalMs = computed(
    () => (this.cockpit()?.dashboard.refresh_interval_seconds ?? 300) * 1000,
  );
  /** The custom period needs both dates before it can be asked for. */
  readonly filtersReady = computed(() => {
    const filters = this.filters();

    return filters.preset !== 'custom' || (filters.from !== null && filters.to !== null);
  });

  // Drill-down drawer.
  readonly drillOpen = signal(false);
  readonly drillWidget = signal<CockpitWidget | null>(null);
  readonly drillSegment = signal<DrillSegment>({});
  readonly drill = signal<DrillDown | null>(null);
  readonly drillLoading = signal(false);
  readonly drillFailed = signal(false);

  // Layout editor.
  readonly editing = signal(false);
  readonly draft = signal<DraftWidget[]>([]);
  readonly saving = signal(false);

  readonly availableToAdd = computed<CatalogEntry[]>(() => {
    const placed = new Set(this.draft().map((widget) => widget.kpi_code));

    return this.catalog().filter((entry) => !placed.has(entry.kpi_code));
  });

  setRole(role: RoleCode): void {
    this.role.set(role);
    this.editing.set(false);
  }

  patchFilters(patch: Partial<CockpitFilters>): void {
    this.filters.update((filters) => ({ ...filters, ...patch }));
  }

  setCurrency(currency: DisplayCurrency): void {
    this.patchFilters({ currency });
  }

  setComparison(comparison: ComparisonMode): void {
    this.patchFilters({ comparison });
  }

  setPreset(preset: PeriodPreset): void {
    this.patchFilters({ preset });
  }

  setConsolidated(consolidated: boolean): void {
    this.patchFilters({ consolidated });
  }

  /** The cockpit of the active role under the active filters. */
  load(): Observable<unknown> {
    if (!this.filtersReady()) {
      return of(null);
    }

    this.loading.set(true);
    this.failed.set(false);
    this.forbidden.set(false);

    return this.api.cockpit(this.role(), this.filters()).pipe(
      tap((response) => this.cockpit.set(response.data)),
      catchError((error: unknown) => {
        this.cockpit.set(null);
        this.forbidden.set(error instanceof HttpErrorResponse && error.status === 403);
        this.failed.set(!(error instanceof HttpErrorResponse && error.status === 403));

        return of(null);
      }),
      finalize(() => this.loading.set(false)),
    );
  }

  loadCatalog(): Observable<unknown> {
    return this.api.catalog().pipe(
      tap((response) => this.catalog.set(response.data)),
      catchError(() => of(null)),
    );
  }

  refreshCubes(): Observable<unknown> {
    return this.api.refreshCubes();
  }

  /** Opens the drawer on a card or a chart segment and loads the documents behind it. */
  openDrill(widget: CockpitWidget, segment: DrillSegment = {}): Observable<unknown> {
    this.drillOpen.set(true);
    this.drillWidget.set(widget);
    this.drillSegment.set(segment);

    return this.loadDrill(1);
  }

  loadDrill(page: number): Observable<unknown> {
    const widget = this.drillWidget();

    if (widget === null) {
      return of(null);
    }

    this.drillLoading.set(true);
    this.drillFailed.set(false);

    return this.api.drillDown(widget.kpi_code, this.filters(), this.drillSegment(), page).pipe(
      tap((response) => this.drill.set(response.data)),
      catchError(() => {
        this.drill.set(null);
        this.drillFailed.set(true);

        return of(null);
      }),
      finalize(() => this.drillLoading.set(false)),
    );
  }

  exportDrill(): Observable<Blob> | null {
    const widget = this.drillWidget();

    return widget === null
      ? null
      : this.api.exportCsv(widget.kpi_code, this.filters(), this.drillSegment());
  }

  closeDrill(): void {
    this.drillOpen.set(false);
    this.drillWidget.set(null);
    this.drill.set(null);
    this.drillSegment.set({});
  }

  startEditing(): void {
    this.draft.set(draftOf(this.widgets()));
    this.editing.set(true);
  }

  cancelEditing(): void {
    this.editing.set(false);
    this.draft.set([]);
  }

  moveDraft(from: number, to: number): void {
    this.draft.update((draft) => moveItem(draft, from, to));
  }

  removeDraft(kpiCode: string): void {
    this.draft.update((draft) => draft.filter((widget) => widget.kpi_code !== kpiCode));
  }

  resizeDraft(kpiCode: string): void {
    this.draft.update((draft) =>
      draft.map((widget) =>
        widget.kpi_code === kpiCode ? { ...widget, w: nextWidth(widget.w) } : widget,
      ),
    );
  }

  addDraft(entry: CatalogEntry): void {
    this.draft.update((draft) => [
      ...draft,
      { kpi_code: entry.kpi_code, widget_type: entry.widget_type, w: 4, h: 3 },
    ]);
  }

  /**
   * Saves the draft as the user's own layout: a system cockpit is cloned, the user's custom one is updated (with the version
   * it was loaded at, so a layout changed on another device is not overwritten silently).
   */
  saveLayout(): Observable<unknown> {
    const cockpit = this.cockpit();

    if (cockpit === null) {
      return of(null);
    }

    this.saving.set(true);

    return this.api
      .saveLayout({
        dashboard_id: cockpit.dashboard.id,
        role: cockpit.dashboard.role_code,
        refresh_interval_seconds: cockpit.dashboard.refresh_interval_seconds,
        expected_version: cockpit.dashboard.is_system_default ? null : cockpit.dashboard.version,
        widgets: packLayout(this.draft()),
      })
      .pipe(
        tap(() => this.editing.set(false)),
        finalize(() => this.saving.set(false)),
      );
  }
}
