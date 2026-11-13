import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  TemplateRef,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NzTableModule } from 'ng-zorro-antd/table';
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
  readonly data = input.required<TItem[]>();
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
      const distinct = new Set<string>();
      for (const item of this.data()) {
        const value = this.getColumnValue(item, col);
        if (value === null || value === undefined || value === '' || typeof value === 'object') {
          continue;
        }
        distinct.add(String(value));
        if (distinct.size > 30) {
          break;
        }
      }
      result[String(col.key)] =
        distinct.size > 30
          ? []
          : [...distinct].sort(compareValues).map((v) => ({ label: v, value: v }));
    }
    return result;
  });

  /** Rows of the current page after column filters and sorting. */
  readonly displayData = computed(() => {
    const filters = this.filterState();
    const columns = this.columns();
    let rows = this.data();
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
    return rows;
  });

  readonly isAllSelected = computed(() => {
    const d = this.data();
    const sel = this.selectedItems();
    if (!d || d.length === 0 || sel.length === 0) return false;
    return d.every((item) => this.isItemSelected(item));
  });

  readonly isIndeterminate = computed(() => {
    const d = this.data();
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
    const rows = this.displayData();
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
    const d = this.data();
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
    this.pageChange.emit({ pageIndex, pageSize: this.pageSize() });
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
    this.paramsChange.emit({
      pageIndex: override.pageIndex ?? this.pageIndex(),
      pageSize: override.pageSize ?? this.pageSize(),
      sort: override.sort !== undefined ? override.sort : this.currentSort(),
      filters: override.filters ?? this.flatFilters(),
    });
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
