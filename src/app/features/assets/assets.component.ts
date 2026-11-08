import { Component, inject, OnInit, signal } from '@angular/core';
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
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AssetApiService,
  AssetCategoryResource,
  AssetFilterParams,
  AssetTagData,
  AuthStore,
  FixedAssetResource,
  isValidationError,
  StoreFixedAssetPayload,
} from '@core';
import { MoneyPipe, PageHeaderComponent } from '@shared';
import { AssetDetailDrawerComponent } from './components/asset-detail-drawer/asset-detail-drawer.component';

@Component({
  selector: 'app-assets',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
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
    NzSpaceModule,
    NzQRCodeComponent,
    PageHeaderComponent,
    MoneyPipe,
    AssetDetailDrawerComponent,
  ],
  templateUrl: './assets.component.html',
  styleUrl: './assets.component.scss',
})
export class AssetsComponent implements OnInit {
  private readonly assetApi = inject(AssetApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly authStore = inject(AuthStore);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly assets = signal<FixedAssetResource[]>([]);
  readonly categories = signal<AssetCategoryResource[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);

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
    name: this.fb.control('', [Validators.required]),
    category_id: this.fb.control('', [Validators.required]),
    acquisition_cost: this.fb.control<number>(0, [Validators.required, Validators.min(1)]),
    depreciation_method: this.fb.control<'straight_line' | 'declining_balance' | 'double_declining_balance' | 'units_of_production'>('straight_line'),
    useful_life_years: this.fb.control<number>(5, [Validators.required, Validators.min(1)]),
    condition: this.fb.control<'new' | 'excellent' | 'good' | 'fair' | 'poor' | 'damaged'>('new'),
    asset_number: this.fb.control(''),
    serial_number: this.fb.control(''),
    description: this.fb.control(''),
  });

  ngOnInit(): void {
    this.loadCategories();
    this.loadAssets();
  }

  loadCategories(): void {
    this.assetApi.getCategories().subscribe({
      next: (res) => this.categories.set(res.data || []),
      error: () => this.categories.set([]),
    });
  }

  loadAssets(): void {
    this.loading.set(true);
    const params: AssetFilterParams = {
      page: this.pageIndex(),
      per_page: this.pageSize(),
      search: this.searchTerm() || undefined,
      status: this.statusFilter() || undefined,
    };

    this.assetApi.getAssets(params).subscribe({
      next: (res) => {
        this.assets.set(res.data || []);
        this.total.set(res.meta?.total || (res.data || []).length);
        this.loading.set(false);
      },
      error: () => {
        this.assets.set([]);
        this.total.set(0);
        this.loading.set(false);
      },
    });
  }

  onQueryParamsChange(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.loadAssets();
  }

  onSearch(event: Event): void {
    const val = (event.target as HTMLInputElement).value;
    this.searchTerm.set(val);
    this.pageIndex.set(1);
    this.loadAssets();
  }

  onStatusChange(status: string | null): void {
    this.statusFilter.set(status);
    this.pageIndex.set(1);
    this.loadAssets();
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
        this.message.success('Fixed asset recorded');
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
        this.message.success('Asset capitalized');
        this.loadAssets();
      },
      error: () => undefined,
    });
  }

  commission(asset: FixedAssetResource): void {
    this.assetApi.commissionAsset(asset.id).subscribe({
      next: () => {
        this.message.success('Asset commissioned and put in service');
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
        this.message.error('Unable to load asset QR tag');
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
