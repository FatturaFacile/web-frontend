import { CurrencyPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuthStore, CreateProductPayload, InventoryApiService, ProductItem } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-inventory',
  imports: [
    ReactiveFormsModule,
    CurrencyPipe,
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
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.scss',
})
export class InventoryComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly products = signal<ProductItem[]>([]);
  readonly total = signal(0);
  readonly pageIndex = signal(1);
  readonly pageSize = signal(10);
  readonly searchTerm = signal('');
  readonly createModalVisible = signal(false);

  readonly productForm = this.fb.group({
    sku: this.fb.control('', [Validators.required]),
    name: this.fb.control('', [Validators.required]),
    warehouse: this.fb.control('Chiasso (CH)', [Validators.required]),
    quantity: this.fb.control(1, [Validators.required, Validators.min(0)]),
    unit_of_measure: this.fb.control('Pz', [Validators.required]),
    price: this.fb.control(0, [Validators.required, Validators.min(0)]),
    hs_code: this.fb.control(''),
  });

  ngOnInit(): void {
    this.loadProducts();
  }

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
      warehouse: this.authStore.activeJurisdiction() === 'CH' ? 'Chiasso (CH)' : 'Milano (IT)',
      quantity: 1,
      unit_of_measure: 'Pz',
      price: 0,
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
      warehouse: formVal.warehouse,
      quantity: formVal.quantity,
      unit_of_measure: formVal.unit_of_measure,
      price: formVal.price,
      currency: this.authStore.activeCurrency(),
      hs_code: formVal.hs_code || undefined,
    };

    this.inventoryApi.createProduct(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.createModalVisible.set(false);
        this.message.success('Prodotto creato con successo');
        this.loadProducts();
      },
      error: () => {
        this.saving.set(false);
      },
    });
  }

  deleteProduct(item: ProductItem): void {
    this.inventoryApi.deleteProduct(item.id).subscribe({
      next: () => {
        this.message.success('Prodotto eliminato');
        this.loadProducts();
      },
      error: () => {
        // Handled by interceptor toast
      },
    });
  }
}
