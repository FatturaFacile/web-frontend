import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IcPeriodRate, IntercompanyApiService } from '@core';
import { IntercompanyStructureStore } from './intercompany-structure.store';

const ok = <T>(data: T) => of({ success: true, message: '', data });

const SETTINGS = {
  id: 's1',
  group_id: 'g1',
  mirror_mode: 'draft' as const,
  auto_mirror: true,
  sync_payments: true,
  netting_enabled: false,
  amount_tolerance: '0.5000',
  date_tolerance_days: 3,
  default_standard: 'fer30' as const,
};

const RATE: IcPeriodRate = {
  id: 'r1',
  group_id: 'g1',
  currency: 'EUR',
  group_currency: 'CHF',
  rate_type: 'closing',
  period_end: '2026-12-31',
  rate: '0.9300',
  note: null,
};

describe('IntercompanyStructureStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof IntercompanyStructureStore>;

  beforeEach(() => {
    api = {
      getSettings: vi.fn(() => ok(SETTINGS)),
      getPartyLinks: vi.fn(() => ok([])),
      getPeriodRates: vi.fn(() => ok([RATE])),
      saveSettings: vi.fn(() => ok({ ...SETTINGS, mirror_mode: 'confirmed' })),
      createPartyLink: vi.fn(() => ok({ id: 'l1', group_id: 'g1', entity_tenant_id: 'a', counterparty_tenant_id: 'b', contact_id: 'c', role: 'customer' })),
      deletePartyLink: vi.fn(() => ok(null)),
      savePeriodRate: vi.fn(() => ok({ ...RATE, id: 'r2', rate: '0.9400' })),
      deletePeriodRate: vi.fn(() => ok(null)),
    };
    TestBed.configureTestingModule({ providers: [IntercompanyStructureStore, { provide: IntercompanyApiService, useValue: api }] });
    store = TestBed.inject(IntercompanyStructureStore);
  });

  it('loads the settings, the contacts and the rates of the group', async () => {
    await store.load('g1');

    expect(store.settings()?.default_standard).toBe('fer30');
    expect(store.rates()).toHaveLength(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('keeps the error key when the group cannot be read', async () => {
    api['getSettings'].mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));

    await store.load('g1');

    expect(store.error()).toBe('intercompany.error.forbidden');
  });

  it('saves the settings and keeps what the API answered', async () => {
    const outcome = await store.saveSettings('g1', { ...SETTINGS });

    expect(outcome.ok).toBe(true);
    expect(store.settings()?.mirror_mode).toBe('confirmed');
    expect(store.saving()).toBe(false);
  });

  it('returns the validation errors of a refused write', async () => {
    api['saveSettings'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { amount_tolerance: ['Invalid.'] } } })),
    );

    const outcome = await store.saveSettings('g1', { ...SETTINGS });

    expect(outcome.ok).toBe(false);
    expect(outcome.errors['amount_tolerance']).toEqual(['Invalid.']);
  });

  it('adds and removes a counterpart contact', async () => {
    await store.addPartyLink('g1', { entity_tenant_id: 'a', counterparty_tenant_id: 'b', contact_id: 'c', role: 'customer' });
    expect(store.partyLinks()).toHaveLength(1);

    await store.removePartyLink('l1');
    expect(store.partyLinks()).toHaveLength(0);
  });

  it('replaces a rate of the same currency, type and period instead of listing it twice', async () => {
    await store.load('g1');
    api['savePeriodRate'].mockReturnValue(ok({ ...RATE, id: 'r9', rate: '0.9500' }));

    await store.saveRate('g1', { currency: 'EUR', rate_type: 'closing', period_end: '2026-12-31', rate: '0.9500' });

    expect(store.rates()).toHaveLength(1);
    expect(store.rates()[0].rate).toBe('0.9500');
  });

  it('filters the rates by type', async () => {
    await store.filterRates('g1', { rate_type: 'average' });

    expect(api['getPeriodRates']).toHaveBeenLastCalledWith('g1', { rate_type: 'average' });
  });
});
