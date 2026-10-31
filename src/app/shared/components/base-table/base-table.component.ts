import {
  Component,
  computed,
  contentChild,
  input,
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
  ],
  template: `
    <div class="base-table-container">
      <!-- Toolbar: density, column visibility, bulk selection bar, custom toolbar slot -->
      <div class="table-toolbar">
        <div class="toolbar-left">
          @if (selectable() && selectedItems().length > 0) {
            <div class="selection-summary">
              <span class="selection-count">
                <strong>{{ selectedItems().length }}</strong> elementi selezionati
              </span>
              <button
                nz-button
                nzType="link"
                nzSize="small"
                type="button"
                (click)="clearSelection()"
              >
                Deseleziona tutti
              </button>
            </div>
          }
          @if (toolbarExtra()) {
            <ng-container [ngTemplateOutlet]="toolbarExtra()!" />
          }
        </div>

        <div class="toolbar-right">
          <!-- Density Toggle -->
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            nz-dropdown
            [nzDropdownMenu]="densityMenu"
            nzTrigger="click"
            title="Densità tabella"
          >
            <nz-icon nzType="column-height" />
          </button>
          <nz-dropdown-menu #densityMenu="nzDropdownMenu">
            <ul nz-menu>
              <li
                nz-menu-item
                [nzSelected]="currentDensity() === 'default'"
                (click)="setDensity('default')"
              >
                Ampia
              </li>
              <li
                nz-menu-item
                [nzSelected]="currentDensity() === 'middle'"
                (click)="setDensity('middle')"
              >
                Media
              </li>
              <li
                nz-menu-item
                [nzSelected]="currentDensity() === 'small'"
                (click)="setDensity('small')"
              >
                Compatta
              </li>
            </ul>
          </nz-dropdown-menu>

          <!-- Column Visibility Toggle -->
          <button
            nz-button
            nzType="text"
            nzSize="small"
            type="button"
            nz-dropdown
            [nzDropdownMenu]="columnVisibilityMenu"
            nzTrigger="click"
            title="Colonne visibili"
          >
            <nz-icon nzType="setting" />
          </button>
          <nz-dropdown-menu #columnVisibilityMenu="nzDropdownMenu">
            <div class="column-visibility-dropdown">
              <div class="dropdown-header">Colonne visibili</div>
              <ul nz-menu>
                @for (col of allColumns(); track col.key) {
                  <li nz-menu-item (click)="$event.stopPropagation()">
                    <label
                      nz-checkbox
                      [ngModel]="isColumnVisible(col.key)"
                      (ngModelChange)="toggleColumnVisibility(col.key, $event)"
                    >
                      {{ col.header }}
                    </label>
                  </li>
                }
              </ul>
            </div>
          </nz-dropdown-menu>
        </div>
      </div>

      <!-- Table Skeleton on initial load -->
      @if (loading() && (!data() || data().length === 0)) {
        <nz-skeleton [nzActive]="true" [nzParagraph]="{ rows: 6 }" />
      } @else {
        <nz-table
          #nzTable
          [nzData]="data()"
          [nzFrontPagination]="false"
          [nzLoading]="loading()"
          [nzTotal]="total()"
          [nzPageIndex]="pageIndex()"
          [nzPageSize]="pageSize()"
          [nzPageSizeOptions]="pageSizeOptions()"
          [nzShowSizeChanger]="showSizeChanger()"
          [nzShowQuickJumper]="showQuickJumper()"
          [nzBordered]="bordered()"
          [nzSize]="currentDensity()"
          [nzScroll]="scroll()"
          [nzNoResult]="customEmptyTemplate() || emptyFallback"
          (nzPageIndexChange)="onPageIndexChange($event)"
          (nzPageSizeChange)="onPageSizeChange($event)"
        >
          <thead>
            <tr>
              @if (expandable()) {
                <th nzWidth="48px" nzLeft></th>
              }
              @if (selectable()) {
                <th
                  nzWidth="48px"
                  nzLeft
                  [nzChecked]="isAllSelected()"
                  [nzIndeterminate]="isIndeterminate()"
                  (nzCheckedChange)="onSelectAll($event)"
                ></th>
              }

              @for (col of visibleColumns(); track col.key) {
                <th
                  [nzWidth]="col.width ?? null"
                  [nzLeft]="col.fixed === 'left'"
                  [nzRight]="col.fixed === 'right'"
                  [nzAlign]="col.align ?? 'left'"
                  [nzShowSort]="!!col.sortable"
                  [nzSortOrder]="currentSort()?.key === col.key ? currentSort()!.order : (col.sortOrder ?? null)"
                  (nzSortOrderChange)="onSortChange(col.key, $event)"
                  [nzCustomFilter]="!!col.filterable"
                >
                  {{ col.header }}

                  @if (col.filterable) {
                    <nz-filter-trigger
                      [nzVisible]="isFilterVisible(col.key)"
                      (nzVisibleChange)="setFilterVisible(col.key, $event)"
                      [nzActive]="hasColumnFilter(col.key)"
                      [nzDropdownMenu]="filterMenu"
                    >
                      <nz-icon nzType="search" />
                    </nz-filter-trigger>
                  }

                  <nz-dropdown-menu #filterMenu="nzDropdownMenu">
                    @if (col.filterable) {
                      <div class="table-filter-popover">
                        @if (col.customFilterTemplate) {
                          <ng-container
                            [ngTemplateOutlet]="col.customFilterTemplate"
                            [ngTemplateOutletContext]="{ column: col }"
                          />
                        } @else if (col.filterType === 'select' && col.filterOptions) {
                          <div class="popover-content">
                            <nz-select
                              class="filter-select"
                              nzAllowClear
                              nzPlaceHolder="Tutti"
                              [ngModel]="getFilterValue(col.key)"
                              (ngModelChange)="onFilterValueChange(col.key, $event)"
                            >
                              @for (opt of col.filterOptions; track opt.value) {
                                <nz-option [nzLabel]="opt.label" [nzValue]="opt.value" />
                              }
                            </nz-select>
                          </div>
                        } @else if (col.filterType === 'date-range') {
                          <div class="popover-content">
                            <nz-range-picker
                              [ngModel]="getFilterValue(col.key)"
                              (ngModelChange)="onFilterValueChange(col.key, $event)"
                            />
                          </div>
                        } @else {
                          <!-- Default text search -->
                          <div class="popover-content">
                            <input
                              nz-input
                              type="text"
                              [placeholder]="'Cerca ' + col.header"
                              [ngModel]="getFilterValue(col.key)"
                              (ngModelChange)="onFilterValueChange(col.key, $event)"
                              (keydown.enter)="applyColumnFilter(col.key)"
                            />
                          </div>
                        }
                        <div class="popover-footer">
                          <button
                            nz-button
                            nzSize="small"
                            type="button"
                            (click)="resetColumnFilter(col.key)"
                          >
                            Reset
                          </button>
                          <button
                            nz-button
                            nzType="primary"
                            nzSize="small"
                            type="button"
                            (click)="applyColumnFilter(col.key)"
                          >
                            Cerca
                          </button>
                        </div>
                      </div>
                    }
                  </nz-dropdown-menu>
                </th>
              }

              @if (actionsTemplate()) {
                <th nzWidth="90px" nzRight nzAlign="right">Azioni</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (item of nzTable.data; track getItemKey(item)) {
              <tr
                class="table-row"
                [class.row-selected]="isItemSelected(item)"
                (click)="onRowClick(item)"
              >
                @if (expandable()) {
                  <td
                    nzLeft
                    [nzExpand]="isRowExpanded(item)"
                    (nzExpandChange)="toggleRowExpanded(item, $event)"
                  ></td>
                }
                @if (selectable()) {
                  <td
                    nzLeft
                    [nzChecked]="isItemSelected(item)"
                    (nzCheckedChange)="onSelectItem(item, $event)"
                    (click)="$event.stopPropagation()"
                  ></td>
                }

                @for (col of visibleColumns(); track col.key) {
                  <td
                    [nzLeft]="col.fixed === 'left'"
                    [nzRight]="col.fixed === 'right'"
                    [nzAlign]="col.align ?? 'left'"
                  >
                    @if (col.customCellTemplate) {
                      <ng-container
                        [ngTemplateOutlet]="col.customCellTemplate"
                        [ngTemplateOutletContext]="{ $implicit: item, value: getCellValue(item, col.key) }"
                      />
                    } @else {
                      {{ getCellValue(item, col.key) }}
                    }
                  </td>
                }

                @if (actionsTemplate()) {
                  <td nzRight nzAlign="right" (click)="$event.stopPropagation()">
                    <ng-container
                      [ngTemplateOutlet]="actionsTemplate()!"
                      [ngTemplateOutletContext]="{ $implicit: item }"
                    />
                  </td>
                }
              </tr>

              @if (expandable() && isRowExpanded(item) && detailTemplate()) {
                <tr [nzExpand]="isRowExpanded(item)">
                  <ng-container
                    [ngTemplateOutlet]="detailTemplate()!"
                    [ngTemplateOutletContext]="{ $implicit: item }"
                  />
                </tr>
              }
            }
          </tbody>
        </nz-table>
      }

      <ng-template #emptyFallback>
        <nz-empty [nzNotFoundContent]="emptyText()" />
      </ng-template>
    </div>
  `,
  styles: `
    .base-table-container {
      display: flex;
      flex-direction: column;
      width: 100%;
    }

    .table-toolbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 0 12px;
      gap: 12px;
      flex-wrap: wrap;
    }

    .toolbar-left {
      display: flex;
      align-items: center;
      gap: 12px;
      flex: 1;
    }

    .toolbar-right {
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .selection-summary {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: var(--ant-primary-1, #e6f7ff);
      border: 1px solid var(--ant-primary-3, #91d5ff);
      padding: 4px 12px;
      border-radius: 4px;
      font-size: 13px;
    }

    .column-visibility-dropdown {
      background: #fff;
      padding: 8px 12px;
      min-width: 180px;
      box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08);
      border-radius: 4px;

      .dropdown-header {
        font-weight: 600;
        font-size: 12px;
        color: #8c8c8c;
        margin-bottom: 8px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      ul[nz-menu] {
        border-right: none;
        max-height: 260px;
        overflow-y: auto;
      }
    }

    .table-filter-popover {
      padding: 8px;
      min-width: 200px;
      background: #fff;
      border-radius: 4px;
      box-shadow: 0 3px 6px -4px rgba(0, 0, 0, 0.12), 0 6px 16px 0 rgba(0, 0, 0, 0.08);

      .popover-content {
        padding: 4px 0 8px;

        .filter-select {
          width: 100%;
        }
      }

      .popover-footer {
        display: flex;
        justify-content: space-between;
        gap: 8px;
        border-top: 1px solid #f0f0f0;
        padding-top: 8px;
      }
    }

    .table-row {
      cursor: pointer;
      transition: background-color 0.2s;
    }

    .table-row.row-selected {
      background-color: var(--ant-primary-1, #e6f7ff);
    }
  `,
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
  readonly emptyText = input<string>('Nessun dato trovato');

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
  readonly currentDensity = signal<TableDensity>('middle');
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

  constructor() {
    // Sync initial density from input
    this.currentDensity.set(this.size());
  }

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
      const next = this.selectedItems().filter(
        (it) => !currentKeys.has(this.getItemKey(it))
      );
      this.selectionChange.emit(next);
    } else {
      // Add all visible rows
      const existingKeys = new Set(
        this.selectedItems().map((it) => this.getItemKey(it))
      );
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
      this.selectionChange.emit(
        current.filter((it) => this.getItemKey(it) !== key)
      );
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
    return !!this.filterVisible[String(key)];
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
