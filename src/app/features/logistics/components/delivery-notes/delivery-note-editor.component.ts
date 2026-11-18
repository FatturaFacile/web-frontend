import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { Subject, debounceTime, merge, switchMap } from 'rxjs';
import {
  applyServerErrors,
  AuthStore,
  CARRIAGE_TERMS,
  DELIVERY_NOTE_TYPES,
  DeliveryNotePayload,
  DeliveryNoteType,
  I18nService,
  INCOTERMS,
  isCrossBorder,
  LogisticsApiService,
  LookupPartner,
  LookupProduct,
  LookupWarehouse,
  OpenOrder,
  TRANSPORT_BY,
  TRANSPORT_REASONS,
  TransportReason,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { carriageKey, ddtTypeKey, reasonKey, transportByKey } from '../../logistics.ui';

/** Types that need a commercial counterparty on the document (mirrors DeliveryNoteType::requiresCustomer()). */
const CUSTOMER_TYPES: readonly DeliveryNoteType[] = ['outbound_sale', 'return_from_customer'];

const DEFAULT_REASON: Record<DeliveryNoteType, TransportReason> = {
  outbound_sale: 'sale',
  internal_transfer: 'internal_transfer',
  subcontracting_out: 'subcontracting',
  subcontracting_return: 'subcontracting',
  customer_consignment: 'consignment',
  vendor_consignment_return: 'consignment',
  return_from_customer: 'return',
};

@Component({
  selector: 'app-delivery-note-editor',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStepsModule,
    NzSwitchModule,
    NzTableModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './delivery-note-editor.component.html',
  styleUrl: './delivery-note-editor.component.scss',
})
export class DeliveryNoteEditorComponent implements OnInit {
  private readonly fb = inject(FormBuilder).nonNullable;
  private readonly api = inject(LogisticsApiService);
  private readonly authStore = inject(AuthStore);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly editingId = signal<string | null>(null);
  protected readonly step = signal(0);
  protected readonly mode = signal<'standalone' | 'from_orders'>('standalone');
  protected readonly saving = signal(false);
  protected readonly loading = signal(false);

  protected readonly partners = signal<LookupPartner[]>([]);
  protected readonly warehouses = signal<LookupWarehouse[]>([]);
  protected readonly products = signal<LookupProduct[]>([]);
  protected readonly openOrders = signal<OpenOrder[]>([]);
  /** quantity chosen per open-order line (sales_order_item_id -> qty); 0/absent = not shipped */
  protected readonly orderQuantities = signal<Record<string, number>>({});

  /** bumped on every form change so computed signals depending on form values re-evaluate */
  private readonly formTick = signal(0);

  private readonly partnerSearch$ = new Subject<string>();
  private readonly productSearch$ = new Subject<string>();

  protected readonly header = this.fb.group({
    type: this.fb.control<DeliveryNoteType>('outbound_sale', Validators.required),
    transport_reason_code: this.fb.control<TransportReason>('sale'),
    date: this.fb.control<Date>(new Date(), Validators.required),
    contact_id: this.fb.control<string | null>(null),
    supplier_id: this.fb.control<string | null>(null),
    origin_warehouse_id: this.fb.control<string | null>(null),
    destination_warehouse_id: this.fb.control<string | null>(null),
    currency: this.fb.control('EUR'),
  });

  protected readonly logistics = this.fb.group({
    transport_by: this.fb.control<string | null>('carrier'),
    carriage_terms: this.fb.control<string | null>('free'),
    carrier_name: this.fb.control<string | null>(null),
    carrier_vat_number: this.fb.control<string | null>(null),
    carrier_license_plate: this.fb.control<string | null>(null),
    departure_time: this.fb.control<Date | null>(null),
    goods_appearance: this.fb.control<string | null>(null),
    packages_count: this.fb.control<number | null>(1),
    gross_weight_kg: this.fb.control<number | null>(null),
    net_weight_kg: this.fb.control<number | null>(null),
    volume_m3: this.fb.control<number | null>(null),
    incoterms: this.fb.control<string | null>(null),
    tracking_number: this.fb.control<string | null>(null),
    awb_number: this.fb.control<string | null>(null),
    shipment_flow: this.fb.control<'direct' | 'triangular' | 'dropshipping'>('direct'),
    sender_display: this.fb.control<'company' | 'blank' | 'custom'>('company'),
    sender_name: this.fb.control<string | null>(null),
    sender_address: this.fb.control<string | null>(null),
    final_recipient_name: this.fb.control<string | null>(null),
    notes: this.fb.control<string | null>(null),
    show_prices: this.fb.control(false),
  });

  protected readonly lines = this.fb.array([this.newLine()]);

  protected readonly typeOptions = computed(() =>
    DELIVERY_NOTE_TYPES.map((value) => ({ value, label: this.i18n.translate(ddtTypeKey(value)) })),
  );
  protected readonly reasonOptions = computed(() =>
    TRANSPORT_REASONS.map((value) => ({ value, label: this.i18n.translate(reasonKey(value)) })),
  );
  protected readonly modeOptions = computed(() => [
    { value: 'standalone', label: this.i18n.translate('LOGISTICS.WIZARD.MODE_STANDALONE') },
    { value: 'from_orders', label: this.i18n.translate('LOGISTICS.DDT.FROM_ORDER') },
  ]);
  protected readonly carriageOptions = computed(() =>
    CARRIAGE_TERMS.map((value) => ({ value, label: this.i18n.translate(carriageKey(value)) })),
  );
  protected readonly transportByOptions = computed(() =>
    TRANSPORT_BY.map((value) => ({ value, label: this.i18n.translate(transportByKey(value)) })),
  );
  protected readonly incotermOptions = INCOTERMS.map((value) => ({ value, label: value }));
  private readonly selectedContact = toSignal(this.header.controls.contact_id.valueChanges, {
    initialValue: this.header.controls.contact_id.value,
  });
  /** The counterparty is in another country than the company: Incoterm and customs data are mandatory. */
  protected readonly crossBorder = computed(() => {
    const partner = this.partners().find((p) => p.id === this.selectedContact());
    return isCrossBorder(this.authStore.activeJurisdiction(), partner?.country);
  });
  protected readonly partnerOptions = computed(() =>
    this.partners().map((p) => ({
      value: p.id,
      label: p.company_name ?? ([p.first_name, p.last_name].filter(Boolean).join(' ') || p.id),
    })),
  );
  protected readonly warehouseOptions = computed(() =>
    this.warehouses().map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
  );
  protected readonly productOptions = computed(() =>
    this.products().map((p) => ({ value: p.id, label: `${p.sku} — ${p.name}` })),
  );

  protected readonly selectedCustomerOrders = computed(() => {
    this.formTick();
    const contactId = this.header.controls.contact_id.value;
    return this.openOrders().filter((o) => !contactId || o.contact_id === contactId);
  });

  protected readonly needsCustomer = computed(() => CUSTOMER_TYPES.includes(this.currentType()));
  protected readonly currentType = signal<DeliveryNoteType>('outbound_sale');
  protected readonly isEditing = computed(() => this.editingId() !== null);
  protected readonly stepValid = computed(() => this.validateStep(this.step()));

  ngOnInit(): void {
    this.partnerSearch$
      .pipe(
        debounceTime(250),
        switchMap((q) => this.api.partners(q)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.partners.set(res.data));
    this.productSearch$
      .pipe(
        debounceTime(250),
        switchMap((q) => this.api.products(q)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((res) => this.products.set(res.data));

    this.api.partners().subscribe((res) => this.partners.set(res.data));
    this.api.products().subscribe((res) => this.products.set(res.data));
    this.api.warehouses().subscribe((res) => this.warehouses.set(res.data));

    this.header.controls.type.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((type) => {
        this.currentType.set(type);
        this.header.controls.transport_reason_code.setValue(DEFAULT_REASON[type]);
        if (type !== 'outbound_sale') {
          this.mode.set('standalone');
        }
      });

    this.lines.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.recalculate());
    // Reactive-form values are not signals: bump the tick so computed validity / order lists re-evaluate.
    merge(this.header.valueChanges, this.logistics.valueChanges)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.formTick.update((n) => n + 1));

    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.editingId.set(id);
      this.load(id);
    }
  }

  protected typeKeyOf(type: DeliveryNoteType): string {
    return ddtTypeKey(type);
  }

  protected reasonKeyOf(reason: TransportReason): string {
    return reasonKey(reason);
  }

  protected selectedOrderLines(): number {
    return Object.values(this.orderQuantities()).filter((q) => q > 0).length;
  }

  protected searchPartners(query: string): void {
    this.partnerSearch$.next(query);
  }

  protected searchProducts(query: string): void {
    this.productSearch$.next(query);
  }

  protected onCustomerChange(): void {
    if (this.mode() === 'from_orders') {
      this.loadOpenOrders();
    }
  }

  protected setMode(mode: 'standalone' | 'from_orders'): void {
    this.mode.set(mode);
    if (mode === 'from_orders') {
      this.header.controls.type.setValue('outbound_sale');
      this.loadOpenOrders();
    }
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 1) {
      this.lines.removeAt(index);
    }
  }

  protected onProductPicked(index: number, productId: string | null): void {
    const product = this.products().find((p) => p.id === productId);
    if (!product) return;
    const line = this.lines.at(index);
    line.patchValue({
      description: product.name,
      unit_price: Number(product.sale_price),
      tax_rate: Number(product.tax_rate),
    });
  }

  protected setOrderQuantity(itemId: string, qty: number | null): void {
    this.orderQuantities.update((current) => ({ ...current, [itemId]: qty ?? 0 }));
    this.formTick.update((n) => n + 1);
  }

  protected orderQuantity(itemId: string): number {
    return this.orderQuantities()[itemId] ?? 0;
  }

  protected shipAllRemaining(order: OpenOrder): void {
    this.orderQuantities.update((current) => {
      const next = { ...current };
      for (const item of order.items) {
        next[item.id] = item.remaining;
      }
      return next;
    });
  }

  protected next(): void {
    if (this.stepValid()) {
      this.step.update((s) => Math.min(3, s + 1));
    }
  }

  protected previous(): void {
    this.step.update((s) => Math.max(0, s - 1));
  }

  protected save(): void {
    this.saving.set(true);
    const request$ =
      this.mode() === 'from_orders'
        ? this.api.createDeliveryNoteFromOrders({
            ...this.sharedPayload(),
            orders: this.orderSelection(),
          })
        : this.editingId()
          ? this.api.updateDeliveryNote(this.editingId() as string, this.standalonePayload())
          : this.api.createDeliveryNote(this.standalonePayload());

    request$.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('LOGISTICS.DDT.MESSAGES.SAVED'));
        void this.router.navigate(['/logistics/delivery-notes']);
      },
      error: (err) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.header, err);
        const apiMessage = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(
          unmapped[0] ?? apiMessage ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'),
        );
      },
    });
  }

  /** Suggests net/gross weight (sum of qty x unit weight) and packages (one per line) unless the user typed them. */
  private recalculate(): void {
    const net = this.lines.controls.reduce(
      (sum, line) =>
        sum +
        Number(line.controls.quantity.value ?? 0) * Number(line.controls.unit_weight_kg.value ?? 0),
      0,
    );
    const rounded = Math.round(net * 100) / 100;
    const { net_weight_kg, gross_weight_kg, packages_count } = this.logistics.controls;
    if (!net_weight_kg.dirty && rounded > 0) {
      net_weight_kg.setValue(rounded, { emitEvent: false });
    }
    if (!gross_weight_kg.dirty && rounded > 0) {
      gross_weight_kg.setValue(rounded, { emitEvent: false });
    }
    if (!packages_count.dirty) {
      packages_count.setValue(
        Math.max(
          1,
          this.lines.controls.filter((l) => Number(l.controls.quantity.value) > 0).length,
        ),
        {
          emitEvent: false,
        },
      );
    }
    this.formTick.update((n) => n + 1);
  }

  private validateStep(step: number): boolean {
    this.formTick();
    const h = this.header.getRawValue();
    if (step === 0) {
      if (!h.type || !h.date) return false;
      if (CUSTOMER_TYPES.includes(h.type)) return !!h.contact_id;
      return !!(h.contact_id || h.supplier_id || h.destination_warehouse_id);
    }
    if (step === 1) {
      if (this.mode() === 'from_orders') {
        return Object.values(this.orderQuantities()).some((q) => q > 0);
      }
      return this.lines.controls.every(
        (l) => l.controls.description.value.trim() !== '' && Number(l.controls.quantity.value) > 0,
      );
    }
    return true;
  }

  private orderSelection() {
    const quantities = this.orderQuantities();
    return this.openOrders()
      .map((order) => ({
        sales_order_id: order.id,
        items: order.items
          .filter((item) => (quantities[item.id] ?? 0) > 0)
          .map((item) => ({ sales_order_item_id: item.id, quantity: quantities[item.id] })),
      }))
      .filter((entry) => entry.items.length > 0);
  }

  private sharedPayload() {
    const h = this.header.getRawValue();
    const l = this.logistics.getRawValue();
    const iso = (d: Date | null): string | undefined => (d ? d.toISOString() : undefined);

    return {
      contact_id: h.contact_id,
      supplier_id: h.supplier_id,
      origin_warehouse_id: h.origin_warehouse_id,
      destination_warehouse_id: h.destination_warehouse_id,
      date: h.date.toISOString().slice(0, 10),
      transport_reason_code: h.transport_reason_code,
      currency: h.currency,
      transport_by: l.transport_by as DeliveryNotePayload['transport_by'],
      carriage_terms: l.carriage_terms as DeliveryNotePayload['carriage_terms'],
      carrier_name: l.carrier_name,
      carrier_vat_number: l.carrier_vat_number,
      carrier_license_plate: l.carrier_license_plate,
      departure_time: iso(l.departure_time) ?? null,
      goods_appearance: l.goods_appearance,
      packages_count: l.packages_count,
      gross_weight_kg: l.gross_weight_kg,
      net_weight_kg: l.net_weight_kg,
      volume_m3: l.volume_m3,
      incoterms: l.incoterms,
      tracking_number: l.tracking_number,
      awb_number: l.awb_number,
      shipment_flow: l.shipment_flow,
      sender_display: l.sender_display,
      sender_name: l.sender_name,
      sender_address: l.sender_address,
      final_recipient_name: l.final_recipient_name,
      notes: l.notes,
      show_prices: l.show_prices,
    };
  }

  private standalonePayload(): DeliveryNotePayload {
    return {
      ...this.sharedPayload(),
      type: this.header.controls.type.value,
      items: this.lines.controls.map((line) => ({
        product_id: line.controls.product_id.value,
        description: line.controls.description.value,
        quantity: Number(line.controls.quantity.value),
        unit_price: Number(line.controls.unit_price.value ?? 0),
        tax_rate: Number(line.controls.tax_rate.value ?? 0),
      })),
    };
  }

  private loadOpenOrders(): void {
    this.api.openOrders(this.header.controls.contact_id.value ?? undefined).subscribe((res) => {
      this.openOrders.set(res.data);
      this.orderQuantities.set({});
    });
  }

  private load(id: string): void {
    this.loading.set(true);
    this.api.getDeliveryNote(id).subscribe({
      next: (res) => {
        const note = res.data;
        this.header.patchValue({
          type: note.type,
          transport_reason_code: note.transport_reason_code ?? DEFAULT_REASON[note.type],
          date: new Date(note.date),
          contact_id: note.contact_id,
          supplier_id: note.supplier_id,
          origin_warehouse_id: note.origin_warehouse_id,
          destination_warehouse_id: note.destination_warehouse_id,
          currency: note.currency,
        });
        this.currentType.set(note.type);
        this.logistics.patchValue({
          transport_by: note.transport_by,
          carriage_terms: note.carriage_terms,
          carrier_name: note.carrier_name,
          carrier_vat_number: note.carrier_vat_number,
          carrier_license_plate: note.carrier_license_plate,
          departure_time: note.departure_time ? new Date(note.departure_time) : null,
          goods_appearance: note.goods_appearance,
          packages_count: note.packages_count,
          gross_weight_kg: note.gross_weight_kg !== null ? Number(note.gross_weight_kg) : null,
          net_weight_kg: note.net_weight_kg !== null ? Number(note.net_weight_kg) : null,
          volume_m3: note.volume_m3 !== null ? Number(note.volume_m3) : null,
          incoterms: note.incoterms,
          tracking_number: note.tracking_number,
          awb_number: note.awb_number ?? null,
          shipment_flow: note.shipment_flow ?? 'direct',
          sender_display: note.sender_display ?? 'company',
          sender_name: note.sender_name ?? null,
          sender_address: note.sender_address ?? null,
          final_recipient_name: note.final_recipient_name ?? null,
          notes: note.notes,
          show_prices: note.show_prices,
        });
        this.lines.clear();
        for (const item of note.items ?? []) {
          const group = this.newLine();
          group.patchValue({
            product_id: item.product_id,
            description: item.description,
            quantity: Number(item.quantity),
            unit_price: Number(item.unit_price),
            tax_rate: Number(item.tax_rate),
          });
          this.lines.push(group);
        }
        if (this.lines.length === 0) {
          this.lines.push(this.newLine());
        }
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
      },
    });
  }

  private newLine() {
    return this.fb.group({
      product_id: this.fb.control<string | null>(null),
      description: this.fb.control('', Validators.required),
      quantity: this.fb.control<number>(1, [Validators.required, Validators.min(0.0001)]),
      unit_price: this.fb.control<number | null>(0),
      tax_rate: this.fb.control<number | null>(22),
      /** frontend-only: drives the weight suggestion, never sent to the API */
      unit_weight_kg: this.fb.control<number | null>(null),
    });
  }
}
