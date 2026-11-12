import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  HospitalityKitchenTicket,
  HospitalityOrder,
  HospitalityReservation,
  HospitalityRoom,
} from '../models';
import { HospitalityApiService } from './hospitality-api.service';

describe('HospitalityApiService', () => {
  let service: HospitalityApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/hospitality`;

  const mockRoom: HospitalityRoom = {
    id: 'room-1',
    name: 'Sala Principale',
    tables_count: 12,
  };

  const mockOrder: HospitalityOrder = {
    id: 'ord-1',
    order_number: 'CMD-101',
    table_id: 'tbl-4',
    table_name: 'Tavolo 4',
    covers: 4,
    currency: 'EUR',
    total_amount: '96.00',
    status: 'open',
  };

  const mockTicket: HospitalityKitchenTicket = {
    id: 'tkt-1',
    order_id: 'ord-1',
    order_number: 'CMD-101',
    table_name: 'Tavolo 4',
    course: 1,
    status: 'preparing',
    items: [{ name: 'Tagliere Salumi & Formaggi', quantity: 2 }],
    created_at: '2026-03-02T12:30:00Z',
  };

  const mockReservation: HospitalityReservation = {
    id: 'res-1',
    table_id: 'tbl-4',
    table_name: 'Tavolo 4',
    guest_name: 'Mario Rossi',
    party_size: 4,
    starts_at: '2026-03-02T20:00:00Z',
    duration_minutes: 120,
    status: 'booked',
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        HospitalityApiService,
      ],
    });

    service = TestBed.inject(HospitalityApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('should fetch rooms and tables', () => {
    service.getRooms().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].name).toBe('Sala Principale');
    });

    const req = httpTesting.expectOne(`${baseUrl}/rooms`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: [mockRoom] });
  });

  it('should read the tables of a room from its plan', () => {
    service.getRoomTables('room-1').subscribe((res) => {
      expect(res.data.length).toBe(2);
      expect(res.data[0]).toEqual(
        expect.objectContaining({ id: 'tbl-1', room_id: 'room-1', status: 'occupied', current_order_id: 'ord-1' }),
      );
      expect(res.data[1].current_order_id).toBeNull();
    });

    const req = httpTesting.expectOne(`${baseUrl}/rooms/room-1/plan`);
    expect(req.request.method).toBe('GET');
    req.flush({
      data: {
        room: { id: 'room-1', name: 'Sala Principale', width: 1000, height: 600 },
        tables: [
          { id: 'tbl-1', name: 'T1', seats: 4, shape: 'rectangle', pos_x: 0, pos_y: 0, width: 80, height: 80, status: 'occupied', order_id: 'ord-1', covers: '2' },
          { id: 'tbl-2', name: 'T2', seats: 2, shape: 'round', pos_x: 90, pos_y: 0, width: 60, height: 60, status: 'free', order_id: null, covers: null },
        ],
      },
    });
  });

  it('should collect open orders from the room plans', () => {
    service.getOpenOrders().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].id).toBe('ord-1');
    });

    httpTesting.expectOne(`${baseUrl}/rooms`).flush({ data: [mockRoom] });
    httpTesting.expectOne(`${baseUrl}/rooms/room-1/plan`).flush({
      data: {
        room: { id: 'room-1', name: 'Sala Principale', width: 1000, height: 600 },
        tables: [
          { id: 'tbl-1', name: 'T1', seats: 4, shape: 'rectangle', pos_x: 0, pos_y: 0, width: 80, height: 80, status: 'occupied', order_id: 'ord-1', covers: '2' },
          { id: 'tbl-2', name: 'T2', seats: 2, shape: 'round', pos_x: 90, pos_y: 0, width: 60, height: 60, status: 'free', order_id: null, covers: null },
        ],
      },
    });
    const orderReq = httpTesting.expectOne(`${baseUrl}/orders/ord-1`);
    expect(orderReq.request.method).toBe('GET');
    orderReq.flush({ data: mockOrder });
  });

  it('should read the bill of an order with GET', () => {
    service.getBill('ord-1').subscribe((res) => {
      expect(res.data.remaining_gross).toBe('96.00');
    });

    const req = httpTesting.expectOne(`${baseUrl}/orders/ord-1/bill`);
    expect(req.request.method).toBe('GET');
    req.flush({ data: { order_id: 'ord-1', lines: [], remaining_gross: '96.00' } });
  });

  it('should create order and add items', () => {
    service
      .createOrder({ table_id: 'tbl-4', covers: 4 })
      .subscribe((res) => {
        expect(res.data.order_number).toBe('CMD-101');
      });

    const reqOrder = httpTesting.expectOne(`${baseUrl}/orders`);
    expect(reqOrder.request.method).toBe('POST');
    reqOrder.flush({ data: mockOrder });

    service
      .addOrderItems('ord-1', {
        items: [{ description: 'Spaghetti alle Vongole', quantity: 2, unit_price: '18.00', tax_rate: 10, course: 2 }],
      })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
      });

    const reqItems = httpTesting.expectOne(`${baseUrl}/orders/ord-1/items`);
    expect(reqItems.request.method).toBe('POST');
    reqItems.flush({
      data: [
        {
          id: 'item-1',
          order_id: 'ord-1',
          description: 'Spaghetti alle Vongole',
          quantity: 2,
          unit_price: '18.00',
          subtotal: '36.00',
          course: 2,
          status: 'pending',
        },
      ],
    });
  });

  it('should fire order course and pay order', () => {
    service.fireOrderCourse('ord-1', { course: 2 }).subscribe((res) => {
      expect(res.data.status).toBe('fired');
    });
    const reqFire = httpTesting.expectOne(`${baseUrl}/orders/ord-1/fire`);
    expect(reqFire.request.method).toBe('POST');
    reqFire.flush({ data: { status: 'fired' } });

    service
      .payOrder('ord-1', { pos_session_id: 'sess-1', mode: 'equal', ways: 2, payment_method: 'mixed', cash_amount: 96.0 })
      .subscribe((res) => {
        expect(res.data.payment_id).toBe('pay-123');
      });
    const reqPay = httpTesting.expectOne(`${baseUrl}/orders/ord-1/payments`);
    expect(reqPay.request.method).toBe('POST');
    expect(reqPay.request.body).toEqual({ pos_session_id: 'sess-1', mode: 'equal', ways: 2, payment_method: 'mixed', cash_amount: 96.0 });
    reqPay.flush({ data: { payment_id: 'pay-123' } });
  });

  it('should manage kitchen tickets and reservations', () => {
    service.getKitchenTickets().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].status).toBe('preparing');
    });
    const reqKds = httpTesting.expectOne(`${baseUrl}/kitchen-tickets`);
    expect(reqKds.request.method).toBe('GET');
    reqKds.flush({ data: [mockTicket] });

    service.getReservations({ date: '2026-11-12' }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].guest_name).toBe('Mario Rossi');
    });
    const reqRes = httpTesting.expectOne(`${baseUrl}/reservations?date=2026-11-12`);
    expect(reqRes.request.method).toBe('GET');
    reqRes.flush({ data: [mockReservation] });
  });
});
