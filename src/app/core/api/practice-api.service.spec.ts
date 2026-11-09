import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  PracticeActivityControlResponse,
  PracticeChecklistRequest,
  PracticeCloseRequest,
  PracticeClosing,
  PracticeClosingOverview,
  PracticeClosingRequest,
  PracticeFeeNoteRequest,
  PracticeRetainer,
  PracticeRetainerApplyRequest,
  PracticeRetainerRequest,
} from '../models';
import { PracticeApiService } from './practice-api.service';

describe('PracticeApiService', () => {
  let service: PracticeApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [PracticeApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(PracticeApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should fetch activity control and fee note activities', () => {
    const mockActivityControl: PracticeActivityControlResponse = {
      activities: [
        {
          id: 'act-1',
          client_id: 'cli-1',
          activity_date: '2026-11-01',
          description: 'Consulenza fiscale',
          hours: 2,
          rate: '120.00',
          amount: '240.00',
          status: 'unbilled',
        },
      ],
      total_hours: 2,
      total_amount: '240.00',
      unbilled_count: 1,
    };

    service
      .getActivityControl({ from: '2026-11-01', to: '2026-11-30', user_id: 'usr-1', stale_days: 30 })
      .subscribe((res) => {
        expect(res.data).toEqual(mockActivityControl);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/practice/activity-control') &&
        r.params.get('from') === '2026-11-01' &&
        r.params.get('to') === '2026-11-30' &&
        r.params.get('user_id') === 'usr-1' &&
        r.params.get('stale_days') === '30',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockActivityControl });

    service.getFeeNoteActivities('fn-1').subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const actReq = httpMock.expectOne((r) => r.url.endsWith('/practice/fee-notes/fn-1/activities'));
    expect(actReq.request.method).toBe('GET');
    actReq.flush({ data: mockActivityControl.activities });
  });

  it('should create fee note from activities', () => {
    const payload: PracticeFeeNoteRequest = {
      client_id: 'cli-1',
      activity_ids: ['act-1'],
      date: '2026-11-05',
      cpa_rate: '4.00',
      ritenuta_rate: '20.00',
      vat_rate: '22.00',
    };

    service.createFeeNoteFromActivities(payload).subscribe((res) => {
      expect(res.data.id).toBe('fn-new-1');
      expect(res.data.status).toBe('draft');
    });

    const req = httpMock.expectOne((r) => r.url.endsWith('/practice/fee-notes/from-activities'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);
    req.flush({ data: { id: 'fn-new-1', status: 'draft' } });
  });

  it('should manage closings and checklists', () => {
    const mockOverview: PracticeClosingOverview = {
      closings: [],
      total_open: 2,
      total_closed: 5,
      pending_checklists: 3,
    };

    service.getClosingOverview({ from: '2026-01-01', to: '2026-12-31' }).subscribe((res) => {
      expect(res.data).toEqual(mockOverview);
    });
    const ovReq = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/practice/closing-overview') &&
        r.params.get('from') === '2026-01-01' &&
        r.params.get('to') === '2026-12-31',
    );
    expect(ovReq.request.method).toBe('GET');
    ovReq.flush({ data: mockOverview });

    const openPayload: PracticeClosingRequest = {
      client_id: 'cli-1',
      period_start: '2026-01-01',
      period_end: '2026-12-31',
      checklist: [{ key: 'chk-1', label: 'Riconciliazione bancaria', done: false }],
    };
    service.openClosing(openPayload).subscribe((res) => {
      expect(res.data.id).toBe('cls-1');
      expect(res.data.status).toBe('open');
    });
    const clsReq = httpMock.expectOne((r) => r.url.endsWith('/practice/closings'));
    expect(clsReq.request.method).toBe('POST');
    clsReq.flush({ data: { id: 'cls-1', status: 'open', ...openPayload } as PracticeClosing });

    const chkPayload: PracticeChecklistRequest = {
      items: [{ key: 'chk-1', done: true }],
      notes: 'Completata verifica',
    };
    service.updateClosingChecklist('cls-1', chkPayload).subscribe();
    const updReq = httpMock.expectOne((r) => r.url.endsWith('/practice/closings/cls-1/checklist'));
    expect(updReq.request.method).toBe('PUT');
    updReq.flush({ data: { id: 'cls-1', status: 'open' } });

    const closePayload: PracticeCloseRequest = { allow_unbilled: true, reason: 'Eccezione approvata' };
    service.closePeriod('cls-1', closePayload).subscribe();
    const closeReq = httpMock.expectOne((r) => r.url.endsWith('/practice/closings/cls-1/close'));
    expect(closeReq.request.method).toBe('POST');
    closeReq.flush({ data: { id: 'cls-1', status: 'closed' } });

    service.reopenPeriod('cls-1').subscribe();
    const reopenReq = httpMock.expectOne((r) => r.url.endsWith('/practice/closings/cls-1/reopen'));
    expect(reopenReq.request.method).toBe('POST');
    reopenReq.flush({ data: { id: 'cls-1', status: 'open' } });
  });

  it('should manage retainers, balances, applications, and voids', () => {
    const mockRetainers: PracticeRetainer[] = [
      {
        id: 'ret-1',
        client_id: 'cli-1',
        received_on: '2026-11-01',
        amount: '1500.00',
        balance: '1500.00',
        status: 'available',
      },
    ];

    service.getRetainers({ client_id: 'cli-1', status: 'available' }).subscribe((res) => {
      expect(res.data).toEqual(mockRetainers);
    });
    const retReq = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/practice/retainers') &&
        r.params.get('client_id') === 'cli-1' &&
        r.params.get('status') === 'available',
    );
    expect(retReq.request.method).toBe('GET');
    retReq.flush({ data: mockRetainers });

    const retPayload: PracticeRetainerRequest = {
      client_id: 'cli-1',
      received_on: '2026-11-02',
      amount: '800.00',
    };
    service.createRetainer(retPayload).subscribe((res) => {
      expect(res.data.id).toBe('ret-new');
    });
    const createReq = httpMock.expectOne((r) => r.url.endsWith('/practice/retainers'));
    expect(createReq.request.method).toBe('POST');
    createReq.flush({ data: { id: 'ret-new', ...retPayload, balance: '800.00', status: 'available' } });

    service.getRetainerBalances('cli-1').subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const balReq = httpMock.expectOne(
      (r) => r.url.endsWith('/practice/retainers/balances') && r.params.get('client_id') === 'cli-1',
    );
    expect(balReq.request.method).toBe('GET');
    balReq.flush({ data: [{ client_id: 'cli-1', client_name: 'Alpha Srl', total_received: '1500.00', total_applied: '0.00', current_balance: '1500.00' }] });

    const applyPayload: PracticeRetainerApplyRequest = { fee_note_id: 'fn-1', amount: '500.00' };
    service.applyRetainer('ret-1', applyPayload).subscribe((res) => {
      expect(res.data.amount).toBe('500.00');
    });
    const applyReq = httpMock.expectOne((r) => r.url.endsWith('/practice/retainers/ret-1/apply'));
    expect(applyReq.request.method).toBe('POST');
    applyReq.flush({ data: { id: 'app-1', retainer_id: 'ret-1', fee_note_id: 'fn-1', amount: '500.00', applied_at: '2026-11-03' } });

    service.voidRetainer('ret-1').subscribe((res) => {
      expect(res.data.status).toBe('voided');
    });
    const voidReq = httpMock.expectOne((r) => r.url.endsWith('/practice/retainers/ret-1/void'));
    expect(voidReq.request.method).toBe('POST');
    voidReq.flush({ data: { id: 'ret-1', status: 'voided' } });

    service.getFeeNoteRetainers('fn-1').subscribe((res) => {
      expect(res.data.length).toBe(1);
    });
    const fnRetReq = httpMock.expectOne((r) => r.url.endsWith('/practice/fee-notes/fn-1/retainers'));
    expect(fnRetReq.request.method).toBe('GET');
    fnRetReq.flush({ data: [{ id: 'app-1', retainer_id: 'ret-1', fee_note_id: 'fn-1', amount: '500.00', applied_at: '2026-11-03' }] });
  });
});
