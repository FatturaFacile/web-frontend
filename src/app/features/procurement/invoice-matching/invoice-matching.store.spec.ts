import { TestBed } from '@angular/core/testing';
import { InvoiceMatchingApiService } from '@data-access/procurement/invoice-matching-api.service';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { grIr, matchRun, matchSummary } from './invoice-matching.fixtures';
import { InvoiceMatchingStore } from './invoice-matching.store';

const meta = { current_page: 1, from: 1, last_page: 3, per_page: 20, to: 20, total: 55 };

describe('InvoiceMatchingStore', () => {
  const api = {
    summary: vi.fn(),
    listRuns: vi.fn(),
    getRun: vi.fn(),
    getGrIr: vi.fn(),
    invoiceHistory: vi.fn(),
    run: vi.fn(),
    batchRun: vi.fn(),
    requestCreditNote: vi.fn(),
    rematch: vi.fn(),
    partialResolution: vi.fn(),
    override: vi.fn(),
  };
  let store: InstanceType<typeof InvoiceMatchingStore>;

  beforeEach(() => {
    vi.resetAllMocks();
    TestBed.configureTestingModule({
      providers: [InvoiceMatchingStore, { provide: InvoiceMatchingApiService, useValue: api }],
    });
    store = TestBed.inject(InvoiceMatchingStore);
  });

  it('loads the KPI summary', async () => {
    api.summary.mockReturnValue(of(matchSummary()));
    await store.loadSummary();
    expect(store.summary()?.blocked_count).toBe(2);
    expect(store.blockedCount()).toBe(2);
  });

  it('loads the runs with the pagination meta', async () => {
    api.listRuns.mockReturnValue(of({ success: true, message: '', data: [matchRun()], meta }));
    await store.loadRuns({ page: 1, per_page: 20 });
    expect(store.runs()).toHaveLength(1);
    expect(store.total()).toBe(55);
    expect(store.loading()).toBe(false);
  });

  it('resets to the first page when a filter changes and keeps the queue', async () => {
    api.listRuns.mockReturnValue(of({ success: true, message: '', data: [], meta }));
    await store.loadRuns({ page: 3, per_page: 20, queue: 'blocked' });
    await store.applyFilters({ status: 'blocked_discrepancy', search: 'acme' });
    expect(api.listRuns).toHaveBeenLastCalledWith({
      page: 1,
      per_page: 20,
      queue: 'blocked',
      status: 'blocked_discrepancy',
      search: 'acme',
    });
    await store.setPage(2);
    expect(api.listRuns).toHaveBeenLastCalledWith(
      expect.objectContaining({ page: 2, search: 'acme' }),
    );
  });

  it('keeps the API message when the list fails', async () => {
    api.listRuns.mockReturnValue(throwError(() => ({ error: { message: 'boom' } })));
    await store.loadRuns();
    expect(store.failed()).toBe(true);
    expect(store.error()).toBe('boom');
    expect(store.loading()).toBe(false);
  });

  it('loads the detail, the GR/IR and the invoice history', async () => {
    api.getRun.mockReturnValue(of(matchRun()));
    api.getGrIr.mockReturnValue(of(grIr()));
    api.invoiceHistory.mockReturnValue(of([matchRun({ id: 'old', is_current: false })]));
    await store.loadDetail('run-1');
    await store.loadGrIr('run-1');
    await store.loadHistory('inv-1');
    expect(store.detail()?.id).toBe('run-1');
    expect(store.canResolve()).toBe(true);
    expect(store.blockingLines()).toHaveLength(2);
    expect(store.grIr()?.open_balance).toBe('800.00');
    expect(api.invoiceHistory).toHaveBeenCalledWith('inv-1');
    expect(store.history()[0].id).toBe('old');
  });

  it('runs the matching and returns the run', async () => {
    api.run.mockReturnValue(of(matchRun()));
    const outcome = await store.run({ passive_invoice_id: 'inv-1' });
    expect(outcome.ok).toBe(true);
    expect(outcome.result?.id).toBe('run-1');
    expect(store.busy()).toBe(false);
  });

  it('returns the batch counters', async () => {
    api.batchRun.mockReturnValue(
      of({ processed: 3, matched: 2, blocked: 1, skipped: 0, run_ids: [] }),
    );
    const outcome = await store.batchRun({ limit: 10 });
    expect(outcome.result?.processed).toBe(3);
  });

  it('replaces the displayed run after an override and sends the reason', async () => {
    api.getRun.mockReturnValue(of(matchRun()));
    await store.loadDetail('run-1');
    api.override.mockReturnValue(of(matchRun({ status: 'override_approved', is_blocking: false })));
    const outcome = await store.override('run-1', { reason: 'Approved by CFO' });
    expect(api.override).toHaveBeenCalledWith('run-1', { reason: 'Approved by CFO' });
    expect(outcome.ok).toBe(true);
    expect(store.detail()?.status).toBe('override_approved');
    expect(store.canResolve()).toBe(false);
  });

  it('flags a 403 on the override as forbidden', async () => {
    api.override.mockReturnValue(throwError(() => ({ status: 403, error: { message: 'No' } })));
    const outcome = await store.override('run-1', { reason: 'Approved by CFO' });
    expect(outcome.ok).toBe(false);
    expect(outcome.forbidden).toBe(true);
    expect(store.busy()).toBe(false);
  });

  it('keeps a validation failure apart from a 403', async () => {
    api.partialResolution.mockReturnValue(
      throwError(() => ({ status: 422, error: { message: 'Invalid lines' } })),
    );
    const outcome = await store.partialResolution('run-1', { reason: 'x', line_ids: ['l-1'] });
    expect(outcome.forbidden).toBe(false);
    expect(outcome.message).toBe('Invalid lines');
  });

  it('returns the new current run of a re-match', async () => {
    api.rematch.mockReturnValue(of(matchRun({ id: 'run-2', trigger: 'rematch' })));
    const outcome = await store.rematch('run-1', {});
    expect(outcome.result?.id).toBe('run-2');
    expect(store.detail()?.id).toBe('run-2');
  });

  it('requests a credit note with the expected amount', async () => {
    api.requestCreditNote.mockReturnValue(of(matchRun({ status: 'pending_credit_note' })));
    await store.requestCreditNote('run-1', { reason: 'Overbilled', expected_credit_amount: 100 });
    expect(api.requestCreditNote).toHaveBeenCalledWith('run-1', {
      reason: 'Overbilled',
      expected_credit_amount: 100,
    });
    expect(store.detail()?.status).toBe('pending_credit_note');
  });
});
