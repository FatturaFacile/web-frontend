import { Component, computed, inject, input, OnInit, output, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AssetApiService,
  AssetBookResource,
  AssetHistory,
  AssetValuation,
  ConfigureAssetBookPayload,
  DepreciationScheduleResource,
  DisposalPreviewResponse,
  DisposeAssetPayload,
  EamOpsApiService,
  FetchGridModel,
  FiscalDepreciationRateResource,
  FixedAssetResource,
  I18nService,
  MaintenanceWorkOrderResource,
  ParallelScheduleResponse,
  ProRataConvention,
  QueryFilterParams,
  RecordAssetImprovementPayload,
} from '@core';
import {
  BaseTableComponent,
  GridFilterFnPipe,
  GridFilterListPipe,
  GridSortPipe,
  MoneyPipe,
  TableColumnDef,
  TranslatePipe,
} from '@shared';

@Component({
  selector: 'app-asset-detail-drawer',
  styleUrl: './asset-detail-drawer.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    BaseTableComponent,
    TranslatePipe,
    GridSortPipe,
    GridFilterListPipe,
    GridFilterFnPipe,
    NzAlertModule,
    NzCheckboxModule,
    NzDividerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTabsModule,
    NzDescriptionsModule,
    NzBadgeModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzIconModule,
    NzEmptyModule,
    MoneyPipe,
  ],
  templateUrl: './asset-detail-drawer.component.html',
})
export class AssetDetailDrawerComponent implements OnInit {
  asset = input.required<FixedAssetResource>();
  visible = input.required<boolean>();
  closed = output<void>();
  assetChanged = output<void>();

