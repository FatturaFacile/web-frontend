import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivablesApiService } from '@core';
import { CustomerLedgerStore } from './customer-ledger.store';
import { ledger } from './receivables.fixtures';

describe('CustomerLedgerStore', () => {
  let api: { getLedger: ReturnType<typeof vi.fn> };
  let store: InstanceType<typeof CustomerLedgerStore>;

  beforeEach(() => {
    api = { getLedger: vi.fn(() => of({ data: ledger })) };
    TestBed.configureTestingModule({
      providers: [CustomerLedgerStore, { provide: ReceivablesApiService, useValue: api }],
    });
    store = TestBed.inject(CustomerLedgerStore);
  });

  it('loads the ledger of a customer with the running balance and the totals', async () => {
    await store.load('c-1');

    expect(api.getLedger).toHaveBeenCalledWith('c-1', {});
    expect(store.movements()).toHaveLength(2);
    expect(store.closingBalance()).toBe('200.00');
    expect(store.totalDebit()).toBe('300.00');
    expect(store.totalCredit()).toBe('100.00');
    expect(store.currencies()).toEqual(['EUR']);
    expect(store.loading()).toBe(false);
  });

  it('keeps the other filters when one changes', async () => {
    await store.load('c-1', { from: '2026-01-01' });

    await store.setFilters({ status: 'overdue' });
    expect(api.getLedger).toHaveBeenLastCalledWith('c-1', { from: '2026-01-01', status: 'overdue' });

    await store.setFilters({ status: undefined, to: '2026-03-31' });
    expect(api.getLedger).toHaveBeenLastCalledWith('c-1', {
      from: '2026-01-01',
      status: undefined,
      to: '2026-03-31',
    });
  });

  it('does nothing without a customer', async () => {
    await store.setFilters({ status: 'open' });
    await store.refresh();

    expect(api.getLedger).not.toHaveBeenCalled();
  });

  it('drops the previous customer ledger while another one loads', async () => {
    await store.load('c-1');
    api.getLedger.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Not found' } })),
    );

    await store.load('c-2');

    expect(store.ledger()).toBeNull();
    expect(store.error()).toBe('Not found');
  });

  it('refreshes with the filters in force and clears', async () => {
    await store.load('c-1', { document_type: 'invoice' });

    await store.refresh();
    expect(api.getLedger).toHaveBeenLastCalledWith('c-1', { document_type: 'invoice' });

    store.clear();
    expect(store.customerId()).toBeNull();
    expect(store.ledger()).toBeNull();
  });
});
