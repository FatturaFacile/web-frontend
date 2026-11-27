import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { obsConnector, obsEnvelope, obsSettings } from '../../../testing/observability-fixtures';
import { ObservabilityApiService } from './observability-api.service';

describe('ObservabilityApiService', () => {
  let api: ObservabilityApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    api = TestBed.inject(ObservabilityApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('asks for the 24 h top 20 of queries and endpoints', () => {
    api.slowQueries().subscribe();
    const queries = http.expectOne((req) => req.url.endsWith('/admin/observability/profiler/slow-queries'));
    expect(queries.request.params.get('hours')).toBe('24');
    expect(queries.request.params.get('limit')).toBe('20');
    queries.flush(obsEnvelope([]));

    api.slowEndpoints(6, 5).subscribe();
    const endpoints = http.expectOne((req) => req.url.endsWith('/profiler/slow-endpoints'));
    expect(endpoints.request.params.get('hours')).toBe('6');
    endpoints.flush(obsEnvelope([]));
  });

  it('reads statements and noisy neighbours', () => {
    api.statements().subscribe();
    http.expectOne((req) => req.url.endsWith('/profiler/statements')).flush(obsEnvelope({}));
    api.noisyNeighbors().subscribe();
    const noisy = http.expectOne((req) => req.url.endsWith('/profiler/noisy-neighbors'));
    expect(noisy.request.params.get('hours')).toBe('1');
    noisy.flush(obsEnvelope([]));
  });

  it('reads and saves the settings', () => {
    api.getSettings().subscribe();
    http.expectOne((req) => req.method === 'GET' && req.url.endsWith('/profiler/settings')).flush(obsEnvelope(obsSettings()));

    api.saveSettings(obsSettings({ slow_query_threshold_ms: 500 })).subscribe();
    const put = http.expectOne((req) => req.method === 'PUT' && req.url.endsWith('/profiler/settings'));
    expect(put.request.body.slow_query_threshold_ms).toBe(500);
    put.flush(obsEnvelope(obsSettings({ slow_query_threshold_ms: 500 })));
  });

  it('lists, probes and puts connectors in maintenance', () => {
    api.connectors().subscribe();
    http.expectOne((req) => req.url.endsWith('/admin/observability/connectors')).flush(obsEnvelope([obsConnector()]));

    api.connectorHistory('sdi', 48).subscribe();
    const history = http.expectOne((req) => req.url.endsWith('/connectors/sdi/history'));
    expect(history.request.params.get('hours')).toBe('48');
    history.flush(obsEnvelope({}));

    api.probe().subscribe();
    expect(http.expectOne((req) => req.url.endsWith('/connectors/probe')).request.body).toEqual({});
    api.probe('vies').subscribe();
    const probe = http.expectOne((req) => req.url.endsWith('/connectors/probe'));
    expect(probe.request.body).toEqual({ key: 'vies' });
    probe.flush(obsEnvelope([]));

    api.setMaintenance('zefix', true, 'planned').subscribe();
    const maintenance = http.expectOne((req) => req.url.endsWith('/connectors/zefix/maintenance'));
    expect(maintenance.request.method).toBe('PUT');
    expect(maintenance.request.body).toEqual({ maintenance: true, message: 'planned' });
    maintenance.flush(obsEnvelope(obsConnector()));
  });

  it('reads the tenant-facing status from the system endpoint', () => {
    api.connectorStatus().subscribe();
    const status = http.expectOne((req) => req.url.endsWith('/system/connector-status'));
    expect(status.request.method).toBe('GET');
    status.flush(obsEnvelope({ overall: 'operational', checked_at: null, connectors: [] }));
  });
});
