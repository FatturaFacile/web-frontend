import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { StatutoryFinancialsApiService } from '@core';
import { IndicatorsStore } from './indicators.store';
import { indicators, wrap } from './statutory-financials.testing';

describe('IndicatorsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof IndicatorsStore>;

  const simulated = indicators({
    alert_level: 'critical',
    dscr: {
      horizon_months: 6,
      expected_cash_flow: '300.0000',
      opening_liquidity: '200.0000',
      debt_service: '440.0000',
      value: '1.1364',
    },
  });

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      getIndicators: vi.fn(() => of(wrap(indicators()))),
      simulateIndicators: vi.fn(() => of(wrap(simulated))),
      saveIndicators: vi.fn(() => of(wrap(indicators()))),
    };
    TestBed.configureTestingModule({
      providers: [IndicatorsStore, { provide: StatutoryFinancialsApiService, useValue: api }],
    });
    store = TestBed.inject(IndicatorsStore);
  });

  afterEach(() => {
    store.dispose();
    vi.useRealTimers();
  });

  it('loads the stored indicators and shows them while nothing is simulated', async () => {
    await store.load('d-1');

    expect(store.base()?.indicators).toHaveLength(2);
    expect(store.current()).toBe(store.base());
    expect(store.isSimulation()).toBe(false);
    expect(store.baseDscr()?.value).toBe('1.7500');
  });

  it('keeps the error key when the indicators cannot be read', async () => {
    api['getIndicators']?.mockReturnValue(
      throwError(
        () => new HttpErrorResponse({ status: 409, error: { code: 'statements_not_generated' } }),
      ),
    );

    await store.load('d-1');

    expect(store.error()).toBe('statutoryFinancials.error.statements_not_generated');
  });

  it('simulates once after a pause, however many parameters change', async () => {
    await store.load('d-1');

    store.setWhatIf('d-1', { ebitda_change_percent: -5 });
    store.setWhatIf('d-1', { ebitda_change_percent: -10 });
    store.setWhatIf('d-1', { debt_service_change_percent: 10 });
    expect(api['simulateIndicators']).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(400);

    expect(api['simulateIndicators']).toHaveBeenCalledTimes(1);
    expect(api['simulateIndicators']).toHaveBeenCalledWith('d-1', {
      ebitda_change_percent: -10,
      debt_service_change_percent: 10,
    });
    expect(store.isSimulation()).toBe(true);
    expect(store.simulatedDscr()?.value).toBe('1.1364');
    expect(store.baseDscr()?.value).toBe('1.7500');
    expect(store.current()?.alert_level).toBe('critical');
    expect(store.simulating()).toBe(false);
  });

  it('does not send cleared parameters and goes back to the stored indicators', async () => {
    await store.load('d-1');
    store.setWhatIf('d-1', { revenue_change_percent: 5 });
    await vi.advanceTimersByTimeAsync(400);
    expect(store.isSimulation()).toBe(true);

    store.setWhatIf('d-1', { revenue_change_percent: null });
    await vi.advanceTimersByTimeAsync(400);

    expect(api['simulateIndicators']).toHaveBeenCalledTimes(1);
    expect(store.isSimulation()).toBe(false);
  });

  it('simulates at once on demand', async () => {
    store.setWhatIf('d-1', { extra_liquidity: 1000 }, 10_000);

    await store.simulateNow('d-1');

    expect(api['simulateIndicators']).toHaveBeenCalledWith('d-1', { extra_liquidity: 1000 });
    await vi.advanceTimersByTimeAsync(10_000);
    expect(api['simulateIndicators']).toHaveBeenCalledTimes(1);
  });

  it('resets the what-if and cancels a pending simulation', async () => {
    await store.load('d-1');
    store.setWhatIf('d-1', { ebitda_change_percent: -10 });

    store.reset();
    await vi.advanceTimersByTimeAsync(400);

    expect(api['simulateIndicators']).not.toHaveBeenCalled();
    expect(store.whatIf()).toEqual({});
    expect(store.isSimulation()).toBe(false);
  });

  it('persists the indicators with the what-if in use', async () => {
    await store.load('d-1');
    store.setWhatIf('d-1', { opening_liquidity: 50 });
    store.reset();
    store.setWhatIf('d-1', { opening_liquidity: 75 }, 10_000);

    const outcome = await store.saveToPackage('d-1');

    expect(outcome.ok).toBe(true);
    expect(api['saveIndicators']).toHaveBeenCalledWith('d-1', { opening_liquidity: 75 });
    expect(store.saving()).toBe(false);
  });

  it('answers a refused simulation with its error key', async () => {
    api['simulateIndicators']?.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'generic' } })),
    );
    store.setWhatIf('d-1', { extra_liquidity: 1 }, 10_000);

    const outcome = await store.simulateNow('d-1');

    expect(outcome.ok).toBe(false);
    expect(store.simulating()).toBe(false);
  });
});
