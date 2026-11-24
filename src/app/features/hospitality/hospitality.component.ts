import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FetchGridModel,
  HospitalityApiService,
  HospitalityKitchenTicket,
  HospitalityOrder,
  HospitalityOrderItem,
  HospitalityOrderRequest,
  HospitalityOrderStatus,
  HospitalityPaymentMethod,
  HospitalityPaymentRequest,
  HospitalityTableShape,
  HospitalityReservation,
  HospitalityReservationRequest,
  HospitalityRoom,
  HospitalityRoomRequest,
  HospitalityTable,
  HospitalityTableRequest,
  HospitalityTableStatus,
  KitchenTicketStatus,
  RetailApiService,
  RetailPosSession,
  TranslateService,
} from '@core';
import { BaseTableComponent, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { positiveNumber } from '@shared/utils/decimal-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { validationTipKey } from '@shared/utils/validation-tip';

@Component({
  selector: 'app-hospitality',
  styleUrl: './hospitality.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    DatePipe,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
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
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './hospitality.component.html',
})
export class HospitalityComponent implements OnInit {
  private readonly api = inject(HospitalityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly retailApi = inject(RetailApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly selectedTabIndex = signal<number>(0);

  // --- TAB 1: ROOMS & TABLES ---
  readonly rooms = signal<HospitalityRoom[]>([]);
  readonly selectedRoomId = signal<string>('');
  readonly tables = signal<HospitalityTable[]>([]);
  readonly tablesLoading = signal<boolean>(false);

  // --- TAB 2: ACTIVE ORDERS ---
  readonly orders = signal<HospitalityOrder[]>([]);
  readonly ordersLoading = signal<boolean>(false);
  readonly filterOrderStatus = signal<string>('');

  // Drawer details
  readonly drawerVisible = signal<boolean>(false);
  readonly selectedOrder = signal<HospitalityOrder | null>(null);
  readonly orderItems = signal<HospitalityOrderItem[]>([]);
  readonly drawerLoading = signal<boolean>(false);

  // --- TAB 3: KITCHEN TICKETS (KDS) ---
  readonly kitchenTickets = signal<HospitalityKitchenTicket[]>([]);
  readonly ticketsLoading = signal<boolean>(false);

  // --- TAB 4: RESERVATIONS ---
  readonly reservationsGrid = new FetchGridModel<HospitalityReservation, { date: string; page?: number; per_page?: number; search?: string }>(
    (query) => this.api.getReservations(query),
  );
  readonly reservations = this.reservationsGrid.items;
  /** Day shown in the reservations tab (Y-m-d): the API lists one day at a time. */
  readonly reservationDate = signal<string>(new Date().toLocaleDateString('en-CA'));
  readonly openPosSessions = signal<RetailPosSession[]>([]);

  // Derived metrics
  readonly totalActiveCovers = computed(() =>
    this.orders()
      .filter((o) => o.status === 'open' || o.status === 'fired')
      .reduce((acc, o) => acc + (o.covers || 0), 0),
  );

  readonly totalActiveRevenue = computed(() =>
    this.orders()
      .filter((o) => o.status === 'open' || o.status === 'fired')
      .reduce((acc, o) => acc + (parseFloat(o.total_amount) || 0), 0),
  );

  // Modals visibility
  readonly roomModalVisible = signal<boolean>(false);
  readonly tableModalVisible = signal<boolean>(false);
  readonly orderModalVisible = signal<boolean>(false);
  readonly addItemModalVisible = signal<boolean>(false);
  readonly moveOrderModalVisible = signal<boolean>(false);
  readonly payModalVisible = signal<boolean>(false);
  readonly reservationModalVisible = signal<boolean>(false);

  // --- FORMS ---
  readonly roomForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(100)]],
    sort_order: [1, [Validators.min(0)]],
    width: [1000],
    height: [600],
  });

  readonly tableForm = this.fb.group({
    room_id: ['', [Validators.required]],
    name: ['', [Validators.required, Validators.maxLength(30)]],
    seats: [4, [Validators.required, Validators.min(1), Validators.max(100)]],
    shape: ['rectangle' as HospitalityTableShape, [Validators.required]],
  });

  readonly orderForm = this.fb.group({
    table_id: ['', [Validators.required]],
    covers: [2, [Validators.required, Validators.min(1), Validators.max(100)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly addItemForm = this.fb.group({
    description: ['', [Validators.required, Validators.maxLength(255)]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit_price: ['12.00', [Validators.required, Validators.pattern(/^\d+(\.\d{1,4})?$/)]],
    tax_rate: [10, [Validators.required, Validators.min(0), Validators.max(100)]],
    course: [1, [Validators.required, Validators.min(1), Validators.max(9)]],
    notes: ['', [Validators.maxLength(255)]],
  });

  readonly moveOrderForm = this.fb.group({
    table_id: ['', [Validators.required]],
  });

  readonly payForm = this.fb.group({
    pos_session_id: ['', [Validators.required, uuidFormat]],
    ways: [1, [Validators.required, Validators.min(1), Validators.max(100)]],
    payment_method: ['card' as HospitalityPaymentMethod, [Validators.required]],
    cash_amount: [0],
  });

  readonly reservationForm = this.fb.group({
    guest_name: ['', [Validators.required, Validators.maxLength(150)]],
    guest_phone: ['', [Validators.maxLength(40)]],
    party_size: [2, [Validators.required, Validators.min(1), Validators.max(100)]],
    starts_at: [new Date().toISOString().substring(0, 16), [Validators.required]],
    duration_minutes: [120, [Validators.required, Validators.min(15), Validators.max(720)]],
    table_id: [''],
    notes: ['', [Validators.maxLength(500)]],
  });

  /** Translation key of the error shown under a control of the forms of this page. */
  errorKey(control: AbstractControl | null): string {
    return control?.hasError('required') ? 'COMMON.FIELD_REQUIRED' : validationTipKey(control) || 'COMMON.VALIDATION.INVALID_VALUE';
  }

  private readonly resGuestTpl = viewChild<TemplateRef<unknown>>('resGuestTpl');
  private readonly resPartyTpl = viewChild<TemplateRef<unknown>>('resPartyTpl');
  private readonly resStartsTpl = viewChild<TemplateRef<unknown>>('resStartsTpl');
  private readonly resDurationTpl = viewChild<TemplateRef<unknown>>('resDurationTpl');
  private readonly resStatusTpl = viewChild<TemplateRef<unknown>>('resStatusTpl');

  protected readonly reservationColumns = computed<TableColumnDef<HospitalityReservation>[]>(() => [
    { key: 'guest_name', header: 'HOSPITALITY.GUEST_NAME', customCellTemplate: this.resGuestTpl() },
    { key: 'guest_phone', header: 'HOSPITALITY.GUEST_PHONE', valueGetter: (r) => r.guest_phone || '-' },
    { key: 'party_size', header: 'HOSPITALITY.PARTY_SIZE', customCellTemplate: this.resPartyTpl() },
    { key: 'starts_at', header: 'HOSPITALITY.DATE_TIME', customCellTemplate: this.resStartsTpl() },
    { key: 'duration_minutes', header: 'HOSPITALITY.DURATION', customCellTemplate: this.resDurationTpl() },
    { key: 'status', header: 'HOSPITALITY.STATUS', valueGetter: (r) => this.reservationStatusLabel(r.status), valueLabel: (value) => this.reservationStatusLabel(value), customCellTemplate: this.resStatusTpl() },
    { key: 'notes', header: 'HOSPITALITY.NOTES', valueGetter: (r) => r.notes || '-' },
  ]);

  protected reservationStatusLabel(status: string): string {
    return this.translate.instant('HOSPITALITY.RES_' + status.toUpperCase());
  }

  constructor() {
    this.reservationsGrid.setFilter({ date: this.reservationDate() });
    // A mixed payment needs the cash part (greater than zero), the other methods do not.
    this.payForm.controls.payment_method.valueChanges.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((method) => {
      const cash = this.payForm.controls.cash_amount;
      cash.setValidators(method === 'mixed' ? [Validators.required, positiveNumber] : []);
      cash.updateValueAndValidity();
    });
  }

  ngOnInit(): void {
    this.loadRooms();
    this.loadOrders();
    this.loadKitchenTickets();
  }

  // --- ROOMS & TABLES METHODS ---
  loadRooms(): void {
    this.api.getRooms().subscribe({
      next: (res) => {
        const list = res.data || [];
        this.rooms.set(list);
        if (list.length > 0 && !this.selectedRoomId()) {
          this.selectedRoomId.set(list[0].id);
          this.loadTables(list[0].id);
        }
      },
    });
  }

  loadTables(roomId: string): void {
    if (!roomId) return;
    this.tablesLoading.set(true);
    this.api.getRoomTables(roomId).subscribe({
      next: (res) => {
        this.tables.set(res.data || []);
        this.tablesLoading.set(false);
      },
      error: () => {
        this.tablesLoading.set(false);
      },
    });
  }

  openCreateRoomModal(): void {
    this.roomForm.reset({
      name: '',
      sort_order: (this.rooms().length || 0) + 1,
      width: 1000,
      height: 600,
    });
    this.roomModalVisible.set(true);
  }

  saveRoom(): void {
    if (this.roomForm.invalid) {
      this.roomForm.markAllAsTouched();
      return;
    }
    const val = this.roomForm.getRawValue();
    const payload: HospitalityRoomRequest = {
      name: val.name,
      sort_order: val.sort_order || undefined,
    };

    this.api.createRoom(payload).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('HOSPITALITY.ROOM_CREATED'));
        this.roomModalVisible.set(false);
        this.loadRooms();
        this.selectedRoomId.set(res.data.id);
        this.loadTables(res.data.id);
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  openCreateTableModal(): void {
    this.tableForm.reset({
      room_id: this.selectedRoomId() || this.rooms()[0]?.id || '',
      name: `Tavolo ${(this.tables().length || 0) + 1}`,
      seats: 4,
      shape: 'rectangle',
    });
    this.tableModalVisible.set(true);
  }

  saveTable(): void {
    if (this.tableForm.invalid) {
      this.tableForm.markAllAsTouched();
      return;
    }
    const val = this.tableForm.getRawValue();
    const payload: HospitalityTableRequest = {
      name: val.name,
      seats: Number(val.seats),
      shape: val.shape,
      is_active: true,
    };

    this.api.createTable(val.room_id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.TABLE_CREATED'));
        this.tableModalVisible.set(false);
        this.loadTables(val.room_id);
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  // --- ORDERS METHODS ---
  loadOrders(): void {
    this.ordersLoading.set(true);
    this.api.getOpenOrders().subscribe({
      next: (res) => {
        let list = res.data || [];
        const status = this.filterOrderStatus();
        if (status) {
          list = list.filter((o) => o.status === status);
        }
        this.orders.set(list);
        this.ordersLoading.set(false);
      },
      error: () => {
        this.ordersLoading.set(false);
      },
    });
  }

  openCreateOrderModal(tableId?: string): void {
    this.orderForm.reset({
      table_id: tableId || this.tables()[0]?.id || '',
      covers: 2,
      notes: '',
    });
    this.orderModalVisible.set(true);
  }

  saveOrder(): void {
    if (this.orderForm.invalid) {
      this.orderForm.markAllAsTouched();
      return;
    }
    const val = this.orderForm.getRawValue();
    const payload: HospitalityOrderRequest = {
      table_id: val.table_id,
      covers: Number(val.covers),
      notes: val.notes || undefined,
    };

    this.api.createOrder(payload).subscribe({
      next: (res) => {
        this.message.success(this.translate.instant('HOSPITALITY.ORDER_CREATED'));
        this.orderModalVisible.set(false);
        this.loadOrders();
        this.openOrderDrawer(res.data);
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  // --- DRAWER DETAILS ---
  openOrderDrawer(order: HospitalityOrder): void {
    this.selectedOrder.set(order);
    this.drawerVisible.set(true);
    this.loadOrderDetails(order.id);
  }

  closeOrderDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedOrder.set(null);
    this.orderItems.set([]);
  }

  loadOrderDetails(orderId: string): void {
    this.drawerLoading.set(true);
    this.api.getOrder(orderId).subscribe({
      next: (res) => {
        this.selectedOrder.set(res.data);
        this.orderItems.set(res.data.items || []);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
      },
    });
  }

  openAddItemModal(): void {
    this.addItemForm.reset({
      description: '',
      quantity: 1,
      unit_price: '12.00',
      tax_rate: 10,
      course: 1,
      notes: '',
    });
    this.addItemModalVisible.set(true);
  }

  saveItem(): void {
    const order = this.selectedOrder();
    if (!order || this.addItemForm.invalid) {
      this.addItemForm.markAllAsTouched();
      return;
    }
    const val = this.addItemForm.getRawValue();
    this.api
      .addOrderItems(order.id, {
        items: [
          {
            description: val.description,
            quantity: Number(val.quantity),
            unit_price: val.unit_price,
            tax_rate: Number(val.tax_rate),
            course: Number(val.course),
            notes: val.notes || undefined,
          },
        ],
      })
      .subscribe({
        next: () => {
          this.message.success(this.translate.instant('HOSPITALITY.ITEM_ADDED'));
          this.addItemModalVisible.set(false);
          this.loadOrderDetails(order.id);
          this.loadOrders();
        },
        error: () => {
          this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
        },
      });
  }

  fireCourse(courseNumber: number): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.api.fireOrderCourse(order.id, { course: courseNumber }).subscribe({
      next: () => {
        this.message.success(
          `${this.translate.instant('HOSPITALITY.COURSE_FIRED')}: ${courseNumber}`,
        );
        this.loadOrderDetails(order.id);
        this.loadKitchenTickets();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  voidItem(itemId: string): void {
    const order = this.selectedOrder();
    if (!order) return;

    this.api.voidOrderItem(itemId, { reason: 'Errore ordinazione' }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.ITEM_VOIDED'));
        this.loadOrderDetails(order.id);
        this.loadOrders();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  printPreBill(order: HospitalityOrder): void {
    this.api.getBill(order.id).subscribe({
      next: (res) => {
        this.message.success(
          `${this.translate.instant('HOSPITALITY.PRE_BILL_PRINTED')}: ${res.data.remaining_gross} ${order.currency}`,
        );
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  openPayModal(order: HospitalityOrder): void {
    this.selectedOrder.set(order);
    this.payForm.reset({
      pos_session_id: '',
      ways: 1,
      payment_method: 'card',
      cash_amount: 0,
    });
    this.retailApi.getPosSessions().subscribe({
      next: (res) => {
        const open = (res.data?.data ?? []).filter((session) => session.status === 'open');
        this.openPosSessions.set(open);
        if (open.length === 1) {
          this.payForm.controls.pos_session_id.setValue(open[0].id);
        }
      },
      error: () => this.openPosSessions.set([]),
    });
    this.payModalVisible.set(true);
  }

  savePayment(): void {
    const order = this.selectedOrder();
    if (!order || this.payForm.invalid) {
      this.payForm.markAllAsTouched();
      return;
    }
    const val = this.payForm.getRawValue();
    const payload: HospitalityPaymentRequest = {
      pos_session_id: val.pos_session_id,
      mode: 'equal',
      ways: Number(val.ways),
      payment_method: val.payment_method,
      cash_amount: val.payment_method === 'mixed' ? Number(val.cash_amount) : undefined,
    };

    this.api.payOrder(order.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.PAYMENT_RECORDED'));
        this.payModalVisible.set(false);
        this.loadOrders();
        this.closeOrderDrawer();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  openMoveOrderModal(order: HospitalityOrder): void {
    this.selectedOrder.set(order);
    this.moveOrderForm.reset({
      table_id: this.tables()[0]?.id || '',
    });
    this.moveOrderModalVisible.set(true);
  }

  saveMoveOrder(): void {
    const order = this.selectedOrder();
    if (!order || this.moveOrderForm.invalid) {
      this.moveOrderForm.markAllAsTouched();
      return;
    }
    const val = this.moveOrderForm.getRawValue();
    this.api.moveOrderTable(order.id, { table_id: val.table_id }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.ORDER_MOVED'));
        this.moveOrderModalVisible.set(false);
        this.loadOrders();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  // --- KITCHEN TICKETS METHODS ---
  loadKitchenTickets(): void {
    this.ticketsLoading.set(true);
    this.api.getKitchenTickets().subscribe({
      next: (res) => {
        this.kitchenTickets.set(res.data || []);
        this.ticketsLoading.set(false);
      },
      error: () => {
        this.ticketsLoading.set(false);
      },
    });
  }

  updateTicketStatus(ticket: HospitalityKitchenTicket, nextStatus: KitchenTicketStatus): void {
    this.api.updateKitchenTicketStatus(ticket.id, { status: nextStatus }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.TICKET_UPDATED'));
        this.loadKitchenTickets();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  // --- RESERVATIONS METHODS ---
  loadReservations(): void {
    this.reservationsGrid.reload();
  }

  openCreateReservationModal(): void {
    this.reservationForm.reset({
      guest_name: '',
      guest_phone: '',
      party_size: 2,
      starts_at: new Date().toISOString().substring(0, 16),
      duration_minutes: 120,
      table_id: this.tables()[0]?.id || '',
      notes: '',
    });
    this.reservationModalVisible.set(true);
  }

  onReservationDateChange(date: string): void {
    if (date) {
      this.reservationDate.set(date);
      this.reservationsGrid.setFilter({ date });
    }
  }

  saveReservation(): void {
    if (this.reservationForm.invalid) {
      this.reservationForm.markAllAsTouched();
      return;
    }
    const val = this.reservationForm.getRawValue();
    const payload: HospitalityReservationRequest = {
      guest_name: val.guest_name,
      guest_phone: val.guest_phone || undefined,
      party_size: Number(val.party_size),
      starts_at: val.starts_at,
      duration_minutes: Number(val.duration_minutes),
      table_id: val.table_id || undefined,
      notes: val.notes || undefined,
    };

    this.api.createReservation(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.RESERVATION_CREATED'));
        this.reservationModalVisible.set(false);
        this.loadReservations();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  seatReservation(res: HospitalityReservation): void {
    this.api.seatReservation(res.id, {}).subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.GUESTS_SEATED'));
        this.loadReservations();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  cancelReservation(res: HospitalityReservation): void {
    this.api
      .updateReservationStatus(res.id, { status: 'cancelled', reason: this.translate.instant('HOSPITALITY.RESERVATION_CANCEL_REASON') })
      .subscribe({
      next: () => {
        this.message.success(this.translate.instant('HOSPITALITY.RESERVATION_CANCELLED'));
        this.loadReservations();
      },
      error: () => {
        this.message.error(this.translate.instant('HOSPITALITY.ACTION_ERROR'));
      },
    });
  }

  getOrderStatusColor(status: HospitalityOrderStatus | string): string {
    switch (status) {
      case 'open':
        return 'processing';
      case 'fired':
        return 'warning';
      case 'billed':
        return 'blue';
      case 'paid':
        return 'success';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  }

  getTableStatusColor(status: HospitalityTableStatus | string | undefined): string {
    switch (status) {
      case 'free':
        return 'success';
      case 'occupied':
        return 'error';
      case 'billing':
        return 'warning';
      case 'reserved':
        return 'processing';
      default:
        return 'default';
    }
  }

  getTicketStatusColor(status: KitchenTicketStatus | string): string {
    switch (status) {
      case 'queued':
        return 'default';
      case 'preparing':
        return 'warning';
      case 'ready':
        return 'success';
      case 'served':
        return 'blue';
      default:
        return 'default';
    }
  }
}
