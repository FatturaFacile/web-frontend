import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ReceivablesApiService } from '@core';
import { CreditPositionStore } from './credit-position.store';
import { credit, limit, provision, risk } from './receivables.fixtures';

describe('CreditPositionStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof CreditPositionStore>;
  const older = limit({ id: 'lim-0', granted_limit: '1000.00', valid_from: '2025-01-01', valid_to: '2025-12-31' });

  beforeEach(() => {
    api = {
      getCredit: vi.fn(() => of({ data: credit })),
      getRisk: vi.fn(() => of({ data: risk })),
      getCreditLimits: vi.fn(() => of({ data: [limit(), older] })),
      getProvision: vi.fn(() => of({ data: provision })),
      getDso: vi.fn(() =>
        of({
          data: {
            as_of: '2026-03-31',
            period_days: 90,
            currency: 'EUR',
            receivables: '1800.00',
            credit_sales: '3000.00',
            dso: 54,
          },
        }),
      ),
      createCreditLimit: vi.fn(() => of({ data: limit() })),
      updateCreditLimit: vi.fn(() => of({ data: limit() })),
      deleteCreditLimit: vi.fn(() => of(undefined)),
      grantOverride: vi.fn(() => of({ data: {} })),
      revokeOverride: vi.fn(() => of({ data: {} })),
      saveProvisionRates: vi.fn(() => of({ data: {} })),
    };
    TestBed.configureTestingModule({
      providers: [CreditPositionStore, { provide: ReceivablesApiService, useValue: api }],
    });
    store = TestBed.inject(CreditPositionStore);
  });

  it('loads the position, risk, history, provision and DSO of the customer', async () => {
    await store.load('c-1');

    expect(api.getCredit).toHaveBeenCalledWith('c-1');
    expect(api.getProvision).toHaveBeenCalledWith('c-1');
    expect(store.loading()).toBe(false);
    expect(store.hasData()).toBe(true);
    expect(store.risk()?.rating).toBe('high');
    expect(store.dso()?.dso).toBe(54);
    expect(store.provision()?.total_provision).toBe('15.00');
  });

  it('derives the block state, the breaches and the utilisation', async () => {
    await store.load('c-1');

    expect(store.isBlocked()).toBe(true);
    expect(store.isCreditHold()).toBe(false);
    expect(store.outcome()).toBe('block');
    expect(store.breaches()).toEqual(['over_limit']);
    expect(store.utilization()).toBe(125);
    expect(store.utilizationStatus()).toBe('exception');
    expect(store.limit()?.id).toBe('lim-1');
  });

  it('lists as history the limits other than the one in force and the overrides in force', async () => {
    await store.load('c-1');

    expect(store.history().map((row) => row.id)).toEqual(['lim-0']);
    expect(store.activeOverrides().map((row) => row.id)).toEqual(['o-1']);
  });

  it('keeps the page usable when the provision or the DSO fail', async () => {
    api.getProvision.mockReturnValueOnce(throwError(() => new Error('down')));
    api.getDso.mockReturnValueOnce(throwError(() => new Error('down')));

    await store.load('c-1');

    expect(store.hasData()).toBe(true);
    expect(store.provision()).toBeNull();
    expect(store.dso()).toBeNull();
    expect(store.error()).toBeNull();
  });

  it('reports a failed load of the position', async () => {
    api.getCredit.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 404, error: { message: 'Customer not found' } })),
    );

    await store.load('c-9');

    expect(store.error()).toBe('Customer not found');
    expect(store.hasData()).toBe(false);
    expect(store.loading()).toBe(false);
  });

  it('creates a limit when there is no id and updates it otherwise, then reloads', async () => {
    await store.load('c-1');
    const payload = {
      customer_id: 'c-1',
      currency: 'EUR',
      granted_limit: '3000.00',
      reaction_policy: 'credit_hold' as const,
      valid_from: '2026-04-01',
    };

    expect((await store.saveLimit(null, payload)).ok).toBe(true);
    expect(api.createCreditLimit).toHaveBeenCalledWith(payload);
    expect(api.getCredit).toHaveBeenCalledTimes(2);

    expect((await store.saveLimit('lim-1', { granted_limit: '3500.00' })).ok).toBe(true);
    expect(api.updateCreditLimit).toHaveBeenCalledWith('lim-1', { granted_limit: '3500.00' });
    expect(api.getCredit).toHaveBeenCalledTimes(3);
    expect(store.saving()).toBe(false);
  });

  it('returns the field errors of a refused limit', async () => {
    await store.load('c-1');
    api.createCreditLimit.mockReturnValueOnce(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'Invalid', errors: { valid_to: ['The valid to must not be before valid from.'] } },
          }),
      ),
    );

    const outcome = await store.saveLimit(null, {
      customer_id: 'c-1',
      currency: 'EUR',
      granted_limit: '1.00',
      reaction_policy: 'warning',
      valid_from: '2026-04-01',
    });

    expect(outcome.ok).toBe(false);
    expect(outcome.errors['valid_to']).toEqual(['The valid to must not be before valid from.']);
    expect(store.saving()).toBe(false);
  });

  it('deletes a limit and reloads', async () => {
    await store.load('c-1');

    expect((await store.deleteLimit('lim-0')).ok).toBe(true);

    expect(api.deleteCreditLimit).toHaveBeenCalledWith('lim-0');
    expect(api.getCreditLimits).toHaveBeenCalledTimes(2);
  });

  it('grants and revokes overrides', async () => {
    await store.load('c-1');

    await store.grantOverride({ scope: 'all', reason: 'Strategic account', expires_at: '2026-06-30' });
    expect(api.grantOverride).toHaveBeenCalledWith('c-1', {
      scope: 'all',
      reason: 'Strategic account',
      expires_at: '2026-06-30',
    });

    await store.revokeOverride('o-1', 'Settled');
    expect(api.revokeOverride).toHaveBeenCalledWith('o-1', 'Settled');
    expect(api.getCredit).toHaveBeenCalledTimes(3);
  });

  it('saves the provision rates and re-reads the provision', async () => {
    await store.load('c-1');

    const outcome = await store.saveProvisionRates({ current: 1, '1_30': 3 });

    expect(outcome.ok).toBe(true);
    expect(api.saveProvisionRates).toHaveBeenCalledWith({ current: 1, '1_30': 3 });
    expect(api.getProvision).toHaveBeenCalledTimes(2);
  });

  it('reports a forbidden write with the message of the API', async () => {
    await store.load('c-1');
    api.revokeOverride.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })),
    );

    const outcome = await store.revokeOverride('o-1');

    expect(outcome).toEqual({ ok: false, message: 'Forbidden', errors: {} });
  });
});
