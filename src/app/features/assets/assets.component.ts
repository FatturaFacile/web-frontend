import { Component, computed, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AssetApiService,
  AssetCategoryResource,
  AssetFilterParams,
  FetchGridModel,
  AssetTagData,
  AuthStore,
  FixedAssetResource,
  isValidationError,
  StoreFixedAssetPayload,
  TranslateService,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, ModalActionsDirective, IconActionDirective, TableColumnDef } from '@shared';
import { AssetDetailDrawerComponent } from './components/asset-detail-drawer/asset-detail-drawer.component';
import { TranslatePipe } from '@shared';

@Component({
  selector: 'app-assets',
  styleUrl: './assets.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    IconActionDirective,
    TranslatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
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
    NzQRCodeComponent,
    PageHeaderComponent,
    MoneyPipe,
    AssetDetailDrawerComponent,
  ],
  templateUrl: './assets.component.html',
})
export class AssetsComponent implements OnInit {
  private readonly translate = inject(TranslateService);
  private readonly assetApi = inject(AssetApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly saving = signal(false);
  readonly categories = signal<AssetCategoryResource[]>([]);

  /** Server-driven grid: paging, sorting, column filters, grouping and export run on the API. */
  readonly grid = new FetchGridModel<FixedAssetResource, AssetFilterParams>((query) => this.assetApi.getAssets(query));

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

  // QR Modal
  readonly qrModalVisible = signal(false);
  readonly currentTag = signal<AssetTagData | null>(null);
  readonly loadingTag = signal(false);

  readonly assetForm = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    category_id: this.fb.control('', [Validators.required]),
    acquisition_cost: this.fb.control<number>(0, [Validators.required, Validators.min(1), Validators.max(9999999999999.99)]),
    depreciation_method: this.fb.control<'straight_line' | 'declining_balance' | 'double_declining_balance' | 'units_of_production'>('straight_line'),
    useful_life_years: this.fb.control<number>(5, [Validators.min(1), Validators.max(100)]),
    condition: this.fb.control<'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged'>('new'),
    asset_number: this.fb.control('', [Validators.maxLength(60)]),
    serial_number: this.fb.control('', [Validators.maxLength(100)]),
    description: this.fb.control('', [Validators.maxLength(5000)]),
  });

  ngOnInit(): void {
    this.loadCategories();
  }

  loadCategories(): void {
    this.assetApi.getCategories().subscribe({
      next: (res) => this.categories.set(res.data || []),
      error: () => this.categories.set([]),
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
    this.assetForm.reset({
      name: '',
      category_id: this.categories()[0]?.id || '',
      acquisition_cost: 0,
      depreciation_method: 'straight_line',
      useful_life_years: 5,
      condition: 'new',
      asset_number: `AST-${Date.now().toString().slice(-4)}`,
      serial_number: '',
      description: '',
    });
    this.createModalVisible.set(true);
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
      currency: this.authStore.activeCurrency(),
      depreciation_method: formVal.depreciation_method,
      useful_life_years: formVal.useful_life_years,
      condition: formVal.condition,
      asset_number: formVal.asset_number || undefined,
      serial_number: formVal.serial_number || undefined,
      description: formVal.description || undefined,
    };

    this.assetApi.createAsset(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success(this.translate.instant('assets.msgFixedAssetRecorded'));
        this.loadAssets();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        if (isValidationError(err)) {
          applyServerErrors(this.assetForm, err);
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
