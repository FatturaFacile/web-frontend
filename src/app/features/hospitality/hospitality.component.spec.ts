import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  HospitalityApiService,
  HospitalityKitchenTicket,
  HospitalityOrder,
  HospitalityReservation,
  HospitalityRoom,
  HospitalityTable,
  RetailApiService,
  TranslateService,
} from '@core';
import { HospitalityComponent } from './hospitality.component';

describe('HospitalityComponent', () => {
  let component: HospitalityComponent;
  let fixture: ComponentFixture<HospitalityComponent>;

  const mockRooms: HospitalityRoom[] = [
    {
      id: 'r-1',
      tenant_id: 't-1',
      name: 'Sala Principale',
      sort_order: 1,
      created_at: '2026-11-01',
      updated_at: '2026-11-01',
    },
  ];

  const mockTables: HospitalityTable[] = [
    {
      id: 'tbl-1',
      room_id: 'r-1',
      name: 'Tavolo 1',
      seats: 4,
      shape: 'rectangle',
      is_active: true,
      status: 'free',
      created_at: '2026-11-01',
      updated_at: '2026-11-01',
    },
  ];

  const mockOrders: HospitalityOrder[] = [
    {
      id: 'ord-1',
      table_id: 'tbl-1',
      status: 'open',
      covers: 2,
      total_amount: '45.00',
      items: [
        {
          id: 'item-1',
          order_id: 'ord-1',
          description: 'Pasta Carbonara',
          quantity: 2,
          unit_price: '12.00',
          total_price: '24.00',
          status: 'pending',
          course: 1,
          created_at: '2026-11-01',
        },
      ],
      created_at: '2026-11-01',
      updated_at: '2026-11-01',
    },
  ];

  const mockTickets: HospitalityKitchenTicket[] = [
    {
      id: 'tick-1',
      order_id: 'ord-1',
      order_number: 'ORD-101',
      table_name: 'Tavolo 1',
      course: 1,
      status: 'queued',
      items: [
        {
          name: 'Pasta Carbonara',
          quantity: 2,
        },
      ],
      created_at: '2026-11-01',
    },
  ];

  const mockReservations: HospitalityReservation[] = [
    {
      id: 'res-1',
      guest_name: 'Mario Rossi',
      guest_phone: '+39 333 1234567',
      party_size: 4,
      starts_at: '2026-11-10T20:00:00Z',
      duration_minutes: 120,
      status: 'booked',
      created_at: '2026-11-01',
      updated_at: '2026-11-01',
    },
  ];

  const apiSpy = {
    getRooms: vi.fn().mockReturnValue(of({ data: mockRooms })),
    getRoomTables: vi.fn().mockReturnValue(of({ data: mockTables })),
    createRoom: vi.fn().mockReturnValue(of({ data: mockRooms[0] })),
    createTable: vi.fn().mockReturnValue(of({ data: mockTables[0] })),
    getOpenOrders: vi.fn().mockReturnValue(of({ data: mockOrders })),
    getOrder: vi.fn().mockReturnValue(of({ data: mockOrders[0] })),
    createOrder: vi.fn().mockReturnValue(of({ data: mockOrders[0] })),
    addOrderItems: vi.fn().mockReturnValue(of({ data: mockOrders[0].items })),
    fireOrderCourse: vi.fn().mockReturnValue(of({ data: { success: true } })),
    voidOrderItem: vi.fn().mockReturnValue(of({ data: { success: true } })),
    getBill: vi.fn().mockReturnValue(of({ data: { order_id: 'ord-1', lines: [], remaining_gross: '96.00' } })),
    payOrder: vi.fn().mockReturnValue(of({ data: mockOrders[0] })),
    moveOrderTable: vi.fn().mockReturnValue(of({ data: mockOrders[0] })),
    getKitchenTickets: vi.fn().mockReturnValue(of({ data: mockTickets })),
    updateKitchenTicketStatus: vi.fn().mockReturnValue(of({ data: { ...mockTickets[0], status: 'preparing' } })),
    getReservations: vi.fn().mockReturnValue(of({ data: mockReservations })),
    createReservation: vi.fn().mockReturnValue(of({ data: mockReservations[0] })),
    seatReservation: vi.fn().mockReturnValue(of({ data: { ...mockReservations[0], status: 'seated' } })),
    updateReservationStatus: vi.fn().mockReturnValue(of({ data: { ...mockReservations[0], status: 'cancelled' } })),
  };

  const retailSpy = {
    getPosSessions: vi.fn().mockReturnValue(of({ data: { data: [{ id: '7b3c1f4e-3333-4222-8333-944455556666', status: 'open', opened_at: '2026-11-12T08:00:00Z' }] } })),
  };

  const messageSpy = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [HospitalityComponent],
      providers: [
        provideNzIcons(icons),
        { provide: HospitalityApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: RetailApiService, useValue: retailSpy },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(HospitalityComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should initialize and load rooms, tables, orders, kitchen tickets, and reservations', () => {
    expect(component).toBeTruthy();
    expect(apiSpy.getRooms).toHaveBeenCalled();
    expect(apiSpy.getRoomTables).toHaveBeenCalledWith('r-1');
    expect(apiSpy.getOpenOrders).toHaveBeenCalled();
    expect(apiSpy.getKitchenTickets).toHaveBeenCalled();
    expect(apiSpy.getReservations).toHaveBeenCalledWith({ date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });

    expect(component.rooms()).toEqual(mockRooms);
    expect(component.tables()).toEqual(mockTables);
    expect(component.orders()).toEqual(mockOrders);
    expect(component.kitchenTickets()).toEqual(mockTickets);
    expect(component.reservations()).toEqual(mockReservations);
    expect(component.totalActiveCovers()).toBe(2);
    expect(component.totalActiveRevenue()).toBe(45);
  });

  it('should create a new room and refresh table list', () => {
    component.openCreateRoomModal();
    expect(component.roomModalVisible()).toBe(true);

    component.roomForm.patchValue({
      name: 'Terrazza Estiva',
      sort_order: 2,
    });

    component.saveRoom();
    expect(apiSpy.createRoom).toHaveBeenCalledWith({
      name: 'Terrazza Estiva',
      sort_order: 2,
    });
    expect(component.roomModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should not call the API when the forms are submitted empty or out of range', () => {
    apiSpy.createRoom.mockClear();
    apiSpy.createTable.mockClear();
    apiSpy.createReservation.mockClear();
    component.openCreateRoomModal();
    component.roomForm.patchValue({ name: '' });
    component.saveRoom();
    component.openCreateTableModal();
    component.tableForm.patchValue({ room_id: 'r-1', name: 'T'.repeat(31) });
    component.saveTable();
    component.openCreateReservationModal();
    component.reservationForm.patchValue({ guest_name: '', duration_minutes: 5 });
    component.saveReservation();

    expect(apiSpy.createRoom).not.toHaveBeenCalled();
    expect(apiSpy.createTable).not.toHaveBeenCalled();
    expect(apiSpy.createReservation).not.toHaveBeenCalled();
    expect(component.errorKey(component.roomForm.controls.name)).toBe('COMMON.FIELD_REQUIRED');
    expect(component.errorKey(component.tableForm.controls.name)).toBe('COMMON.VALIDATION.INVALID_VALUE');
  });

  it('should create a new table', () => {
    component.openCreateTableModal();
    expect(component.tableModalVisible()).toBe(true);

    component.tableForm.patchValue({
      room_id: 'r-1',
      name: 'Tavolo 2',
      seats: 6,
      shape: 'round',
    });

    component.saveTable();
    expect(apiSpy.createTable).toHaveBeenCalledWith('r-1', {
      name: 'Tavolo 2',
      seats: 6,
      shape: 'round',
      is_active: true,
    });
    expect(component.tableModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should create an order and open drawer', () => {
    component.openCreateOrderModal('tbl-1');
    expect(component.orderModalVisible()).toBe(true);

    component.orderForm.patchValue({
      table_id: 'tbl-1',
      covers: 4,
      notes: 'Tavolo VIP',
    });

    component.saveOrder();
    expect(apiSpy.createOrder).toHaveBeenCalledWith({
      table_id: 'tbl-1',
      covers: 4,
      notes: 'Tavolo VIP',
    });
    expect(component.orderModalVisible()).toBe(false);
    expect(component.drawerVisible()).toBe(true);
    expect(component.selectedOrder()?.id).toBe('ord-1');
  });

  it('should add item to order', () => {
    component.openOrderDrawer(mockOrders[0]);
    component.openAddItemModal();
    expect(component.addItemModalVisible()).toBe(true);

    component.addItemForm.patchValue({
      description: 'Tiramisù',
      quantity: 2,
      unit_price: '6.50',
      tax_rate: 10,
      course: 2,
      notes: 'Senza cacao amaro',
    });

    component.saveItem();
    expect(apiSpy.addOrderItems).toHaveBeenCalledWith('ord-1', {
      items: [
        {
          description: 'Tiramisù',
          quantity: 2,
          unit_price: '6.50',
          tax_rate: 10,
          course: 2,
          notes: 'Senza cacao amaro',
        },
      ],
    });
    expect(component.addItemModalVisible()).toBe(false);
  });

  it('should fire course to kitchen', () => {
    component.openOrderDrawer(mockOrders[0]);
    component.fireCourse(2);
    expect(apiSpy.fireOrderCourse).toHaveBeenCalledWith('ord-1', { course: 2 });
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should void an order item', () => {
    component.openOrderDrawer(mockOrders[0]);
    component.voidItem('item-1');
    expect(apiSpy.voidOrderItem).toHaveBeenCalledWith('item-1', { reason: 'Errore ordinazione' });
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should print pre-bill and pay order', () => {
    component.printPreBill(mockOrders[0]);
    expect(apiSpy.getBill).toHaveBeenCalledWith('ord-1');

    component.openPayModal(mockOrders[0]);
    expect(component.payModalVisible()).toBe(true);

    // the only open POS session is preselected
    expect(component.payForm.controls.pos_session_id.value).toBe('7b3c1f4e-3333-4222-8333-944455556666');

    component.payForm.patchValue({ payment_method: 'mixed', cash_amount: 0 });
    component.savePayment();
    expect(apiSpy.payOrder).not.toHaveBeenCalled();

    component.payForm.patchValue({ payment_method: 'mixed', cash_amount: 45 });
    component.savePayment();
    expect(apiSpy.payOrder).toHaveBeenCalledWith('ord-1', {
      pos_session_id: '7b3c1f4e-3333-4222-8333-944455556666',
      mode: 'equal',
      ways: 1,
      payment_method: 'mixed',
      cash_amount: 45,
    });
    expect(component.payModalVisible()).toBe(false);
  });

  it('should move order to another table', () => {
    component.openMoveOrderModal(mockOrders[0]);
    expect(component.moveOrderModalVisible()).toBe(true);

    component.moveOrderForm.patchValue({
      table_id: 'tbl-2',
    });

    component.saveMoveOrder();
    expect(apiSpy.moveOrderTable).toHaveBeenCalledWith('ord-1', { table_id: 'tbl-2' });
    expect(component.moveOrderModalVisible()).toBe(false);
  });

  it('should advance kitchen ticket status', () => {
    component.updateTicketStatus(mockTickets[0], 'preparing');
    expect(apiSpy.updateKitchenTicketStatus).toHaveBeenCalledWith('tick-1', { status: 'preparing' });
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should create reservation, seat guests, and cancel reservation', () => {
    component.openCreateReservationModal();
    expect(component.reservationModalVisible()).toBe(true);

    component.reservationForm.patchValue({
      guest_name: 'Luigi Verdi',
      guest_phone: '+39 340 9876543',
      party_size: 3,
      starts_at: '2026-11-12T19:30:00Z',
      duration_minutes: 90,
      table_id: 'tbl-1',
      notes: 'Compleanno',
    });

    component.saveReservation();
    expect(apiSpy.createReservation).toHaveBeenCalledWith({
      guest_name: 'Luigi Verdi',
      guest_phone: '+39 340 9876543',
      party_size: 3,
      starts_at: '2026-11-12T19:30:00Z',
      duration_minutes: 90,
      table_id: 'tbl-1',
      notes: 'Compleanno',
    });
    expect(component.reservationModalVisible()).toBe(false);

    component.seatReservation(mockReservations[0]);
    expect(apiSpy.seatReservation).toHaveBeenCalledWith('res-1', {});

    component.cancelReservation(mockReservations[0]);
    expect(apiSpy.updateReservationStatus).toHaveBeenCalledWith('res-1', { status: 'cancelled', reason: 'HOSPITALITY.RESERVATION_CANCEL_REASON' });
  });

  it('should return correct color badges for statuses', () => {
    expect(component.getOrderStatusColor('open')).toBe('processing');
    expect(component.getOrderStatusColor('paid')).toBe('success');
    expect(component.getTableStatusColor('free')).toBe('success');
    expect(component.getTableStatusColor('occupied')).toBe('error');
    expect(component.getTicketStatusColor('queued')).toBe('default');
    expect(component.getTicketStatusColor('ready')).toBe('success');
  });
});
