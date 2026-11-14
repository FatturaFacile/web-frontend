import { DatePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
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
  FetchGridModel,
  I18nService,
  InventoryApiService,
  QueryFilterParams,
  ProductItem,
  SalesApiService,
  SalesOrderResource,
  SalesQuoteResource,
  TranslateService,
  WarehouseItem,
  applyServerErrors,
  contactDisplayName,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

/** Filters of the legacy invoicing lists (on top of the grid ones). */
type StatusFilterParams = QueryFilterParams & { status?: string };

/** Translation keys of the statuses shown by the quote, order and delivery note tabs. */
const QUOTE_STATUS_KEYS: Readonly<Record<string, string>> = {
  draft: 'SALES.LBL_BOZZA',
  pending_approval: 'SALES.LBL_IN_APPROVAZIONE',
  approved: 'SALES.LBL_APPROVATO',
  rejected: 'SALES.LBL_RIFIUTATO',
  accepted: 'SALES.LBL_ACCETTATO',
  converted: 'SALES.LBL_CONVERTITO',
};
const ORDER_STATUS_KEYS: Readonly<Record<string, string>> = {
  draft: 'SALES.LBL_BOZZA',
  confirmed: 'SALES.LBL_CONFERMATO',
  approved: 'SALES.LBL_APPROVATO',
  shipped: 'SALES.LBL_SPEDITO',
  completed: 'SALES.LBL_COMPLETATO',
  cancelled: 'SALES.LBL_ANNULLATO',
};
const DDT_STATUS_KEYS: Readonly<Record<string, string>> = {
  draft: 'SALES.LBL_BOZZA',
  dispatched: 'SALES.LBL_SPEDITO',
  confirmed: 'SALES.LBL_CONSEGNATO',
  invoiced: 'SALES.LBL_FATTURATO',
};

@Component({
  selector: 'app-sales-orders',
  styleUrl: './sales-orders.component.scss',
  imports: [
    BaseTableComponent,
    ModalActionsDirective,
    IconActionDirective,
    ReactiveFormsModule,
    FormsModule,
    DatePipe,
    MoneyPipe,
    NzCardModule,
    NzTabsModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzPopconfirmModule,
    NzIconModule,
    NzGridModule,
    NzDividerModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './sales-orders.component.html',
})
export class SalesOrdersComponent implements OnInit {
  protected readonly authStore = inject(AuthStore);
  private readonly salesApi = inject(SalesApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly inventoryApi = inject(InventoryApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly selectedTabIndex = signal(0);
  readonly saving = signal(false);

  // Lookups
  readonly clients = signal<ContactResource[]>([]);
  readonly products = signal<ProductItem[]>([]);
  readonly warehouses = signal<WarehouseItem[]>([]);

  // 1. Quotes
  readonly quoteGrid = new FetchGridModel<SalesQuoteResource, StatusFilterParams>((query) =>
    this.salesApi.getQuotes(query),
  );
  readonly quotes = this.quoteGrid.items;
  readonly quoteModalVisible = signal(false);

  readonly quoteForm = this.fb.group({
    contact_id: this.fb.control('', [Validators.required]),
    date: this.fb.control(new Date().toISOString().substring(0, 10), [Validators.required]),
    valid_until: this.fb.control(
      new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10),
      endsNotBefore('date', { dateOnly: true }),
    ),
    currency: this.fb.control(this.authStore.activeCurrency(), [Validators.required]),
    notes: this.fb.control(''),
    items: this.fb.array([this.createItemFormGroup()]),
  });

  // 2. Orders
  readonly orderGrid = new FetchGridModel<SalesOrderResource, StatusFilterParams>((query) =>
    this.salesApi.getOrders(query),
  );
  readonly orders = this.orderGrid.items;
  readonly orderModalVisible = signal(false);

  readonly orderForm = this.fb.group({
    contact_id: this.fb.control('', [Validators.required]),
    date: this.fb.control(new Date().toISOString().substring(0, 10), [Validators.required]),
    due_date: this.fb.control('', endsNotBefore('date', { dateOnly: true })),
    currency: this.fb.control(this.authStore.activeCurrency(), [Validators.required]),
    notes: this.fb.control(''),
    items: this.fb.array([this.createItemFormGroup()]),
  });

  // 3. Delivery Notes (DDT)
  readonly ddtGrid = new FetchGridModel<DeliveryNoteResource, StatusFilterParams>((query) =>
    this.salesApi.getDeliveryNotes(query),
  );
  readonly deliveryNotes = this.ddtGrid.items;
  readonly ddtModalVisible = signal(false);

  readonly ddtForm = this.fb.group({
    sales_order_id: this.fb.control('', [Validators.required]),
    warehouse_id: this.fb.control<string | null>(null),
    date: this.fb.control(new Date().toISOString().substring(0, 10)),
    transport_reason: this.fb.control('Vendita'),
    goods_appearance: this.fb.control('A vista'),
    packages_count: this.fb.control<number | null>(1, [Validators.min(1)]),
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

  constructor() {
    // The API requires valid_until / due_date on or after the document date (after_or_equal:date).
    const destroyRef = inject(DestroyRef);
    revalidateOnStartChange(this.quoteForm, 'date', 'valid_until', destroyRef);
    revalidateOnStartChange(this.orderForm, 'date', 'due_date', destroyRef);
  }

  private readonly quoteNumberTpl = viewChild<TemplateRef<unknown>>('quoteNumberTpl');
  private readonly orderNumberTpl = viewChild<TemplateRef<unknown>>('orderNumberTpl');
  private readonly ddtNumberTpl = viewChild<TemplateRef<unknown>>('ddtNumberTpl');
  private readonly clientTpl = viewChild<TemplateRef<unknown>>('clientTpl');
  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly validUntilTpl = viewChild<TemplateRef<unknown>>('validUntilTpl');
  private readonly dueDateTpl = viewChild<TemplateRef<unknown>>('dueDateTpl');
  private readonly totalNetTpl = viewChild<TemplateRef<unknown>>('totalNetTpl');
  private readonly totalTaxTpl = viewChild<TemplateRef<unknown>>('totalTaxTpl');
  private readonly totalGrossTpl = viewChild<TemplateRef<unknown>>('totalGrossTpl');
  private readonly quoteStatusTpl = viewChild<TemplateRef<unknown>>('quoteStatusTpl');
  private readonly orderStatusTpl = viewChild<TemplateRef<unknown>>('orderStatusTpl');
  private readonly ddtStatusTpl = viewChild<TemplateRef<unknown>>('ddtStatusTpl');
  private readonly inventoryTpl = viewChild<TemplateRef<unknown>>('inventoryTpl');
  private readonly reasonTpl = viewChild<TemplateRef<unknown>>('reasonTpl');
  private readonly weightTpl = viewChild<TemplateRef<unknown>>('weightTpl');

  /** Label of a raw status value: the translation of its key, or the value itself when the status is unknown. */
  private statusLabel(keys: Readonly<Record<string, string>>, value: string | null | undefined): string {
    const key = keys[value ?? 'draft'];
    return key ? this.i18n.translate(key) : (value ?? '');
  }

  protected readonly quoteColumns = computed<TableColumnDef<SalesQuoteResource>[]>(() => {
    this.i18n.currentLanguage();
    const label = (value: string | null | undefined) => this.statusLabel(QUOTE_STATUS_KEYS, value);
    return [
      { key: 'quote_number', header: this.i18n.translate('SALES.COL_QUOTE_NUM'), customCellTemplate: this.quoteNumberTpl() },
      { key: 'contact', serverKey: 'customer.name', valueGetter: (row) => row.contact?.name ?? row.contact_id, header: this.i18n.translate('SALES.COL_CLIENT'), customCellTemplate: this.clientTpl() },
      { key: 'date', header: this.i18n.translate('SALES.COL_DATE'), customCellTemplate: this.dateTpl() },
      { key: 'valid_until', header: this.i18n.translate('SALES.COL_VALID_UNTIL'), customCellTemplate: this.validUntilTpl() },
      { key: 'total_net', header: this.i18n.translate('SALES.COL_TOTAL_NET'), align: 'right', customCellTemplate: this.totalNetTpl() },
      { key: 'total_tax', header: this.i18n.translate('SALES.COL_TOTAL_TAX'), align: 'right', customCellTemplate: this.totalTaxTpl() },
      { key: 'total_gross', header: this.i18n.translate('SALES.COL_TOTAL_GROSS'), align: 'right', customCellTemplate: this.totalGrossTpl() },
      { key: 'status', valueGetter: (row) => label(row.status), valueLabel: label, header: this.i18n.translate('COMMON.STATUS'), align: 'center', customCellTemplate: this.quoteStatusTpl() },
    ];
  });

  protected readonly orderColumns = computed<TableColumnDef<SalesOrderResource>[]>(() => {
    this.i18n.currentLanguage();
    const label = (value: string | null | undefined) => this.statusLabel(ORDER_STATUS_KEYS, value);
    const inventoryLabel = (value: string | null | undefined) => this.i18n.translate(`SC.STATUS.${value ?? 'unknown'}`);
    return [
      { key: 'order_number', header: this.i18n.translate('SALES.COL_ORDER_NUM'), customCellTemplate: this.orderNumberTpl() },
      { key: 'contact', serverKey: 'customer.name', valueGetter: (row) => row.contact?.name ?? row.contact_id, header: this.i18n.translate('SALES.COL_CLIENT'), customCellTemplate: this.clientTpl() },
      { key: 'date', header: this.i18n.translate('SALES.COL_DATE'), customCellTemplate: this.dateTpl() },
      { key: 'due_date', header: this.i18n.translate('SALES.COL_DUE_DATE'), customCellTemplate: this.dueDateTpl() },
      { key: 'total_net', header: this.i18n.translate('SALES.COL_TOTAL_NET'), align: 'right', customCellTemplate: this.totalNetTpl() },
      { key: 'total_gross', header: this.i18n.translate('SALES.COL_TOTAL_GROSS'), align: 'right', customCellTemplate: this.totalGrossTpl() },
      { key: 'inventory_status', valueGetter: (row) => inventoryLabel(row.inventory_status), valueLabel: inventoryLabel, header: this.i18n.translate('SALES.LBL_STOCK'), align: 'center', customCellTemplate: this.inventoryTpl() },
      { key: 'status', valueGetter: (row) => label(row.status), valueLabel: label, header: this.i18n.translate('COMMON.STATUS'), align: 'center', customCellTemplate: this.orderStatusTpl() },
    ];
  });

  protected readonly ddtColumns = computed<TableColumnDef<DeliveryNoteResource>[]>(() => {
    this.i18n.currentLanguage();
    const label = (value: string | null | undefined) => this.statusLabel(DDT_STATUS_KEYS, value);
    return [
      { key: 'ddt_number', header: this.i18n.translate('SALES.COL_DDT_NUM'), customCellTemplate: this.ddtNumberTpl() },
      { key: 'contact', serverKey: 'customer.name', valueGetter: (row) => row.contact?.name ?? row.contact_id, header: this.i18n.translate('SALES.COL_CLIENT'), customCellTemplate: this.clientTpl() },
      { key: 'date', header: this.i18n.translate('SALES.COL_DATE'), customCellTemplate: this.dateTpl() },
      { key: 'transport_reason', header: this.i18n.translate('SALES.COL_REASON'), customCellTemplate: this.reasonTpl() },
      { key: 'packages_count', header: this.i18n.translate('SALES.COL_PACKAGES'), align: 'right' },
      { key: 'gross_weight_kg', header: this.i18n.translate('SALES.COL_WEIGHT'), align: 'right', customCellTemplate: this.weightTpl() },
      { key: 'carrier_name', header: this.i18n.translate('SALES.COL_CARRIER') },
      { key: 'status', valueGetter: (row) => label(row.status), valueLabel: label, header: this.i18n.translate('COMMON.STATUS'), align: 'center', customCellTemplate: this.ddtStatusTpl() },
    ];
  });

  ngOnInit(): void {
    this.loadLookups();
  }

  contactLabel(c: ContactResource): string {
    return contactDisplayName(c);
  }

  createItemFormGroup() {
    return this.fb.group({
      product_id: this.fb.control<string | null>(null),
      description: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
      quantity: this.fb.control(1, [Validators.required, Validators.min(0.0001)]),
      unit_price: this.fb.control(0, [Validators.required, Validators.min(0)]),
      tax_rate: this.fb.control(this.authStore.activeJurisdiction() === 'CH' ? 8.1 : 22, [
        Validators.required,
        Validators.min(0),
        Validators.max(100),
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
    this.quoteGrid.reload();
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
      date: formVal.date || undefined,
      valid_until: formVal.valid_until || undefined,
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
        this.message.success(this.translate.instant('sales.messages.quote_created') );
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
        this.message.success(this.translate.instant('sales.messages.quote_submitted') );
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  approveQuote(id: string): void {
    this.salesApi.approveQuote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_approved') );
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  rejectQuote(id: string): void {
    this.salesApi.rejectQuote(id, 'Price conditions unfeasible').subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_rejected') );
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  acceptQuote(id: string): void {
    this.salesApi.acceptQuote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_accepted') );
        this.loadQuotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  convertQuote(id: string): void {
    this.salesApi.convertQuoteToOrder(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.quote_converted') );
        this.loadQuotes();
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  // 2. Orders methods
  loadOrders(): void {
    this.orderGrid.reload();
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
        this.message.success(this.translate.instant('sales.messages.order_created') );
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
        this.message.success(this.translate.instant('sales.messages.order_approved') );
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  reserveStock(id: string): void {
    this.salesApi.reserveOrderStock(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.stock_reserved') );
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  invoiceOrder(id: string): void {
    this.salesApi.invoiceOrder(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.order_invoiced') );
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  cancelOrder(id: string): void {
    this.salesApi.cancelOrder(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.order_cancelled') );
        this.loadOrders();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  // 3. Delivery Notes methods
  loadDeliveryNotes(): void {
    this.ddtGrid.reload();
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
      date: formVal.date || undefined,
      transport_reason: formVal.transport_reason || undefined,
      goods_appearance: formVal.goods_appearance || undefined,
      packages_count: formVal.packages_count ? Number(formVal.packages_count) : undefined,
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
        this.message.success(this.translate.instant('sales.messages.ddt_created') );
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
        this.message.success(this.translate.instant('sales.messages.ddt_dispatched') );
        this.loadDeliveryNotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  confirmDdt(id: string): void {
    this.salesApi.confirmDeliveryNote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.ddt_confirmed') );
        this.loadDeliveryNotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }

  invoiceDdt(id: string): void {
    this.salesApi.invoiceDeliveryNote(id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('sales.messages.ddt_invoiced') );
        this.loadDeliveryNotes();
      },
      error: () => this.message.error(this.translate.instant('common.errors.generic') ),
    });
  }
}
