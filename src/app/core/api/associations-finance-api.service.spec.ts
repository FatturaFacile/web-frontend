import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { AssociationsFinanceApiService } from './associations-finance-api.service';

describe('AssociationsFinanceApiService', () => {
  let service: AssociationsFinanceApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/associations`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AssociationsFinanceApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AssociationsFinanceApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  const cases: [string, string, string, () => Observable<unknown>, boolean][] = [
    ['cancelDonationReceipt', 'POST', 'donation-receipts/id1/cancel', () => service.cancelDonationReceipt('id1'), false],
    ['downloadDonationReceiptPdf', 'GET', 'donation-receipts/id1/pdf', () => service.downloadDonationReceiptPdf('id1'), true],
    ['addCampaignExpense', 'POST', 'campaigns/id1/expenses', () => service.addCampaignExpense('id1', { note: 1 }), false],
    ['getCampaignReport', 'GET', 'campaigns/id1/report', () => service.getCampaignReport('id1'), false],
    ['createFivePerMille', 'POST', 'five-per-mille', () => service.createFivePerMille({ note: 1 }), false],
    ['addFivePerMilleExpense', 'POST', 'five-per-mille/id1/expenses', () => service.addFivePerMilleExpense('id1', { note: 1 }), false],
    ['getFivePerMilleReport', 'GET', 'five-per-mille/id1/report', () => service.getFivePerMilleReport('id1'), false],
    ['downloadFivePerMilleCsv', 'GET', 'five-per-mille/id1/csv', () => service.downloadFivePerMilleCsv('id1'), true],
    ['attachSponsorContractDocument', 'POST', 'sponsor-contracts/id1/document', () => service.attachSponsorContractDocument('id1', { title: "t" }, new File(['x'], 'f.pdf')), false],
    ['downloadSponsorContractDocument', 'GET', 'sponsor-contracts/id1/document', () => service.downloadSponsorContractDocument('id1'), true],
    ['getStatementSchemes', 'GET', 'statements/schemes', () => service.getStatementSchemes(), false],
    ['getStatementMappings', 'GET', 'statements/mappings', () => service.getStatementMappings(), false],
    ['createStatementMapping', 'POST', 'statements/mappings', () => service.createStatementMapping({ note: 1 }), false],
    ['updateStatementMapping', 'PUT', 'statements/mappings/id1', () => service.updateStatementMapping('id1', { note: 1 }), false],
    ['deleteStatementMapping', 'DELETE', 'statements/mappings/id1', () => service.deleteStatementMapping('id1'), false],
    ['getStatementFilings', 'GET', 'statements/filings', () => service.getStatementFilings(), false],
    ['getManagementReport', 'GET', 'statements/id1/management-report', () => service.getManagementReport('id1'), false],
    ['getBalanceSheet', 'GET', 'statements/id1/balance-sheet', () => service.getBalanceSheet('id1'), false],
    ['getCashReport', 'GET', 'statements/id1/cash-report', () => service.getCashReport('id1'), false],
    ['getStatementChecks', 'GET', 'statements/id1/checks', () => service.getStatementChecks('id1'), false],
    ['getMissionReport', 'GET', 'statements/id1/mission-report', () => service.getMissionReport('id1'), false],
    ['updateMissionReport', 'PUT', 'statements/id1/mission-report', () => service.updateMissionReport('id1', { note: 1 }), false],
    ['createStatementFiling', 'POST', 'statements/id1/filings', () => service.createStatementFiling('id1', { note: 1 }), false],
    ['markStatementFilingFiled', 'POST', 'statement-filings/id1/filed', () => service.markStatementFilingFiled('id1'), false],
    ['downloadStatementFilingCsv', 'GET', 'statement-filings/id1/csv', () => service.downloadStatementFilingCsv('id1'), true],
    ['downloadStatementFilingPdf', 'GET', 'statement-filings/id1/pdf', () => service.downloadStatementFilingPdf('id1'), true],
    ['getLex398Monitor', 'GET', 'lex398/2026/monitor', () => service.getLex398Monitor(2026), false],
    ['getLex398Register', 'GET', 'lex398/2026/register', () => service.getLex398Register(2026), false],
    ['downloadLex398RegisterCsv', 'GET', 'lex398/2026/register/csv', () => service.downloadLex398RegisterCsv(2026), true],
    ['recordLex398Entry', 'POST', 'lex398/entries', () => service.recordLex398Entry({ note: 1 }), false],
    ['syncLex398Invoices', 'POST', 'lex398/2026/sync-invoices', () => service.syncLex398Invoices(2026), false],
    ['getSportCompensations', 'GET', 'sport/compensations', () => service.getSportCompensations(), false],
    ['createSportCompensation', 'POST', 'sport/compensations', () => service.createSportCompensation({ note: 1 }), false],
    ['getSportExpiries', 'GET', 'sport/expiries', () => service.getSportExpiries(), false],
    ['getSportThresholds', 'GET', 'sport/2026/thresholds', () => service.getSportThresholds(2026), false],
    ['getSportSingleBook', 'GET', 'sport/2026/single-book', () => service.getSportSingleBook(2026), false],
    ['downloadSportSingleBookCsv', 'GET', 'sport/2026/single-book/csv', () => service.downloadSportSingleBookCsv(2026), true],
    ['downloadSportAccountantCsv', 'GET', 'sport/2026/accountant-csv', () => service.downloadSportAccountantCsv(2026), true],
    ['downloadSportRegistryCsv', 'GET', 'sport/2026/registry-csv', () => service.downloadSportRegistryCsv(2026), true],
    ['attachSportContractDocument', 'POST', 'sport-contracts/id1/document', () => service.attachSportContractDocument('id1', { title: "t" }, new File(['x'], 'f.pdf')), false],
    ['downloadSportContractDocument', 'GET', 'sport-contracts/id1/document', () => service.downloadSportContractDocument('id1'), true],
    ['getSectionReport', 'GET', 'sections/id1/report', () => service.getSectionReport('id1'), false],
    ['getNetworkStatements', 'GET', 'network/statements/id1', () => service.getNetworkStatements('id1'), false],
  ];

  it.each(cases)('%s calls %s %s', (_name, method, path, call, isBlob) => {
    call().subscribe();
    const req = httpTesting.expectOne(`${base}/${path}`);
    expect(req.request.method).toBe(method);
    if (isBlob) {
      expect(req.request.responseType).toBe('blob');
      req.flush(new Blob(['x']));
    } else {
      req.flush({ success: true, message: '', data: {} });
    }
  });
});
