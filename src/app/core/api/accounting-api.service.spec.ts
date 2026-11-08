import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import {
  AccountingApiService,
  CalculateTaxSettlementPayload,
  CreateJournalEntryPayload,
} from '@core';

describe('AccountingApiService', () => {
  let service: AccountingApiService;
  let httpTesting: HttpTestingController;
  const glBase = `${environment.apiBaseUrl}/general-ledger`;
  const intrastatBase = `${environment.apiBaseUrl}/intrastat`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AccountingApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(AccountingApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  it('fetches chart of accounts and tree structure', () => {
    service.getAccounts().subscribe((res) => {
      expect(res.data).toHaveLength(2);
    });
    const req = httpTesting.expectOne(`${glBase}/accounts`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'OK', data: [{ id: 'acc-1', code: '1000' }, { id: 'acc-2', code: '2000' }] });

    service.getAccountsTree().subscribe((res) => {
      expect(res.data[0].children).toBeDefined();
    });
    const reqTree = httpTesting.expectOne(`${glBase}/accounts-tree`);
    expect(reqTree.request.method).toBe('GET');
    reqTree.flush({ success: true, message: 'OK', data: [{ id: 'acc-1', code: '1000', children: [] }] });
  });

  it('manages journal entries lifecycle (create, post, reverse, validate-balance)', () => {
    const payload: CreateJournalEntryPayload = {
      fiscal_period_id: 'fp-1',
      posting_date: '2026-11-09',
      description: 'Storno stipendi',
      lines: [
        { account_id: 'acc-1', debit_amount: 1000, credit_amount: 0 },
        { account_id: 'acc-2', debit_amount: 0, credit_amount: 1000 },
      ],
    };

    service.createJournal(payload).subscribe((res) => {
      expect(res.data.id).toBe('j-1');
    });
    const reqCreate = httpTesting.expectOne(`${glBase}/journals`);
    expect(reqCreate.request.method).toBe('POST');
    reqCreate.flush({ success: true, message: 'Created', data: { id: 'j-1', ...payload, status: 'draft' } });

    service.postJournal('j-1').subscribe((res) => {
      expect(res.data.status).toBe('posted');
    });
    const reqPost = httpTesting.expectOne(`${glBase}/journals/j-1/post`);
    expect(reqPost.request.method).toBe('POST');
    reqPost.flush({ success: true, message: 'Posted', data: { id: 'j-1', status: 'posted' } });

    service.reverseJournal('j-1').subscribe((res) => {
      expect(res.data.status).toBe('reversed');
    });
    const reqReverse = httpTesting.expectOne(`${glBase}/journals/j-1/reverse`);
    expect(reqReverse.request.method).toBe('POST');
    reqReverse.flush({ success: true, message: 'Reversed', data: { id: 'j-1', status: 'reversed' } });

    service.validateJournalBalance(payload.lines).subscribe((res) => {
      expect(res.data.balanced).toBe(true);
    });
    const reqVal = httpTesting.expectOne(`${glBase}/journals/validate-balance`);
    expect(reqVal.request.method).toBe('POST');
    reqVal.flush({ success: true, message: 'OK', data: { balanced: true, difference: 0 } });
  });

  it('handles fiscal periods (get, close, reopen)', () => {
    service.getFiscalPeriods().subscribe((res) => {
      expect(res.data).toHaveLength(1);
    });
    const req = httpTesting.expectOne(`${glBase}/fiscal-periods`);
    expect(req.request.method).toBe('GET');
    req.flush({ success: true, message: 'OK', data: [{ id: 'fp-1', status: 'open' }] });

    service.closeFiscalPeriod('fp-1').subscribe((res) => {
      expect(res.data.status).toBe('closed');
    });
    const reqClose = httpTesting.expectOne(`${glBase}/fiscal-periods/fp-1/close`);
    expect(reqClose.request.method).toBe('POST');
    reqClose.flush({ success: true, message: 'Closed', data: { id: 'fp-1', status: 'closed' } });
  });

  it('manages tax and VAT settlements (calculate, post, pay)', () => {
    const calcPayload: CalculateTaxSettlementPayload = {
      period_type: 'monthly',
      year: 2026,
      period: 10,
    };

    service.calculateTaxSettlement(calcPayload).subscribe((res) => {
      expect(res.data.balance).toBe(1500);
    });
    const reqCalc = httpTesting.expectOne(`${glBase}/tax-settlements/calculate`);
    expect(reqCalc.request.method).toBe('POST');
    reqCalc.flush({ success: true, message: 'Calculated', data: { id: 'ts-1', balance: 1500, status: 'calculated' } });

    service.postTaxSettlement('ts-1').subscribe();
    const reqPost = httpTesting.expectOne(`${glBase}/tax-settlements/ts-1/post`);
    expect(reqPost.request.method).toBe('POST');
    reqPost.flush({ success: true, message: 'Posted', data: { id: 'ts-1', status: 'posted' } });

    service.payTaxSettlement('ts-1').subscribe();
    const reqPay = httpTesting.expectOne(`${glBase}/tax-settlements/ts-1/pay`);
    expect(reqPay.request.method).toBe('POST');
    reqPay.flush({ success: true, message: 'Paid', data: { id: 'ts-1', status: 'paid' } });
  });

  it('manages Intrastat declarations (generate, validate, submit)', () => {
    service.generateIntrastatDeclaration(2026, 10, 'dispatch').subscribe((res) => {
      expect(res.data.id).toBe('intra-1');
    });
    const reqGen = httpTesting.expectOne(`${intrastatBase}/declarations/generate`);
    expect(reqGen.request.method).toBe('POST');
    reqGen.flush({ success: true, message: 'Generated', data: { id: 'intra-1', status: 'draft' } });

    service.validateIntrastatDeclaration('intra-1').subscribe((res) => {
      expect(res.data.is_valid).toBe(true);
    });
    const reqVal = httpTesting.expectOne(`${intrastatBase}/declarations/intra-1/validate`);
    expect(reqVal.request.method).toBe('POST');
    reqVal.flush({ success: true, message: 'Valid', data: { is_valid: true } });

    service.submitIntrastatDeclaration('intra-1').subscribe((res) => {
      expect(res.data.status).toBe('submitted');
    });
    const reqSub = httpTesting.expectOne(`${intrastatBase}/declarations/intra-1/submit`);
    expect(reqSub.request.method).toBe('POST');
    reqSub.flush({ success: true, message: 'Submitted', data: { id: 'intra-1', status: 'submitted' } });
  });

  it('fetches trial balance financial statement', () => {
    service.getTrialBalance(2026).subscribe((res) => {
      expect(res.data.total_debit).toBe(100000);
      expect(res.data.total_credit).toBe(100000);
    });
    const req = httpTesting.expectOne(`${glBase}/financial-statements/trial-balance?year=2026`);
    expect(req.request.method).toBe('GET');
    req.flush({
      success: true,
      message: 'OK',
      data: {
        fiscal_year: 2026,
        period_from: '2026-01-01',
        period_to: '2026-12-31',
        items: [],
        total_debit: 100000,
        total_credit: 100000,
      },
    });
  });
});
