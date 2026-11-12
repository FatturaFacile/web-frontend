import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ConstructionApiService } from './construction-api.service';
import {
  ConstructionProgressBillingPayload,
  ConstructionSite,
  TradesBid,
  TradesSiteDiaryEntry,
  TradesSubcontractor,
} from '../models';

describe('ConstructionApiService', () => {
  let service: ConstructionApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/construction`;
  const tradesBase = `${environment.apiBaseUrl}/construction-trades`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        ConstructionApiService,
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });

    service = TestBed.inject(ConstructionApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('fetches construction sites and SAL progress billings', () => {
    const mockSite: ConstructionSite = {
      id: 'site-1',
      code: 'CANTIERE-001',
      name: 'Residenza Lago',
      client_id: 'contact-1',
      address: 'Via Nassa 1, Lugano',
    };

    service.getSites().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].code).toBe('CANTIERE-001');
    });

    const sReq = httpMock.expectOne(`${base}/sites`);
    expect(sReq.request.method).toBe('GET');
    sReq.flush({ data: [mockSite] });

    service.getProgressBillings().subscribe((res) => {
      expect(res.data.length).toBe(0);
    });

    const salReq = httpMock.expectOne(`${base}/sal`);
    expect(salReq.request.method).toBe('GET');
    salReq.flush({ data: [] });
  });

  it('posts a new progress billing record (SAL)', () => {
    const payload: ConstructionProgressBillingPayload = {
      construction_site_id: 'site-1',
      sal_number: 'SAL 3',
      period_start: '2026-03-01',
      period_end: '2026-03-31',
      gross_certified_amount: 150000,
      retention_percentage: 10,
    };

    service.createProgressBilling(payload).subscribe((res) => {
      expect(res.data.sal_number).toBe('SAL 3');
      expect(res.data.net_amount).toBe(135000);
    });

    const req = httpMock.expectOne(`${base}/sal`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({
      data: {
        id: 'sal-3',
        ...payload,
        net_amount: 135000,
        status: 'draft',
      },
    });
  });

  it('manages construction trades bids, status, and billings', () => {
    const mockBid: TradesBid = {
      id: 'bid-1',
      bid_number: 'APP-2026-01',
      contact_id: 'contact-1',
      title: 'Opere da Muratore e Cemento Armato',
      language: 'it',
      currency: 'CHF',
      tax_rate: '8.10',
      status: 'submitted',
    };

    service.getBids().subscribe((res) => {
      expect(res.data.length).toBe(1);
      expect(res.data[0].bid_number).toBe('APP-2026-01');
    });
    const bidsReq = httpMock.expectOne(`${tradesBase}/bids`);
    expect(bidsReq.request.method).toBe('GET');
    bidsReq.flush({ data: [mockBid] });

    service.changeBidStatus('bid-1', { status: 'accepted' }).subscribe((res) => {
      expect(res.data.status).toBe('accepted');
    });
    const statusReq = httpMock.expectOne(`${tradesBase}/bids/bid-1/status`);
    expect(statusReq.request.method).toBe('POST');
    statusReq.flush({ data: { ...mockBid, status: 'accepted' } });

    service
      .issueBidBilling('bid-1', {
        kind: 'partial',
        basis: 'percentage',
        percentage: '30',
        date: '2026-03-15',
      })
      .subscribe((res) => {
        expect(res.data.sequence).toBe(1);
      });
    const billReq = httpMock.expectOne(`${tradesBase}/bids/bid-1/billings`);
    expect(billReq.request.method).toBe('POST');
    expect(billReq.request.body).toEqual({ kind: 'partial', basis: 'percentage', percentage: '30', date: '2026-03-15' });
    billReq.flush({
      data: {
        id: 'tb-1',
        bid_id: 'bid-1',
        kind: 'partial',
        sequence: 1,
        billing_date: '2026-03-15',
        gross_this: '80000.00',
        retention_amount: '8000.00',
        amount_invoiced: '72000.00',
      },
    });
  });

  it('handles site diary and subcontractors', () => {
    const mockDiary: TradesSiteDiaryEntry = {
      id: 'diary-1',
      construction_site_id: 'site-1',
      entry_date: '2026-03-02',
      weather: 'Soleggiato 14°C',
      workers_present: 8,
      work_performed: 'Armatura solaio piano primo',
    };

    service.getSiteDiary('site-1').subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const diaryReq = httpMock.expectOne(`${tradesBase}/sites/site-1/diary`);
    expect(diaryReq.request.method).toBe('GET');
    diaryReq.flush({ data: [mockDiary] });

    const mockSub: TradesSubcontractor = {
      id: 'sub-1',
      name: 'Impianti Elettrici Rossi Sagl',
      tax_id: 'CHE-987.654.321',
    };

    service.getSubcontractors().subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const subReq = httpMock.expectOne(`${tradesBase}/subcontractors`);
    expect(subReq.request.method).toBe('GET');
    subReq.flush({ data: [mockSub] });
  });

  it('sends the certification with the fields the API requires', () => {
    service
      .certifySubcontractWork('sc-1', { certified_on: '2026-03-31', amount: '7500.00', description: 'SAL 1' })
      .subscribe();
    const req = httpMock.expectOne(`${tradesBase}/subcontracts/sc-1/certifications`);
    expect(Object.keys(req.request.body as object).sort()).toEqual(['amount', 'certified_on', 'description']);
    req.flush({ data: {} });
  });
});