  private readonly assetApi = inject(AssetApiService);
  private readonly opsApi = inject(EamOpsApiService, { optional: true });
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService, { optional: true });
  private readonly fb = inject(NonNullableFormBuilder);

  readonly loadingBooks = signal(false);
  readonly books = signal<AssetBookResource[]>([]);
  readonly fiscalRates = signal<FiscalDepreciationRateResource[]>([]);

  // Parallel schedule comparison
  readonly schedulePeriodType = signal<'yearly' | 'quarterly' | 'monthly'>('yearly');
  readonly loadingParallelSchedules = signal(false);
  readonly parallelSchedules = signal<ParallelScheduleResponse | null>(null);

  // Asset history & extraordinary events
  readonly loadingHistory = signal(false);
  readonly history = signal<AssetHistory>({
    transfers: [],
    valuations: [],
    improvements: [],
    disposals: [],
  });

  // Configure Book Modal
  readonly configureBookVisible = signal(false);
  readonly editingBook = signal<AssetBookResource | null>(null);
  readonly savingBook = signal(false);

  // Improvement Modal
  readonly improvementModalVisible = signal(false);
  readonly savingImprovement = signal(false);

  // Valuation (Impairment / Revaluation) Modal
  readonly valuationModalVisible = signal(false);
  readonly savingValuation = signal(false);

  // Disposal / Scrapping Modal
  readonly disposalModalVisible = signal(false);
  readonly loadingDisposalPreview = signal(false);
  readonly savingDisposal = signal(false);
  readonly disposalPreview = signal<DisposalPreviewResponse | null>(null);

  /** Depreciation schedule of the asset, paged, sorted and filtered by the API. */
  readonly schedulesGrid = new FetchGridModel<DepreciationScheduleResource, QueryFilterParams>((query) =>
    this.assetApi.getDepreciationSchedules(this.asset().id, query),
  );

  /** Maintenance work orders of the asset (the API filters them by asset_id). */
  readonly workOrdersGrid = new FetchGridModel<MaintenanceWorkOrderResource, QueryFilterParams>((query) =>
    this.assetApi.getMaintenanceWorkOrders({ ...query, asset_id: this.asset().id } as QueryFilterParams),
  );

  readonly bookForm = this.fb.group({
    fiscal_regime: this.fb.control<
      'civil_linear' | 'ch_afc_degressive' | 'ch_afc_linear' | 'ch_afc_immediate' | 'it_dm_1988'
    >('civil_linear'),
    fiscal_rate_id: this.fb.control(''),
    depreciation_method: this.fb.control<
      'straight_line' | 'declining_balance' | 'double_declining_balance' | 'units_of_production' | 'immediate_expensing'
    >('straight_line'),
    useful_life_months: this.fb.control<number>(60, [Validators.required, Validators.min(1), Validators.max(1200)]),
    rate_percent: this.fb.control<number>(20, [Validators.min(0.01), Validators.max(100)]),
    declining_balance_factor: this.fb.control<number>(2, [Validators.min(0.1), Validators.max(10)]),
    pro_rata_convention: this.fb.control<ProRataConvention>('daily'),
    pro_memoria_value: this.fb.control<number>(1, [Validators.min(0)]),
    first_year_half_rate: this.fb.control(false),
    switch_to_straight_line: this.fb.control(true),
    immediate_expensing: this.fb.control(false),
  });

  readonly improvementForm = this.fb.group({
    improvement_date: this.fb.control(new Date().toISOString().slice(0, 10), [Validators.required]),
    description: this.fb.control('', [Validators.required, Validators.maxLength(500)]),
    amount: this.fb.control<number>(1000, [Validators.required, Validators.min(0.01)]),
    purchase_invoice_number: this.fb.control('', [Validators.maxLength(100)]),
    extends_useful_life_months: this.fb.control<number>(0, [Validators.min(0), Validators.max(600)]),
    affects_tax_book: this.fb.control(true),
    auto_post_to_gl: this.fb.control(true),
  });

  readonly valuationForm = this.fb.group({
    valuation_type: this.fb.control<'impairment' | 'revaluation'>('impairment'),
    fair_value: this.fb.control<number>(0, [Validators.required, Validators.min(0)]),
    value_in_use: this.fb.control<number>(0, [Validators.min(0)]),
    valuation_date: this.fb.control(new Date().toISOString().slice(0, 10)),
    apply_to_tax_book: this.fb.control(false),
    auto_post_to_gl: this.fb.control(true),
    reason: this.fb.control('', [Validators.maxLength(1000)]),
  });

  readonly disposalForm = this.fb.group({
    disposal_type: this.fb.control<'sale' | 'scrap' | 'retirement' | 'donation' | 'theft_loss'>('sale'),
    disposal_date: this.fb.control(new Date().toISOString().slice(0, 10)),
    disposed_percentage: this.fb.control<number>(100, [Validators.required, Validators.min(1), Validators.max(100)]),
    proceeds_amount: this.fb.control<number>(0, [Validators.min(0)]),
    disposal_costs: this.fb.control<number>(0, [Validators.min(0)]),
    disposal_document_number: this.fb.control('', [Validators.maxLength(100)]),
    fiscal_gain_spread_years: this.fb.control<number>(1, [Validators.min(1), Validators.max(5)]),
    reason: this.fb.control('', [Validators.maxLength(1000)]),
    auto_post_to_gl: this.fb.control(true),
  });

  private readonly periodTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('periodTpl');
  private readonly scheduleLedgerTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('scheduleLedgerTpl');
  private readonly openingTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('openingTpl');
  private readonly depreciationTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('depreciationTpl');
  private readonly closingTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('closingTpl');
  private readonly accumulatedTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('accumulatedTpl');
  private readonly scheduleStatusTpl = viewChild<TemplateRef<{ $implicit: DepreciationScheduleResource; value: unknown }>>('scheduleStatusTpl');
  private readonly woNumberTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woNumberTpl');
  private readonly woTypeTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woTypeTpl');
  private readonly woPriorityTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woPriorityTpl');
  private readonly woStatusTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woStatusTpl');
  private readonly woDateTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woDateTpl');
  private readonly woCostTpl = viewChild<TemplateRef<{ $implicit: MaintenanceWorkOrderResource; value: unknown }>>('woCostTpl');

  protected readonly scheduleColumns = computed<TableColumnDef<DepreciationScheduleResource>[]>(() => [
    { key: 'period_code', header: 'assetDetailDrawer.lblPeriod', customCellTemplate: this.periodTpl() },
    { key: 'ledger_type', header: 'assetDetailDrawer.lblLedger', customCellTemplate: this.scheduleLedgerTpl() },
    { key: 'opening_book_value', header: 'assetDetailDrawer.lblOpeningValue', align: 'right', customCellTemplate: this.openingTpl() },
    { key: 'depreciation_amount', header: 'assetDetailDrawer.lblDeprAmount', align: 'right', customCellTemplate: this.depreciationTpl() },
    { key: 'closing_book_value', header: 'assetDetailDrawer.lblClosingValue', align: 'right', customCellTemplate: this.closingTpl() },
    { key: 'accumulated_depreciation', header: 'assetDetailDrawer.lblAccumulated', align: 'right', customCellTemplate: this.accumulatedTpl() },
    { key: 'status', header: 'assetDetailDrawer.lblStatus', customCellTemplate: this.scheduleStatusTpl() },
  ]);

  protected readonly workOrderColumns = computed<TableColumnDef<MaintenanceWorkOrderResource>[]>(() => [
    { key: 'work_order_number', header: 'assetDetailDrawer.lblWoNumber', customCellTemplate: this.woNumberTpl() },
    { key: 'maintenance_type', header: 'assetDetailDrawer.lblType', customCellTemplate: this.woTypeTpl() },
    { key: 'priority', header: 'assetDetailDrawer.lblPriority', customCellTemplate: this.woPriorityTpl() },
    { key: 'status', header: 'assetDetailDrawer.lblStatus', customCellTemplate: this.woStatusTpl() },
    { key: 'scheduled_date', header: 'assetDetailDrawer.lblScheduledDate', customCellTemplate: this.woDateTpl() },
    { key: 'total_cost', header: 'assetDetailDrawer.lblTotalCost', align: 'right', customCellTemplate: this.woCostTpl() },
  ]);

  ngOnInit(): void {
    this.loadData();
  }

  label(key: string): string {
    return this.i18n?.translate(key) ?? key;
  }

  loadData(): void {
    const id = this.asset().id;
    this.loadBooks(id);
    this.loadParallelSchedules(id);
    this.loadHistory(id);
    if (this.assetApi.getFiscalRates) {
      this.assetApi.getFiscalRates().subscribe({
        next: (res) => this.fiscalRates.set(res.data || []),
        error: () => undefined,
      });
    }
  }

  loadBooks(assetId: string): void {
    this.loadingBooks.set(true);
    this.assetApi.getAssetBooks(assetId).subscribe({
      next: (res) => {
        this.books.set(res.data || []);
        this.loadingBooks.set(false);
      },
      error: () => {
        this.books.set([]);
        this.loadingBooks.set(false);
      },
    });
  }

  loadParallelSchedules(assetId: string = this.asset().id): void {
    if (!this.assetApi.getParallelSchedules) {
      return;
    }
    this.loadingParallelSchedules.set(true);
    this.assetApi
      .getParallelSchedules(assetId, { period_type: this.schedulePeriodType(), periods: 30 })
      .subscribe({
        next: (res) => {
          this.parallelSchedules.set(res.data ?? null);
          this.loadingParallelSchedules.set(false);
        },
        error: () => {
          this.parallelSchedules.set(null);
          this.loadingParallelSchedules.set(false);
        },
      });
  }

  onSchedulePeriodTypeChange(periodType: 'yearly' | 'quarterly' | 'monthly'): void {
    this.schedulePeriodType.set(periodType);
    this.loadParallelSchedules();
  }

  loadHistory(assetId: string = this.asset().id): void {
    if (!this.opsApi?.getAssetHistory) {
      return;
    }
    this.loadingHistory.set(true);
    this.opsApi.getAssetHistory(assetId).subscribe({
      next: (res) => {
        this.history.set(
          res.data || { transfers: [], valuations: [], improvements: [], disposals: [] },
        );
        this.loadingHistory.set(false);
      },
      error: () => {
        this.loadingHistory.set(false);
      },
    });
  }

  // --- Lifecycle quick actions ---
  capitalize(): void {
    this.assetApi.capitalizeAsset(this.asset().id).subscribe({
      next: () => {
        this.message.success(this.label('eam.status.capitalized'));
        this.loadData();
        this.assetChanged.emit();
      },
      error: () => undefined,
    });
  }

  commission(): void {
    this.assetApi.commissionAsset(this.asset().id).subscribe({
      next: () => {
        this.message.success(this.label('eam.status.in_service'));
        this.loadData();
        this.assetChanged.emit();
      },
      error: () => undefined,
    });
  }

  // --- Configure Parallel Book ---
  openConfigureBookModal(book: AssetBookResource): void {
    this.editingBook.set(book);
    const regime =
      (book.fiscal_regime as
        | 'civil_linear'
        | 'ch_afc_degressive'
        | 'ch_afc_linear'
        | 'ch_afc_immediate'
        | 'it_dm_1988') || (book.ledger_type === 'tax' ? 'ch_afc_degressive' : 'civil_linear');
    const method =
      (book.depreciation_method as
        | 'straight_line'
        | 'declining_balance'
        | 'double_declining_balance'
        | 'units_of_production'
        | 'immediate_expensing') || 'straight_line';

    this.bookForm.reset({
      fiscal_regime: regime,
      fiscal_rate_id: '',
      depreciation_method: method,
      useful_life_months: book.useful_life_months || 60,
      rate_percent: Number(book.rate_percent || 20),
      declining_balance_factor: 2,
      pro_rata_convention: 'daily',
      pro_memoria_value: Number(book.pro_memoria_value ?? 1),
      first_year_half_rate: Boolean(book.first_year_half_rate),
      switch_to_straight_line: book.switch_to_straight_line ?? true,
      immediate_expensing: Boolean(book.immediate_expensing),
    });
    this.configureBookVisible.set(true);
  }

  applyFiscalPresetToBook(rateId: string): void {
    const rate = this.fiscalRates().find((r) => r.id === rateId);
    if (!rate) {
      return;
    }
    const isCh = rate.jurisdiction === 'CH';
    this.bookForm.patchValue({
      fiscal_regime: isCh ? 'ch_afc_degressive' : 'it_dm_1988',
      fiscal_rate_id: rate.id,
      depreciation_method: isCh && rate.declining_rate_percent ? 'declining_balance' : 'straight_line',
      useful_life_months: Math.max(12, rate.useful_life_years * 12),
      rate_percent: Number(
        isCh && rate.declining_rate_percent ? rate.declining_rate_percent : rate.linear_rate_percent,
      ),
      first_year_half_rate: rate.first_year_half_rule,
      switch_to_straight_line: !isCh,
      pro_memoria_value: isCh ? 1 : 0,
    });
  }

  submitConfigureBook(): void {
    const book = this.editingBook();
    if (!book?.ledger_type || this.bookForm.invalid || !this.assetApi.configureBook) {
      return;
    }
    this.savingBook.set(true);
    const v = this.bookForm.getRawValue();
    const payload: ConfigureAssetBookPayload = {
      fiscal_regime: v.fiscal_regime,
      fiscal_rate_id: v.fiscal_rate_id || null,
      depreciation_method: v.depreciation_method,
      useful_life_months: v.useful_life_months,
      rate_percent: v.rate_percent,
      declining_balance_factor: v.declining_balance_factor,
      pro_rata_convention: v.pro_rata_convention,
      first_year_half_rate: v.first_year_half_rate,
      switch_to_straight_line: v.switch_to_straight_line,
      pro_memoria_value: v.pro_memoria_value,
      immediate_expensing: v.immediate_expensing,
    };

    this.assetApi.configureBook(this.asset().id, book.ledger_type, payload).subscribe({
      next: () => {
        this.savingBook.set(false);
        this.configureBookVisible.set(false);
        this.message.success(this.label('eam.book.configure'));
        this.loadBooks(this.asset().id);
        this.loadParallelSchedules(this.asset().id);
        this.assetChanged.emit();
      },
      error: () => {
        this.savingBook.set(false);
      },
    });
  }

  // --- Capital Improvement ---
  openImprovementModal(): void {
    this.improvementForm.reset({
      improvement_date: new Date().toISOString().slice(0, 10),
      description: '',
      amount: 1000,
      purchase_invoice_number: '',
      extends_useful_life_months: 0,
      affects_tax_book: true,
      auto_post_to_gl: true,
    });
    this.improvementModalVisible.set(true);
  }

  submitImprovement(): void {
    if (this.improvementForm.invalid || !this.opsApi?.recordImprovement) {
      this.improvementForm.markAllAsTouched();
      return;
    }
    this.savingImprovement.set(true);
    const v = this.improvementForm.getRawValue();
    const payload: RecordAssetImprovementPayload = {
      improvement_date: v.improvement_date,
      description: v.description,
      amount: v.amount,
      purchase_invoice_number: v.purchase_invoice_number || null,
      extends_useful_life_months: v.extends_useful_life_months,
      affects_tax_book: v.affects_tax_book,
      auto_post_to_gl: v.auto_post_to_gl,
    };

    this.opsApi.recordImprovement(this.asset().id, payload).subscribe({
      next: () => {
        this.savingImprovement.set(false);
        this.improvementModalVisible.set(false);
        this.message.success(this.label('eam.events.improve'));
        this.loadData();
        this.schedulesGrid.reload();
        this.assetChanged.emit();
      },
      error: () => {
        this.savingImprovement.set(false);
      },
    });
  }

  // --- Impairment / Revaluation ---
  openValuationModal(): void {
    const currentNbv = Number(this.asset().carrying_amount || this.asset().acquisition_cost || 0);
    this.valuationForm.reset({
      valuation_type: 'impairment',
      fair_value: currentNbv,
      value_in_use: 0,
      valuation_date: new Date().toISOString().slice(0, 10),
      apply_to_tax_book: false,
      auto_post_to_gl: true,
      reason: '',
    });
    this.valuationModalVisible.set(true);
  }

  submitValuation(): void {
    if (this.valuationForm.invalid || !this.opsApi?.valuateAsset) {
      return;
    }
    this.savingValuation.set(true);
    const v = this.valuationForm.getRawValue();
    this.opsApi
      .valuateAsset(this.asset().id, {
        valuation_type: v.valuation_type,
        fair_value: v.fair_value,
        value_in_use: v.value_in_use || null,
        valuation_date: v.valuation_date || null,
        apply_to_tax_book: v.apply_to_tax_book,
        auto_post_to_gl: v.auto_post_to_gl,
        reason: v.reason || null,
      })
      .subscribe({
        next: () => {
          this.savingValuation.set(false);
          this.valuationModalVisible.set(false);
          this.message.success(this.label('eam.events.impairOrRevalue'));
          this.loadData();
          this.schedulesGrid.reload();
          this.assetChanged.emit();
        },
        error: () => {
          this.savingValuation.set(false);
        },
      });
  }

  reverseImpairment(valuation: AssetValuation): void {
    if (!this.opsApi?.reverseImpairment) {
      return;
    }
    const recoverable = Number(valuation.carrying_amount_before || this.asset().capitalized_cost || 0);
    this.opsApi
      .reverseImpairment(this.asset().id, {
        recoverable_amount: recoverable,
        reason: 'Recovery of asset value',
      })
      .subscribe({
        next: () => {
          this.message.success('Impairment reversed');
          this.loadData();
          this.assetChanged.emit();
        },
        error: () => undefined,
      });
  }

  // --- Disposal / Scrapping + Gain/Loss Preview ---
  openDisposalModal(): void {
    this.disposalPreview.set(null);
    this.disposalForm.reset({
      disposal_type: 'sale',
      disposal_date: new Date().toISOString().slice(0, 10),
      disposed_percentage: 100,
      proceeds_amount: 0,
      disposal_costs: 0,
      disposal_document_number: '',
      fiscal_gain_spread_years: 1,
      reason: '',
      auto_post_to_gl: true,
    });
    this.disposalModalVisible.set(true);
    this.previewDisposal();
  }

  private buildDisposalPayload(): DisposeAssetPayload {
    const v = this.disposalForm.getRawValue();
    return {
      disposal_type: v.disposal_type,
      disposal_date: v.disposal_date || null,
      disposed_percentage: v.disposed_percentage,
      proceeds_amount: v.disposal_type === 'sale' ? v.proceeds_amount : 0,
      disposal_costs: v.disposal_costs || 0,
      disposal_document_number: v.disposal_document_number || null,
      fiscal_gain_spread_years: v.fiscal_gain_spread_years || null,
      reason: v.reason || null,
      auto_post_to_gl: v.auto_post_to_gl,
    };
  }

  previewDisposal(): void {
    if (!this.assetApi.previewDisposal) {
      return;
    }
    this.loadingDisposalPreview.set(true);
    this.assetApi.previewDisposal(this.asset().id, this.buildDisposalPayload()).subscribe({
      next: (res) => {
        this.disposalPreview.set(res.data ?? null);
        this.loadingDisposalPreview.set(false);
      },
      error: () => {
        this.disposalPreview.set(null);
        this.loadingDisposalPreview.set(false);
      },
    });
  }

  submitDisposal(): void {
    if (this.disposalForm.invalid) {
      return;
    }
    this.savingDisposal.set(true);
    this.assetApi.disposeAsset(this.asset().id, this.buildDisposalPayload()).subscribe({
      next: () => {
        this.savingDisposal.set(false);
        this.disposalModalVisible.set(false);
        this.message.success(this.label('eam.events.dispose'));
        this.loadData();
        this.assetChanged.emit();
      },
      error: () => {
        this.savingDisposal.set(false);
      },
    });
  }

  onClose(): void {
    this.closed.emit();
  }

  getLedgerTypeColor(type: string | null): string {
    switch (type?.toLowerCase()) {
      case 'statutory':
      case 'civil':
        return 'blue';
      case 'tax':
      case 'fiscal':
        return 'orange';
      case 'managerial':
      case 'internal':
        return 'purple';
      default:
        return 'default';
    }
  }
}
