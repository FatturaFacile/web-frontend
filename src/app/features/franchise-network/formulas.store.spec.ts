import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FranchiseNetworkApiService, FrnFormulaPayload } from '@core';
import { FormulasStore } from './formulas.store';

const ok = (data: unknown = {}) => of({ success: true, message: '', data });

const payload: FrnFormulaPayload = {
  code: 'CUSTOM-1',
  labels: { it: 'Formula', en: 'Formula', de: 'Formel', fr: 'Formule' },
  royalty_tiers: [{ from: 0, to: null, rate: 6 }],
  marketing_tiers: [{ from: 0, to: null, rate: 2 }],
  minimum_guarantee: 1000,
  startup_months: 3,
  startup_mode: 'full_exemption',
  startup_reduction_percent: 0,
  ramp_start_percent: 0,
  startup_applies_to_marketing: false,
  currency: 'EUR',
};

describe('FormulasStore', () => {
  const api = {
    listFormulas: vi.fn(),
    createFormula: vi.fn(),
    updateFormula: vi.fn(),
    deleteFormula: vi.fn(),
    cloneFormula: vi.fn(),
    simulateFormula: vi.fn(),
  };
  let store: InstanceType<typeof FormulasStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listFormulas.mockReturnValue(ok([{ id: 'f1', code: 'RETAIL-FLAT-6-2', is_preset: true }]));
    TestBed.configureTestingModule({
      providers: [FormulasStore, { provide: FranchiseNetworkApiService, useValue: api }],
    });
    store = TestBed.inject(FormulasStore);
  });

  it('loads the formulas, presets included', async () => {
    await store.load();

    expect(store.formulas()).toHaveLength(1);
    expect(store.formulas()[0].is_preset).toBe(true);
  });

  it('creates without an id, updates with one and copies a preset', async () => {
    api.createFormula.mockReturnValue(ok());
    api.updateFormula.mockReturnValue(ok());
    api.cloneFormula.mockReturnValue(ok());

    expect((await store.save(payload)).ok).toBe(true);
    expect(api.createFormula).toHaveBeenCalledWith(payload);
    expect((await store.save(payload, 'f2')).ok).toBe(true);
    expect(api.updateFormula).toHaveBeenCalledWith('f2', payload);
    expect((await store.clone('f1', 'MY-COPY')).ok).toBe(true);
    expect(api.cloneFormula).toHaveBeenCalledWith('f1', 'MY-COPY');
  });

  it('shows the refusal of invalid brackets', async () => {
    api.createFormula.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'tiers_not_contiguous' } })),
    );

    const outcome = await store.save(payload);

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('franchiseNetwork.error.tiers_not_contiguous');
  });

  it('keeps the simulation of a hypothetical month and clears it', async () => {
    api.simulateFormula.mockReturnValue(ok({ royalty_charged: '1000.00', marketing_fund: '200.00' }));

    const outcome = await store.simulate('f1', { net_sales: 10000, period: '2028-03' });

    expect(outcome.ok).toBe(true);
    expect(api.simulateFormula).toHaveBeenCalledWith('f1', { net_sales: 10000, period: '2028-03' });
    expect(store.simulation()?.royalty_charged).toBe('1000.00');

    store.clearSimulation();
    expect(store.simulation()).toBeNull();
  });
});
