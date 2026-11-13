import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { catchError, debounce, map, Observable, of, switchMap, tap, timer } from 'rxjs';
import { PaginatedResponse, QueryFilterParams } from '../models';

/** Query-string token that selects the empty cells of a column in a value list. */
export const GRID_EMPTY = '__empty__';

/** One distinct value of a column over the WHOLE dataset, with its row count. */
export interface GridValue {
  value: string | null;
  count: number;
}

/** Query emitted by app-base-table (structural, so core does not depend on shared). */
export interface GridQueryChange {
  pageIndex: number;
  pageSize: number;
  sort?: { key: string; order: 'ascend' | 'descend' | null } | null;
  filters?: Record<string, unknown>;
}

/** A row of the rendered grid: a collapsible group header or a data row. */
export type GridRow<T> =
  | { kind: 'group'; key: string; label: string; count: number | null; collapsed: boolean }
  | { kind: 'row'; item: T; hidden: boolean };

/**
 * Model of a server-side grid. It owns everything the user can do on a table and sends it to the API, which applies
 * it over the whole dataset (the contract is documented on App\Support\Http\GridRequest):
 *  - paging, sorting (`sort_by`, `sort_dir`);
 *  - column filters: value lists (`filter[col][]`) and "contains" texts (`filter_like[col]`);
 *  - grouping (`grid_group_by`): the server orders the whole dataset by the group column, and the group sizes come
 *    from `grid_values` over all the rows, not just the loaded page;
 *  - the values offered by the filter lists (`grid_values`): distinct values of the column over the whole dataset.
 *
 * Any change triggers a debounced reload that cancels the in-flight request (switchMap).
 * Subclasses (or `createGridModel`) only provide `fetch`, the call to the list endpoint.
 */
