import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DistributionApiService } from '@core';
import { ProposalsStore } from './proposals.store';

const page = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });
const ok = (data: unknown = {}) => of({ success: true, message: '', data });

const proposals = [
  { id: 'p1', status: 'pending', proposal_type: 'replenishment' },
  { id: 'p2', status: 'pending', proposal_type: 'balancing' },
  { id: 'p3', status: 'converted', proposal_type: 'replenishment' },
];

describe('ProposalsStore', () => {
  const api = {
    listProposals: vi.fn(),
    getLookups: vi.fn(),
    getProposal: vi.fn(),
    generateProposals: vi.fn(),
    updateProposal: vi.fn(),
    approveProposals: vi.fn(),
    rejectProposal: vi.fn(),
  };
  let store: InstanceType<typeof ProposalsStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listProposals.mockReturnValue(page(proposals));
    api.getLookups.mockReturnValue(ok({ warehouses: [], items: [] }));
    TestBed.configureTestingModule({
      providers: [ProposalsStore, { provide: DistributionApiService, useValue: api }],
    });
    store = TestBed.inject(ProposalsStore);
  });

  it('opens on the pending proposals and loads the lookups', async () => {
    await store.init();

    expect(api.listProposals).toHaveBeenCalledWith({ status: 'pending' });
    expect(store.proposals()).toHaveLength(3);
    expect(store.lookups()).not.toBeNull();
  });

  it('selects one proposal, or every pending one, and ignores the converted ones', async () => {
    await store.load();

    store.toggle('p1', true);
    expect(store.selectedIds()).toEqual(['p1']);
    store.toggle('p1', false);
    expect(store.selectedIds()).toEqual([]);

    store.toggleAll(true);
    expect(store.selectedIds()).toEqual(['p1', 'p2']);
    store.toggleAll(false);
    expect(store.selectedIds()).toEqual([]);
  });

  it('drops from the selection what a reload no longer returns', async () => {
    await store.load();
    store.toggleAll(true);
    api.listProposals.mockReturnValue(page([proposals[0]]));

    await store.setFilters({ proposal_type: 'replenishment' });

    expect(store.selectedIds()).toEqual(['p1']);
  });

  it('generates proposals for the given scope and keeps the result', async () => {
    api.generateProposals.mockReturnValue(ok({ created: 3, balancing: 1, shortfalls: 1 }));

    const outcome = await store.generate(['w1'], []);

    expect(outcome.ok).toBe(true);
    expect(api.generateProposals).toHaveBeenCalledWith({ warehouse_ids: ['w1'] });
    expect(store.lastGenerated()).toEqual({ created: 3, balancing: 1, shortfalls: 1 });
  });

  it('approves the selection into transfers and reports the shortfalls', async () => {
    await store.load();
    store.toggleAll(true);
    api.approveProposals.mockReturnValue(
      ok({ transfers: [{ id: 't1' }], shortfalls: [{ id: 'p2' }] }),
    );

    const outcome = await store.approveSelected('approved');

    expect(outcome.ok).toBe(true);
    expect(api.approveProposals).toHaveBeenCalledWith(['p1', 'p2'], 'approved');
    expect(store.lastTransfers()).toHaveLength(1);
    expect(store.lastShortfalls()).toHaveLength(1);
    expect(store.selectedIds()).toEqual([]);
  });

  it('refuses to approve an empty selection', async () => {
    const outcome = await store.approveSelected('draft');

    expect(outcome.ok).toBe(false);
    expect(api.approveProposals).not.toHaveBeenCalled();
  });

  it('adjusts a quantity, rejects a proposal and reads the detail', async () => {
    api.updateProposal.mockReturnValue(ok());
    api.rejectProposal.mockReturnValue(ok());
    api.getProposal
      .mockReturnValueOnce(ok({ id: 'p1' }))
      .mockReturnValueOnce(throwError(() => new Error('x')));

    expect((await store.adjust('p1', 12)).ok).toBe(true);
    expect(api.updateProposal).toHaveBeenCalledWith('p1', 12);
    expect((await store.reject('p1')).ok).toBe(true);
    expect(await store.detail('p1')).toEqual({ id: 'p1' });
    expect(await store.detail('p1')).toBeNull();
  });

  it('reports the refusal of an approval with its key', async () => {
    await store.load();
    store.toggle('p1', true);
    api.approveProposals.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 422, error: { code: 'proposal_not_pending' } }),
      ),
    );

    const outcome = await store.approveSelected('draft');

    expect(outcome.errorKey).toBe('distribution.error.proposal_not_pending');
  });
});
