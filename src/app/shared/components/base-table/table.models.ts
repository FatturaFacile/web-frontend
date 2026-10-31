import { TemplateRef } from '@angular/core';

export type SortOrder = 'ascend' | 'descend' | null;

export interface TableColumnDef<TItem = any> {
  key: keyof TItem | string;
  header: string;
  width?: string;
  sortable?: boolean;
  sortOrder?: SortOrder;
  filterable?: boolean;
  filterType?: 'text' | 'select' | 'date-range' | 'custom';
  filterOptions?: { label: string; value: unknown }[];
  fixed?: 'left' | 'right';
  align?: 'left' | 'center' | 'right';
  visible?: boolean;
  customCellTemplate?: TemplateRef<{ $implicit: any; value: any }> | TemplateRef<any>;
  customFilterTemplate?: TemplateRef<{ column: TableColumnDef<TItem> }>;
}

export interface TablePaginationState {
  pageIndex: number;
  pageSize: number;
  total: number;
}

export interface TableSortState {
  key: string;
  order: SortOrder;
}

export type TableFilterState = Record<string, unknown>;

export interface TableSelectionState<TItem> {
  selectedKeys: Set<string | number>;
  selectedItems: TItem[];
  allSelected: boolean;
  indeterminate: boolean;
}

export interface TableQueryParams {
  pageIndex: number;
  pageSize: number;
  sort?: TableSortState | null;
  filters: TableFilterState;
  search?: string;
}

export type TableDensity = 'default' | 'middle' | 'small';
