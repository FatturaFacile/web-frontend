import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CreateInventoryCountPayload,
  CreateProductPayload,
  FetchGridModel,
  InventoryAdjustmentItem,
  InventoryApiService,
  InventoryCountSessionItem,
  ProductFilterParams,
  ProductItem,
  StockLevelItem,
  StockMovementFilterParams,
  StockMovementItem,
  StockValuationAtDate,
  StockValuationMethod,
  StoreInventoryAdjustmentPayload,
  InventoryAdjustmentFilterParams,
  InventoryCountFilterParams,
  TransferStockPayload,
  TranslateService,
  WarehouseBinItem,
  WarehouseItem,
  applyServerErrors,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { formErrorTip } from './form-error-tip';

/** Local calendar day as YYYY-MM-DD (the API wants a company day, not a UTC instant). */
function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

/** The API refuses a zero quantity delta (`not_in:0`). */
function notZero(control: AbstractControl): ValidationErrors | null {
  return Number(control.value) === 0 ? { notZero: true } : null;
}

/** The API requires `destination_bin_id` different from `source_bin_id`. */
function differentFromSourceBin(control: AbstractControl): ValidationErrors | null {
  const source = control.parent?.get('source_bin_id')?.value;
  return source && source === control.value ? { sameBin: true } : null;
}

