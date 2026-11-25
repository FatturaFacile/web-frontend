import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralLedgerConsolidationApiService, IcRunWorkflow, IntercompanyApiService } from '@core';
import { IntercompanyRunStore } from './intercompany-run.store';

function workflow(overrides: Partial<IcRunWorkflow> = {}): IcRunWorkflow {
  return { run_id: 'r1', status: 'draft', version: 1, history: [], allowed_transitions: ['calculating'], ...overrides };
}

const ok = <T>(data: T) => of({ success: true, message: '', data });

describe('IntercompanyRunStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let consolidation: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof IntercompanyRunStore>;

  beforeEach(() => {
    api = {
      getWorkflow: vi.fn(() => ok(workflow())),
      getScopeValidation: vi.fn(() =>
        ok({
          ready: false,
          checks: [
            { code: 'fx_rates', passed: false, entity_tenant_id: 'b', detail: 'missing EUR/CHF' },
            { code: 'tree', passed: true, entity_tenant_id: null, detail: null },
          ],
        }),
      ),
      getEliminationLedger: vi.fn(() => ok({ run_id: 'r1', currency: 'CHF', entries: [], totals_by_type: {} })),
      getNciSchedule: vi.fn(() => ok({ currency: 'CHF', rows: [], total_nci_net_assets: '0.0000', total_nci_profit: '0.0000' })),
      advanceRun: vi.fn(() => ok(workflow({ status: 'review', version: 2, allowed_transitions: ['locked'] }))),
      reopenRun: vi.fn(() => ok(workflow({ status: 'review', version: 4 }))),
    };
    consolidation = { runConsolidation: vi.fn(() => ok({ id: 'r2' })) };
    TestBed.configureTestingModule({
      providers: [
        IntercompanyRunStore,
        { provide: IntercompanyApiService, useValue: api },
        { provide: GeneralLedgerConsolidationApiService, useValue: consolidation },
      ],
    });
    store = TestBed.inject(IntercompanyRunStore);
  });

  it('loads the workflow, the scope checks, the ledger and the NCI schedule together', async () => {
    await store.load('r1');

    expect(store.status()).toBe('draft');
    expect(store.step()).toBe(0);
    expect(store.failedChecks().map((check) => check.code)).toEqual(['fx_rates']);
    expect(store.ledger()?.currency).toBe('CHF');
    expect(store.loading()).toBe(false);
  });

  it('opens the wizard on the step of a run that is already under review', async () => {
    api['getWorkflow'].mockReturnValue(ok(workflow({ status: 'review', version: 3 })));

    await store.load('r1');

    expect(store.step()).toBe(3);
  });

  it('advances with the version it holds and follows the new status', async () => {
    await store.load('r1');

    const outcome = await store.advance('r1', 'review');

    expect(api['advanceRun']).toHaveBeenCalledWith('r1', 'review', 1);
    expect(outcome.ok).toBe(true);
    expect(store.status()).toBe('review');
    expect(store.canAdvanceTo()('locked')).toBe(true);
    expect(store.canAdvanceTo()('posted')).toBe(false);
    expect(store.step()).toBe(3);
  });

  it('keeps the run as it is when the version is stale', async () => {
    await store.load('r1');
    api['advanceRun'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 409 })));

    const outcome = await store.advance('r1', 'review');

    expect(outcome.ok).toBe(false);
    expect(store.error()).toBe('intercompany.error.conflict');
    expect(store.status()).toBe('draft');
    expect(store.busy()).toBe(false);
  });

  it('reopens a locked run with the reason and the version', async () => {
    api['getWorkflow'].mockReturnValue(ok(workflow({ status: 'locked', version: 3, allowed_transitions: ['posted'] })));
    await store.load('r1');
    expect(store.closed()).toBe(true);

    await store.reopen('r1', 'correction after the audit');

    expect(api['reopenRun']).toHaveBeenCalledWith('r1', 'correction after the audit', 3);
    expect(store.closed()).toBe(false);
  });

  it('filters the elimination ledger by type', async () => {
    await store.filterLedger('r1', 'unrealised_profit');

    expect(api['getEliminationLedger']).toHaveBeenCalledWith('r1', { type: 'unrealised_profit' });
    expect(store.ledgerType()).toBe('unrealised_profit');
  });

  it('starts a run of the existing consolidation engine', async () => {
    const result = await store.startRun('g1', 'fp1');

    expect(consolidation['runConsolidation']).toHaveBeenCalledWith('g1', 'fp1');
    expect(result.run?.id).toBe('r2');
  });
});
