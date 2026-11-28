import { TestBed } from '@angular/core/testing';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TimeTravelApiService } from '@core/api/time-travel-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import { TtWhatIfResult } from '@core/models/time-travel.model';
import { TimeTravelContextService } from '@core/services/time-travel-context.service';
import { WhatifValuationReplayComponent } from './whatif-valuation-replay.component';

const i18n = {
  dictionaryLocale: () => 'en',
  translate: (key: string) => key,
};

const result: TtWhatIfResult = {
  id: 'sim-1',
  simulation_name: 'LIFO test',
  valuation_method: 'LIFO',
  target_valid_at: '2025-12-31T23:59:59Z',
  target_known_at: '2026-01-15T00:00:00Z',
  baseline_summary: { method: 'WAC', total_value: '1000.00', total_quantity: '100' },
  simulated_summary: { method: 'LIFO', total_value: '1100.00', total_quantity: '100' },
  delta_summary: { total_value: '100.00', pct: '10.00' },
  items: [
    {
      item_id: 'item-1',
      warehouse_id: 'wh-1',
      quantity: '100',
      official_value: '1000.00',
      simulated_value: '1100.00',
      variance: '100.00',
      variance_pct: '10.00',
    },
  ],
  created_at: '2026-04-01T10:00:00Z',
};

describe('WhatifValuationReplayComponent', () => {
  let api: { whatIfReplay: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    api = { whatIfReplay: vi.fn(() => of({ success: true, message: '', data: result })) };
    TestBed.configureTestingModule({
      providers: [
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: TimeTravelApiService, useValue: api },
        { provide: I18nService, useValue: i18n },
      ],
    });
  });

  async function create() {
    const context = TestBed.inject(TimeTravelContextService);
    context.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T00:00:00Z'));
    const fixture = TestBed.createComponent(WhatifValuationReplayComponent);
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('filters', { warehouse_id: 'wh-1' });
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const drawerButton = (testId: string) => document.querySelector(`[data-testid="${testId}"]`) as HTMLButtonElement | null;

  it('starts from the coordinate of the session', async () => {
    const fixture = await create();
    const component = fixture.componentInstance as unknown as { validAt: Date | null; knownAt: Date | null; method: string };

    expect(component.validAt?.toISOString()).toBe('2025-12-31T23:59:59.000Z');
    expect(component.knownAt?.toISOString()).toBe('2026-01-15T00:00:00.000Z');
    expect(component.method).toBe('FIFO');
  });

  it('runs the replay with the chosen method and the host filters', async () => {
    const fixture = await create();
    (fixture.componentInstance as unknown as { method: string }).method = 'LIFO';

    drawerButton('tt-whatif-run')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.whatIfReplay).toHaveBeenCalledTimes(1);
    const request = api.whatIfReplay.mock.calls[0][0];
    expect(request.valuation_method).toBe('LIFO');
    expect(request.warehouse_id).toBe('wh-1');
    expect(request.valid_at).toBe('2025-12-31T23:59:59.000Z');
    expect(request.known_at).toBe('2026-01-15T00:00:00.000Z');
    expect(request.simulation_name).toBeUndefined();
  });

  it('renders the KPI cards and the variance table of the simulation', async () => {
    const fixture = await create();

    drawerButton('tt-whatif-run')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.querySelectorAll('[data-testid="tt-whatif-kpis"] nz-statistic').length).toBe(4);
    const table = document.querySelector('[data-testid="tt-whatif-table"]');
    expect(table?.textContent).toContain('item-1');
    expect(table?.textContent).toContain('100.00');
  });

  it('shows a translated alert when the replay fails and keeps no stale result', async () => {
    const fixture = await create();
    drawerButton('tt-whatif-run')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    api.whatIfReplay.mockReturnValue(throwError(() => new Error('boom')));

    drawerButton('tt-whatif-run')?.click();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(document.querySelector('[data-testid="tt-whatif-error"]')).not.toBeNull();
    expect(document.querySelector('[data-testid="tt-whatif-kpis"]')).toBeNull();
  });
});