@Component({
  selector: 'app-inventory',
  styleUrl: './inventory.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    DecimalPipe,
    MoneyPipe,
    NzCardModule,
    NzDatePickerModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    NzStatisticModule,
    NzGridModule,
    NzDividerModule,
    PageHeaderComponent,
    BaseTableComponent,
    TranslatePipe,
  ],
  templateUrl: './inventory.component.html',
})
export class InventoryComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);

  // Warehouses list for dropdowns
  readonly warehouses = signal<WarehouseItem[]>([]);
  readonly selectedWarehouseFilter = signal<string | undefined>(undefined);

  // 1. Products Catalog
  readonly productsGrid = new FetchGridModel<ProductItem, ProductFilterParams>((query) => this.inventoryApi.getProducts(query));
  readonly products = this.productsGrid.items;
  readonly searchTerm = signal('');
  readonly createModalVisible = signal(false);

  readonly productForm = this.fb.group({
    sku: this.fb.control('', [Validators.required, Validators.maxLength(50)]),
    name: this.fb.control('', [Validators.required]),
    unit_measure: this.fb.control('Pz', [Validators.required, Validators.maxLength(10)]),
    cost_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
    sale_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
    tax_rate: this.fb.control(22, [Validators.required, Validators.min(0), Validators.max(100)]),
    hs_code: this.fb.control(''),
  });

  // 2. Stock Levels & Balances
  readonly stockLevels = signal<StockLevelItem[]>([]);
  readonly totalOnHand = computed(() => this.stockLevels().reduce((sum, item) => sum + (item.on_hand || 0), 0));
  readonly totalAvailable = computed(() => this.stockLevels().reduce((sum, item) => sum + (item.available || 0), 0));
  readonly totalReserved = computed(() => this.stockLevels().reduce((sum, item) => sum + (item.reserved || 0), 0));
  readonly totalShortfall = computed(() => this.stockLevels().reduce((sum, item) => sum + (item.shortfall || 0), 0));

  // 3. Movements & Transfers
  readonly movementsGrid = new FetchGridModel<StockMovementItem, StockMovementFilterParams>((query) => this.inventoryApi.getMovements(query));
  readonly movements = this.movementsGrid.items;
  readonly movementTypeFilter = signal<string | undefined>(undefined);
  readonly transferModalVisible = signal(false);

  /** Bins of the warehouse picked in the open transfer or adjustment modal. */
  readonly bins = signal<WarehouseBinItem[]>([]);

  readonly transferForm = this.fb.group({
    stock_item_id: this.fb.control('', [Validators.required]),
    warehouse_id: this.fb.control('', [Validators.required]),
    quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
    source_bin_id: this.fb.control('', [Validators.required]),
    destination_bin_id: this.fb.control('', [Validators.required, differentFromSourceBin]),
    notes: this.fb.control('', [Validators.maxLength(1000)]),
  });

  /** The destination bin must be re-checked when the source bin changes. */
  private readonly recheckDestinationBin = this.transferForm.controls.source_bin_id.valueChanges.subscribe(() =>
    this.transferForm.controls.destination_bin_id.updateValueAndValidity(),
  );

  // 4. Adjustments
  readonly adjustmentsGrid = new FetchGridModel<InventoryAdjustmentItem, InventoryAdjustmentFilterParams>((query) => this.inventoryApi.getAdjustments(query));
  readonly adjustments = this.adjustmentsGrid.items;
  readonly adjustmentModalVisible = signal(false);
  readonly adjustmentStatusFilter = signal<string | undefined>(undefined);
  /** Adjustment waiting for the rejection reason (opens the reject modal). */
  readonly rejectingAdjustment = signal<InventoryAdjustmentItem | null>(null);
  readonly rejectionReason = signal('');
  /** Only owners and admins approve or reject: the API also refuses the adjustment creator. */
  readonly canApproveAdjustments = computed(() =>
    this.authStore.activeRoles().some((role) => ['owner', 'admin'].includes(role.toLowerCase())),
  );

  readonly adjustmentForm = this.fb.group({
    warehouse_id: this.fb.control('', [Validators.required]),
    reason: this.fb.control<'cycle_count_variance' | 'damage_loss' | 'obsolete_write_off' | 'found_stock' | 'scrap'>(
      'cycle_count_variance',
      [Validators.required],
    ),
    warehouse_bin_id: this.fb.control('', [Validators.required]),
    stock_item_id: this.fb.control('', [Validators.required]),
    quantity_delta: this.fb.control(1, [Validators.required, notZero]),
    unit_cost: this.fb.control(0, [Validators.required, Validators.min(0)]),
    notes: this.fb.control('', [Validators.maxLength(2000)]),
  });

  // 5. Counts (Physical Stocktaking)
  readonly countsGrid = new FetchGridModel<InventoryCountSessionItem, InventoryCountFilterParams>((query) => this.inventoryApi.getCounts(query));
  readonly counts = this.countsGrid.items;
  readonly countModalVisible = signal(false);

  readonly countForm = this.fb.group({
    warehouse_id: this.fb.control('', [Validators.required]),
    count_type: this.fb.control<'full_physical' | 'cycle_count_abc' | 'spot_check' | 'zone_sweep'>('full_physical', [
      Validators.required,
    ]),
    scheduled_date: this.fb.control(new Date().toISOString().substring(0, 10), [Validators.required]),
    notes: this.fb.control('', [Validators.maxLength(2000)]),
  });

  // 6. Valuation
  readonly valuation = signal<StockValuationAtDate | null>(null);
  readonly valuationDate = signal(toIsoDay(new Date()));
  readonly valuationDateValue = computed(() => new Date(`${this.valuationDate()}T00:00:00`));
  readonly valuationMethod = signal<StockValuationMethod | undefined>(undefined);

  private readonly movementDateTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementDateTpl');
  private readonly movementNumberTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementNumberTpl');
  private readonly movementTypeTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementTypeTpl');
  private readonly movementQtyTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementQtyTpl');
  private readonly movementSignedTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementSignedTpl');
  private readonly movementCostTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementCostTpl');
  private readonly movementValuationTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementValuationTpl');
  private readonly movementRefTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementRefTpl');
  private readonly movementNotesTpl = viewChild<TemplateRef<{ $implicit: StockMovementItem; value: unknown }>>('movementNotesTpl');

  readonly movementColumns = computed<TableColumnDef<StockMovementItem>[]>(() => [
    { key: 'created_at', header: 'INVENTORY.COL_DATE', customCellTemplate: this.movementDateTpl() },
    { key: 'movement_number', header: 'INVENTORY.COL_MOVEMENT_NUM', valueGetter: (row) => row.movement_number || row.id.substring(0, 8), customCellTemplate: this.movementNumberTpl() },
    { key: 'movement_type', header: 'INVENTORY.COL_TYPE', customCellTemplate: this.movementTypeTpl() },
    { key: 'quantity', header: 'INVENTORY.COL_QTY', align: 'right', customCellTemplate: this.movementQtyTpl() },
    { key: 'signed_quantity', header: 'INVENTORY.COL_SIGNED_QTY', align: 'right', valueGetter: (row) => row.signed_quantity ?? row.quantity, customCellTemplate: this.movementSignedTpl() },
    { key: 'unit_cost', header: 'INVENTORY.COL_UNIT_COST', align: 'right', customCellTemplate: this.movementCostTpl() },
    { key: 'total_valuation', header: 'INVENTORY.COL_VALUATION', align: 'right', valueGetter: (row) => row.total_valuation ?? row.unit_cost * row.quantity, customCellTemplate: this.movementValuationTpl() },
    { key: 'reference_type', serverKey: 'origin_document_type', header: 'INVENTORY.COL_REF', valueGetter: (row) => row.reference_type ?? '', customCellTemplate: this.movementRefTpl() },
    { key: 'notes', header: 'INVENTORY.COL_NOTES', customCellTemplate: this.movementNotesTpl() },
  ]);

  private readonly adjustmentNumberTpl = viewChild<TemplateRef<{ $implicit: InventoryAdjustmentItem; value: unknown }>>('adjustmentNumberTpl');
  private readonly adjustmentReasonTpl = viewChild<TemplateRef<{ $implicit: InventoryAdjustmentItem; value: unknown }>>('adjustmentReasonTpl');
  private readonly adjustmentChangeTpl = viewChild<TemplateRef<{ $implicit: InventoryAdjustmentItem; value: unknown }>>('adjustmentChangeTpl');
  private readonly adjustmentStatusTpl = viewChild<TemplateRef<{ $implicit: InventoryAdjustmentItem; value: unknown }>>('adjustmentStatusTpl');
  private readonly adjustmentDateTpl = viewChild<TemplateRef<{ $implicit: InventoryAdjustmentItem; value: unknown }>>('adjustmentDateTpl');

  readonly adjustmentColumns = computed<TableColumnDef<InventoryAdjustmentItem>[]>(() => [
    { key: 'adjustment_number', header: 'INVENTORY.COL_ADJ_NUMBER', customCellTemplate: this.adjustmentNumberTpl() },
    { key: 'warehouse', serverKey: 'warehouse.name', header: 'INVENTORY.COL_WAREHOUSE', valueGetter: (row) => row.warehouse?.name ?? row.warehouse_id },
    { key: 'reason', header: 'INVENTORY.COL_REASON', customCellTemplate: this.adjustmentReasonTpl() },
    { key: 'net_valuation_change', header: 'INVENTORY.COL_VAL_CHANGE', align: 'right', valueGetter: (row) => row.net_valuation_change ?? 0, customCellTemplate: this.adjustmentChangeTpl() },
    { key: 'status', header: 'COMMON.STATUS', align: 'center', valueGetter: (row) => this.adjustmentStatusLabel(row.status), valueLabel: (value) => this.adjustmentStatusLabel(value), customCellTemplate: this.adjustmentStatusTpl() },
    { key: 'created_at', header: 'INVENTORY.COL_DATE', customCellTemplate: this.adjustmentDateTpl() },
  ]);

  private readonly countNumberTpl = viewChild<TemplateRef<{ $implicit: InventoryCountSessionItem; value: unknown }>>('countNumberTpl');
  private readonly countTypeTpl = viewChild<TemplateRef<{ $implicit: InventoryCountSessionItem; value: unknown }>>('countTypeTpl');
  private readonly countDateTpl = viewChild<TemplateRef<{ $implicit: InventoryCountSessionItem; value: unknown }>>('countDateTpl');
  private readonly countStatusTpl = viewChild<TemplateRef<{ $implicit: InventoryCountSessionItem; value: unknown }>>('countStatusTpl');

  readonly countColumns = computed<TableColumnDef<InventoryCountSessionItem>[]>(() => [
    { key: 'session_number', header: 'INVENTORY.COL_SESSION_NUM', customCellTemplate: this.countNumberTpl() },
    { key: 'warehouse', serverKey: 'warehouse.name', header: 'INVENTORY.COL_WAREHOUSE', valueGetter: (row) => row.warehouse?.name ?? row.warehouse_id },
    { key: 'count_type', header: 'INVENTORY.COL_COUNT_TYPE', customCellTemplate: this.countTypeTpl() },
    { key: 'scheduled_date', header: 'INVENTORY.COL_SCHEDULED_DATE', customCellTemplate: this.countDateTpl() },
    { key: 'status', header: 'COMMON.STATUS', align: 'center', valueGetter: (row) => this.countStatusLabel(row.status), valueLabel: (value) => this.countStatusLabel(value), customCellTemplate: this.countStatusTpl() },
  ]);

  private readonly productSkuTpl = viewChild<TemplateRef<{ $implicit: ProductItem; value: unknown }>>('productSkuTpl');
  private readonly productNameTpl = viewChild<TemplateRef<{ $implicit: ProductItem; value: unknown }>>('productNameTpl');
  private readonly productUomTpl = viewChild<TemplateRef<{ $implicit: ProductItem; value: unknown }>>('productUomTpl');
  private readonly productHsTpl = viewChild<TemplateRef<{ $implicit: ProductItem; value: unknown }>>('productHsTpl');
  private readonly productCostTpl = viewChild<TemplateRef<{ $implicit: ProductItem; value: unknown }>>('productCostTpl');
  private readonly productPriceTpl = viewChild<TemplateRef<{ $implicit: ProductItem; value: unknown }>>('productPriceTpl');

  readonly productColumns = computed<TableColumnDef<ProductItem>[]>(() => [
    { key: 'sku', header: 'INVENTORY.COL_SKU', customCellTemplate: this.productSkuTpl() },
    { key: 'name', header: 'INVENTORY.COL_DESC', customCellTemplate: this.productNameTpl() },
    { key: 'unit_measure', header: 'INVENTORY.LBL_UDM', customCellTemplate: this.productUomTpl() },
    { key: 'hs_code', header: 'INVENTORY.COL_HS', valueGetter: (row) => row.hs_code ?? '', customCellTemplate: this.productHsTpl() },
    { key: 'cost_price', header: 'INVENTORY.COL_UNIT_COST', customCellTemplate: this.productCostTpl() },
    { key: 'sale_price', header: 'SALES.INVOICES.ITEM.PRICE', customCellTemplate: this.productPriceTpl() },
  ]);

  /** Text of an adjustment status (also used for the filter list and the group headers of the grid). */
  adjustmentStatusLabel(status: string): string {
    switch (status) {
      case 'approved':
        return this.translate.instant('COMMON.STATUS_APPROVED');
      case 'rejected':
        return this.translate.instant('COMMON.STATUS_REJECTED');
      case 'pending_approval':
        return this.translate.instant('COMMON.STATUS_PENDING');
      case 'draft':
        return this.translate.instant('INVENTORY.ADJ_STATUS.DRAFT');
      default:
        return status;
    }
  }

  /** Text of a count session status. */
  countStatusLabel(status: string): string {
    switch (status) {
      case 'reconciled':
        return this.translate.instant('INVENTORY.STATUS.RECONCILED');
      case 'in_progress':
        return this.translate.instant('INVENTORY.STATUS.IN_PROGRESS');
      default:
        return status;
    }
  }

  errorTip(form: FormGroup, path: string): string {
    return formErrorTip(form, path, this.translate);
  }

  ngOnInit(): void {
    this.loadWarehouses();
    this.loadProducts();
    this.loadStockLevels();
  }

  onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    switch (index) {
      case 0:
        this.loadStockLevels();
        break;
      case 1:
        this.loadMovements();
        break;
      case 2:
        this.loadAdjustments();
        break;
      case 3:
        this.loadCounts();
        break;
      case 4:
        this.loadValuation();
        break;
      case 5:
        this.loadProducts();
        break;
    }
  }

  loadWarehouses(): void {
    this.inventoryApi.getWarehouses({ is_active: true }).subscribe({
      next: (res) => this.warehouses.set(res.data || []),
      error: () => this.warehouses.set([]),
    });
  }

  // Stock Levels
  loadStockLevels(): void {
    this.loading.set(true);
    this.inventoryApi.getStockLevels(this.selectedWarehouseFilter()).subscribe({
      next: (res) => {
        this.stockLevels.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.stockLevels.set([]);
        this.loading.set(false);
      },
    });
  }

  onWarehouseFilterChange(warehouseId: string | undefined): void {
    this.selectedWarehouseFilter.set(warehouseId);
    this.movementsGrid.setFilter({ warehouse_id: warehouseId });
    this.loadStockLevels();
  }

  /** Loads the bins of a warehouse into the transfer and adjustment selects. */
  loadBins(warehouseId: string): void {
    this.bins.set([]);
    if (!warehouseId) {
      return;
    }
    this.inventoryApi.getWarehouseBins(warehouseId).subscribe({
      next: (res) => this.bins.set(res.data || []),
      error: () => this.bins.set([]),
    });
  }

  onTransferWarehouseChange(warehouseId: string): void {
    this.transferForm.patchValue({ source_bin_id: '', destination_bin_id: '' });
    this.loadBins(warehouseId);
  }

  onAdjustmentWarehouseChange(warehouseId: string): void {
    this.adjustmentForm.patchValue({ warehouse_bin_id: '' });
    this.loadBins(warehouseId);
  }

  /**
   * Direction of a movement: the quantity is always positive, so the sign comes from `signed_quantity` when the API
   * sends it, else from the bins (only a source bin: stock leaves; only a destination: stock enters).
   */
  movementSign(movement: StockMovementItem): 'in' | 'out' | 'move' | 'none' {
    if (movement.signed_quantity !== undefined && movement.signed_quantity !== null) {
      return movement.signed_quantity > 0 ? 'in' : movement.signed_quantity < 0 ? 'out' : 'none';
    }
    if (movement.source_bin_id && movement.destination_bin_id) {
      return 'move';
    }
    if (movement.destination_bin_id) {
      return 'in';
    }
    return movement.source_bin_id ? 'out' : 'none';
  }

  // Movements
  loadMovements(): void {
    this.movementsGrid.reload();
  }

  setMovementType(movementType: string | undefined): void {
    this.movementTypeFilter.set(movementType);
    this.movementsGrid.setFilter({ movement_type: movementType });
  }

  openTransferModal(): void {
    const firstWh = this.warehouses()[0]?.id || '';
    const firstProduct = this.products()[0]?.id || '';
    this.transferForm.reset({
      stock_item_id: firstProduct,
      warehouse_id: firstWh,
      quantity: 1,
      source_bin_id: '',
      destination_bin_id: '',
      notes: '',
    });
    this.loadBins(firstWh);
    this.transferModalVisible.set(true);
  }

  submitTransfer(): void {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.transferForm.getRawValue();
    const payload: TransferStockPayload = {
      stock_item_id: formVal.stock_item_id,
      warehouse_id: formVal.warehouse_id,
      quantity: Number(formVal.quantity),
      movement_type: 'INTERNAL_TRANSFER',
      source_bin_id: formVal.source_bin_id,
      destination_bin_id: formVal.destination_bin_id,
      notes: formVal.notes || undefined,
    };

    this.inventoryApi.transferStock(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.transferModalVisible.set(false);
        this.message.success(this.translate.instant('inventory.messages.transfer_success') );
        this.loadMovements();
        this.loadStockLevels();
      },
      error: (err) => {
        this.saving.set(false);
        applyServerErrors(this.transferForm, err);
      },
    });
  }

  // Adjustments
  loadAdjustments(): void {
    this.adjustmentsGrid.reload();
  }

  setAdjustmentStatus(status: string | undefined): void {
    this.adjustmentStatusFilter.set(status);
    this.adjustmentsGrid.setFilter({ status });
  }

  openAdjustmentModal(): void {
    const firstWh = this.warehouses()[0]?.id || '';
    const firstProduct = this.products()[0]?.id || '';
    this.adjustmentForm.reset({
      warehouse_id: firstWh,
      reason: 'cycle_count_variance',
      warehouse_bin_id: '',
      stock_item_id: firstProduct,
      quantity_delta: 1,
      unit_cost: 0,
      notes: '',
    });
    this.loadBins(firstWh);
    this.adjustmentModalVisible.set(true);
  }

  submitAdjustment(): void {
    if (this.adjustmentForm.invalid) {
      this.adjustmentForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.adjustmentForm.getRawValue();
    const payload: StoreInventoryAdjustmentPayload = {
      warehouse_id: formVal.warehouse_id,
      reason: formVal.reason,
      notes: formVal.notes || undefined,
      lines: [
        {
          stock_item_id: formVal.stock_item_id,
          warehouse_bin_id: formVal.warehouse_bin_id,
          quantity_delta: Number(formVal.quantity_delta),
          unit_cost: Number(formVal.unit_cost),
        },
      ],
    };

    this.inventoryApi.createAdjustment(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.adjustmentModalVisible.set(false);
        this.message.success(this.translate.instant('inventory.messages.adjustment_created') );
        this.loadAdjustments();
      },
      error: (err) => {
        this.saving.set(false);
        applyServerErrors(this.adjustmentForm, err);
      },
    });
  }

  approveAdjustment(id: string): void {
    this.inventoryApi.approveAdjustment(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('inventory.messages.approved'));
        this.loadAdjustments();
        this.loadStockLevels();
      },
      error: (err) => {
        this.message.error(this.adjustmentErrorText(err));
      },
    });
  }

  openRejectAdjustment(adjustment: InventoryAdjustmentItem): void {
    this.rejectionReason.set('');
    this.rejectingAdjustment.set(adjustment);
  }

  confirmRejectAdjustment(): void {
    const adjustment = this.rejectingAdjustment();
    const reason = this.rejectionReason().trim();
    if (!adjustment || !reason) {
      return;
    }
    this.saving.set(true);
    this.inventoryApi.rejectAdjustment(adjustment.id, reason).subscribe({
      next: () => {
        this.saving.set(false);
        this.rejectingAdjustment.set(null);
        this.message.success(this.translate.instant('inventory.messages.rejected'));
        this.loadAdjustments();
      },
      error: (err) => {
        this.saving.set(false);
        this.message.error(this.adjustmentErrorText(err));
      },
    });
  }

  /** 403 covers a non-manager, a read-only role and the creator approving their own adjustment. */
  private adjustmentErrorText(err: { status?: number }): string {
    return this.translate.instant(
      err?.status === 403 ? 'inventory.messages.adjustment_forbidden' : 'common.errors.generic',
    );
  }

  // Counts
  loadCounts(): void {
    this.countsGrid.reload();
  }

  openCountModal(): void {
    const firstWh = this.warehouses()[0]?.id || '';
    this.countForm.reset({
      warehouse_id: firstWh,
      count_type: 'full_physical',
      scheduled_date: new Date().toISOString().substring(0, 10),
      notes: '',
    });
    this.countModalVisible.set(true);
  }

  submitCount(): void {
    if (this.countForm.invalid) {
      this.countForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.countForm.getRawValue();
    const payload: CreateInventoryCountPayload = {
      warehouse_id: formVal.warehouse_id,
      count_type: formVal.count_type,
      scheduled_date: formVal.scheduled_date,
      notes: formVal.notes || undefined,
    };

    this.inventoryApi.createCount(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.countModalVisible.set(false);
        this.message.success(this.translate.instant('inventory.messages.count_created') );
        this.loadCounts();
      },
      error: (err) => {
        this.saving.set(false);
        applyServerErrors(this.countForm, err);
      },
    });
  }

  reconcileCount(id: string): void {
    this.inventoryApi.reconcileCount(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('inventory.messages.reconciled') );
        this.loadCounts();
        this.loadStockLevels();
      },
      error: () => {
        this.message.error(this.translate.instant('common.errors.generic') );
      },
    });
  }

  // Valuation
  loadValuation(): void {
    this.loading.set(true);
    this.inventoryApi
      .getValuationAtDate(this.valuationDate(), this.selectedWarehouseFilter(), this.valuationMethod())
      .subscribe({
        next: (res) => {
          this.valuation.set(res);
          this.loading.set(false);
        },
        error: () => {
          this.valuation.set(null);
          this.loading.set(false);
        },
      });
  }

  onValuationDateChange(date: Date | null): void {
    this.valuationDate.set(toIsoDay(date ?? new Date()));
    this.loadValuation();
  }

  readonly disableFutureDates = (current: Date): boolean => current.getTime() > Date.now();

  captureSnapshot(stockItemId: string, warehouseId: string): void {
    this.saving.set(true);
    this.inventoryApi.captureValuationSnapshot(stockItemId, warehouseId).subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.translate.instant('inventory.messages.snapshot_taken'));
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.translate.instant('common.errors.generic'));
      },
    });
  }

  // Products (Existing Catalog Table)
  loadProducts(): void {
    this.productsGrid.reload();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.productsGrid.setFilter({ search: value || undefined });
  }

  openCreateModal(): void {
    this.productForm.reset({
      sku: '',
      name: '',
      unit_measure: 'Pz',
      cost_price: 0,
      sale_price: 0,
      tax_rate: this.authStore.activeJurisdiction() === 'CH' ? 8.1 : 22,
      hs_code: '',
    });
    this.createModalVisible.set(true);
  }

  submitCreateProduct(): void {
    if (this.productForm.invalid) {
      this.productForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.productForm.getRawValue();
    const payload: CreateProductPayload = {
      sku: formVal.sku,
      name: formVal.name,
      unit_measure: formVal.unit_measure,
      cost_price: formVal.cost_price,
      sale_price: formVal.sale_price,
      tax_rate: formVal.tax_rate,
      hs_code: formVal.hs_code || null,
    };

    this.inventoryApi.createProduct(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success(this.translate.instant('inventory.messages.created'));
        this.loadProducts();
        this.loadStockLevels();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  deleteProduct(item: ProductItem): void {
    this.inventoryApi.deleteProduct(item.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('inventory.messages.deleted'));
        this.loadProducts();
        this.loadStockLevels();
      },
      error: () => {
        this.message.error(this.translate.instant('common.errors.generic') );
      },
    });
  }
}
