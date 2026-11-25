import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IcTransaction, IntercompanyApiService } from '@core';
import { IntercompanyTransactionsStore } from './intercompany-transactions.store';

function transaction(overrides: Partial<IcTransaction> = {}): IcTransaction {
  return {
    id: 't1',
    pair_id: 'p1',
    group_id: 'g1',
    document_type: 'invoice',
    source_tenant_id: 'a',
    source_tenant_name: 'Alpha AG',
    source_document_id: 'd1',
    source_document_number: 'INV-1',
    mirror_tenant_id: 'b',
    mirror_tenant_name: 'Beta Srl',
    mirror_document_id: null,
    mirror_document_number: null,
    mirror_status: null,
    status: 'pending',
    currency: 'CHF',
    net_amount: '100.0000',
    tax_amount: '8.1000',
    gross_amount: '108.1000',
    payment_status: 'unpaid',
    synced_paid_amount: '0.0000',
    paid_variance: '0.0000',
    document_date: '2026-11-01',
    error_message: null,
    version: 1,
    idempotency_key: 'k1',
    created_at: '2026-11-01T10:00:00Z',
    ...overrides,
  };
}

describe('IntercompanyTransactionsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof IntercompanyTransactionsStore>;

  beforeEach(() => {
    api = {
      getTransactions: vi.fn(() =>
        of({
          success: true,
          message: '',
          data: [transaction()],
          meta: {
            current_page: 1,
            per_page: 20,
            total: 1,
            last_page: 1,
            summary: {
              total: 1,
              drafted: 0,
              confirmed: 0,
              reversed: 0,
              failed: 0,
              unpaid: 1,
              amount_by_currency: { CHF: '108.1000' },
            },
          },
        }),
      ),
      scanTransactions: vi.fn(() =>
        of({
          success: true,
          message: '',
          data: { created: 2, skipped: 1, failed: 0, transactions: [] },
        }),
      ),
      mirrorTransaction: vi.fn(() =>
        of({
          success: true,
          message: '',
          data: transaction({ status: 'drafted', mirror_status: 'draft', version: 2 }),
        }),
      ),
      confirmTransaction: vi.fn(() =>
        of({
          success: true,
          message: '',
          data: transaction({ status: 'confirmed', mirror_status: 'confirmed', version: 3 }),
        }),
      ),
      reverseTransaction: vi.fn(),
      syncPayment: vi.fn(),
      getNettingRuns: vi.fn(() => of({ success: true, message: '', data: [] })),
      proposeNetting: vi.fn(() =>
        of({
          success: true,
          message: '',
          data: { id: 'n1', status: 'draft', version: 1, items: [] },
        }),
      ),
      confirmNetting: vi.fn(() =>
        of({
          success: true,
          message: '',
          data: { id: 'n1', status: 'confirmed', version: 2, items: [] },
        }),
      ),
      cancelNetting: vi.fn(),
    };
    TestBed.configureTestingModule({
      providers: [
        IntercompanyTransactionsStore,
        { provide: IntercompanyApiService, useValue: api },
      ],
    });
    store = TestBed.inject(IntercompanyTransactionsStore);
  });

  it('loads the page with its summary and total', async () => {
    await store.load('g1');

    expect(api['getTransactions']).toHaveBeenCalledWith('g1', { page: 1, per_page: 20 });
    expect(store.transactions()).toHaveLength(1);
    expect(store.summary()?.amount_by_currency['CHF']).toBe('108.1000');
    expect(store.total()).toBe(1);
    expect(store.loading()).toBe(false);
  });

  it('keeps the translated error key when the load fails', async () => {
    api['getTransactions'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403 })),
    );

    await store.load('g1');

    expect(store.error()).toBe('intercompany.error.forbidden');
    expect(store.loading()).toBe(false);
  });

  it('scans for unlinked documents and reloads the first page', async () => {
    await store.scan('g1', { from: '2026-01-01' });

    expect(api['scanTransactions']).toHaveBeenCalledWith('g1', { from: '2026-01-01' });
    expect(store.lastScan()).toEqual({ created: 2, skipped: 1, failed: 0 });
    expect(api['getTransactions']).toHaveBeenCalledTimes(1);
  });

  it('sends the version of the row it holds when it mirrors and confirms', async () => {
    await store.load('g1');

    await store.mirror('t1', 'draft');
    expect(api['mirrorTransaction']).toHaveBeenCalledWith('t1', {
      mode: 'draft',
      expected_version: 1,
    });
    expect(store.transactions()[0].status).toBe('drafted');

    const outcome = await store.confirm('t1');
    expect(api['confirmTransaction']).toHaveBeenCalledWith('t1', 2);
    expect(outcome.ok).toBe(true);
    expect(store.transactions()[0].mirror_status).toBe('confirmed');
    expect(store.busy()).toEqual([]);
  });

  it('reports a stale version as a conflict and leaves the row untouched', async () => {
    await store.load('g1');
    api['reverseTransaction'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409 })),
    );

    const outcome = await store.reverse('t1', 'wrong entity');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('intercompany.error.conflict');
    expect(store.transactions()[0].status).toBe('pending');
    expect(store.busy()).toEqual([]);
  });

  it('proposes, confirms and cancels netting runs', async () => {
    const proposed = await store.proposeNetting('g1', {
      entity_a_tenant_id: 'a',
      entity_b_tenant_id: 'b',
      as_of_date: '2026-12-31',
    });
    expect(proposed.run?.id).toBe('n1');
    expect(store.nettingRuns()).toHaveLength(1);

    await store.confirmNetting('n1');
    expect(api['confirmNetting']).toHaveBeenCalledWith('n1', 1);
    expect(store.nettingRuns()[0].status).toBe('confirmed');

    api['cancelNetting'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));
    expect((await store.cancelNetting('n1', 'x')).ok).toBe(false);
  });
});
