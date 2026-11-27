import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ObservabilityApiService } from '../../core/api/observability-api.service';
import {
  obsConnector,
  obsEnvelope,
  obsNoisy,
  obsSettings,
  obsSlowEndpoint,
  obsSlowQuery,
  obsStatements,
} from '../../../testing/observability-fixtures';
import { ConnectorAdminStore } from './connector-admin.store';
import {
  CONNECTOR_STATUS_POLL_MS,
  ConnectorStatusStore,
  DISMISSED_STORAGE_KEY,
} from './connector-status.store';
import { ProfilerStore } from './profiler.store';

const api = {
  slowQueries: vi.fn(),
  slowEndpoints: vi.fn(),
  statements: vi.fn(),
  noisyNeighbors: vi.fn(),
  getSettings: vi.fn(),
  saveSettings: vi.fn(),
  connectors: vi.fn(),
  probe: vi.fn(),
  setMaintenance: vi.fn(),
  connectorStatus: vi.fn(),
};

const forbidden = () => throwError(() => new HttpErrorResponse({ status: 403 }));

beforeEach(() => {
  Object.values(api).forEach((mock) => mock.mockReset());
  sessionStorage.clear();
  TestBed.configureTestingModule({
    providers: [
      ProfilerStore,
      ConnectorAdminStore,
      { provide: ObservabilityApiService, useValue: api },
    ],
  });
});

describe('ProfilerStore', () => {
  it('loads the five datasets and derives the KPIs', async () => {
    api.slowQueries.mockReturnValue(
      of(obsEnvelope([obsSlowQuery(), obsSlowQuery({ fingerprint: 'fp-2', n_plus_one: true, max_ms: 2000, suggested_indexes: [] })])),
    );
    api.slowEndpoints.mockReturnValue(of(obsEnvelope([obsSlowEndpoint({ p95_ms: 800 })])));
    api.statements.mockReturnValue(of(obsEnvelope(obsStatements())));
    api.noisyNeighbors.mockReturnValue(of(obsEnvelope([obsNoisy(), obsNoisy({ tenant_id: 't-2', flagged: false })])));
    api.getSettings.mockReturnValue(of(obsEnvelope(obsSettings())));
    const store = TestBed.inject(ProfilerStore);

    await store.loadAll();

    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
    expect(store.slowQueries()).toHaveLength(2);
    expect(store.nPlusOneCount()).toBe(1);
    expect(store.slowestQueryMs()).toBe(2000);
    expect(store.slowestEndpointP95()).toBe(800);
    expect(store.suggestedIndexCount()).toBe(1);
    expect(store.flaggedTenants()).toBe(1);
    expect(store.settings()?.slow_query_threshold_ms).toBe(250);
  });

  it('keeps the datasets that loaded when one call fails', async () => {
    api.slowQueries.mockReturnValue(of(obsEnvelope([obsSlowQuery()])));
    api.slowEndpoints.mockReturnValue(forbidden());
    api.statements.mockReturnValue(of(obsEnvelope(obsStatements({ available: false, reason: 'extension_missing' }))));
    api.noisyNeighbors.mockReturnValue(of(obsEnvelope([])));
    api.getSettings.mockReturnValue(of(obsEnvelope(obsSettings())));
    const store = TestBed.inject(ProfilerStore);

    await store.loadAll();

    expect(store.error()).toBe('OBSERVABILITY.ERROR.FORBIDDEN');
    expect(store.slowQueries()).toHaveLength(1);
    expect(store.slowEndpoints()).toEqual([]);
    expect(store.statements()?.reason).toBe('extension_missing');
  });

  it('selects a query by fingerprint for the drawer', async () => {
    api.slowQueries.mockReturnValue(of(obsEnvelope([obsSlowQuery()])));
    api.slowEndpoints.mockReturnValue(of(obsEnvelope([])));
    api.statements.mockReturnValue(of(obsEnvelope(obsStatements())));
    api.noisyNeighbors.mockReturnValue(of(obsEnvelope([])));
    api.getSettings.mockReturnValue(of(obsEnvelope(obsSettings())));
    const store = TestBed.inject(ProfilerStore);
    await store.loadAll();

    store.select('fp-1');
    expect(store.selectedQuery()?.fingerprint).toBe('fp-1');
    store.select(null);
    expect(store.selectedQuery()).toBeNull();
  });

  it('saves the settings and reports a refusal', async () => {
    const store = TestBed.inject(ProfilerStore);
    api.saveSettings.mockReturnValue(of(obsEnvelope(obsSettings({ slow_query_threshold_ms: 500 }))));

    await expect(store.saveSettings(obsSettings({ slow_query_threshold_ms: 500 }))).resolves.toBe(true);
    expect(store.settings()?.slow_query_threshold_ms).toBe(500);
    expect(store.saved()).toBe(true);

    api.saveSettings.mockReturnValue(forbidden());
    await expect(store.saveSettings(obsSettings())).resolves.toBe(false);
    expect(store.error()).toBe('OBSERVABILITY.ERROR.FORBIDDEN');
  });
});

