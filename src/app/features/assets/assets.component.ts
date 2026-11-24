import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzQRCodeComponent } from 'ng-zorro-antd/qr-code';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AssetAcquirePayload,
  AssetApiService,
  AssetCategoryResource,
  AssetFilterParams,
  AssetLocation,
  AssetTagData,
  AuthStore,
  EamOpsApiService,
  FetchGridModel,
  FiscalDepreciationRateResource,
  FiscalIncentiveRegime,
  FixedAssetResource,
  I18nService,
  isValidationError,
  PendingInvoiceLine,
  ProRataConvention,
  StoreFixedAssetPayload,
  TranslateService,
} from '@core';
import {
  BaseTableComponent,
  IconActionDirective,
  ModalActionsDirective,
  MoneyPipe,
  PageHeaderComponent,
  TableColumnDef,
  TranslatePipe,
} from '@shared';
import { AssetDetailDrawerComponent } from './components/asset-detail-drawer/asset-detail-drawer.component';

type AssetDepreciationMethod =
  | 'straight_line'
  | 'declining_balance'
  | 'double_declining_balance'
  | 'units_of_production'
  | 'immediate_expensing';

const ASSET_STATUS_OPTIONS = [
  'registered',
  'acquired',
  'capitalized',
  'in_service',
  'impaired',
  'revalued',
  'sold',
  'disposed',
  'retired',
] as const;

