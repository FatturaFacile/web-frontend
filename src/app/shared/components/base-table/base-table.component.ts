import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  Component,
  computed,
  effect,
  inject,
  untracked,
  input,
  linkedSignal,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { firstValueFrom } from 'rxjs';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDropdownModule } from 'ng-zorro-antd/dropdown';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { exportXlsx } from '../../utils/export-xlsx';
import { I18nService } from '@core/i18n/i18n.service';
import { buildGridRows, GRID_EMPTY, GridModel, GridRow, GridValue } from '@core/state/grid.model';
import {
  ColumnFilter,
  SortOrder,
  TableColumnDef,
  TableDensity,
  TableFilterState,
  TableQueryParams,
  TableSortState,
} from './table.models';

@Component({
  selector: 'app-base-table',
  styleUrl: './base-table.component.scss',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    NzTableModule,
    NzSelectModule,
    NzDropdownModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './base-table.component.html',
})
export class BaseTableComponent<TItem extends object = object> {
  // Inputs
  /**
   * Server-side grid model. When set, the table is fully driven by the server: rows, paging, sorting, column
   * filters, grouping, the values of the filter lists and the xlsx export all come from the API over the whole
   * dataset (`data`, `total`, `pageIndex`, `pageSize` and `loading` are then ignored).
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- the model is generic over the filter params
  readonly grid = input<GridModel<TItem, any> | undefined>(undefined);
  readonly data = input<TItem[]>([]);
  readonly columns = input.required<TableColumnDef<TItem>[]>();
  readonly loading = input<boolean>(false);
  readonly total = input<number>(0);
  readonly pageIndex = input<number>(1);
  readonly pageSize = input<number>(15);
  readonly pageSizeOptions = input<number[]>([10, 15, 25, 50, 100]);
  readonly selectable = input<boolean>(false);
  readonly selectedItems = input<TItem[]>([]);
  readonly itemKey = input<keyof TItem | ((item: TItem) => string | number)>('id' as keyof TItem);
  readonly scroll = input<{ x?: string; y?: string }>({ x: '1200px' });
  readonly bordered = input<boolean>(false);
  readonly size = input<TableDensity>('middle');
  readonly showSizeChanger = input<boolean>(true);
  readonly showQuickJumper = input<boolean>(false);
  readonly expandable = input<boolean>(false);
  readonly emptyText = input<string | undefined>(undefined);
  readonly exportable = input<boolean>(true);
  readonly exportFileName = input<string>('export');

  // Templates
  readonly actionsTemplate = input<TemplateRef<{ $implicit: TItem }>>();
  readonly detailTemplate = input<TemplateRef<{ $implicit: TItem }>>();
  readonly toolbarExtra = input<TemplateRef<void>>();
  readonly customEmptyTemplate = input<TemplateRef<void>>();

  // Outputs
  readonly paramsChange = output<TableQueryParams>();
  readonly selectionChange = output<TItem[]>();
  readonly sortChange = output<{ key: string; order: SortOrder }>();
  readonly pageChange = output<{ pageIndex: number; pageSize: number }>();
  readonly filterChange = output<TableFilterState>();
  readonly rowClick = output<TItem>();

  /** Rows of the current page: from the server model when there is one. */
  readonly rows = computed<TItem[]>(() => this.grid()?.items() ?? this.data());
  readonly isLoading = computed(() => this.grid()?.loading() ?? this.loading());
  readonly rowTotal = computed(() => this.grid()?.totalCount() ?? this.total());
  readonly currentPage = computed(() => this.grid()?.pageIndex() ?? this.pageIndex());
  readonly currentPageSize = computed(() => this.grid()?.pageSize() ?? this.pageSize());

  // Internal states
  readonly currentDensity = linkedSignal<TableDensity>(() => this.size());
  readonly hiddenColumns = signal<Set<string | keyof TItem>>(new Set());
  readonly currentSort = signal<TableSortState | null>(null);
  readonly expandedRows = signal<Set<string | number>>(new Set());

  private readonly i18n = inject(I18nService);

  readonly filterVisible: Record<string, boolean> = {};
  /** Applied filters. */
  readonly filterState = signal<Record<string, ColumnFilter>>({});
  /** Values being edited inside the open filter dropdowns. */
  readonly draftFilters: Record<string, ColumnFilter> = {};

  readonly allColumns = computed(() => this.columns());

  readonly visibleColumns = computed(() => {
    const hidden = this.hiddenColumns();
    return this.columns().filter((c) => !hidden.has(c.key) && c.visible !== false);
  });

  /** Values of the filter lists loaded from the server (whole dataset), per column. */
  private readonly serverValues = signal<Record<string, GridValue[]>>({});

  /** Every value seen so far per column, so the list stays complete after a server-side filter. */
  private readonly seenValues = signal<Record<string, Set<string>>>({});

