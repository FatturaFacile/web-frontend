import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SfWhatIfParameter } from '@core';
import { IndicatorsComponent } from './indicators.component';
import { IndicatorsStore } from './indicators.store';
import { baseProviders, dossier, indicators, lookups, wrap } from './statutory-financials.testing';
import { WorkspaceStore } from './workspace.store';

interface IndicatorsInternals {
  change(parameter: SfWhatIfParameter, value: number | null): void;
}

describe('IndicatorsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  const simulated = indicators({
    alert_level: 'critical',
    alerts: [{ code: 'dscr', status: 'critical', message: 'DSCR below 1.' }],
    dscr: {
      horizon_months: 6,
      expected_cash_flow: '300.0000',
      opening_liquidity: '100.0000',
      debt_service: '440.0000',
      value: '0.9091',
    },
  });

  beforeEach(() => {
    api = {
      getLookups: vi.fn(() => of(wrap(lookups))),
      getDossier: vi.fn(() => of(wrap(dossier('d-1', { accounting_standard: 'CH_CO_Art959' })))),
      getIndicators: vi.fn(() => of(wrap(indicators()))),
      simulateIndicators: vi.fn(() => of(wrap(simulated))),
      saveIndicators: vi.fn(() => of(wrap(indicators()))),
    };
    TestBed.configureTestingModule({ providers: [WorkspaceStore, ...baseProviders(api)] });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function render() {
    await TestBed.inject(WorkspaceStore).load('d-1');
    const fixture = TestBed.createComponent(IndicatorsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the ratios with value, status, message and thresholds', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;
    const text = root.textContent as string;

    expect(api['getIndicators']).toHaveBeenCalledWith('d-1');
    expect(text).toContain('Current ratio');
    expect(text).toContain('1.20');
    expect(text).toContain('statutoryFinancials.indicators.status.warning');
    expect(text).toContain('statutoryFinancials.indicators.crisis');
    expect(text).toContain('Below the warning threshold.');
    expect(text).toContain('1.50 / 1.00');
    expect(text).toContain('8.50%');
  });

  it('shows the overall alert level and the alerts', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('statutoryFinancials.indicators.alertLevel.warning');
    expect(text).toContain('Current ratio is low.');
  });

  it('shows the 6-month DSCR breakdown of the stored indicators', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).toContain('statutoryFinancials.dscr.breakdown');
    expect(text).toContain('500.00');
    expect(text).toContain('1.75');
  });

  it('offers one control per what-if parameter of the contract', async () => {
    const fixture = await render();
    const root = fixture.nativeElement as HTMLElement;

    for (const parameter of [
      'ebitda_change_percent',
      'revenue_change_percent',
      'debt_service_change_percent',
      'extra_liquidity',
      'expected_cash_flow_6m',
      'debt_service_6m',
      'opening_liquidity',
    ]) {
      expect(root.querySelector(`label[for="sf-whatif-${parameter}"]`), parameter).not.toBeNull();
    }
  });

  it('sends the what-if after a pause and shows the base against the simulated DSCR', async () => {
    const fixture = await render();
    vi.useFakeTimers();
    const component = fixture.componentInstance as unknown as IndicatorsInternals;
    const store = fixture.debugElement.injector.get(IndicatorsStore);

    component.change('ebitda_change_percent', -20);
    component.change('debt_service_change_percent', 10);
    await vi.advanceTimersByTimeAsync(400);
    vi.useRealTimers();
    fixture.detectChanges();

    expect(api['simulateIndicators']).toHaveBeenCalledTimes(1);
    expect(api['simulateIndicators']).toHaveBeenCalledWith('d-1', {
      ebitda_change_percent: -20,
      debt_service_change_percent: 10,
    });
    expect(store.isSimulation()).toBe(true);
    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('statutoryFinancials.indicators.alertLevel.critical');
    expect(text).toContain('DSCR below 1.');
    expect(text).toContain('0.91');
    expect(text).toContain('1.75');
  });

  it('goes back to the stored indicators on reset', async () => {
    const fixture = await render();
    const store = fixture.debugElement.injector.get(IndicatorsStore);
    await store.simulateNow('d-1');
    store.setWhatIf('d-1', { revenue_change_percent: 5 }, 10_000);
    fixture.detectChanges();
    const reset = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('button'),
    ).find((button) =>
      (button.textContent ?? '').includes('statutoryFinancials.action.reset'),
    ) as HTMLButtonElement;
    expect(reset.disabled).toBe(false);

    reset.click();
    fixture.detectChanges();

    expect(store.isSimulation()).toBe(false);
    expect(store.whatIf()).toEqual({});
  });

  it('saves the indicators to the package', async () => {
    const fixture = await render();
    const save = Array.from(
      (fixture.nativeElement as HTMLElement).querySelectorAll('.toolbar button'),
    ).find((button) => (button.textContent ?? '').includes('saveToPackage')) as HTMLButtonElement;

    save.click();
    await fixture.whenStable();

    expect(api['saveIndicators']).toHaveBeenCalledWith('d-1', {});
  });
});
