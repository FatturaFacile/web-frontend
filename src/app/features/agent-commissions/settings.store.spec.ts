import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService } from '@core';
import { parameter, wrap, zone } from './agent-commissions.testing';
import { SettingsStore } from './settings.store';

describe('SettingsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof SettingsStore>;

  beforeEach(() => {
    api = {
      listZones: vi.fn(() => of(wrap([zone('1')]))),
      listFiscalParameters: vi.fn(() =>
        of(
          wrap([
            parameter('p-1', { code: 'vat_rate', mandate_type: null, value: '22.0000' }),
            parameter('p-2', { code: 'enasarco_massimale', year: 2025 }),
            parameter('p-3', { code: 'enasarco_massimale', year: 2026 }),
            parameter('p-4', {
              code: 'enasarco_massimale',
              year: 2026,
              is_override: true,
              value: '45000.00',
            }),
          ]),
        ),
      ),
      createZone: vi.fn(() => of(wrap(zone('2')))),
      updateZone: vi.fn(() => of(wrap(zone('1')))),
      deleteZone: vi.fn(() => of(wrap(null))),
      saveFiscalOverride: vi.fn(() => of(wrap(parameter('p-5', { is_override: true })))),
      deleteFiscalOverride: vi.fn(() => of(wrap(null))),
    };
    TestBed.configureTestingModule({
      providers: [SettingsStore, { provide: AgentCommissionsApiService, useValue: api }],
    });
    store = TestBed.inject(SettingsStore);
  });

  it('loads the zones and the fiscal parameters together', async () => {
    await store.init();

    expect(store.zones()).toHaveLength(1);
    expect(store.parameters()).toHaveLength(4);
    expect(store.loading()).toBe(false);
  });

  it('reports a failed load', async () => {
    api['listZones'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: {} })),
    );

    await store.init();

    expect(store.error()).toBe('agentCommissions.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('orders the parameters by code, then year (newest first), with the company override on top', async () => {
    await store.init();

    expect(store.sortedParameters().map((entry) => entry.id)).toEqual(['p-4', 'p-3', 'p-2', 'p-1']);
  });

  it('creates and updates a zone, then reads the zones again', async () => {
    expect((await store.saveZone(null, { code: 'N', name: 'North' })).ok).toBe(true);
    expect(api['createZone']).toHaveBeenCalledWith({ code: 'N', name: 'North' });

    expect((await store.saveZone('1', { name: 'North west' })).ok).toBe(true);
    expect(api['updateZone']).toHaveBeenCalledWith('1', { name: 'North west' });
    expect(api['listZones']).toHaveBeenCalledTimes(2);
  });

  it('reports the refusal of a duplicate zone code', async () => {
    api['createZone'].mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({ status: 422, error: { errors: { code: ['Already taken'] } } }),
      ),
    );

    const outcome = await store.saveZone(null, { code: 'N', name: 'North' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errors).toEqual({ code: ['Already taken'] });
    expect(store.saving()).toBe(false);
  });

  it('deletes a zone locally', async () => {
    await store.init();

    expect((await store.removeZone('1')).ok).toBe(true);
    expect(store.zones()).toEqual([]);
  });

  it('saves a company override and reads the parameters again', async () => {
    const payload = { code: 'vat_rate' as const, year: 2026, value: 21 };

    expect((await store.saveOverride(payload)).ok).toBe(true);
    expect(api['saveFiscalOverride']).toHaveBeenCalledWith(payload);
    expect(api['listFiscalParameters']).toHaveBeenCalledTimes(1);
  });

  it('removes an override and reads the parameters again, or reports the refusal', async () => {
    expect((await store.removeOverride('p-4')).ok).toBe(true);
    expect(api['deleteFiscalOverride']).toHaveBeenCalledWith('p-4');
    expect(api['listFiscalParameters']).toHaveBeenCalledTimes(1);

    api['deleteFiscalOverride'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 403, error: { code: 'generic' } })),
    );
    expect((await store.removeOverride('p-1')).ok).toBe(false);
  });
});
