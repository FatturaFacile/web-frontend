import { computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import { NzTableQueryParams } from 'ng-zorro-antd/table';
import { catchError, debounce, Observable, of, switchMap, tap, timer } from 'rxjs';
import { PaginatedResponse, QueryFilterParams } from '../models';

/**
 * Light facade holding the signals of a server-side paginated grid.
 * Any change to filters / page / page size triggers a debounced reload that
 * cancels the in-flight request (switchMap).
 */
export abstract class ListFacade<T, F extends QueryFilterParams> {
  readonly items = signal<T[]>([]);
  readonly totalCount = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
  readonly loading = signal(false);
  readonly filterParams = signal<F>({} as F);
  /** True once the first response (or error) arrived � drives the skeleton. */
  readonly loaded = signal(false);
  /** Server-side sorting (sent as sort_by / sort_dir only when set). */
  readonly sortBy = signal<string | null>(null);
  readonly sortOrder = signal<'asc' | 'desc' | null>(null);

  private readonly reloadTick = signal(0);
  private readonly query = computed(() => ({
    ...this.filterParams(),
    page: this.pageIndex(),
    per_page: this.pageSize(),
    ...(this.sortBy() && this.sortOrder()
      ? { sort_by: this.sortBy(), sort_dir: this.sortOrder() }
      : {}),
    _tick: this.reloadTick(),
  }));

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

  setPage(index: number): void {
    this.pageIndex.set(index);
  }

  setPageSize(size: number): void {
    this.pageSize.set(size);
    this.pageIndex.set(1);
  }

  reload(): void {
    this.reloadTick.update((n) => n + 1);
  }
}
