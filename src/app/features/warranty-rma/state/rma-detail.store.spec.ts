import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WarrantyRmaApiService } from '@core';
import { httpError, loanerFixture, rmaFixture } from '../testing/rma-fixtures';
import { RmaNotifier } from './action-result';
import { RmaDetailStore } from './rma-detail.store';

describe('RmaDetailStore', () => {
  let store: InstanceType<typeof RmaDetailStore>;
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let notifier: { success: ReturnType<typeof vi.fn>; conflict: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = {
      getRma: vi.fn().mockReturnValue(of({ data: rmaFixture() })),
      receive: vi.fn(),
      diagnose: vi.fn(),
      resendEstimate: vi.fn(),
      partsReceived: vi.fn(),
      returnToCustomer: vi.fn(),
      issueLoaner: vi.fn(),
    };
    notifier = { success: vi.fn(), conflict: vi.fn() };
    TestBed.configureTestingModule({
      providers: [
        RmaDetailStore,
        { provide: WarrantyRmaApiService, useValue: api },
        { provide: RmaNotifier, useValue: notifier },
      ],
    });
    store = TestBed.inject(RmaDetailStore);
    store.open('rma-1');
  });

  it('loads the RMA on open', () => {
    expect(api['getRma']).toHaveBeenCalledWith('rma-1');
    expect(store.rma()?.rma_number).toBe('RMA-2026-000123');
  });

  it('replaces the RMA with the transition response', async () => {
    api['receive'].mockReturnValue(
      of({ data: rmaFixture({ status: 'in_diagnosis', received_at: '2026-11-02' }) }),
    );
    const res = await store.receive({ receipt_condition_notes: 'scratched' });
    expect(res.ok).toBe(true);
    expect(api['receive']).toHaveBeenCalledWith('rma-1', { receipt_condition_notes: 'scratched' });
    expect(store.rma()?.received_at).toBe('2026-11-02');
    expect(notifier.success).toHaveBeenCalledWith('RMA.MESSAGES.RECEIVED');
  });

  it('reveals the estimate link of an out-of-warranty diagnosis once, then forgets it', async () => {
    api['diagnose'].mockReturnValue(
      of({
        data: {
          ...rmaFixture({ status: 'awaiting_estimate_approval' }),
          estimate_url: 'https://app.test/rma-estimate/raw-token',
          estimate_token: 'raw-token',
        },
      }),
    );
    await store.diagnose({
      lab_bench_diagnostic_notes: 'PSU dead',
      repair_feasible: true,
      lines: [],
    });
    expect(store.rma()?.status).toBe('awaiting_estimate_approval');
    expect(store.reveal()).toEqual({
      kind: 'estimate',
      url: 'https://app.test/rma-estimate/raw-token',
      token: 'raw-token',
    });

    store.dismissReveal();
    expect(store.reveal()).toBeNull();
    expect(JSON.stringify(store.rma())).not.toContain('raw-token');
  });

  it('reveals a new link on resend', async () => {
    api['resendEstimate'].mockReturnValue(
      of({
        data: {
          ...rmaFixture({ status: 'awaiting_estimate_approval' }),
          estimate_url: 'https://app.test/rma-estimate/new',
        },
      }),
    );
    await store.resendEstimate();
    expect(store.reveal()?.url).toBe('https://app.test/rma-estimate/new');
  });

  it('does not reveal anything when no estimate link is returned (covered diagnosis)', async () => {
    api['diagnose'].mockReturnValue(
      of({
        data: rmaFixture({ status: 'awaiting_parts', warranty_status: 'covered_in_warranty' }),
      }),
    );
    await store.diagnose({ lab_bench_diagnostic_notes: 'x', repair_feasible: true, lines: [] });
    expect(store.reveal()).toBeNull();
  });

  it('on 409 invalid_transition informs the user and reloads the RMA', async () => {
    api['getRma'].mockClear();
    api['partsReceived'].mockReturnValue(
      httpError(409, { message: 'x', code: 'invalid_transition' }),
    );
    const res = await store.partsReceived();
    expect(res).toMatchObject({ ok: false, status: 409, code: 'invalid_transition' });
    expect(notifier.conflict).toHaveBeenCalledWith('invalid_transition');
    expect(api['getRma']).toHaveBeenCalledWith('rma-1');
  });

  it('returns 422 to the caller without reloading', async () => {
    api['getRma'].mockClear();
    api['returnToCustomer'].mockReturnValue(
      httpError(422, { message: 'x', errors: { returned_at: ['bad'] } }),
    );
    const res = await store.returnToCustomer({});
    expect(res).toMatchObject({ ok: false, status: 422 });
    expect(api['getRma']).not.toHaveBeenCalled();
    expect(notifier.conflict).not.toHaveBeenCalled();
  });

  it('issues a loaner and reloads the RMA', async () => {
    api['getRma'].mockClear();
    api['issueLoaner'].mockReturnValue(of({ data: loanerFixture() }));
    const res = await store.issueLoaner({
      loaner_serial_number: 'LOAN-1',
      register_type: 'prestito_uso',
    });
    expect(res.ok).toBe(true);
    expect(api['getRma']).toHaveBeenCalledWith('rma-1');
  });

  it('clears everything on close', () => {
    store.close();
    expect(store.rma()).toBeNull();
    expect(store.rmaId()).toBeNull();
  });
});
