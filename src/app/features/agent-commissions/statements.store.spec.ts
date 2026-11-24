import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, Subject, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService } from '@core';
import { agent, pageMeta, preview, statement, wrap } from './agent-commissions.testing';
import { StatementsStore } from './statements.store';

const problem = (code: string) =>
  throwError(() => new HttpErrorResponse({ status: 422, error: { code, detail: code } }));

const payload = {
  agent_profile_id: 'a-1',
  period_start: '2026-03-01',
  period_end: '2026-03-31',
  period_type: 'monthly' as const,
};

describe('StatementsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof StatementsStore>;

  beforeEach(() => {
    api = {
      listAgents: vi.fn(() => of(wrap([agent('a-1')]))),
      listStatements: vi.fn(() =>
        of({
          success: true,
          message: 'OK',
          data: [statement('1'), statement('2', { status: 'approved' })],
          meta: pageMeta,
        }),
      ),
      getStatement: vi.fn((id: string) => of(wrap(statement(id)))),
      previewStatement: vi.fn(() => of(wrap(preview))),
      generateStatement: vi.fn(() => of(wrap(statement('3')))),
      approveStatement: vi.fn(() =>
        of(wrap(statement('1', { status: 'approved', lines: undefined }))),
      ),
      voidStatement: vi.fn(() => of(wrap(statement('1', { status: 'void', lines: undefined })))),
      prepareSelfBilling: vi.fn(() =>
        of(
          wrap(
            statement('2', {
              status: 'invoiced',
              self_billing_number: 'AF-2026-0001',
              lines: undefined,
            }),
          ),
        ),
      ),
      payStatement: vi.fn(() => of(wrap(statement('2', { status: 'paid', lines: undefined })))),
      sendStatement: vi.fn(() =>
        of(wrap(statement('2', { status: 'approved', sent_count: 1, lines: undefined }))),
      ),
      downloadStatementPdf: vi.fn(() => of(new Blob(['%PDF']))),
    };
    TestBed.configureTestingModule({
      providers: [StatementsStore, { provide: AgentCommissionsApiService, useValue: api }],
    });
    store = TestBed.inject(StatementsStore);
  });

  it('loads the statements and the agents of the filter', async () => {
    await store.init();

    expect(store.statements().map((row) => row.id)).toEqual(['1', '2']);
    expect(store.total()).toBe(2);
    expect(store.agentOptions()).toEqual([{ id: 'a-1', name: 'Agent a-1' }]);
    expect(api['listStatements']).toHaveBeenCalledWith({ per_page: 20, page: 1 });
  });

  it('filters by status and agent from the first page', async () => {
    await store.init();
    await store.setPage(2);

    await store.setStatus('approved');
    expect(api['listStatements']).toHaveBeenLastCalledWith({
      per_page: 20,
      page: 1,
      status: 'approved',
    });

    await store.setFilters({ agent_profile_id: 'a-1', year: 2026 });
    expect(api['listStatements']).toHaveBeenLastCalledWith({
      per_page: 20,
      page: 1,
      status: 'approved',
      agent_profile_id: 'a-1',
      year: 2026,
    });
  });

  it('reports a failed load', async () => {
    api['listStatements'].mockReturnValue(problem('generic'));

    await store.init();

    expect(store.error()).toBe('agentCommissions.error.generic');
  });

  it('opens a statement with its lines and closes it', async () => {
    await store.openDetail('1');

    expect(store.detail()?.lines).toHaveLength(1);
    store.closeDetail();
    expect(store.detail()).toBeNull();
  });

  it('previews the statement of an agent and a period', async () => {
    await store.previewFor(payload);

    expect(api['previewStatement']).toHaveBeenCalledWith(payload);
    expect(store.preview()?.gross_commission).toBe('550.00');
    expect(store.previewing()).toBe(false);
    expect(store.previewError()).toBeNull();
  });

  it('shows the refusal of a period with nothing to settle, and clears it', async () => {
    api['previewStatement'].mockReturnValue(problem('nothing_to_settle'));

    await store.previewFor(payload);

    expect(store.preview()).toBeNull();
    expect(store.previewError()).toBe('agentCommissions.error.nothing_to_settle');

    store.clearPreview();
    expect(store.previewError()).toBeNull();
  });

  it('keeps the preview of the latest request only', async () => {
    const slow = new Subject<ReturnType<typeof wrap>>();
    api['previewStatement'].mockReturnValueOnce(slow);

    const first = store.previewFor(payload);
    await store.previewFor({ ...payload, period_end: '2026-03-15' });
    slow.next(wrap({ ...preview, gross_commission: '1.00' }));
    slow.complete();
    await first;

    expect(store.preview()?.gross_commission).toBe('550.00');
  });

  it('generates a statement, drops the preview and reads the list again', async () => {
    await store.previewFor(payload);

    const outcome = await store.generate(payload);

    expect(outcome.ok).toBe(true);
    expect(outcome.statement?.id).toBe('3');
    expect(api['generateStatement']).toHaveBeenCalledWith(payload);
    expect(store.preview()).toBeNull();
    expect(api['listStatements']).toHaveBeenCalledTimes(1);
  });

  it('answers a refused generation with the key of the code', async () => {
    api['generateStatement'].mockReturnValue(problem('period_overlap'));

    const outcome = await store.generate(payload);

    expect(outcome.ok).toBe(false);
    expect(outcome.statement).toBeNull();
    expect(outcome.errorKey).toBe('agentCommissions.error.period_overlap');
    expect(store.saving()).toBe(false);
  });

  it('approves a statement and updates the detail and the list row, keeping the lines', async () => {
    await store.init();
    await store.openDetail('1');

    const outcome = await store.approve('1');

    expect(outcome.ok).toBe(true);
    expect(api['approveStatement']).toHaveBeenCalledWith('1');
    expect(store.detail()?.status).toBe('approved');
    expect(store.detail()?.lines).toHaveLength(1);
    expect(store.statements().find((row) => row.id === '1')?.status).toBe('approved');
  });

  it('voids a statement', async () => {
    await store.init();
    await store.openDetail('1');

    expect((await store.void('1')).ok).toBe(true);
    expect(store.detail()?.status).toBe('void');
  });

  it('prepares the invoice with the chosen date, pays with its reference and sends to a recipient', async () => {
    await store.init();
    await store.openDetail('2');

    await store.prepareSelfBilling('2', '2026-04-02');
    expect(api['prepareSelfBilling']).toHaveBeenCalledWith('2', '2026-04-02');
    expect(store.detail()?.self_billing_number).toBe('AF-2026-0001');

    await store.pay('2', { reference: 'BON-1', paid_on: '2026-04-05' });
    expect(api['payStatement']).toHaveBeenCalledWith('2', {
      reference: 'BON-1',
      paid_on: '2026-04-05',
    });
    expect(store.detail()?.status).toBe('paid');

    await store.send('2', { recipient: 'agent@example.test' });
    expect(api['sendStatement']).toHaveBeenCalledWith('2', { recipient: 'agent@example.test' });
    expect(store.detail()?.sent_count).toBe(1);
  });

  it('answers a blocked payout with its translated code and leaves the statement as it is', async () => {
    await store.init();
    await store.openDetail('2');
    api['payStatement'].mockReturnValue(problem('payout_blocked'));

    const outcome = await store.pay('2');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('agentCommissions.error.payout_blocked');
    expect(store.detail()?.status).toBe('draft');
    expect(store.saving()).toBe(false);
  });

  it('does not touch the detail of another statement when a row is updated', async () => {
    await store.init();
    await store.openDetail('1');

    await store.pay('2');

    expect(store.detail()?.id).toBe('1');
    expect(store.statements().find((row) => row.id === '2')?.status).toBe('paid');
  });

  it('fetches the PDF with the file name of the statement, or reports the failure', async () => {
    const pdf = await store.pdf({ id: '1', number: 'ST-2026-0001' });

    expect(pdf.ok).toBe(true);
    expect(pdf.blob).toBeInstanceOf(Blob);
    expect(pdf.filename).toBe('statement-ST-2026-0001.pdf');

    api['downloadStatementPdf'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 404,
            error: new Blob([JSON.stringify({ code: 'generic' })]),
          }),
      ),
    );
    const failure = await store.pdf({ id: '9', number: 'ST-9' });
    expect(failure.ok).toBe(false);
    expect(failure.blob).toBeNull();
    expect(failure.errorKey).toBe('agentCommissions.error.generic');
  });
});
