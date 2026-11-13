import { WritableSignal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  BankAccountResource,
  BankStatement,
  BankTransactionResource,
  BankingApiService,
  BillingApiService,
  CashForecastResource,
  PaymentBatchResource,
  TreasuryApiService,
} from '@core';
import { TreasuryComponent } from './treasury.component';

describe('TreasuryComponent', () => {
  let fixture: ComponentFixture<TreasuryComponent>;
  let component: TreasuryComponent;
  let treasuryApiMock: Partial<TreasuryApiService>;
  let bankingApiMock: Partial<BankingApiService>;
  let billingApiMock: { uploadPaymentImport: ReturnType<typeof vi.fn> };
  let messageMock: Partial<NzMessageService>;

  const mockAccount: BankAccountResource = {
    id: 'ba-1',
    bank_name: 'Banca Popolare',
    iban: 'IT60X0569601600000001234567',
    currency: 'EUR',
    current_balance: 50000,
    available_balance: 50000,
    is_active: true,
  };

  const mockTx: BankTransactionResource = {
    id: 'tx-1',
    bank_account_id: 'ba-1',
    transaction_date: '2026-11-09',
    amount: 1500,
    currency: 'EUR',
    description: 'Bonifico Cliente',
    reconciled: false,
  };

  const mockStatement: BankStatement = {
    id: 'st-1',
    iban: 'IT60X0569601600000001234567',
    statement_date: '2026-11-01',
    opening_balance: 40000,
    closing_balance: 50000,
    currency: 'EUR',
    status: 'imported',
    source_format: 'camt053',
  };

  const mockBatch: PaymentBatchResource = {
    id: 'pb-1',
    batch_reference: 'DIST-2026-001',
    bank_account_id: 'ba-1',
    payment_method: 'sepa_credit_transfer',
    execution_date: '2026-11-10',
    currency: 'EUR',
    total_amount: 1200,
    total_count: 1,
    status: 'draft',
    lines: [
      {
        recipient_name: 'Vendor X',
        recipient_iban: 'IT00X12345',
        amount: 1200,
      },
    ],
  };

  const mockForecast: CashForecastResource = {
    id: 'cf-1',
    forecast_date: '2026-11-09',
    horizon_days: 30,
    opening_cash: 50000,
    expected_inflows: 20000,
    expected_outflows: 10000,
    projected_cash: 60000,
    deficit_identified: false,
    currency: 'EUR',
  };

  beforeEach(() => {
    billingApiMock = {
      uploadPaymentImport: vi.fn().mockReturnValue(of({ data: { id: 'pi-1', lines: [{ id: 'l1' }, { id: 'l2' }] } })),
    };
    treasuryApiMock = {
      getBankAccounts: vi.fn().mockReturnValue(of({ data: [mockAccount] })),
      createBankAccount: vi.fn().mockReturnValue(of({ data: mockAccount })),
      deleteBankAccount: vi.fn().mockReturnValue(of(void 0)),
      getBankTransactions: vi.fn().mockImplementation((query?: { grid_values?: string }) =>
        of(
          query?.grid_values
            ? { data: [{ value: 'unmatched', count: 1 }] }
            : { data: [mockTx], meta: { total: 1 } },
        ),
      ),
      reconcileTransactionsAutoMatch: vi.fn().mockReturnValue(of({ data: { matched_count: 3 } })),
      importCbiFile: vi.fn().mockReturnValue(of({ data: { imported_count: 4 } })),
      getPaymentBatches: vi.fn().mockReturnValue(of({ data: [mockBatch], meta: { total: 1 } })),
      createPaymentBatch: vi.fn().mockReturnValue(of({ data: mockBatch })),
      submitPaymentBatchApproval: vi.fn().mockReturnValue(of({ data: { ...mockBatch, status: 'pending_approval' } })),
      approvePaymentBatch: vi.fn().mockReturnValue(of({ data: { ...mockBatch, status: 'approved' } })),
      exportPaymentBatch: vi.fn().mockReturnValue(of({ data: { file_content: '<xml/>' } })),
      downloadPaymentBatchXml: vi.fn().mockReturnValue(of(new Blob(['xml content'], { type: 'application/xml' }))),
      cancelPaymentBatch: vi.fn().mockReturnValue(of({ data: { ...mockBatch, status: 'cancelled' } })),
      getCashForecasts: vi.fn().mockReturnValue(of({ data: [mockForecast] })),
      generateCashForecast: vi.fn().mockReturnValue(of({ data: mockForecast })),
    };

    bankingApiMock = {
      getBankStatements: vi.fn().mockReturnValue(of({ data: [mockStatement], meta: { total: 1 } })),
      reconcileStatement: vi.fn().mockReturnValue(of({ data: { reconciled_count: 5 } })),
    };

    messageMock = {
      success: vi.fn(),
      warning: vi.fn(),
      error: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [TreasuryComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: TreasuryApiService, useValue: treasuryApiMock },
        { provide: BankingApiService, useValue: bankingApiMock },
        { provide: BillingApiService, useValue: billingApiMock },
        { provide: NzMessageService, useValue: messageMock },
      ],
    });

    fixture = TestBed.createComponent(TreasuryComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as unknown as { modal: { confirm: (opts: { nzOnOk?: () => void }) => NzModalRef } }).modal, 'confirm').mockImplementation(config => {
      config.nzOnOk?.();
      return {} as NzModalRef;
    });
    fixture.detectChanges();
  });

  it('creates the component and loads initial treasury data', async () => {
    await new Promise((resolve) => setTimeout(resolve, 400));
    expect(component).toBeTruthy();
    expect(treasuryApiMock.getBankAccounts).toHaveBeenCalled();
    expect(treasuryApiMock.getBankTransactions).toHaveBeenCalled();
    expect(bankingApiMock.getBankStatements).toHaveBeenCalled();
    expect(treasuryApiMock.getPaymentBatches).toHaveBeenCalled();
    expect(treasuryApiMock.getCashForecasts).toHaveBeenCalled();
    expect(component.totalEurBalance()).toBe(50000);
    expect(component.unreconciledCount()).toBe(1);
  });

  it('triggers auto-match reconciliation', () => {
    component.triggerAutoMatch();
    expect(treasuryApiMock.reconcileTransactionsAutoMatch).toHaveBeenCalled();
    expect(messageMock.success).toHaveBeenCalled();
  });

  it('reconciles a bank statement', () => {
    component.reconcileStatement(mockStatement);
    expect(bankingApiMock.reconcileStatement).toHaveBeenCalledWith('st-1');
    expect(messageMock.success).toHaveBeenCalled();
  });

  it('adds a new bank account through modal form', () => {
    component.openAccountModal();
    expect(component.accountModalVisible()).toBe(true);

    component.accountForm.patchValue({
      bank_name: 'BPS',
      iban: 'DE89370400440532013000',
      currency: 'EUR',
      opening_balance: 10000,
    });

    component.submitAccount();
    expect(treasuryApiMock.createBankAccount).toHaveBeenCalled();
    expect(component.accountModalVisible()).toBe(false);
  });

  it('rejects an IBAN with a wrong checksum', () => {
    component.openAccountModal();
    component.accountForm.patchValue({ bank_name: 'BPS', iban: 'IT60X0542811101000000123457' });
    expect(component.accountForm.controls.iban.hasError('iban')).toBe(true);
    component.submitAccount();
    expect(treasuryApiMock.createBankAccount).not.toHaveBeenCalled();
  });

  it('does not create a bank account or a payment batch from an empty form', () => {
    treasuryApiMock.createBankAccount.mockClear();
    treasuryApiMock.createPaymentBatch.mockClear();
    component.openAccountModal();
    component.submitAccount();
    component.openBatchModal();
    component.batchForm.patchValue({ amount: 0 });
    component.submitBatch();

    expect(treasuryApiMock.createBankAccount).not.toHaveBeenCalled();
    expect(treasuryApiMock.createPaymentBatch).not.toHaveBeenCalled();
    expect(component.accountForm.controls.bank_name.touched).toBe(true);
  });

  it('deletes bank account', () => {
    component.deleteAccount(mockAccount);
    expect(treasuryApiMock.deleteBankAccount).toHaveBeenCalledWith('ba-1');
    expect(messageMock.success).toHaveBeenCalled();
  });

  it('creates a new payment batch', () => {
    component.openBatchModal();
    expect(component.batchModalVisible()).toBe(true);

    component.batchForm.patchValue({
      bank_account_id: 'ba-1',
      batch_reference: 'DIST-TEST',
      payment_method: 'sepa_credit_transfer',
      recipient_name: 'Vendor Y',
      recipient_iban: 'IT60X0542811101000000123456',
      amount: 450,
    });

    component.submitBatch();
    expect(treasuryApiMock.createPaymentBatch).toHaveBeenCalled();
    expect(component.batchModalVisible()).toBe(false);
  });

  it('executes payment batch actions (submit, approve, export, download, cancel)', () => {
    component.submitBatchApproval(mockBatch);
    expect(treasuryApiMock.submitPaymentBatchApproval).toHaveBeenCalledWith('pb-1');

    component.approveBatch(mockBatch);
    expect(treasuryApiMock.approvePaymentBatch).toHaveBeenCalledWith('pb-1');

    component.exportBatchXml(mockBatch);
    expect(treasuryApiMock.exportPaymentBatch).toHaveBeenCalledWith('pb-1');

    component.downloadBatchXml(mockBatch);
    expect(treasuryApiMock.downloadPaymentBatchXml).toHaveBeenCalledWith('pb-1');

    component.cancelBatch(mockBatch);
    expect(treasuryApiMock.cancelPaymentBatch).toHaveBeenCalledWith('pb-1');
  });

  it('imports a CAMT file through the payment import, not the deprecated treasury endpoint', () => {
    const file = new File(['<xml/>'], 'camt053.xml', { type: 'text/xml' });
    (component as unknown as { selectedFile: WritableSignal<File | null> }).selectedFile.set(file);
    (component as unknown as { importFormat: string }).importFormat = 'camt';
    component.submitImport();
    expect(billingApiMock.uploadPaymentImport).toHaveBeenCalledWith(file);
    expect(messageMock.success).toHaveBeenCalledWith('treasury.msgImportatiMovimentiCamt');
  });

  it('generates cash flow forecast', () => {
    component.generateForecast(30);
    expect(treasuryApiMock.generateCashForecast).toHaveBeenCalledWith(30);
    expect(messageMock.success).toHaveBeenCalled();
  });
});
