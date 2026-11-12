import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  Component,
  computed,
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSkeletonModule } from 'ng-zorro-antd/skeleton';
import { NzTooltipModule } from 'ng-zorro-antd/tooltip';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import {
  SortOrder,
  TableColumnDef,
  TableDensity,
  TableFilterState,
  TableQueryParams,
  TableSortState,
} from './table.models';

@Component({
  selector: 'app-base-table',
  imports: [
    NgTemplateOutlet,
    FormsModule,
    NzTableModule,
    NzDropdownModule,
    NzButtonModule,
    NzIconModule,
    NzInputModule,
    NzSelectModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzSkeletonModule,
    NzTooltipModule,
    NzDatePickerModule,
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

  readonly filterVisible: Record<string, boolean> = {};
  readonly filterValues: Record<string, unknown> = {};

  readonly allColumns = computed(() => this.columns());

  readonly visibleColumns = computed(() => {
    const hidden = this.hiddenColumns();
    return this.columns().filter((c) => !hidden.has(c.key) && c.visible !== false);
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
    this.filterVisible[String(key)] = visible;
  }

  getFilterValue(key: string | keyof TItem): unknown {
    return this.filterValues[String(key)];
  }

  hasColumnFilter(key: string | keyof TItem): boolean {
    const val = this.filterValues[String(key)];
    return val !== undefined && val !== null && val !== '';
  }

  onFilterValueChange(key: string | keyof TItem, val: unknown): void {
    this.filterValues[String(key)] = val;
  }

  applyColumnFilter(key: string | keyof TItem): void {
    const k = String(key);
    this.filterVisible[k] = false;
    this.filterChange.emit(this.filterValues as TableFilterState);
    this.emitParamsChange({ filters: this.filterValues as TableFilterState, pageIndex: 1 });
  }

  resetColumnFilter(key: string | keyof TItem): void {
    const k = String(key);
    delete this.filterValues[k];
    this.filterVisible[k] = false;
    this.filterChange.emit(this.filterValues as TableFilterState);
    this.emitParamsChange({ filters: this.filterValues as TableFilterState, pageIndex: 1 });
  }

  private emitParamsChange(override: Partial<TableQueryParams>): void {
    this.paramsChange.emit({
      pageIndex: override.pageIndex ?? this.pageIndex(),
      pageSize: override.pageSize ?? this.pageSize(),
      sort: override.sort !== undefined ? override.sort : this.currentSort(),
      filters: override.filters ?? (this.filterValues as TableFilterState),
    });
  }
}