  constructor() {
    effect(() => {
      const rows = this.rows();
      const columns = this.visibleColumns();
      if (this.grid()) {
        return;
      }
      untracked(() =>
        this.seenValues.update((current) => {
          const next = { ...current };
          for (const col of columns) {
            const known = new Set(next[String(col.key)] ?? []);
            for (const item of rows) {
              const value = this.getColumnValue(item, col);
              if (value === null || value === undefined || value === '' || typeof value === 'object') {
                continue;
              }
              known.add(String(value));
              if (known.size > 30) {
                break;
              }
            }
            next[String(col.key)] = known;
          }
          return next;
        }),
      );
    });
  }

  /** Distinct values (max 30) offered by the checkbox list of each column filter. */
  readonly filterOptions = computed(() => {
    const result: Record<string, { label: string; value: string }[]> = {};
    for (const col of this.visibleColumns()) {
      if (col.filterable === false) {
        continue;
      }
      if (col.filterOptions) {
        result[String(col.key)] = col.filterOptions.map((o) => ({
          label: o.label,
          value: String(o.value),
        }));
        continue;
      }
      if (this.grid()) {
        result[String(col.key)] = (this.serverValues()[String(col.key)] ?? []).map((v) => ({
          label: v.value === null || v.value === '' ? '—' : `${col.valueLabel ? col.valueLabel(v.value) : v.value} (${v.count})`,
          value: v.value === null || v.value === '' ? GRID_EMPTY : v.value,
        }));
        continue;
      }
      const seen = this.seenValues()[String(col.key)] ?? new Set<string>();
      result[String(col.key)] =
        seen.size > 30
          ? []
          : [...seen].sort(compareValues).map((v) => ({ label: v, value: v }));
    }
    return result;
  });

  /** Rows of the current page after column filters and sorting. */
  readonly displayData = computed(() => {
    if (this.grid()) {
      return this.rows();
    }
    const filters = this.filterState();
    const columns = this.columns();
    let rows = this.rows();
    const active = Object.entries(filters).filter(
      ([, f]) => f.text !== '' || f.selected.length > 0,
    );
    if (active.length > 0) {
      rows = rows.filter((item) =>
        active.every(([key, f]) => {
          const col = columns.find((c) => String(c.key) === key);
          if (!col) {
            return true;
          }
          const raw = this.getColumnValue(item, col);
          const text = raw === null || raw === undefined ? '' : String(raw);
          if (f.selected.length > 0 && !f.selected.includes(text)) {
            return false;
          }
          return f.text === '' || text.toLowerCase().includes(f.text.toLowerCase());
        }),
      );
    }
    const sort = this.currentSort();
    const sortColumn = sort ? columns.find((c) => String(c.key) === sort.key) : undefined;
    if (sort?.order && sortColumn) {
      const direction = sort.order === 'ascend' ? 1 : -1;
      rows = [...rows].sort((a, b) =>
        sortColumn.sortFn
          ? direction * sortColumn.sortFn(a, b)
          : direction *
            compareValues(this.getColumnValue(a, sortColumn), this.getColumnValue(b, sortColumn)),
      );
    }
    const groupKey = this.groupBy();
    const groupColumn = groupKey ? columns.find((c) => String(c.key) === groupKey) : undefined;
    if (groupColumn) {
      rows = [...rows].sort((a, b) =>
        compareValues(this.groupLabelOf(a, groupColumn), this.groupLabelOf(b, groupColumn)),
      );
    }
    return rows;
  });

  private readonly localCollapsed = signal<ReadonlySet<string>>(new Set());

  /** Column (by its declared key) the rows are grouped by (null = no grouping). */
  readonly groupBy = signal<string | null>(null);
  readonly collapsedGroups = computed(() => this.grid()?.collapsedGroups() ?? this.localCollapsed());

  private readonly groupColumn = computed(() => {
    const key = this.groupBy();
    return key ? this.columns().find((c) => String(c.key) === key) : undefined;
  });

  /**
   * The rendered rows: group header rows interleaved with the data rows. With a server grid the group sizes come
   * from the whole dataset; without one they are counted on the rows at hand.
   */
  readonly viewRows = computed<GridRow<TItem>[]>(() => {
    const column = this.groupColumn();
    const items = this.displayData();
    if (!column) {
      return buildGridRows(items, null, [], new Set());
    }
    const valueOf = (item: TItem): unknown => this.groupLabelOf(item, column);
    const grid = this.grid();
    let summary: GridValue[];
    if (grid) {
      summary = grid.groupSummary();
    } else {
      const counts = new Map<string, number>();
      for (const item of items) {
        const label = this.groupLabelOf(item, column);
        counts.set(label, (counts.get(label) ?? 0) + 1);
      }
      summary = [...counts].map(([value, count]) => ({ value, count }));
    }
    return buildGridRows(items, valueOf, summary, this.collapsedGroups(), column.valueLabel);
  });

