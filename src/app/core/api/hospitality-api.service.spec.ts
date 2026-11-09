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
    status: 'confirmed',
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
        items: [{ name: 'Spaghetti alle Vongole', quantity: 2, unit_price: '18.00', course: 2 }],
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
          name: 'Spaghetti alle Vongole',
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
      .payOrder('ord-1', { payment_method: 'card', cash_amount: 96.0 })
      .subscribe((res) => {
        expect(res.data.payment_id).toBe('pay-123');
      });
    const reqPay = httpTesting.expectOne(`${baseUrl}/orders/ord-1/payments`);
    expect(reqPay.request.method).toBe('POST');
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

    service.getReservations().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].guest_name).toBe('Mario Rossi');
    });
    const reqRes = httpTesting.expectOne(`${baseUrl}/reservations`);
    expect(reqRes.request.method).toBe('GET');
    reqRes.flush({ data: [mockReservation] });
  });
});
