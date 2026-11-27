import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BankingApiService } from '@core/api/banking-api.service';
import { exceptionLine, exceptionPage } from './iso-reconciliation.testing';
import { ReconciliationExceptionsStore } from './reconciliation-exceptions.store';

describe('ReconciliationExceptionsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof ReconciliationExceptionsStore>;

  beforeEach(() => {
    api = {
      getReconciliationExceptions: vi.fn(() =>
        of(
          exceptionPage(
            [
              exceptionLine({ id: 'l-1', exception_code: 'AmountMismatch' }),
              exceptionLine({ id: 'l-2', exception_code: 'Unmatched', exception_candidate: null }),
            ],
            { AmountMismatch: 4, Unmatched: 7, DuplicatePayment: 1 },
          ),
        ),
      ),
      assignLineToInvoice: vi.fn(() => of({ success: true, data: {} })),
      categorizeLine: vi.fn(() => of({ success: true, data: {} })),
    };
    TestBed.configureTestingModule({
      providers: [ReconciliationExceptionsStore, { provide: BankingApiService, useValue: api }],
    });
    store = TestBed.inject(ReconciliationExceptionsStore);
  });

  it('loads the lines with the count of every exception code', async () => {
    await store.load();

    expect(store.lines()).toHaveLength(2);
    expect(store.counts()).toEqual({
      Unmatched: 7,
      AmountMismatch: 4,
      DuplicatePayment: 1,
      AlreadyPaid: 0,
      InvalidReference: 0,
    });
    expect(store.totalOpen()).toBe(12);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('queries the API with the selected code, direction and search, back on the first page', async () => {
    await store.load();
    await store.goTo(3);
    await store.setCode('Unmatched');
    await store.setDirection('credit');
    await store.setSearch('  müller ');

    expect(api['getReconciliationExceptions']).toHaveBeenLastCalledWith({
      code: 'Unmatched',
      direction: 'credit',
      search: 'müller',
      page: 1,
      per_page: 25,
    });
    expect(store.page()).toBe(1);
  });

  it('takes an assigned line out of the queue and keeps the counters in step', async () => {
    await store.load();

    const done = await store.assign('l-1', 'inv-1', 'write_off');

    expect(done).toBe(true);
    expect(api['assignLineToInvoice']).toHaveBeenCalledWith('l-1', {
      invoice_id: 'inv-1',
      difference_handling: 'write_off',
    });
    expect(store.lines().map((line) => line.id)).toEqual(['l-2']);
    expect(store.counts().AmountMismatch).toBe(3);
    expect(store.total()).toBe(1);
    expect(store.saving()).toBe(false);
  });

  it('removes a categorized line as well', async () => {
    await store.load();

    const done = await store.categorize('l-2', { category: 'bank_expense', ledger_account_code: '6940', notes: null });

    expect(done).toBe(true);
    expect(api['categorizeLine']).toHaveBeenCalledWith('l-2', {
      category: 'bank_expense',
      ledger_account_code: '6940',
      notes: null,
    });
    expect(store.lines().map((line) => line.id)).toEqual(['l-1']);
    expect(store.counts().Unmatched).toBe(6);
  });

  it('keeps the line and reports the API message when the assignment fails', async () => {
    await store.load();
    api['assignLineToInvoice'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Invoice already paid.' } })),
    );

    const done = await store.assign('l-1', 'inv-1');

    expect(done).toBe(false);
    expect(store.lines()).toHaveLength(2);
    expect(store.counts().AmountMismatch).toBe(4);
    expect(store.error()).toEqual({ action: 'assign', detail: 'Invoice already paid.' });
    expect(store.saving()).toBe(false);

    store.clearError();
    expect(store.error()).toBeNull();
  });

  it('reports a load failure without stale lines', async () => {
    await store.load();
    api['getReconciliationExceptions'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));

    await store.load();

    expect(store.lines()).toEqual([]);
    expect(store.loading()).toBe(false);
    expect(store.error()).toEqual({ action: 'load', detail: '' });
  });
});