  readonly groupColumns = computed(() => this.visibleColumns().filter((c) => c.groupable !== false));

  readonly totalColumnCount = computed(
    () =>
      this.visibleColumns().length +
      (this.selectable() ? 1 : 0) +
      (this.expandable() ? 1 : 0) +
      (this.actionsTemplate() ? 1 : 0),
  );

  readonly isAllSelected = computed(() => {
    const d = this.rows();
    const sel = this.selectedItems();
    if (!d || d.length === 0 || sel.length === 0) return false;
    return d.every((item) => this.isItemSelected(item));
  });

  readonly isIndeterminate = computed(() => {
    const d = this.rows();
    if (!d || d.length === 0) return false;
    const hasSome = d.some((item) => this.isItemSelected(item));
    return hasSome && !this.isAllSelected();
  });

  getItemKey(item: TItem): string | number {
    const key = this.itemKey();
    if (typeof key === 'function') {
      return key(item);
    }
    const val = item[key];
    return (val as string | number) ?? JSON.stringify(item);
  }

  getCellValue(item: TItem, key: keyof TItem | string): unknown {
    return (item as Record<string, unknown>)[key as string];
  }

  groupLabelOf(item: TItem, col: TableColumnDef<TItem>): string {
    const value = this.getColumnValue(item, col);
    return value === null || value === undefined || value === '' || typeof value === 'object'
      ? GRID_EMPTY
      : String(value);
  }

  setGroupBy(key: string | null): void {
    this.groupBy.set(key);
    const grid = this.grid();
    if (grid) {
      grid.setGroupBy(key ? this.serverKey(key) : null);
      return;
    }
    this.localCollapsed.set(new Set());
  }

  toggleGroup(key: string): void {
    const grid = this.grid();
    if (grid) {
      grid.toggleGroup(key);
      return;
    }
    this.localCollapsed.update((set) => {
      const next = new Set(set);
      if (!next.delete(key)) {
        next.add(key);
      }
      return next;
    });
  }

  getColumnValue(item: TItem, col: TableColumnDef<TItem>): unknown {
    return col.valueGetter ? col.valueGetter(item) : this.getCellValue(item, col.key);
  }

  /** Translated label, falling back to `fallback` when the key is not translated. */
  label(key: string, fallback: string): string {
    const translated = this.i18n.translate(key);
    return !translated || translated === key ? fallback : translated;
  }

  async exportToXlsx(): Promise<void> {
    const columns = this.visibleColumns().filter((c) => c.exportable !== false);
    const grid = this.grid();
    const rows = grid ? await firstValueFrom(grid.loadAllRows()) : this.displayData();
    await exportXlsx(
      columns.map((col) => ({
        header: this.i18n.translate(col.header),
        values: rows.map((item) => this.getColumnValue(item, col)),
      })),
      this.exportFileName(),
    );
  }

  isItemSelected(item: TItem): boolean {
    const key = this.getItemKey(item);
    return this.selectedItems().some((it) => this.getItemKey(it) === key);
  }

  isColumnVisible(key: string | keyof TItem): boolean {
    return !this.hiddenColumns().has(key);
  }

