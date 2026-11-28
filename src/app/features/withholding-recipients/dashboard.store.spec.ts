import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Observable, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WithholdingRecipientsApiService } from '@core';
import { DashboardStore } from './dashboard.store';
import { dashboardMeta, dashboardRow, lookups, wrap } from './withholding-recipients.testing';

describe('DashboardStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof DashboardStore>;

  beforeEach(() => {
    api = {
      getDashboard: vi.fn(() =>
        of(
          wrap(
            [dashboardRow('r-1'), dashboardRow('r-2', { alerts: ['birth_date_missing'] })],
            dashboardMeta,
          ),
        ),
      ),
      getLookups: vi.fn(() => of(wrap(lookups))),
    };
    TestBed.configureTestingModule({
      providers: [DashboardStore, { provide: WithholdingRecipientsApiService, useValue: api }],
    });
    store = TestBed.inject(DashboardStore);
  });

  it('loads the rows and the summary of the year', async () => {
    await store.load();

    expect(store.rows()).toHaveLength(2);
    expect(store.meta()?.with_alerts).toBe(1);
    expect(store.hasRows()).toBe(true);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('sends the current year and drops the empty filters', async () => {
    await store.load();

    const filters = api['getDashboard'].mock.calls[0][0];
    expect(filters.year).toBe(new Date().getFullYear());
    expect(filters.search).toBeNull();
    expect(filters.regime).toBeNull();
    expect(filters.only_alerts).toBe(false);
  });

  it('applies a change of the filters and reads the dashboard again', async () => {
    await store.setFilters({
      regime: 'agent_25bis',
      jurisdiction: 'IT',
      search: ' anna ',
      onlyAlerts: true,
    });

    expect(api['getDashboard']).toHaveBeenCalledTimes(1);
    expect(api['getDashboard']).toHaveBeenCalledWith({
      regime: 'agent_25bis',
      jurisdiction: 'IT',
      cu_causal: null,
      search: 'anna',
      year: new Date().getFullYear(),
      only_alerts: true,
    });
  });

  it('resets the filters but keeps the year', async () => {
    await store.setFilters({ year: 2024, regime: 'amateur_sports', onlyAlerts: true });
    await store.resetFilters();

    expect(store.regime()).toBeNull();
    expect(store.onlyAlerts()).toBe(false);
    expect(store.year()).toBe(2024);
  });

  it('reports a failed load with the key of the problem code', async () => {
    api['getDashboard'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    await store.load();

    expect(store.error()).toBe('withholdingRecipients.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('loads the lookups', async () => {
    await store.loadLookups();

    expect(store.lookups()?.regimes).toHaveLength(6);
  });

  it('keeps only the answer of the latest load', async () => {
    let release: (value: unknown) => void = () => undefined;
    api['getDashboard'].mockReturnValueOnce(
      new Observable((subscriber) => {
        release = (value) => {
          subscriber.next(value);
          subscriber.complete();
        };
      }),
    );

    const slow = store.load();
    await store.load();
    release(wrap([dashboardRow('stale')], dashboardMeta));
    await slow;

    expect(store.rows().map((row) => row.id)).toEqual(['r-1', 'r-2']);
  });
});
