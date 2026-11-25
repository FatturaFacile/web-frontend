import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DebtCollectionApiService } from '@core';
import { notice, pageMeta, proposalItem, wrap } from './debt-collection.testing';
import { LegalStore } from './legal.store';

const dossier = {
  id: 'd-1',
  number: 'BET-1',
  customer_id: 'c-1',
  customer_name: 'ACME SA',
  currency: 'CHF',
  principal: '2000.00',
  interest: '10.00',
  fee: '30.00',
  total: '2040.00',
  status: 'generated' as const,
  office: null,
  receivable_item_ids: ['r-1'],
  generated_at: '2026-05-05T08:00:00Z',
  has_bundle: true,
};

describe('LegalStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof LegalStore>;

  beforeEach(() => {
    api = {
      listDossiers: vi.fn(() => of(wrap([dossier]))),
      listEnforcementOffices: vi.fn(() => of(wrap([]))),
      listNotices: vi.fn(() =>
        of({
          success: true,
          message: 'ok',
          data: [notice('m-1', { kind: 'messa_in_mora' })],
          meta: pageMeta,
        }),
      ),
      listProposals: vi.fn(() =>
        of(wrap({ items: [proposalItem('r-1'), proposalItem('r-2')], groups: [] })),
      ),
      createDossier: vi.fn(() => of(wrap(dossier))),
      createMessaInMora: vi.fn(() => of(wrap(notice('m-2', { kind: 'messa_in_mora' })))),
      submitDossier: vi.fn(() => of(wrap({ ...dossier, status: 'submitted' }))),
    };
    TestBed.configureTestingModule({
      providers: [LegalStore, { provide: DebtCollectionApiService, useValue: api }],
    });
    store = TestBed.inject(LegalStore);
  });

  it('loads the dossiers, the offices and the messa in mora notices', async () => {
    await store.load();

    expect(store.dossiers()).toHaveLength(1);
    expect(store.messe()).toHaveLength(1);
    expect(api['listNotices']).toHaveBeenCalledWith({ kind: 'messa_in_mora' });
  });

  it('loads the open items of the chosen customer and lets the user pick some', async () => {
    await store.selectCustomer('c-1');
    store.toggleItem('r-1', true);
    store.toggleItem('r-2', true);
    store.toggleItem('r-2', false);

    expect(store.items()).toHaveLength(2);
    expect(store.selected()).toEqual(['r-1']);

    await store.selectCustomer(null);
    expect(store.items()).toEqual([]);
    expect(store.selected()).toEqual([]);
  });

  it('creates a dossier for the selected items, with the office and the language when chosen', async () => {
    await store.selectCustomer('c-1');
    store.toggleItem('r-1', true);

    const outcome = await store.createDossier('o-1', 'de');

    expect(outcome.ok).toBe(true);
    expect(api['createDossier']).toHaveBeenCalledWith({
      customer_id: 'c-1',
      receivable_item_ids: ['r-1'],
      office_id: 'o-1',
      locale: 'de',
    });
    expect(store.selected()).toEqual([]);
  });

  it('creates a messa in mora, sending the PEC when asked', async () => {
    await store.selectCustomer('c-1');
    store.toggleItem('r-1', true);

    await store.createMessaInMora(true, null);

    expect(api['createMessaInMora']).toHaveBeenCalledWith({
      customer_id: 'c-1',
      receivable_item_ids: ['r-1'],
      send_pec: true,
    });
  });

  it('submits a dossier and reloads the list', async () => {
    await store.submitDossier('d-1');

    expect(api['submitDossier']).toHaveBeenCalledWith('d-1');
    expect(api['listDossiers']).toHaveBeenCalledOnce();
    expect(store.busyId()).toBeNull();
  });
});
