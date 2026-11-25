import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService } from '@core';
import { AgreementsStore } from './agreements.store';

const page = (data: unknown[]) => of({ success: true, message: '', data, meta: {} });
const ok = (data: unknown = {}) => of({ success: true, message: '', data });

describe('AgreementsStore', () => {
  const api = {
    listAgreements: vi.fn(),
    getLookups: vi.fn(),
    getAgreement: vi.fn(),
    createAgreement: vi.fn(),
    updateAgreement: vi.fn(),
    deleteAgreement: vi.fn(),
    activateAgreement: vi.fn(),
    terminateAgreement: vi.fn(),
    renewAgreement: vi.fn(),
  };
  let store: InstanceType<typeof AgreementsStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listAgreements.mockReturnValue(page([{ id: 'a1', status: 'draft' }]));
    api.getLookups.mockReturnValue(ok({ stores: [{ id: 's1' }], formulas: [{ id: 'f1' }] }));
    TestBed.configureTestingModule({
      providers: [AgreementsStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(AgreementsStore);
  });

  it('loads the agreements with the stores and formulas of the selects', async () => {
    await store.load();

    expect(store.agreements()).toHaveLength(1);
    expect(store.stores()).toHaveLength(1);
    expect(store.formulas()).toHaveLength(1);
  });

  it('filters by status and reloads', async () => {
    await store.setStatusFilter('active');

    expect(api.listAgreements).toHaveBeenCalledWith({ status: 'active' });
    expect(store.statusFilter()).toBe('active');
  });

  it('activates, terminates and renews through the API, reloading each time', async () => {
    api.activateAgreement.mockReturnValue(ok());
    api.terminateAgreement.mockReturnValue(ok());
    api.renewAgreement.mockReturnValue(ok());

    expect((await store.activate('a1')).ok).toBe(true);
    expect((await store.terminate('a1')).ok).toBe(true);
    expect((await store.renew('a1', '2031-12-31')).ok).toBe(true);

    expect(api.renewAgreement).toHaveBeenCalledWith('a1', '2031-12-31');
    expect(api.listAgreements).toHaveBeenCalledTimes(3);
  });

  it('reports the blocking findings that stop an activation', async () => {
    api.activateAgreement.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { code: 'agreement_has_blocking_findings', params: { finding: 'guarantee_expired' } },
          }),
      ),
    );

    const outcome = await store.activate('a1');

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('franchiseNetwork.error.agreement_has_blocking_findings');
    expect(outcome.params).toEqual({ finding: 'guarantee_expired' });
  });

  it('opens and closes the entry fee schedule of an agreement', async () => {
    api.getAgreement.mockReturnValue(ok({ id: 'a1', deferrals: [{ period: '2028-01', amount: '500.00' }] }));

    await store.openDetail('a1');
    expect(store.detail()?.deferrals).toHaveLength(1);

    store.closeDetail();
    expect(store.detail()).toBeNull();
  });
});
