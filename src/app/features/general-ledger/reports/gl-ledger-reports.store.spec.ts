import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralLedgerApiService } from '@core';
import { GlLedgerReportsStore } from './gl-ledger-reports.store';

describe('GlLedgerReportsStore', () => {
  const api = { getTrialBalanceReport: vi.fn(), getAccountLedger: vi.fn() };

  function create() {
    TestBed.configureTestingModule({
      providers: [{ provide: GeneralLedgerApiService, useValue: api }],
    });
    return TestBed.inject(GlLedgerReportsStore);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getTrialBalanceReport.mockReturnValue(
      of({ success: true, message: '', data: { accounts: [], totals: {} } }),
    );
    api.getAccountLedger.mockReturnValue(
      of({ success: true, message: '', data: { lines: [], meta: { total: 0 } } }),
    );
  });

  it('sends the book, the layout and the dimensions to the trial balance', async () => {
    const store = create();
    store.setFilters({
      ledger: '02',
      columns: 2,
      from: '2026-01-01',
      to: '2026-06-30',
      costCenterId: 'cc1',
      profitCenterId: 'd1',
    });
    await store.loadTrialBalance();
    expect(api.getTrialBalanceReport).toHaveBeenCalledWith({
      from: '2026-01-01',
      to: '2026-06-30',
      compare_from: null,
      compare_to: null,
      cost_center_id: 'cc1',
      profit_center_id: 'd1',
      ledger: '02',
      columns: 2,
    });
    expect(store.trialBalance()).not.toBeNull();
    expect(store.trialBalanceLoading()).toBe(false);
  });

  it('does not call the API for a range that ends before it starts', async () => {
    const store = create();
    store.setFilters({ from: '2026-12-31', to: '2026-01-01' });
    expect(store.rangeInvalid()).toBe(true);
    await store.loadTrialBalance();
    expect(api.getTrialBalanceReport).not.toHaveBeenCalled();
  });

  it('keeps the error and stops loading when the report fails', async () => {
    api.getTrialBalanceReport.mockReturnValue(throwError(() => new Error('boom')));
    const store = create();
    await store.loadTrialBalance();
    expect(store.error()).toBeInstanceOf(Error);
    expect(store.trialBalanceLoading()).toBe(false);
  });

  it('drills down to the account ledger of the row with the same range and book', async () => {
    const store = create();
    store.setFilters({ ledger: '03', from: '2026-01-01', to: '2026-12-31' });
    await store.openAccountLedger('acc-1');
    expect(store.activeTab()).toBe(1);
    expect(store.accountId()).toBe('acc-1');
    expect(api.getAccountLedger).toHaveBeenCalledWith(
      expect.objectContaining({
        account_id: 'acc-1',
        from: '2026-01-01',
        to: '2026-12-31',
        ledger: '03',
        page: 1,
      }),
    );
  });

  it('needs an account to load the account ledger', async () => {
    const store = create();
    await store.loadAccountLedger(2);
    expect(api.getAccountLedger).not.toHaveBeenCalled();
    store.setAccountId('acc-2');
    await store.loadAccountLedger(2);
    expect(api.getAccountLedger).toHaveBeenCalledWith(
      expect.objectContaining({ account_id: 'acc-2', page: 2 }),
    );
  });
});