  toggleColumnVisibility(key: string | keyof TItem, visible: boolean): void {
    this.hiddenColumns.update((set) => {
      const next = new Set(set);
      if (visible) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }

  setDensity(density: TableDensity): void {
    this.currentDensity.set(density);
  }

  onSelectAll(checked: boolean): void {
    const d = this.rows();
    if (!checked) {
      // Remove all visible rows from selected items
      const currentKeys = new Set(d.map((it) => this.getItemKey(it)));
      const next = this.selectedItems().filter((it) => !currentKeys.has(this.getItemKey(it)));
      this.selectionChange.emit(next);
    } else {
      // Add all visible rows
      const existingKeys = new Set(this.selectedItems().map((it) => this.getItemKey(it)));
      const toAdd = d.filter((it) => !existingKeys.has(this.getItemKey(it)));
      this.selectionChange.emit([...this.selectedItems(), ...toAdd]);
    }
  }

  onSelectItem(item: TItem, checked: boolean): void {
    const key = this.getItemKey(item);
    const current = this.selectedItems();
    if (checked) {
      if (!current.some((it) => this.getItemKey(it) === key)) {
        this.selectionChange.emit([...current, item]);
      }
    } else {
      this.selectionChange.emit(current.filter((it) => this.getItemKey(it) !== key));
    }
  }

  clearSelection(): void {
    this.selectionChange.emit([]);
  }

  onRowClick(item: TItem): void {
    this.rowClick.emit(item);
  }

  isRowExpanded(item: TItem): boolean {
    return this.expandedRows().has(this.getItemKey(item));
  }

  toggleRowExpanded(item: TItem, expanded: boolean): void {
    const key = this.getItemKey(item);
    this.expandedRows.update((set) => {
      const next = new Set(set);
      if (expanded) {
        next.add(key);
      } else {
        next.delete(key);
      }
      return next;
    });
  }

  onPageIndexChange(pageIndex: number): void {
    this.pageChange.emit({ pageIndex, pageSize: this.currentPageSize() });
    this.emitParamsChange({ pageIndex });
  }

  onPageSizeChange(pageSize: number): void {
    this.pageChange.emit({ pageIndex: 1, pageSize });
    this.emitParamsChange({ pageIndex: 1, pageSize });
  }

  onSortChange(key: string | keyof TItem, order: string | null): void {
    const k = String(key);
    const validOrder: SortOrder = order === 'ascend' || order === 'descend' ? order : null;
    this.currentSort.set(validOrder ? { key: k, order: validOrder } : null);
    this.sortChange.emit({ key: k, order: validOrder });
    this.emitParamsChange({ sort: validOrder ? { key: k, order: validOrder } : null });
  }

  isFilterVisible(key: string | keyof TItem): boolean {
    return this.filterVisible[String(key)] ?? false;
  }

  setFilterVisible(key: string | keyof TItem, visible: boolean): void {
    const k = String(key);
    this.filterVisible[k] = visible;
    if (visible && this.grid()) {
      this.grid()!
        .loadValues(this.serverKey(k))
        .subscribe((values) => this.serverValues.update((current) => ({ ...current, [k]: values })));
    }
    if (visible) {
      const applied = this.filterState()[k];
      this.draftFilters[k] = {
        text: applied?.text ?? '',
        selected: [...(applied?.selected ?? [])],
      };
    }
  }

  draft(key: string | keyof TItem): ColumnFilter {
    const k = String(key);
    return (this.draftFilters[k] ??= { text: '', selected: [] });
  }

  toggleDraftValue(key: string | keyof TItem, value: string, checked: boolean): void {
    const d = this.draft(key);
    d.selected = checked ? [...new Set([...d.selected, value])] : d.selected.filter((v) => v !== value);
  }

  hasColumnFilter(key: string | keyof TItem): boolean {
    const f = this.filterState()[String(key)];
    return !!f && (f.text !== '' || f.selected.length > 0);
  }

  applyColumnFilter(key: string | keyof TItem): void {
    const k = String(key);
    this.filterVisible[k] = false;
    const d = this.draft(k);
    this.commitFilters({
      ...this.filterState(),
      [k]: { text: d.text.trim(), selected: [...d.selected] },
    });
  }

  resetColumnFilter(key: string | keyof TItem): void {
    const k = String(key);
    this.filterVisible[k] = false;
    this.draftFilters[k] = { text: '', selected: [] };
    const next = { ...this.filterState() };
    delete next[k];
    this.commitFilters(next);
  }

  private commitFilters(next: Record<string, ColumnFilter>): void {
    this.filterState.set(next);
    const flat = this.flatFilters();
    this.filterChange.emit(flat);
    this.emitParamsChange({ filters: flat });
  }

  private emitParamsChange(override: Partial<TableQueryParams>): void {
    const params: TableQueryParams = {
      pageIndex: override.pageIndex ?? this.currentPage(),
      pageSize: override.pageSize ?? this.currentPageSize(),
      sort: override.sort !== undefined ? override.sort : this.currentSort(),
      filters: override.filters ?? this.flatFilters(),
    };
    this.grid()?.onGridParams({
      ...params,
      sort: params.sort ? { key: this.serverKey(params.sort.key), order: params.sort.order } : null,
      filters: Object.fromEntries(Object.entries(params.filters).map(([key, value]) => [this.serverKey(key), value])),
    });
    this.paramsChange.emit(params);
  }

  /** Name the API knows the column by (sorting, filtering, grouping): `serverKey`, else the column key. */
  serverKey(key: string | keyof TItem): string {
    const column = this.columns().find((c) => String(c.key) === String(key));
    return column?.serverKey ?? String(key);
  }

  private flatFilters(): TableFilterState {
    const flat: TableFilterState = {};
    for (const [k, f] of Object.entries(this.filterState())) {
      if (f.text !== '' || f.selected.length > 0) {
        flat[k] = f.selected.length > 0 ? f.selected : f.text;
      }
    }
    return flat;
  }
}

function compareValues(a: unknown, b: unknown): number {
  const aEmpty = a === null || a === undefined || a === '';
  const bEmpty = b === null || b === undefined || b === '';
  if (aEmpty || bEmpty) {
    return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1;
  }
  if (typeof a === 'number' && typeof b === 'number') {
    return a - b;
  }
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}
