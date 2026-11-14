import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { describe, beforeEach, afterEach, it, expect } from 'vitest';
import { LoyaltyApiService } from './loyalty-api.service';
import {
  CreateLoyaltyCardPayload,
  LoyaltyCard,
  LoyaltyTransaction,
  RecordLoyaltyTransactionPayload,
  UpdateLoyaltyCardPayload,
} from '../models';

describe('LoyaltyApiService', () => {
  let service: LoyaltyApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/loyalty-cards`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        LoyaltyApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(LoyaltyApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('should fetch loyalty cards with pagination', () => {
    const mockCards = {
      data: [
        {
          id: 'card-1',
          contact_id: 'cust-1',
          type: 'loyalty',
          card_number: 'LOY-1001',
          balance: 250,
          status: 'active',
          created_at: '2026-11-01',
        } as LoyaltyCard,
      ],
    };

    service.getCards({ page: 1, per_page: 10 }).subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].card_number).toBe('LOY-1001');
    });

    const req = httpTesting.expectOne((r) => r.url === baseUrl && r.params.get('page') === '1');
    expect(req.request.method).toBe('GET');
    req.flush(mockCards);
  });

  it('should create a loyalty card', () => {
    const payload: CreateLoyaltyCardPayload = {
      contact_id: 'cust-1',
      type: 'loyalty',
      card_number: 'LOY-1002',
      initial_balance: 50,
    };
    const mockCard: LoyaltyCard = {
      id: 'card-2',
      contact_id: 'cust-1',
      type: 'loyalty',
      card_number: 'LOY-1002',
      balance: 50,
      status: 'active',
      created_at: '2026-11-09',
    };

    service.createCard(payload).subscribe((res) => {
      expect(res.data.id).toBe('card-2');
      expect(res.data.balance).toBe(50);
    });

    const req = httpTesting.expectOne(baseUrl);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: mockCard });
  });

  it('should update loyalty card status', () => {
    const payload: UpdateLoyaltyCardPayload = { status: 'blocked' };
    const mockCard: LoyaltyCard = {
      id: 'card-1',
      contact_id: 'cust-1',
      type: 'loyalty',
      card_number: 'LOY-1001',
      balance: 250,
      status: 'blocked',
      created_at: '2026-11-01',
    };

    service.updateCard('card-1', payload).subscribe((res) => {
      expect(res.data.status).toBe('blocked');
    });

    const req = httpTesting.expectOne(`${baseUrl}/card-1`);
    expect(req.request.method).toBe('PUT');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: mockCard });
  });

  it('should delete a loyalty card', () => {
    service.deleteCard('card-1').subscribe();

    const req = httpTesting.expectOne(`${baseUrl}/card-1`);
    expect(req.request.method).toBe('DELETE');
    req.flush({ success: true });
  });

  it('should retrieve card transactions and record new transaction', () => {
    const mockTransactions: LoyaltyTransaction[] = [
      {
        id: 'tx-1',
        loyalty_card_id: 'card-1',
        type: 'topup',
        amount: 100,
        description: 'Store purchase bonus',
        created_at: '2026-11-05',
      },
    ];

    service.getTransactions('card-1').subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].amount).toBe(100);
    });

    const req1 = httpTesting.expectOne(`${baseUrl}/card-1/transactions`);
    expect(req1.request.method).toBe('GET');
    req1.flush({ data: mockTransactions });

    const newTxPayload: RecordLoyaltyTransactionPayload = {
      type: 'redeem',
      amount: 40,
      description: 'Discount coupon redemption',
    };

    service.recordTransaction('card-1', newTxPayload).subscribe((res) => {
      expect(res.data.type).toBe('redeem');
      expect(res.data.amount).toBe(40);
    });

    const req2 = httpTesting.expectOne(`${baseUrl}/card-1/transactions`);
    expect(req2.request.method).toBe('POST');
    expect(req2.request.body).toEqual(newTxPayload);
    req2.flush({ data: { id: 'tx-2', ...newTxPayload, created_at: '2026-11-09' } });
  });
});
