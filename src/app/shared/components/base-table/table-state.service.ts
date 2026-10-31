import { computed, Injectable, signal } from '@angular/core';
import {
  SortOrder,
  TableFilterState,
  TableQueryParams,
  TableSortState,
} from './table.models';

@Injectable()
export class TableStateService<TItem extends object = object, TFilter = Record<string, unknown>> {
  readonly pageIndex = signal<number>(1);
  readonly pageSize = signal<number>(15);
  readonly total = signal<number>(0);
  readonly sort = signal<TableSortState | null>(null);
  readonly filters = signal<TFilter>({} as TFilter);
  readonly search = signal<string>('');
  readonly selectedItems = signal<TItem[]>([]);
  readonly loading = signal<boolean>(false);

  readonly queryParams = computed<TableQueryParams>(() => ({
    pageIndex: this.pageIndex(),
    pageSize: this.pageSize(),
    sort: this.sort(),
    filters: (this.filters() || {}) as TableFilterState,
    search: this.search() || undefined,
  }));

  readonly hasActiveFilters = computed<boolean>(() => {
    const f = (this.filters() || {}) as Record<string, unknown>;
    const hasFilters = Object.values(f).some(
      (v) => v !== undefined && v !== null && v !== ''
    );
    return hasFilters || !!this.search();
  });

  readonly selectedCount = computed<number>(() => this.selectedItems().length);

  setPage(pageIndex: number): void {
    this.pageIndex.set(pageIndex);
  }

  setPageSize(pageSize: number): void {
    this.pageSize.set(pageSize);
    this.pageIndex.set(1);
  }

  setSort(key: string, order: SortOrder): void {
    if (!order) {
      this.sort.set(null);
    } else {
      this.sort.set({ key, order });
    }
  }

  setFilter(key: string, value: unknown): void {
    this.filters.update((current) => {
      const next = { ...(current as Record<string, unknown>) };
      if (value === undefined || value === null || value === '') {
        delete next[key];
      } else {
        next[key] = value;
      }
      return next as TFilter;
    });
    this.pageIndex.set(1);
  }

  setFilters(partial: Record<string, unknown>): void {
    this.filters.update((current) => {
      const next = { ...(current as Record<string, unknown>) };
      for (const [k, v] of Object.entries(partial)) {
        if (v === undefined || v === null || v === '') {
          delete next[k];
        } else {
          next[k] = v;
        }
      }
      return next as TFilter;
    });
    this.pageIndex.set(1);
  }

  resetFilters(): void {
    this.filters.set({} as TFilter);
    this.search.set('');
    this.pageIndex.set(1);
  }

  setSearch(search: string): void {
    this.search.set(search);
    this.pageIndex.set(1);
  }

  setTotal(total: number): void {
    this.total.set(total);
  }

  setLoading(loading: boolean): void {
    this.loading.set(loading);
  }

  setSelectedItems(items: TItem[]): void {
    this.selectedItems.set(items);
  }

  clearSelection(): void {
    this.selectedItems.set([]);
  }

  toggleItem(item: TItem, keyProp: keyof TItem = 'id' as keyof TItem): void {
    const key = item[keyProp];
    const current = this.selectedItems();
    const exists = current.some((it) => it[keyProp] === key);
    if (exists) {
      this.selectedItems.set(current.filter((it) => it[keyProp] !== key));
    } else {
      this.selectedItems.set([...current, item]);
    }
  }

  selectAll(items: TItem[], keyProp: keyof TItem = 'id' as keyof TItem): void {
    const current = this.selectedItems();
    const allSelected = items.length > 0 && items.every((item) =>
      current.some((it) => it[keyProp] === item[keyProp])
    );
    if (allSelected) {
      const itemKeys = new Set(items.map((i) => i[keyProp]));
      this.selectedItems.set(current.filter((it) => !itemKeys.has(it[keyProp])));
    } else {
      const currentKeys = new Set(current.map((i) => i[keyProp]));
      const newAdditions = items.filter((i) => !currentKeys.has(i[keyProp]));
      this.selectedItems.set([...current, ...newAdditions]);
    }
  }

  isItemSelected(item: TItem, keyProp: keyof TItem = 'id' as keyof TItem): boolean {
    const key = item[keyProp];
    return this.selectedItems().some((it) => it[keyProp] === key);
  }

  toBackendQueryParams(): Record<string, string | number> {
    const p: Record<string, string | number> = {
      page: this.pageIndex(),
      per_page: this.pageSize(),
    };
    if (this.search()) {
      p['search'] = this.search();
    }
    const sort = this.sort();
    if (sort) {
      p['sort_by'] = sort.key;
      p['sort_dir'] = sort.order === 'ascend' ? 'asc' : 'desc';
    }
    const f = (this.filters() || {}) as Record<string, unknown>;
    for (const [key, val] of Object.entries(f)) {
      if (val !== undefined && val !== null && val !== '') {
        p[key] = String(val);
      }
    }
    return p;
  }
}
