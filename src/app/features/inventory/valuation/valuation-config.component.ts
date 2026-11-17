import { DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AccountingApiService,
  ChartOfAccount,
  I18nService,
  InventoryRevaluation,
  InventoryValuationApiService,
  InventoryWarehouseOption,
  serverErrorMessage,
  UpdateItemValuationPayload,
  VALUATION_METHODS,
  ValuationConfigRow,
  ValuationMethod,
  ValuationSummary,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import {
  DECIMAL4_PATTERN,
  httpStatus,
  inventoryErrorKey,
  VALUATION_METHOD_LABELS,
  VALUATION_SOURCE_LABELS,
  validationMessages,
  bindServerErrors,
} from '../shared/inventory-valuation.utils';

export interface ValuationCategoryRow {
  id: string;
  name: string | null;
  method: ValuationMethod | null;
  items: number;
}

@Component({
  selector: 'app-valuation-config',
  imports: [
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './valuation-config.component.html',
  styleUrl: '../shared/inventory-valuation.scss',
})
export class ValuationConfigComponent implements OnInit {
  private readonly api = inject(InventoryValuationApiService);
  private readonly accountingApi = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly methods = VALUATION_METHODS;
  protected readonly methodLabels = VALUATION_METHOD_LABELS;
  protected readonly sourceLabels = VALUATION_SOURCE_LABELS;
  protected readonly serverError = serverErrorMessage;

  readonly rows = signal<ValuationConfigRow[]>([]);
  readonly loading = signal(false);
  readonly loadErrorKey = signal<string | null>(null);
  readonly search = signal('');
  readonly inlineSavingId = signal<string | null>(null);
  readonly lastRevaluation = signal<InventoryRevaluation | null>(null);
  /** Bumped to re-render inline selects after a cancelled / failed change. */
  readonly revision = signal(0);

  readonly filteredRows = computed(() => {
    const term = this.search().trim().toLowerCase();
    if (!term) {
      return this.rows();
    }
    return this.rows().filter(
      (r) => r.sku.toLowerCase().includes(term) || (r.name ?? '').toLowerCase().includes(term),
    );
  });

  /** Categories are derived from the config rows (no dedicated list endpoint). */
  readonly categories = computed<ValuationCategoryRow[]>(() => {
    const byId = new Map<string, ValuationCategoryRow>();
    for (const row of this.rows()) {
      if (!row.category_id) {
        continue;
      }
      const existing = byId.get(row.category_id);
      if (existing) {
        existing.items += 1;
      } else {
        byId.set(row.category_id, {
          id: row.category_id,
          name: row.category_name ?? null,
          method: row.category_method,
          items: 1,
        });
      }
    }
    return [...byId.values()];
  });

  // --- Item modal ---
  readonly itemModalOpen = signal(false);
  readonly editingItem = signal<ValuationConfigRow | null>(null);
  readonly savingItem = signal(false);
  readonly itemFormErrors = signal<string[]>([]);
  readonly itemForm = this.fb.group({
    valuation_method: this.fb.control<ValuationMethod | null>(null),
    standard_cost: this.fb.control('', [Validators.pattern(DECIMAL4_PATTERN)]),
    weight_kg: this.fb.control('', [Validators.pattern(DECIMAL4_PATTERN)]),
    volume_m3: this.fb.control('', [Validators.pattern(DECIMAL4_PATTERN)]),
  });

  // --- Category modal ---
  readonly categoryModalOpen = signal(false);
  readonly editingCategory = signal<ValuationCategoryRow | null>(null);
  readonly savingCategory = signal(false);
  readonly categoryFormErrors = signal<string[]>([]);
  readonly accounts = signal<ChartOfAccount[]>([]);
  readonly categoryForm = this.fb.group({
    valuation_method: this.fb.control<ValuationMethod>('weighted_average', [Validators.required]),
    inventory_account_id: this.fb.control(''),
    cogs_account_id: this.fb.control(''),
    ppv_account_id: this.fb.control(''),
    landed_cost_clearing_account_id: this.fb.control(''),
  });

  // --- Summary & snapshot ---
  readonly warehouses = signal<InventoryWarehouseOption[]>([]);
  readonly summary = signal<ValuationSummary | null>(null);
  readonly summaryLoading = signal(false);
  readonly summaryWarehouse = signal<string | null>(null);
  readonly summaryMethod = signal<ValuationMethod | null>(null);
  readonly snapshotModalOpen = signal(false);
  readonly savingSnapshot = signal(false);
  readonly snapshotFormErrors = signal<string[]>([]);
  readonly snapshotForm = this.fb.group({
    stock_item_id: this.fb.control('', [Validators.required]),
    warehouse_id: this.fb.control('', [Validators.required]),
    valuation_method: this.fb.control<ValuationMethod | null>(null),
  });

  ngOnInit(): void {
    this.load();
    this.loadSummary();
    this.api.listWarehouses().subscribe({
      next: (list) => this.warehouses.set(list),
      error: () => this.warehouses.set([]),
    });
  }

  load(): void {
    this.loading.set(true);
    this.loadErrorKey.set(null);
    this.api.getValuationConfig().subscribe({
      next: (rows) => {
        this.rows.set(rows);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.rows.set([]);
        this.loadErrorKey.set(inventoryErrorKey(err));
        this.loading.set(false);
      },
    });
  }

  loadSummary(): void {
    this.summaryLoading.set(true);
    this.api
      .getValuationSummary({
        warehouse_id: this.summaryWarehouse() ?? undefined,
        valuation_method: this.summaryMethod() ?? undefined,
      })
      .subscribe({
        next: (summary) => {
          this.summary.set(summary);
          this.summaryLoading.set(false);
        },
        error: () => {
          this.summary.set(null);
          this.summaryLoading.set(false);
        },
      });
  }

  onSearch(event: Event): void {
    this.search.set((event.target as HTMLInputElement).value);
  }

  /** Inline override change from the items table (null = inherit from category). */
  changeItemMethod(row: ValuationConfigRow, method: ValuationMethod | null): void {
    if (method === row.item_method) {
      return;
    }
    this.confirmMethodChange(() => {
      this.inlineSavingId.set(row.item_id);
      this.api.updateItemValuation(row.item_id, { valuation_method: method, revalue_on_change: true }).subscribe({
        next: (item) => {
          this.inlineSavingId.set(null);
          this.onItemSaved(item.revaluation ?? null);
        },
        error: (err: unknown) => {
          this.inlineSavingId.set(null);
          this.notifyValidation(err);
          this.revision.update((n) => n + 1);
        },
      });
    }, () => this.revision.update((n) => n + 1));
  }

  openItemModal(row: ValuationConfigRow): void {
    this.editingItem.set(row);
    this.itemFormErrors.set([]);
    this.itemForm.reset({
      valuation_method: row.item_method,
      standard_cost: row.standard_cost ?? '',
      weight_kg: row.weight_kg ?? '',
      volume_m3: row.volume_m3 ?? '',
    });
    this.itemModalOpen.set(true);
  }

  closeItemModal(): void {
    this.itemModalOpen.set(false);
    this.editingItem.set(null);
  }

  submitItem(): void {
    const row = this.editingItem();
    if (!row) {
      return;
    }
    if (this.itemForm.invalid) {
      this.itemForm.markAllAsTouched();
      Object.values(this.itemForm.controls).forEach((c) => c.markAsDirty());
      return;
    }
    const value = this.itemForm.getRawValue();
    const methodChanged = value.valuation_method !== row.item_method;
    const payload: UpdateItemValuationPayload = {
      valuation_method: value.valuation_method,
      standard_cost: value.standard_cost.trim() || null,
      weight_kg: value.weight_kg.trim() || null,
      volume_m3: value.volume_m3.trim() || null,
      revalue_on_change: methodChanged,
    };
    const save = () => {
      this.savingItem.set(true);
      this.itemFormErrors.set([]);
      this.api.updateItemValuation(row.item_id, payload).subscribe({
        next: (item) => {
          this.savingItem.set(false);
          this.closeItemModal();
          this.onItemSaved(item.revaluation ?? null);
        },
        error: (err: unknown) => {
          this.savingItem.set(false);
          this.itemFormErrors.set(bindServerErrors(this.itemForm, err));
        },
      });
    };
    if (methodChanged) {
      this.confirmMethodChange(save);
    } else {
      save();
    }
  }

  openCategoryModal(category: ValuationCategoryRow): void {
    this.editingCategory.set(category);
    this.categoryFormErrors.set([]);
    this.categoryForm.reset({
      valuation_method: category.method ?? 'weighted_average',
      inventory_account_id: '',
      cogs_account_id: '',
      ppv_account_id: '',
      landed_cost_clearing_account_id: '',
    });
    if (!this.accounts().length) {
      this.accountingApi.getChartOfAccounts().subscribe({
        next: (res) => this.accounts.set(Array.isArray(res?.data) ? res.data : []),
        error: () => this.accounts.set([]),
      });
    }
    this.categoryModalOpen.set(true);
  }

  closeCategoryModal(): void {
    this.categoryModalOpen.set(false);
    this.editingCategory.set(null);
  }

  submitCategory(): void {
    const category = this.editingCategory();
    if (!category || this.categoryForm.invalid) {
      this.categoryForm.markAllAsTouched();
      return;
    }
    const v = this.categoryForm.getRawValue();
    const save = () => {
      this.savingCategory.set(true);
      this.categoryFormErrors.set([]);
      this.api
        .updateCategoryValuation(category.id, {
          valuation_method: v.valuation_method,
          inventory_account_id: v.inventory_account_id || undefined,
          cogs_account_id: v.cogs_account_id || undefined,
          ppv_account_id: v.ppv_account_id || undefined,
          landed_cost_clearing_account_id: v.landed_cost_clearing_account_id || undefined,
        })
        .subscribe({
          next: () => {
            this.savingCategory.set(false);
            this.closeCategoryModal();
            this.message.success(this.i18n.translate('INVENTORY.VALUATION.CATEGORY_SAVED'));
            this.load();
          },
          error: (err: unknown) => {
            this.savingCategory.set(false);
            this.categoryFormErrors.set(bindServerErrors(this.categoryForm, err));
          },
        });
    };
    if (v.valuation_method !== category.method) {
      this.confirmMethodChange(save);
    } else {
      save();
    }
  }

  openSnapshotModal(): void {
    this.snapshotFormErrors.set([]);
    this.snapshotForm.reset({ stock_item_id: '', warehouse_id: this.summaryWarehouse() ?? '', valuation_method: null });
    this.snapshotModalOpen.set(true);
  }

  submitSnapshot(): void {
    if (this.snapshotForm.invalid) {
      this.snapshotForm.markAllAsTouched();
      Object.values(this.snapshotForm.controls).forEach((c) => c.markAsDirty());
      return;
    }
    const v = this.snapshotForm.getRawValue();
    this.savingSnapshot.set(true);
    this.snapshotFormErrors.set([]);
    this.api
      .captureValuationSnapshot({
        stock_item_id: v.stock_item_id,
        warehouse_id: v.warehouse_id,
        valuation_method: v.valuation_method ?? undefined,
      })
      .subscribe({
        next: () => {
          this.savingSnapshot.set(false);
          this.snapshotModalOpen.set(false);
          this.message.success(this.i18n.translate('INVENTORY.VALUATION.SNAPSHOT_CAPTURED'));
        },
        error: (err: unknown) => {
          this.savingSnapshot.set(false);
          this.snapshotFormErrors.set(bindServerErrors(this.snapshotForm, err));
        },
      });
  }

  private onItemSaved(revaluation: InventoryRevaluation | null): void {
    this.lastRevaluation.set(revaluation);
    this.message.success(this.i18n.translate('INVENTORY.VALUATION.ITEM_SAVED'));
    this.load();
  }

  private confirmMethodChange(onOk: () => void, onCancel?: () => void): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('INVENTORY.VALUATION.CONFIRM_METHOD_TITLE'),
      nzContent: this.i18n.translate('INVENTORY.VALUATION.CONFIRM_METHOD_CONTENT'),
      nzOkText: this.i18n.translate('COMMON.SAVE'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () => onOk(),
      nzOnCancel: () => onCancel?.(),
    });
  }

  private notifyValidation(err: unknown): void {
    if (httpStatus(err) === 422) {
      const [first] = validationMessages(err);
      this.message.error(first ?? this.i18n.translate('INVENTORY.ERRORS.VALIDATION'));
    }
  }
}
