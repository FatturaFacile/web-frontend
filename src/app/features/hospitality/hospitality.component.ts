import { DatePipe, UpperCasePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
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
  HospitalityApiService,
  HospitalityKitchenTicket,
  HospitalityOrder,
  HospitalityOrderItem,
  HospitalityOrderRequest,
  HospitalityOrderStatus,
  HospitalityPaymentRequest,
  HospitalityReservation,
  HospitalityReservationRequest,
  HospitalityRoom,
  HospitalityRoomRequest,
  HospitalityTable,
  HospitalityTableRequest,
  HospitalityTableStatus,
  KitchenTicketStatus,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

@Component({
  selector: 'app-hospitality',
  imports: [
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
    NzDrawerModule,
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
  styleUrl: './hospitality.component.scss',
})
export class HospitalityComponent implements OnInit {
  private readonly api = inject(HospitalityApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

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
  readonly reservations = signal<HospitalityReservation[]>([]);
  readonly reservationsLoading = signal<boolean>(false);

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
    name: ['', [Validators.required]],
    sort_order: [1],
    width: [1000],
    height: [600],
  });

  readonly tableForm = this.fb.group({
    room_id: ['', [Validators.required]],
    name: ['', [Validators.required]],
    seats: [4, [Validators.required, Validators.min(1)]],
    shape: ['rect' as 'rect' | 'round', [Validators.required]],
  });

  readonly orderForm = this.fb.group({
    table_id: ['', [Validators.required]],
    covers: [2, [Validators.required, Validators.min(1)]],
    notes: [''],
  });

  readonly addItemForm = this.fb.group({
    name: ['', [Validators.required]],
    quantity: [1, [Validators.required, Validators.min(1)]],
    unit_price: ['12.00', [Validators.required]],
    course: [1, [Validators.required, Validators.min(1)]],
    notes: [''],
  });

  readonly moveOrderForm = this.fb.group({
    table_id: ['', [Validators.required]],
  });

  readonly payForm = this.fb.group({
    payment_method: ['card', [Validators.required]],
    cash_amount: [0],
  });

  readonly reservationForm = this.fb.group({
    guest_name: ['', [Validators.required]],
    guest_phone: [''],
    party_size: [2, [Validators.required, Validators.min(1)]],
    starts_at: [new Date().toISOString().substring(0, 16), [Validators.required]],
    duration_minutes: [120, [Validators.required]],
    table_id: [''],
    notes: [''],
  });

  ngOnInit(): void {
    this.loadRooms();
    this.loadOrders();
    this.loadKitchenTickets();
    this.loadReservations();
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
      shape: 'rect',
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
      name: '',
      quantity: 1,
      unit_price: '12.00',
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
            name: val.name,
            quantity: Number(val.quantity),
            unit_price: val.unit_price,
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
      payment_method: 'card',
      cash_amount: parseFloat(order.total_amount) || 0,
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
      payment_method: val.payment_method,
      cash_amount: val.cash_amount ? Number(val.cash_amount) : undefined,
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
    this.reservationsLoading.set(true);
    this.api.getReservations().subscribe({
      next: (res) => {
        this.reservations.set(res.data || []);
        this.reservationsLoading.set(false);
      },
      error: () => {
        this.reservationsLoading.set(false);
      },
    });
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
    this.api.updateReservationStatus(res.id, { status: 'cancelled' }).subscribe({
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