export abstract class GridModel<T, F extends QueryFilterParams = QueryFilterParams> {
  readonly items = signal<T[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly filterParams = signal<F>({} as F);
  /** True once the first response (or error) arrived: drives the skeleton. */
  readonly loaded = signal(false);
  /** Server-side sorting (sent as sort_by / sort_dir only when set). */
  readonly sortBy = signal<string | null>(null);
  readonly sortOrder = signal<'asc' | 'desc' | null>(null);

  /** Column filters of the grid: value lists (`filter`) and "contains" texts (`filter_like`). */
  readonly gridFilter = signal<Record<string, string[]>>({});
  readonly gridFilterLike = signal<Record<string, string>>({});

  /** Column the whole dataset is grouped by (null = no grouping). */
  readonly groupBy = signal<string | null>(null);
  /** Size of every group over all the filtered rows (not only the loaded page). */
  readonly groupSummary = signal<GridValue[]>([]);
  readonly collapsedGroups = signal<ReadonlySet<string>>(new Set());

  private readonly reloadTick = signal(0);
  private readonly valuesCache = new Map<string, GridValue[]>();

  private readonly columnParams = computed(() => ({
    ...(Object.keys(this.gridFilter()).length > 0 ? { filter: this.gridFilter() } : {}),
    ...(Object.keys(this.gridFilterLike()).length > 0 ? { filter_like: this.gridFilterLike() } : {}),
  }));

  private readonly query = computed(() => ({
    ...this.filterParams(),
    page: this.pageIndex(),
    per_page: this.pageSize(),
    ...this.columnParams(),
    ...(this.sortBy() && this.sortOrder() ? { sort_by: this.sortBy(), sort_dir: this.sortOrder() } : {}),
    ...(this.groupBy() ? { grid_group_by: this.groupBy() } : {}),
    _tick: this.reloadTick(),
  }));

  /** Group sizes: the distinct values of the group column over the filtered dataset. */
  private readonly groupQuery = computed(() => {
    const column = this.groupBy();
    return column
      ? {
          ...this.filterParams(),
          ...this.columnParams(),
          grid_values: column,
          grid_scope: 'filtered',
          _tick: this.reloadTick(),
        }
      : null;
  });

  protected abstract fetch(params: F): Observable<PaginatedResponse<T>>;

  protected constructor(private readonly debounceMs = 300) {
    toObservable(this.query)
      .pipe(
        debounce(() => timer(this.loaded() ? this.debounceMs : 0)),
        tap(() => this.loading.set(true)),
        switchMap(({ _tick, ...params }) =>
          this.fetch(params as unknown as F).pipe(catchError(() => of(null))),
        ),
        takeUntilDestroyed(),
      )
      .subscribe((res) => {
        if (res) {
          this.items.set(res.data);
          this.totalCount.set(res.meta.total);
        }
        this.loading.set(false);
        this.loaded.set(true);
      });

    toObservable(this.groupQuery)
      .pipe(
        debounce(() => timer(this.debounceMs)),
        switchMap((query) => {
          if (!query) {
            return of<GridValue[]>([]);
          }
          const { _tick, ...params } = query;
          return this.fetch(params as unknown as F).pipe(
            map((res) => toGridValues(res)),
            catchError(() => of<GridValue[]>([])),
          );
        }),
        takeUntilDestroyed(),
      )
      .subscribe((summary) => this.groupSummary.set(summary));
  }

  setFilter(patch: Partial<F>): void {
    this.filterParams.update((f) => ({ ...f, ...patch }));
    this.pageIndex.set(1);
  }

  /** Bind to (nzQueryParams) of nz-table: syncs paging and sorting. */
  onQueryParamsChange(params: NzTableQueryParams): void {
    const sort = params.sort.find((s) => s.value);
    this.sortBy.set(sort?.key ?? null);
    this.sortOrder.set(sort?.value === 'ascend' ? 'asc' : sort?.value === 'descend' ? 'desc' : null);
    this.pageSize.set(params.pageSize);
    this.pageIndex.set(params.pageIndex);
  }

  /** Bind to (paramsChange) of app-base-table: pages, sorts and filters on the server. */
  onGridParams(params: GridQueryChange): void {
    const list: Record<string, string[]> = {};
    const like: Record<string, string> = {};
    for (const [key, value] of Object.entries(params.filters ?? {})) {
      if (Array.isArray(value)) {
        list[key] = value.map(String);
      } else if (typeof value === 'string' && value !== '') {
        like[key] = value;
      }
    }
    const filtersChanged =
      JSON.stringify(list) !== JSON.stringify(this.gridFilter()) ||
      JSON.stringify(like) !== JSON.stringify(this.gridFilterLike());
    const sortChanged =
      (params.sort?.key ?? null) !== this.sortBy() ||
      (params.sort?.order === 'ascend' ? 'asc' : params.sort?.order === 'descend' ? 'desc' : null) !==
        this.sortOrder();

    if (filtersChanged) {
      this.gridFilter.set(list);
      this.gridFilterLike.set(like);
    }
    if (sortChanged) {
      this.sortBy.set(params.sort?.key ?? null);
      this.sortOrder.set(
        params.sort?.order === 'ascend' ? 'asc' : params.sort?.order === 'descend' ? 'desc' : null,
      );
    }
    if (params.pageSize !== this.pageSize()) {
      this.pageSize.set(params.pageSize);
      this.pageIndex.set(1);
    } else if (filtersChanged || sortChanged) {
      this.pageIndex.set(1);
    } else if (params.pageIndex !== this.pageIndex()) {
      this.pageIndex.set(params.pageIndex);
    }
  }

  /** Groups the whole dataset by a column (null removes the grouping). */
  setGroupBy(column: string | null): void {
    this.groupBy.set(column);
    this.collapsedGroups.set(new Set());
    this.pageIndex.set(1);
  }

  toggleGroup(key: string): void {
    this.collapsedGroups.update((current) => {
      const next = new Set(current);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  /**
   * Every possible value of a column over the whole dataset (the list a Ant-style filter offers), not only the
   * values of the loaded page. Cached until the base filters change or `reload()`.
   */
  loadValues(column: string): Observable<GridValue[]> {
    const key = `${column}|${JSON.stringify(this.filterParams())}|${this.reloadTick()}`;
    const cached = this.valuesCache.get(key);
    if (cached) {
      return of(cached);
    }
    return this.fetch({ ...this.filterParams(), grid_values: column } as unknown as F).pipe(
      map((res) => toGridValues(res)),
      tap((values) => this.valuesCache.set(key, values)),
      catchError(() => of<GridValue[]>([])),
    );
  }

  /** Every row matching the current filters and sorting (all pages, up to `limit`), e.g. for the xlsx export. */
  loadAllRows(limit = 5000): Observable<T[]> {
    const pageSize = 100;
    const base = { ...(this.query() as unknown as Record<string, unknown>) };
    delete base['_tick'];
    const pages = Math.ceil(limit / pageSize);
    const loadPage = (page: number, collected: T[]): Observable<T[]> =>
      this.fetch({ ...base, page, per_page: pageSize } as unknown as F).pipe(
        switchMap((res) => {
          const all = [...collected, ...res.data];
          return page < Math.min(res.meta.last_page, pages) ? loadPage(page + 1, all) : of(all);
        }),
      );
    return loadPage(1, []);
  }

  setPage(index: number): void {
    this.pageIndex.set(index);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
  }

  reload(): void {
    this.valuesCache.clear();
    this.reloadTick.update((n) => n + 1);
  }
}

/** The `grid_values` response travels in the same envelope as a list: `data` is `[{ value, count }]`. */
function toGridValues(res: unknown): GridValue[] {
  const data = (res as { data?: unknown } | null)?.data;
  const rows = Array.isArray(data) ? data : ((data as { data?: unknown[] } | undefined)?.data ?? []);
  return (rows as GridValue[]).map((row) => ({
    value: row.value === null || row.value === undefined ? null : String(row.value),
    count: Number(row.count) || 0,
  }));
}

/**
 * Interleaves group header rows into the loaded page. Consecutive rows with the same group value share a header;
 * the size comes from the server summary (all rows), so it is right even when the group spans several pages.
 * `labelOf` turns a raw server value into the text the rows show (translations), so both sides compare equal.
 */
export function buildGridRows<T>(
  items: readonly T[],
  valueOf: ((item: T) => unknown) | null,
  summary: readonly GridValue[],
  collapsed: ReadonlySet<string>,
  labelOf: (value: string) => string = (value) => value,
): GridRow<T>[] {
  if (!valueOf) {
    return items.map((item) => ({ kind: 'row', item, hidden: false }));
  }
  const counts = new Map(
    summary.map((entry) => [normalizeGroupKey(entry.value === null ? null : labelOf(entry.value)), entry.count]),
  );
  const rows: GridRow<T>[] = [];
  let current: string | undefined;
  let hidden = false;
  for (const item of items) {
    const raw = valueOf(item);
    const key = normalizeGroupKey(raw === null || raw === undefined || typeof raw === 'object' ? null : String(raw));
    if (key !== current) {
      current = key;
      hidden = collapsed.has(key);
      rows.push({
        kind: 'group',
        key,
        label: key === GRID_EMPTY ? '—' : String(raw),
        count: counts.get(key) ?? null,
        collapsed: hidden,
      });
    }
    rows.push({ kind: 'row', item, hidden });
  }
  return rows;
}

function normalizeGroupKey(value: string | null): string {
  if (value === null || value === '') {
    return GRID_EMPTY;
  }
  return /^-?\d+(\.\d+)?$/.test(value) ? String(Number(value)) : value;
}

/** A grid model for pages that load their rows with a plain function: `new FetchGridModel((q) => api.list(q))`. */
export class FetchGridModel<T, F extends QueryFilterParams = QueryFilterParams> extends GridModel<T, F> {
  constructor(
    private readonly loader: (params: F) => Observable<PaginatedResponse<T>>,
    debounceMs = 300,
  ) {
    super(debounceMs);
  }

  protected override fetch(params: F): Observable<PaginatedResponse<T>> {
    return this.loader(params);
  }
}