@Component({
  selector: 'app-assets',
  styleUrl: './assets.component.scss',
  imports: [
    RouterLink,
    BaseTableComponent,
    ModalActionsDirective,
    IconActionDirective,
    TranslatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzCardModule,
    NzCheckboxModule,
    NzDividerModule,
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
    NzSpaceModule,
    NzTableModule,
    NzQRCodeComponent,
    PageHeaderComponent,
    MoneyPipe,
    AssetDetailDrawerComponent,
  ],
  templateUrl: './assets.component.html',
})
export class AssetsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService, { optional: true });
  private readonly assetApi = inject(AssetApiService);
  private readonly opsApi = inject(EamOpsApiService, { optional: true });
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly saving = signal(false);
  readonly categories = signal<AssetCategoryResource[]>([]);
  readonly locations = signal<AssetLocation[]>([]);
  readonly fiscalRates = signal<FiscalDepreciationRateResource[]>([]);
  readonly statusOptions = ASSET_STATUS_OPTIONS;

  /** Server-driven grid: paging, sorting, column filters, grouping and export run on the API. */
  readonly grid = new FetchGridModel<FixedAssetResource, AssetFilterParams>((query) =>
    this.assetApi.getAssets(query),
  );

  private readonly nameTpl = viewChild<TemplateRef<{ $implicit: FixedAssetResource; value: unknown }>>('nameTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: FixedAssetResource; value: unknown }>>('statusTpl');
  private readonly conditionTpl = viewChild<TemplateRef<{ $implicit: FixedAssetResource; value: unknown }>>('conditionTpl');
  private readonly costTpl = viewChild<TemplateRef<{ $implicit: FixedAssetResource; value: unknown }>>('costTpl');
  private readonly carryingTpl = viewChild<TemplateRef<{ $implicit: FixedAssetResource; value: unknown }>>('carryingTpl');
  private readonly rateTpl = viewChild<TemplateRef<{ $implicit: FixedAssetResource; value: unknown }>>('rateTpl');

  protected readonly columns = computed<TableColumnDef<FixedAssetResource>[]>(() => [
    { key: 'name', header: 'assets.lblAssetSerial', customCellTemplate: this.nameTpl() },
    { key: 'status', header: 'assets.lblStatus', customCellTemplate: this.statusTpl() },
    { key: 'condition', header: 'assets.lblCondition', customCellTemplate: this.conditionTpl() },
    { key: 'acquisition_cost', header: 'assets.lblAcquisitionCost', align: 'right', customCellTemplate: this.costTpl() },
    { key: 'carrying_value', header: 'assets.lblCarryingAmount', align: 'right', customCellTemplate: this.carryingTpl() },
    { key: 'depreciation_rate_percent', header: 'assets.lblDeprRate', align: 'right', customCellTemplate: this.rateTpl() },
  ]);

  // Filters
  readonly searchTerm = signal('');
  readonly statusFilter = signal<string | null>(null);

  // Modals & Drawer
  readonly createModalVisible = signal(false);
  readonly selectedAsset = signal<FixedAssetResource | null>(null);
  readonly drawerVisible = signal(false);

  // Vendor Invoice Acquisition Modal
  readonly acquireModalVisible = signal(false);
  readonly loadingPendingLines = signal(false);
  readonly onlyCapitalLines = signal(true);
  readonly pendingInvoiceLines = signal<PendingInvoiceLine[]>([]);
  readonly selectedInvoiceLine = signal<PendingInvoiceLine | null>(null);
  readonly acquiringLine = signal(false);

  // QR Modal
  readonly qrModalVisible = signal(false);
  readonly currentTag = signal<AssetTagData | null>(null);
  readonly loadingTag = signal(false);

  // Form filters for fiscal tables
  readonly createJurisdiction = signal<'CH' | 'IT'>('CH');
  readonly filteredCreateRates = computed(() =>
    this.fiscalRates().filter((r) => r.jurisdiction === this.createJurisdiction()),
  );
  readonly selectedFiscalRate = signal<FiscalDepreciationRateResource | null>(null);

  readonly acquireJurisdiction = signal<'CH' | 'IT'>('CH');
  readonly filteredAcquireRates = computed(() =>
    this.fiscalRates().filter((r) => r.jurisdiction === this.acquireJurisdiction()),
  );

  readonly assetForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    category_id: this.fb.control('', [Validators.required]),
    asset_number: this.fb.control('', [Validators.maxLength(60)]),
    serial_number: this.fb.control('', [Validators.maxLength(100)]),
    location_id: this.fb.control(''),
    cost_center_id: this.fb.control('', [Validators.maxLength(64)]),
    purchase_invoice_number: this.fb.control('', [Validators.maxLength(100)]),
    acquisition_date: this.fb.control(new Date().toISOString().slice(0, 10)),
    in_service_date: this.fb.control(new Date().toISOString().slice(0, 10)),
    acquisition_cost: this.fb.control<number>(0, [
      Validators.required,
      Validators.min(1),
      Validators.max(9999999999999.99),
    ]),
    salvage_value: this.fb.control<number>(0, [Validators.min(0)]),
    currency: this.fb.control('CHF'),
    fiscal_jurisdiction: this.fb.control<'CH' | 'IT'>('CH'),
    fiscal_rate_id: this.fb.control(''),
    depreciation_method: this.fb.control<AssetDepreciationMethod>('straight_line'),
    pro_rata_convention: this.fb.control<ProRataConvention>('daily'),
    useful_life_years: this.fb.control<number>(5, [Validators.min(1), Validators.max(100)]),
    condition: this.fb.control<'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged'>('new'),
    immediate_expensing_applied: this.fb.control(false),
    incentive_regime: this.fb.control<FiscalIncentiveRegime>('none'),
    incentive_rate_percent: this.fb.control<number>(0, [Validators.min(0), Validators.max(500)]),
    capitalize_immediately: this.fb.control(false),
    description: this.fb.control('', [Validators.maxLength(5000)]),
  });

  readonly acquireForm = this.fb.group({
    category_id: this.fb.control('', [Validators.required]),
    location_id: this.fb.control(''),
    cost_center_id: this.fb.control(''),
    in_service_date: this.fb.control(new Date().toISOString().slice(0, 10)),
    fiscal_jurisdiction: this.fb.control<'CH' | 'IT'>('CH'),
    fiscal_rate_id: this.fb.control(''),
    immediate_expensing_applied: this.fb.control(false),
    incentive_regime: this.fb.control<FiscalIncentiveRegime>('none'),
    incentive_rate_percent: this.fb.control<number>(0, [Validators.min(0), Validators.max(500)]),
    capitalize: this.fb.control(true),
  });

  ngOnInit(): void {
    this.loadCategories();
    this.loadFiscalRates();
    this.loadLocations();
  }

  label(key: string): string {
    return this.i18n?.translate(key) ?? key;
  }

  loadCategories(): void {
    this.assetApi.getCategories().subscribe({
      next: (res) => this.categories.set(res.data || []),
      error: () => this.categories.set([]),
    });
  }

  loadFiscalRates(): void {
    if (!this.assetApi.getFiscalRates) {
      return;
    }
    this.assetApi.getFiscalRates().subscribe({
      next: (res) => this.fiscalRates.set(res.data || []),
      error: () => this.fiscalRates.set([]),
    });
  }

  loadLocations(): void {
    if (!this.opsApi?.getLocations) {
      return;
    }
    this.opsApi.getLocations().subscribe({
      next: (res) => this.locations.set(res.data || []),
      error: () => this.locations.set([]),
    });
  }

  loadAssets(): void {
    this.grid.reload();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.grid.setFilter({ search: val || undefined });
  }

  onStatusChange(status: string | null): void {
    this.statusFilter.set(status);
    this.grid.setFilter({ status: status || undefined });
  }

  openCreateModal(): void {
    const today = new Date().toISOString().slice(0, 10);
    const currency = this.authStore.activeCurrency() || 'CHF';
    const jurisdiction: 'CH' | 'IT' = currency === 'EUR' ? 'IT' : 'CH';
    this.createJurisdiction.set(jurisdiction);
    this.selectedFiscalRate.set(null);

    this.assetForm.reset({
      name: '',
      category_id: this.categories()[0]?.id || '',
      asset_number: '',
      serial_number: '',
      location_id: '',
      cost_center_id: '',
      purchase_invoice_number: '',
      acquisition_date: today,
      in_service_date: today,
      acquisition_cost: 0,
      salvage_value: 0,
      currency,
      fiscal_jurisdiction: jurisdiction,
      fiscal_rate_id: '',
      depreciation_method: 'straight_line',
      pro_rata_convention: jurisdiction === 'IT' ? 'half_year' : 'daily',
      useful_life_years: 5,
      condition: 'new',
      immediate_expensing_applied: false,
      incentive_regime: 'none',
      incentive_rate_percent: 0,
      capitalize_immediately: false,
      description: '',
    });
    this.createModalVisible.set(true);
  }

  onCreateJurisdictionChange(jurisdiction: 'CH' | 'IT'): void {
    this.createJurisdiction.set(jurisdiction);
    this.selectedFiscalRate.set(null);
    this.assetForm.patchValue({
      fiscal_rate_id: '',
      pro_rata_convention: jurisdiction === 'IT' ? 'half_year' : 'daily',
      currency: jurisdiction === 'CH' ? 'CHF' : 'EUR',
    });
  }

  onCreateFiscalRateSelected(rateId: string): void {
    const rate = this.fiscalRates().find((r) => r.id === rateId) ?? null;
    this.selectedFiscalRate.set(rate);
    if (!rate) {
      return;
    }
    const years = Math.max(1, rate.useful_life_years || 5);
    const decliningPct = Number(rate.declining_rate_percent || 0);
    this.assetForm.patchValue({
      useful_life_years: years,
      depreciation_method: rate.jurisdiction === 'CH' && decliningPct > 0 ? 'declining_balance' : 'straight_line',
      pro_rata_convention: rate.first_year_half_rule ? 'half_year' : 'daily',
    });
  }

  submitCreateAsset(): void {
    if (this.assetForm.invalid) {
      this.assetForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.assetForm.getRawValue();
    const payload: StoreFixedAssetPayload = {
      name: formVal.name,
      category_id: formVal.category_id,
      acquisition_cost: formVal.acquisition_cost,
      salvage_value: formVal.salvage_value || 0,
      currency: formVal.currency || this.authStore.activeCurrency(),
      asset_number: formVal.asset_number || undefined,
      serial_number: formVal.serial_number || undefined,
      location_id: formVal.location_id || undefined,
      cost_center_id: formVal.cost_center_id || undefined,
      purchase_invoice_number: formVal.purchase_invoice_number || undefined,
      fiscal_jurisdiction: formVal.fiscal_jurisdiction,
      fiscal_rate_id: formVal.fiscal_rate_id || undefined,
      acquisition_date: formVal.acquisition_date || undefined,
      in_service_date: formVal.in_service_date || undefined,
      depreciation_method: formVal.depreciation_method,
      pro_rata_convention: formVal.pro_rata_convention,
      useful_life_years: formVal.useful_life_years,
      condition: formVal.condition,
      immediate_expensing_applied: formVal.immediate_expensing_applied,
      incentive_regime: formVal.incentive_regime,
      incentive_rate_percent:
        formVal.incentive_regime !== 'none' ? formVal.incentive_rate_percent : undefined,
      description: formVal.description || undefined,
    };

    this.assetApi.createAsset(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success(this.translate.instant('assets.msgFixedAssetRecorded'));
        if (formVal.capitalize_immediately && res.data?.id) {
          this.assetApi.capitalizeAsset(res.data.id).subscribe({
            next: () => this.loadAssets(),
            error: () => this.loadAssets(),
          });
        } else {
          this.loadAssets();
        }
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.assetForm, err);
        }
      },
    });
  }

  openAcquireModal(): void {
    this.selectedInvoiceLine.set(null);
    this.acquireModalVisible.set(true);
    this.loadPendingInvoiceLines();
  }

  loadPendingInvoiceLines(): void {
    if (!this.opsApi?.getPendingInvoiceLines) {
      this.pendingInvoiceLines.set([]);
      return;
    }
    this.loadingPendingLines.set(true);
    this.opsApi.getPendingInvoiceLines({ only_capital: this.onlyCapitalLines(), per_page: 25 }).subscribe({
      next: (res) => {
        this.pendingInvoiceLines.set(res.data || []);
        this.loadingPendingLines.set(false);
      },
      error: () => {
        this.pendingInvoiceLines.set([]);
        this.loadingPendingLines.set(false);
      },
    });
  }

  toggleOnlyCapitalLines(val: boolean): void {
    this.onlyCapitalLines.set(val);
    this.loadPendingInvoiceLines();
  }

  selectInvoiceLine(line: PendingInvoiceLine): void {
    this.selectedInvoiceLine.set(line);
    const jurisdiction: 'CH' | 'IT' = line.currency === 'EUR' ? 'IT' : 'CH';
    this.acquireJurisdiction.set(jurisdiction);
    this.acquireForm.patchValue({
      category_id: line.asset_category_id || this.categories()[0]?.id || '',
      in_service_date: line.invoice_date || new Date().toISOString().slice(0, 10),
      fiscal_jurisdiction: jurisdiction,
      fiscal_rate_id: '',
      immediate_expensing_applied: false,
      incentive_regime: 'none',
      incentive_rate_percent: 0,
      capitalize: true,
    });
  }

  submitAcquireFromInvoiceLine(): void {
    const line = this.selectedInvoiceLine();
    if (!line || this.acquireForm.invalid || !this.opsApi) {
      this.acquireForm.markAllAsTouched();
      return;
    }

    this.acquiringLine.set(true);
    const v = this.acquireForm.getRawValue();
    const payload: AssetAcquirePayload = {
      source_type: 'passive_invoice_line',
      source_id: line.id,
      category_id: v.category_id,
      location_id: v.location_id || null,
      cost_center_id: v.cost_center_id || null,
      in_service_date: v.in_service_date || null,
      fiscal_jurisdiction: v.fiscal_jurisdiction,
      fiscal_rate_id: v.fiscal_rate_id || null,
      immediate_expensing_applied: v.immediate_expensing_applied,
      incentive_regime: v.incentive_regime,
      incentive_rate_percent: v.incentive_regime !== 'none' ? v.incentive_rate_percent : null,
      capitalize: v.capitalize,
    };

    this.opsApi.acquireAsset(payload).subscribe({
      next: () => {
        this.acquiringLine.set(false);
        this.acquireModalVisible.set(false);
        this.message.success(this.translate.instant('assets.msgFixedAssetRecorded'));
        this.loadAssets();
      },
      error: (err: unknown) => {
        this.acquiringLine.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.acquireForm, err);
        }
      },
    });
  }

  capitalize(asset: FixedAssetResource): void {
    this.assetApi.capitalizeAsset(asset.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('assets.msgAssetCapitalized'));
        this.loadAssets();
      },
      error: () => undefined,
    });
  }

  commission(asset: FixedAssetResource): void {
    this.assetApi.commissionAsset(asset.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('assets.msgAssetCommissionedAndPutInService'));
        this.loadAssets();
      },
      error: () => undefined,
    });
  }

  viewQrCode(asset: FixedAssetResource): void {
    this.loadingTag.set(true);
    this.assetApi.getAssetTag(asset.id).subscribe({
      next: (res) => {
        this.currentTag.set(res.data);
        this.qrModalVisible.set(true);
        this.loadingTag.set(false);
      },
      error: () => {
        this.loadingTag.set(false);
        this.message.error(this.translate.instant('assets.msgUnableToLoadAssetQrTag'));
      },
    });
  }

  openDetail(asset: FixedAssetResource): void {
    this.selectedAsset.set(asset);
    this.drawerVisible.set(true);
  }

  closeDetail(): void {
    this.drawerVisible.set(false);
    this.selectedAsset.set(null);
    this.loadAssets();
  }

  getStatusColor(status: string | null): string {
    switch (status?.toLowerCase()) {
      case 'in_service':
      case 'active':
        return 'success';
      case 'capitalized':
        return 'processing';
      case 'impaired':
        return 'warning';
      case 'revalued':
        return 'purple';
      case 'sold':
      case 'disposed':
      case 'retired':
        return 'default';
      default:
        return 'cyan';
    }
  }

  getQrString(): string {
    const payload = this.currentTag()?.qr_payload;
    if (typeof payload === 'string') {
      return payload;
    }
    return JSON.stringify(payload || '');
  }
}
