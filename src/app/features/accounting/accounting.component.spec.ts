import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  AccountingApiService,
  ChartOfAccount,
  FiscalPeriodResource,
  IntrastatDeclarationResource,
  JournalEntryResource,
  TaxSettlementResource,
  TrialBalanceReport,
} from '@core';
import { AccountingComponent } from './accounting.component';

describe('AccountingComponent', () => {
  let fixture: ComponentFixture<AccountingComponent>;
  let component: AccountingComponent;
  let apiMock: Partial<AccountingApiService>;
  let messageMock: Partial<NzMessageService>;

  const mockJournal: JournalEntryResource = {
    id: 'j-1',
    entry_number: 'PN-2026-0001',
    fiscal_period_id: 'fp-1',
    posting_date: '2026-11-09',
    ledger_type: 'statutory',
    journal_type: 'standard',
    description: 'Fattura vendita n. 1',
    status: 'draft',
    lines: [
      { account_id: 'acc-1', account_code: '1000', account_name: 'Banca', debit_amount: 1220, credit_amount: 0 },
      { account_id: 'acc-2', account_code: '4000', account_name: 'Merci c/vendite', debit_amount: 0, credit_amount: 1000 },
      { account_id: 'acc-3', account_code: '2200', account_name: 'Erario c/IVA', debit_amount: 0, credit_amount: 220 },
    ],
  };

  const mockAccount: ChartOfAccount = {
    id: 'acc-1',
    code: '10.01.001',
    name: 'Banca Popolare c/c',
    type: 'asset',
    balance: 50000,
  };

  const mockVat: TaxSettlementResource = {
    id: 'ts-1',
    period_type: 'monthly',
    year: 2026,
    period: 10,
    vat_payable: 2200,
    vat_receivable: 1000,
    balance: 1200,
    status: 'calculated',
  };

  const mockPeriod: FiscalPeriodResource = {
    id: 'fp-1',
    name: 'Ottobre 2026',
    year: 2026,
    period_number: 10,
    start_date: '2026-10-01',
    end_date: '2026-10-31',
    status: 'open',
  };

  const mockIntra: IntrastatDeclarationResource = {
    id: 'intra-1',
    declaration_number: 'INTRA-2026-10',
    year: 2026,
    month: 10,
    direction: 'dispatch',
    total_amount: 45000,
    status: 'draft',
  };

  const mockTrialBalance: TrialBalanceReport = {
    fiscal_year: 2026,
    period_from: '2026-01-01',
    period_to: '2026-12-31',
    items: [
      {
        account_code: '1000',
        account_name: 'Cassa e Banche',
        account_type: 'asset',
        opening_balance: 10000,
        debit_movement: 5000,
        credit_movement: 2000,
        closing_balance: 13000,
      },
    ],
    total_debit: 5000,
    total_credit: 5000,
  };

  beforeEach(() => {
    apiMock = {
      getJournals: vi.fn().mockReturnValue(of({ data: [mockJournal], meta: { total: 1 } })),
      postJournal: vi.fn().mockReturnValue(of({ data: { ...mockJournal, status: 'posted' } })),
      reverseJournal: vi.fn().mockReturnValue(of({ data: { ...mockJournal, status: 'reversed' } })),
      getAccounts: vi.fn().mockReturnValue(of({ data: [mockAccount] })),
      createAccount: vi.fn().mockReturnValue(of({ data: mockAccount })),
      getTaxSettlements: vi.fn().mockReturnValue(of({ data: [mockVat], meta: { total: 1 } })),
      calculateTaxSettlement: vi.fn().mockReturnValue(of({ data: mockVat })),
      postTaxSettlement: vi.fn().mockReturnValue(of({ data: { ...mockVat, status: 'posted' } })),
      payTaxSettlement: vi.fn().mockReturnValue(of({ data: { ...mockVat, status: 'paid' } })),
      getFiscalPeriods: vi.fn().mockReturnValue(of({ data: [mockPeriod] })),
      closeFiscalPeriod: vi.fn().mockReturnValue(of({ data: { ...mockPeriod, status: 'closed' } })),
      reopenFiscalPeriod: vi.fn().mockReturnValue(of({ data: { ...mockPeriod, status: 'open' } })),
      getIntrastatDeclarations: vi.fn().mockReturnValue(of({ data: [mockIntra], meta: { total: 1 } })),
      generateIntrastatDeclaration: vi.fn().mockReturnValue(of({ data: mockIntra })),
      validateIntrastatDeclaration: vi.fn().mockReturnValue(of({ data: { is_valid: true } })),
      submitIntrastatDeclaration: vi.fn().mockReturnValue(of({ data: { ...mockIntra, status: 'submitted' } })),
      getTrialBalance: vi.fn().mockReturnValue(of({ data: mockTrialBalance })),
    };

    messageMock = {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [AccountingComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: AccountingApiService, useValue: apiMock },
        { provide: NzMessageService, useValue: messageMock },
      ],
    });

    fixture = TestBed.createComponent(AccountingComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as any).modal, 'confirm').mockImplementation((config: any) => {
      config.nzOnOk?.();
      return {} as any;
    });
    fixture.detectChanges();
  });

  it('creates the component and loads initial accounting data', () => {
    expect(component).toBeTruthy();
    expect(apiMock.getJournals).toHaveBeenCalled();
    expect(apiMock.getAccounts).toHaveBeenCalled();
    expect(apiMock.getTaxSettlements).toHaveBeenCalled();
    expect(apiMock.getFiscalPeriods).toHaveBeenCalled();
    expect(apiMock.getIntrastatDeclarations).toHaveBeenCalled();
    expect(apiMock.getTrialBalance).toHaveBeenCalled();
    expect(component['ledgerEntries']()).toHaveLength(1);
    expect(component['chartOfAccounts']()).toHaveLength(1);
  });

  it('posts and reverses journal entry', () => {
    component.postJournal(mockJournal);
    expect(apiMock.postJournal).toHaveBeenCalledWith('j-1');
    expect(messageMock.success).toHaveBeenCalled();

    component.reverseJournal(mockJournal);
    expect(apiMock.reverseJournal).toHaveBeenCalledWith('j-1');
    expect(messageMock.success).toHaveBeenCalled();
  });

  it('creates chart of accounts item through modal form', () => {
    component.openAccountModal();
    expect(component['accountModalVisible']()).toBe(true);

    component.accountForm.patchValue({
      code: '10.02.001',
      name: 'Banca Secondaria',
      type: 'asset',
      currency: 'EUR',
    });

    component.submitAccount();
    expect(apiMock.createAccount).toHaveBeenCalled();
    expect(component['accountModalVisible']()).toBe(false);
  });

  it('calculates, posts and pays tax/VAT settlement', () => {
    component.openCalcVatModal();
    expect(component['calcVatModalVisible']()).toBe(true);

    component.calcVatForm.patchValue({
      period_type: 'monthly',
      year: 2026,
      period: 10,
    });

    component.submitCalculateVat();
    expect(apiMock.calculateTaxSettlement).toHaveBeenCalled();
    expect(component['calcVatModalVisible']()).toBe(false);

    component.postVatSettlement(mockVat);
    expect(apiMock.postTaxSettlement).toHaveBeenCalledWith('ts-1');

    component.payVatSettlement(mockVat);
    expect(apiMock.payTaxSettlement).toHaveBeenCalledWith('ts-1');
  });

  it('closes and reopens fiscal period', () => {
    component.closePeriod(mockPeriod);
    expect(apiMock.closeFiscalPeriod).toHaveBeenCalledWith('fp-1');

    component.reopenPeriod(mockPeriod);
    expect(apiMock.reopenFiscalPeriod).toHaveBeenCalledWith('fp-1');
  });

  it('generates, validates and submits Intrastat declaration', () => {
    component.openIntrastatModal();
    expect(component['intrastatModalVisible']()).toBe(true);

    component.intrastatForm.patchValue({
      year: 2026,
      period: 10,
      direction: 'dispatch',
    });

    component.submitGenerateIntrastat();
    expect(apiMock.generateIntrastatDeclaration).toHaveBeenCalled();
    expect(component['intrastatModalVisible']()).toBe(false);

    component.validateIntrastat(mockIntra);
    expect(apiMock.validateIntrastatDeclaration).toHaveBeenCalledWith('intra-1');

    component.submitIntrastat(mockIntra);
    expect(apiMock.submitIntrastatDeclaration).toHaveBeenCalledWith('intra-1');
  });

  it('reloads trial balance successfully', () => {
    component.loadTrialBalance(2026);
    expect(apiMock.getTrialBalance).toHaveBeenCalledWith(2026);
    expect(component['trialBalance']()?.total_debit).toBe(5000);
  });
});
