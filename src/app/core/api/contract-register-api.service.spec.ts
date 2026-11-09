import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ContractRegisterApiService } from './contract-register-api.service';
import {
  ContractSaveObligationRequest,
  RenewContractRequest,
  StoreContractRequest,
} from '../models';

describe('ContractRegisterApiService', () => {
  let service: ContractRegisterApiService;
  let httpTesting: HttpTestingController;
  const base = environment.apiBaseUrl;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [ContractRegisterApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ContractRegisterApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('fetches contracts list with query params', () => {
    service
      .getContracts({ kind: 'customer', status: 'active', page: 1, per_page: 15 })
      .subscribe((res) => {
        expect(res.data.length).toBe(1);
        expect(res.data[0].contract_number).toBe('CTR-2026-001');
      });

    const req = httpTesting.expectOne((r) => r.url === `${base}/contract-register`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('kind')).toBe('customer');
    expect(req.request.params.get('status')).toBe('active');

    req.flush({
      success: true,
      data: [{ id: 'ctr-1', kind: 'customer', contract_number: 'CTR-2026-001', status: 'active' }],
      meta: { current_page: 1, total: 1 },
    });
  });

  it('creates a new contract record', () => {
    const payload: StoreContractRequest = {
      kind: 'supplier',
      counterparty_id: 'supp-456',
      contract_number: 'SUP-2026-09',
      title: 'Contratto Manutenzione Server Cloud',
      start_date: '2026-01-01',
      end_date: '2026-12-31',
      currency: 'CHF',
      total_value: '24000.00',
    };

    service.createContract(payload).subscribe((res) => {
      expect(res.data.id).toBe('ctr-new');
      expect(res.data.contract_number).toBe(payload.contract_number);
    });

    const req = httpTesting.expectOne(`${base}/contract-register`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({ success: true, data: { id: 'ctr-new', ...payload, status: 'draft' } });
  });

  it('renews an existing contract', () => {
    const payload: RenewContractRequest = {
      new_end_date: '2027-12-31',
      renewal_term_months: 12,
      revised_value: '26000.00',
    };

    service.renewContract('customer', 'ctr-1', payload).subscribe((res) => {
      expect(res.data.status).toBe('renewed');
    });

    const req = httpTesting.expectOne(`${base}/contract-register/customer/ctr-1/renew`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual(payload);

    req.flush({ success: true, data: { id: 'ctr-1', status: 'renewed' } });
  });

  it('manages contractual obligations (add, complete, waive)', () => {
    const payload: ContractSaveObligationRequest = {
      type: 'milestone',
      title: 'Collaudo Finale Software ERP',
      due_date: '2026-06-30',
      penalty_amount: '5000.00',
    };

    service.addObligation('customer', 'ctr-1', payload).subscribe((res) => {
      expect(res.data.id).toBe('ob-1');
    });

    const reqAdd = httpTesting.expectOne(`${base}/contract-register/customer/ctr-1/obligations`);
    expect(reqAdd.request.method).toBe('POST');
    reqAdd.flush({ success: true, data: { id: 'ob-1', ...payload, status: 'pending' } });

    service.completeObligation('ob-1', { notes: 'Collaudo completato con esito positivo' }).subscribe((res) => {
      expect(res.data.status).toBe('completed');
    });

    const reqComp = httpTesting.expectOne(`${base}/contract-register/obligations/ob-1/complete`);
    expect(reqComp.request.method).toBe('POST');
    reqComp.flush({ success: true, data: { id: 'ob-1', status: 'completed' } });

    service.waiveObligation('ob-1', { reason: 'Accordo stragiudiziale' }).subscribe((res) => {
      expect(res.data.status).toBe('waived');
    });

    const reqWaive = httpTesting.expectOne(`${base}/contract-register/obligations/ob-1/waive`);
    expect(reqWaive.request.method).toBe('POST');
    reqWaive.flush({ success: true, data: { id: 'ob-1', status: 'waived' } });
  });

  it('acknowledges contract alerts', () => {
    service.acknowledgeAlert('alert-1').subscribe((res) => {
      expect(res.data.success).toBe(true);
    });

    const req = httpTesting.expectOne(`${base}/contract-register/alerts/alert-1/acknowledge`);
    expect(req.request.method).toBe('POST');
    req.flush({ success: true, data: { success: true } });
  });
});
