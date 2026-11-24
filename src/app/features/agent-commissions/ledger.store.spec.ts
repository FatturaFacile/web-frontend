import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService } from '@core';
import { agent, entry, wrap } from './agent-commissions.testing';
import { LedgerStore } from './ledger.store';

const totals = { commission: '150.00', eligible: '100.00', settled: '0.00', blocked: '50.00' };

function ledgerPage(entries = [entry('1'), entry('2', { status: 'awaiting_reconciliation' })]) {
  return {
    success: true,
    message: 'OK',
    data: entries,
    meta: { current_page: 1, last_page: 3, per_page: 25, total: 60, totals },
  };
}

describe('LedgerStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof LedgerStore>;

  beforeEach(() => {
    api = {
      listAgents: vi.fn(() => of(wrap([agent('a-1')]))),
      listLedger: vi.fn(() => of(ledgerPage())),
      getLedgerEntry: vi.fn(() =>
        of(
          wrap(
            entry('1', {
              movements: [
                { kind: 'accrual', amount: '50.00', occurred_on: '2026-03-10', note: null },
              ],
            }),
          ),
        ),
      ),
      sync: vi.fn(() => of(wrap({ period_invoices: 2, open_invoices: 1 }))),
    };
    TestBed.configureTestingModule({
      providers: [LedgerStore, { provide: AgentCommissionsApiService, useValue: api }],
    });
    store = TestBed.inject(LedgerStore);
  });

  it('loads the entries with the totals and the pagination', async () => {
    await store.init();

    expect(store.entries()).toHaveLength(2);
    expect(store.totals()).toEqual(totals);
    expect(store.total()).toBe(60);
    expect(store.page()).toBe(1);
    expect(store.pageSize()).toBe(25);
    expect(store.agentOptions()).toEqual([{ id: 'a-1', name: 'Agent a-1' }]);
    expect(api['listLedger']).toHaveBeenCalledWith({ per_page: 25, page: 1 });
  });

  it('applies the filters from the first page', async () => {
    await store.init();
    await store.setPage(3);
    expect(api['listLedger']).toHaveBeenLastCalledWith({ per_page: 25, page: 3 });

    await store.setFilters({ status: 'awaiting_reconciliation', accrual_basis: 'collected' });

    expect(api['listLedger']).toHaveBeenLastCalledWith({
      per_page: 25,
      page: 1,
      status: 'awaiting_reconciliation',
      accrual_basis: 'collected',
    });
  });

  it('keeps the answer of the latest request only', async () => {
    const slow = new Subject<ReturnType<typeof ledgerPage>>();
    api['listLedger'].mockReturnValueOnce(slow);

    const first = store.load({ per_page: 25, page: 1 });
    await store.load({ per_page: 25, page: 2 });
    slow.next(ledgerPage([entry('old')]));
    slow.complete();
    await first;

    expect(store.entries().map((row) => row.id)).toEqual(['1', '2']);
  });

  it('reports a failed load with the key of the problem code', async () => {
    api['listLedger'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    await store.init();

    expect(store.error()).toBe('agentCommissions.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('opens an entry with its movements and closes it', async () => {
    await store.openDetail('1');

    expect(api['getLedgerEntry']).toHaveBeenCalledWith('1');
    expect(store.detail()?.movements).toHaveLength(1);
    expect(store.loadingDetail()).toBe(false);

    store.closeDetail();
    expect(store.detail()).toBeNull();
  });

  it('synchronises the period and reloads the ledger', async () => {
    await store.init();
    api['listLedger'].mockClear();

    const outcome = await store.sync({ from: '2026-01-01', to: '2026-03-31' });

    expect(outcome.ok).toBe(true);
    expect(api['sync']).toHaveBeenCalledWith({ from: '2026-01-01', to: '2026-03-31' });
    expect(api['listLedger']).toHaveBeenCalledTimes(1);
    expect(store.syncing()).toBe(false);
  });

  it('reports a refused synchronisation without reloading', async () => {
    api['sync'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'invalid_period' } })),
    );

    const outcome = await store.sync({ from: '2026-04-01', to: '2026-03-01' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('agentCommissions.error.invalid_period');
    expect(store.syncing()).toBe(false);
    expect(api['listLedger']).not.toHaveBeenCalled();
  });
});
