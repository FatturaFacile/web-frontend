import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
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
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  ClientApiService,
  ContactResource,
  CreateDeliveryNotePayload,
  CreateSalesOrderPayload,
  CreateSalesQuotePayload,
  DeliveryNoteResource,
  InventoryApiService,
  ProductItem,
  SalesApiService,
  SalesOrderResource,
  SalesQuoteResource,
  TranslateService,
  WarehouseItem,
  applyServerErrors,
  contactDisplayName,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-sales-orders',
  imports: [
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    MoneyPipe,
    NzCardModule,
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
    NzGridModule,
    NzDividerModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './sales-orders.component.html',
  styleUrl: './sales-orders.component.scss',
})
export class SalesOrdersComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly salesApi = inject(SalesApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal(0);
  readonly loading = signal(false);
  readonly saving = signal(false);

  // Lookups
  readonly clients = signal<ContactResource[]>([]);
  readonly products = signal<ProductItem[]>([]);
  readonly warehouses = signal<WarehouseItem[]>([]);

  // 1. Quotes
  readonly quotes = signal<SalesQuoteResource[]>([]);
  readonly quotesTotal = signal(0);
  readonly quotesPage = signal(1);
  readonly quotesPageSize = signal(10);
  readonly quoteStatusFilter = signal<string | undefined>(undefined);
  readonly quoteModalVisible = signal(false);

  readonly quoteForm = this.fb.group({
    contact_id: this.fb.control('', [Validators.required]),
    date: this.fb.control(new Date().toISOString().substring(0, 10), [Validators.required]),
    valid_until: this.fb.control(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      [Validators.required],
    ),
    currency: this.fb.control(this.authStore.activeCurrency(), [Validators.required]),
    notes: this.fb.control(''),
    items: this.fb.array([this.createItemFormGroup()]),
  });

  // 2. Orders
  readonly orders = signal<SalesOrderResource[]>([]);
  readonly ordersTotal = signal(0);
  readonly ordersPage = signal(1);
  readonly ordersPageSize = signal(10);
  readonly orderStatusFilter = signal<string | undefined>(undefined);
  readonly orderModalVisible = signal(false);

  readonly orderForm = this.fb.group({
    contact_id: this.fb.control('', [Validators.required]),
    date: this.fb.control(new Date().toISOString().substring(0, 10), [Validators.required]),
    due_date: this.fb.control(''),
    currency: this.fb.control(this.authStore.activeCurrency(), [Validators.required]),
    notes: this.fb.control(''),
    items: this.fb.array([this.createItemFormGroup()]),
  });

  // 3. Delivery Notes (DDT)
  readonly deliveryNotes = signal<DeliveryNoteResource[]>([]);
  readonly ddtTotal = signal(0);
  readonly ddtPage = signal(1);
  readonly ddtPageSize = signal(10);
  readonly ddtModalVisible = signal(false);

  readonly ddtForm = this.fb.group({
    sales_order_id: this.fb.control('', [Validators.required]),
    warehouse_id: this.fb.control<string | null>(null),
    date: this.fb.control(new Date().toISOString().substring(0, 10), [Validators.required]),
    transport_reason: this.fb.control('Vendita', [Validators.required]),
    goods_appearance: this.fb.control('A vista'),
    packages_count: this.fb.control(1, [Validators.required, Validators.min(1)]),
    gross_weight_kg: this.fb.control(0),
    carrier_name: this.fb.control(''),
    carrier_license_plate: this.fb.control(''),
    notes: this.fb.control(''),
    items: this.fb.array([this.createDdtItemFormGroup()]),
  });

  get quoteItems(): FormArray {
    return this.quoteForm.get('items') as FormArray;
  }

  get orderItems(): FormArray {
    return this.orderForm.get('items') as FormArray;
  }

  get ddtItems(): FormArray {
    return this.ddtForm.get('items') as FormArray;
  }

  ngOnInit(): void {
    this.loadLookups();
    this.loadQuotes();
  }

  contactLabel(c: ContactResource): string {
    return contactDisplayName(c);
  }

  createItemFormGroup() {
    return this.fb.group({
      product_id: this.fb.control<string | null>(null),
      description: this.fb.control('', [Validators.required]),
      quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
      unit_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
      tax_rate: this.fb.control(this.authStore.activeJurisdiction() === 'CH' ? 8.1 : 22, [
        Validators.required,
      ]),
      discount_percentage: this.fb.control(0),
    });
  }

  createDdtItemFormGroup() {
    return this.fb.group({
      sales_order_item_id: this.fb.control('line-1', [Validators.required]),
      quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
      batch_number: this.fb.control(''),
      serial_number: this.fb.control(''),
    });
  }

  addQuoteItem(): void {
    this.quoteItems.push(this.createItemFormGroup());
  }

  removeQuoteItem(index: number): void {
    if (this.quoteItems.length > 1) {
      this.quoteItems.removeAt(index);
    }
  }

  addOrderItem(): void {
    this.orderItems.push(this.createItemFormGroup());
  }

  removeOrderItem(index: number): void {
    if (this.orderItems.length > 1) {
      this.orderItems.removeAt(index);
    }
  }

  loadLookups(): void {
    this.clientApi.list({ type: 'client', page: 1, per_page: 50 }).subscribe({
      next: (res) => this.clients.set(res.data || []),
      error: () => this.clients.set([]),
    });
    this.inventoryApi.getProducts({ per_page: 50 }).subscribe({
      next: (res) => this.products.set(res.data || []),
      error: () => this.products.set([]),
    });
    this.inventoryApi.getWarehouses({ is_active: true }).subscribe({
      next: (res) => this.warehouses.set(res.data || []),
      error: () => this.warehouses.set([]),
    });
  }

  onTabChange(index: number): void {
    this.selectedTabIndex.set(index);
    switch (index) {
      case 0:
        this.loadQuotes();
        break;
      case 1:
        this.loadOrders();
        break;
      case 2:
        this.loadDeliveryNotes();
        break;
    }
  }

  // 1. Quotes methods
  loadQuotes(): void {
    this.loading.set(true);
    this.salesApi
      .getQuotes({
        status: this.quoteStatusFilter(),
        page: this.quotesPage(),
        per_page: this.quotesPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.quotes.set(res.data || []);
          this.quotesTotal.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.quotes.set([]);
          this.quotesTotal.set(0);
          this.loading.set(false);
        },
      });
  }

  onQuotesQueryParamsChange(params: NzTableQueryParams): void {
    this.quotesPage.set(params.pageIndex);
    this.quotesPageSize.set(params.pageSize);
    this.loadQuotes();
  }

  openQuoteModal(): void {
    this.quoteForm.reset({
      contact_id: this.clients()[0]?.id || '',
      date: new Date().toISOString().substring(0, 10),
      valid_until: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      currency: this.authStore.activeCurrency(),
      notes: '',
    });
    this.quoteItems.clear();
    this.quoteItems.push(this.createItemFormGroup());
    this.quoteModalVisible.set(true);
  }

  submitQuote(): void {
    if (this.quoteForm.invalid) {
      this.quoteForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.quoteForm.getRawValue();
    const payload: CreateSalesQuotePayload = {
      contact_id: formVal.contact_id,
      date: formVal.date,
      valid_until: formVal.valid_until,
      currency: formVal.currency,
      notes: formVal.notes || undefined,
      items: formVal.items.map((it) => ({
        product_id: it.product_id || undefined,
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        tax_rate: Number(it.tax_rate),
        discount_percentage: Number(it.discount_percentage || 0),
      })),
    };

    this.salesApi.createQuote(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.quoteModalVisible.set(false);
        this.message.success(this.translate.instant('sales.messages.quote_created') || 'Quote created');
        this.loadQuotes();
      },
      error: (err) => {
        this.saving.set(false);
        applyServerErrors(this.quoteForm, err);
      },
    });
  }

  submitQuoteForApproval(id: string): void {
    this.salesApi.submitQuoteForApproval(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_submitted') || 'Submitted for approval');
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  approveQuote(id: string): void {
    this.salesApi.approveQuote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_approved') || 'Quote approved');
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  rejectQuote(id: string): void {
    this.salesApi.rejectQuote(id, 'Price conditions unfeasible').subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_rejected') || 'Quote rejected');
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  acceptQuote(id: string): void {
    this.salesApi.acceptQuote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_accepted') || 'Quote marked accepted');
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  convertQuote(id: string): void {
    this.salesApi.convertQuoteToOrder(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_converted') || 'Quote converted to Order');
        this.loadQuotes();
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  // 2. Orders methods
  loadOrders(): void {
    this.loading.set(true);
    this.salesApi
      .getOrders({
        status: this.orderStatusFilter(),
        page: this.ordersPage(),
        per_page: this.ordersPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.orders.set(res.data || []);
          this.ordersTotal.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.orders.set([]);
          this.ordersTotal.set(0);
          this.loading.set(false);
        },
      });
  }

  onOrdersQueryParamsChange(params: NzTableQueryParams): void {
    this.ordersPage.set(params.pageIndex);
    this.ordersPageSize.set(params.pageSize);
    this.loadOrders();
  }

  openOrderModal(): void {
    this.orderForm.reset({
      contact_id: this.clients()[0]?.id || '',
      date: new Date().toISOString().substring(0, 10),
      due_date: '',
      currency: this.authStore.activeCurrency(),
      notes: '',
    });
    this.orderItems.clear();
    this.orderItems.push(this.createItemFormGroup());
    this.orderModalVisible.set(true);
  }

  submitOrder(): void {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.orderForm.getRawValue();
    const payload: CreateSalesOrderPayload = {
      contact_id: formVal.contact_id,
      date: formVal.date,
      due_date: formVal.due_date || undefined,
      currency: formVal.currency,
      notes: formVal.notes || undefined,
      status: 'confirmed',
      items: formVal.items.map((it) => ({
        product_id: it.product_id || undefined,
        description: it.description,
        quantity: Number(it.quantity),
        unit_price: Number(it.unit_price),
        tax_rate: Number(it.tax_rate),
        discount_percentage: Number(it.discount_percentage || 0),
      })),
    };

    this.salesApi.createOrder(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.orderModalVisible.set(false);
        this.message.success(this.translate.instant('sales.messages.order_created') || 'Order created');
        this.loadOrders();
      },
      error: (err) => {
        this.saving.set(false);
        applyServerErrors(this.orderForm, err);
      },
    });
  }

  approveOrder(id: string): void {
    this.salesApi.approveOrder(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.order_approved') || 'Order approved');
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  reserveStock(id: string): void {
    this.salesApi.reserveOrderStock(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.stock_reserved') || 'Stock reserved for order');
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  invoiceOrder(id: string): void {
    this.salesApi.invoiceOrder(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.order_invoiced') || 'Invoice generated from order');
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  cancelOrder(id: string): void {
    this.salesApi.cancelOrder(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.order_cancelled') || 'Order cancelled');
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  // 3. Delivery Notes methods
  loadDeliveryNotes(): void {
    this.loading.set(true);
    this.salesApi
      .getDeliveryNotes({
        page: this.ddtPage(),
        per_page: this.ddtPageSize(),
      })
      .subscribe({
        next: (res) => {
          this.deliveryNotes.set(res.data || []);
          this.ddtTotal.set(res.meta?.total || (res.data || []).length);
          this.loading.set(false);
        },
        error: () => {
          this.deliveryNotes.set([]);
          this.ddtTotal.set(0);
          this.loading.set(false);
        },
      });
  }

  onDdtQueryParamsChange(params: NzTableQueryParams): void {
    this.ddtPage.set(params.pageIndex);
    this.ddtPageSize.set(params.pageSize);
    this.loadDeliveryNotes();
  }

  openDdtModal(orderId?: string): void {
    const firstWh = this.warehouses()[0]?.id || null;
    const targetOrder = orderId || this.orders()[0]?.id || '';
    this.ddtForm.reset({
      sales_order_id: targetOrder,
      warehouse_id: firstWh,
      date: new Date().toISOString().substring(0, 10),
      transport_reason: 'Vendita',
      goods_appearance: 'Cartoni su pallet',
      packages_count: 1,
      gross_weight_kg: 10,
      carrier_name: 'Corriere Espresso',
      carrier_license_plate: '',
      notes: '',
    });
    this.ddtItems.clear();
    this.ddtItems.push(this.createDdtItemFormGroup());
    this.ddtModalVisible.set(true);
  }

  submitDdt(): void {
    if (this.ddtForm.invalid) {
      this.ddtForm.markAllAsTouched();
      return;
    }

    this.saving.set(true);
    const formVal = this.ddtForm.getRawValue();
    const payload: CreateDeliveryNotePayload = {
      sales_order_id: formVal.sales_order_id,
      warehouse_id: formVal.warehouse_id,
      date: formVal.date,
      transport_reason: formVal.transport_reason,
      goods_appearance: formVal.goods_appearance || undefined,
      packages_count: Number(formVal.packages_count),
      gross_weight_kg: Number(formVal.gross_weight_kg || 0),
      carrier_name: formVal.carrier_name || undefined,
      carrier_license_plate: formVal.carrier_license_plate || undefined,
      notes: formVal.notes || undefined,
      items: formVal.items.map((it) => ({
        sales_order_item_id: it.sales_order_item_id,
        quantity: Number(it.quantity),
        batch_number: it.batch_number || undefined,
        serial_number: it.serial_number || undefined,
      })),
    };

    this.salesApi.createDeliveryNote(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.ddtModalVisible.set(false);
        this.message.success(this.translate.instant('sales.messages.ddt_created') || 'Delivery note created');
        this.loadDeliveryNotes();
      },
      error: (err) => {
        this.saving.set(false);
        applyServerErrors(this.ddtForm, err);
      },
    });
  }

  dispatchDdt(id: string): void {
    this.salesApi.dispatchDeliveryNote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.ddt_dispatched') || 'DDT dispatched');
        this.loadDeliveryNotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  confirmDdt(id: string): void {
    this.salesApi.confirmDeliveryNote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.ddt_confirmed') || 'Delivery confirmed');
        this.loadDeliveryNotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }

  invoiceDdt(id: string): void {
    this.salesApi.invoiceDeliveryNote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.ddt_invoiced') || 'Invoice generated from DDT');
        this.loadDeliveryNotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') || 'Operation failed'),
    });
  }
}
