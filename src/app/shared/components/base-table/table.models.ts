import { TemplateRef } from '@angular/core';

export type SortOrder = 'ascend' | 'descend' | null;

export interface TableColumnDef<TItem = unknown> {
  key: keyof TItem | string;
  /** Translation key (rendered through the translate pipe) or plain text */
  header: string;
  width?: string;
  /** Sorting is on by default; set to `false` to disable it. */
  sortable?: boolean;
  /** Value used for sorting, filtering and xlsx export (defaults to `item[key]`). */
  valueGetter?: (item: TItem) => unknown;
  /** Custom comparator, overrides the default one. */
  sortFn?: (a: TItem, b: TItem) => number;
  sortOrder?: SortOrder;
  /** Filtering is on by default; set to `false` to disable it. */
  filterable?: boolean;
  /** Excludes the column from the xlsx export. */
  exportable?: boolean;
  filterType?: 'text' | 'select' | 'date-range' | 'custom';
  filterOptions?: { label: string; value: unknown }[];
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
  customCellTemplate?: TemplateRef<{ $implicit: unknown; value: unknown }> | TemplateRef<unknown>;
  customFilterTemplate?: TemplateRef<{ column: TableColumnDef<TItem> }>;
}

export interface TableSortState {
  key: string;
  order: SortOrder;
}

export type TableFilterState = Record<string, unknown>;

export interface TableQueryParams {
  pageIndex: number;
  pageSize: number;
  sort?: TableSortState | null;
  filters: TableFilterState;
  search?: string;
}

export type TableDensity = 'default' | 'middle' | 'small';

/** Per-column filter state: free text and/or a list of selected values. */
export interface ColumnFilter {
  text: string;
  selected: string[];
}
