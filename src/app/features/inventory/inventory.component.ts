import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
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
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CreateInventoryCountPayload,
  CreateProductPayload,
  InventoryAdjustmentItem,
  InventoryApiService,
  InventoryCountSessionItem,
  ProductItem,
  StockLevelItem,
  StockMovementItem,
  StockValuationAtDate,
  StockValuationMethod,
  StoreInventoryAdjustmentPayload,
  TransferStockPayload,
  TranslateService,
  WarehouseBinItem,
  WarehouseItem,
  applyServerErrors,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
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
  readonly products = signal<ProductItem[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
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
  readonly movements = signal<StockMovementItem[]>([]);
  readonly movementsTotal = signal(0);
  readonly movementsPage = signal(1);
  readonly movementsPageSize = signal(10);
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
  readonly adjustments = signal<InventoryAdjustmentItem[]>([]);
  readonly adjustmentsTotal = signal(0);
  readonly adjustmentsPage = signal(1);
  readonly adjustmentsPageSize = signal(10);
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
  readonly counts = signal<InventoryCountSessionItem[]>([]);
  readonly countsTotal = signal(0);
  readonly countsPage = signal(1);
  readonly countsPageSize = signal(10);
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
    this.loading.set(true);
    this.inventoryApi
      .getMovements({
        warehouse_id: this.selectedWarehouseFilter(),
        movement_type: this.movementTypeFilter(),
        page: this.movementsPage(),
        per_page: this.movementsPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.movements.set(res.data || []);
          this.movementsTotal.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.movements.set([]);
          this.movementsTotal.set(0);
          this.loading.set(false);
        },
      });
  }

  onMovementsQueryParamsChange(params: NzTableQueryParams): void {
    this.movementsPage.set(params.pageIndex);
    this.movementsPageSize.set(params.pageSize);
    this.loadMovements();
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
    this.loading.set(true);
    this.inventoryApi
      .getAdjustments({
        status: this.adjustmentStatusFilter(),
        page: this.adjustmentsPage(),
        per_page: this.adjustmentsPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.adjustments.set(res.data || []);
          this.adjustmentsTotal.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.adjustments.set([]);
          this.adjustmentsTotal.set(0);
          this.loading.set(false);
        },
      });
  }

  onAdjustmentsQueryParamsChange(params: NzTableQueryParams): void {
    this.adjustmentsPage.set(params.pageIndex);
    this.adjustmentsPageSize.set(params.pageSize);
    this.loadAdjustments();
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
    this.loading.set(true);
    this.inventoryApi
      .getCounts({
        page: this.countsPage(),
        per_page: this.countsPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.counts.set(res.data || []);
          this.countsTotal.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.counts.set([]);
          this.countsTotal.set(0);
          this.loading.set(false);
        },
      });
  }

  onCountsQueryParamsChange(params: NzTableQueryParams): void {
    this.countsPage.set(params.pageIndex);
    this.countsPageSize.set(params.pageSize);
    this.loadCounts();
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
    this.loading.set(true);
    this.inventoryApi
      .getProducts({
        page: this.pageIndex(),
        per_page: this.pageSize(),
        search: this.searchTerm() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.products.set(res.data || []);
          this.total.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.products.set([]);
          this.total.set(0);
          this.loading.set(false);
        },
      });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadProducts();
  }

  onSearch(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.searchTerm.set(value);
    this.pageIndex.set(1);
    this.loadProducts();
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