describe('ConnectorAdminStore', () => {
  it('loads, probes and switches maintenance', async () => {
    api.connectors.mockReturnValue(of(obsEnvelope([obsConnector(), obsConnector({ key: 'vies', name_code: 'OBSERVABILITY.CONNECTOR.VIES' })])));
    const store = TestBed.inject(ConnectorAdminStore);
    await store.load();
    expect(store.connectors()).toHaveLength(2);

    api.probe.mockReturnValue(of(obsEnvelope([obsConnector({ key: 'vies', status: 'outage' })])));
    await store.probe('vies');
    expect(api.probe).toHaveBeenCalledWith('vies');
    expect(store.connectors().find((connector) => connector.key === 'vies')?.status).toBe('outage');
    expect(store.connectors().find((connector) => connector.key === 'sdi')?.status).toBe('operational');

    api.setMaintenance.mockReturnValue(of(obsEnvelope(obsConnector({ status: 'maintenance' }))));
    await store.setMaintenance('sdi', true, 'planned');
    expect(api.setMaintenance).toHaveBeenCalledWith('sdi', true, 'planned');
    expect(store.connectors().find((connector) => connector.key === 'sdi')?.status).toBe('maintenance');
  });

  it('reports a failed load', async () => {
    api.connectors.mockReturnValue(forbidden());
    const store = TestBed.inject(ConnectorAdminStore);

    await store.load();

    expect(store.error()).toBe('OBSERVABILITY.ERROR.FORBIDDEN');
  });
});

describe('ConnectorStatusStore', () => {
  const degraded = {
    overall: 'degraded' as const,
    checked_at: '2027-07-10T10:00:00Z',
    connectors: [obsConnector(), obsConnector({ key: 'vies', status: 'degraded' })],
  };

  beforeEach(() => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({ providers: [{ provide: ObservabilityApiService, useValue: api }] });
  });

  afterEach(() => vi.useRealTimers());

  it('shows the banner for a problem and hides it once dismissed, remembering it for the session', async () => {
    api.connectorStatus.mockReturnValue(of(obsEnvelope(degraded)));
    const store = TestBed.inject(ConnectorStatusStore);

    await store.refresh();
    expect(store.bannerVisible()).toBe(true);
    expect(store.affected().map((connector) => connector.key)).toEqual(['vies']);

    store.dismiss();
    expect(store.bannerVisible()).toBe(false);
    expect(sessionStorage.getItem(DISMISSED_STORAGE_KEY)).toBe('vies:degraded');
  });

  it('shows the banner again when the situation changes', async () => {
    api.connectorStatus.mockReturnValue(of(obsEnvelope(degraded)));
    const store = TestBed.inject(ConnectorStatusStore);
    await store.refresh();
    store.dismiss();

    api.connectorStatus.mockReturnValue(
      of(obsEnvelope({ ...degraded, overall: 'outage', connectors: [obsConnector({ key: 'vies', status: 'outage' })] })),
    );
    await store.refresh();

    expect(store.bannerVisible()).toBe(true);
  });

  it('starts dismissed when the session already dismissed this very problem', async () => {
    sessionStorage.setItem(DISMISSED_STORAGE_KEY, 'vies:degraded');
    api.connectorStatus.mockReturnValue(of(obsEnvelope(degraded)));
    const store = TestBed.inject(ConnectorStatusStore);

    await store.refresh();

    expect(store.bannerVisible()).toBe(false);
  });

  it('shows no banner while everything is operational', async () => {
    api.connectorStatus.mockReturnValue(
      of(obsEnvelope({ overall: 'operational', checked_at: null, connectors: [obsConnector()] })),
    );
    const store = TestBed.inject(ConnectorStatusStore);

    await store.refresh();

    expect(store.bannerVisible()).toBe(false);
  });

  it('keeps the last known state when a poll fails', async () => {
    api.connectorStatus.mockReturnValueOnce(of(obsEnvelope(degraded)));
    const store = TestBed.inject(ConnectorStatusStore);
    await store.refresh();

    api.connectorStatus.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 500 })));
    await store.refresh();

    expect(store.overall()).toBe('degraded');
    expect(store.error()).toBe('OBSERVABILITY.ERROR.GENERIC');
  });

  it('polls every minute, pauses while the tab is hidden and stops on demand', async () => {
    vi.useFakeTimers();
    api.connectorStatus.mockReturnValue(of(obsEnvelope(degraded)));
    const store = TestBed.inject(ConnectorStatusStore);

    store.startPolling();
    store.startPolling();
    await vi.advanceTimersByTimeAsync(0);
    expect(api.connectorStatus).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(CONNECTOR_STATUS_POLL_MS);
    expect(api.connectorStatus).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'hidden', { value: true, configurable: true });
    await vi.advanceTimersByTimeAsync(CONNECTOR_STATUS_POLL_MS);
    expect(api.connectorStatus).toHaveBeenCalledTimes(2);

    Object.defineProperty(document, 'hidden', { value: false, configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(0);
    expect(api.connectorStatus).toHaveBeenCalledTimes(3);

    store.stopPolling();
    await vi.advanceTimersByTimeAsync(CONNECTOR_STATUS_POLL_MS * 2);
    expect(api.connectorStatus).toHaveBeenCalledTimes(3);
  });
});
