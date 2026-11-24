import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { marketplaceSecretFields } from '../models';
import { MarketplaceApiService } from './marketplace-api.service';

describe('MarketplaceApiService', () => {
  let service: MarketplaceApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [MarketplaceApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(MarketplaceApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('filters the catalog and skips empty filters', () => {
    service.getConnectors({ category: 'payment', search: '' }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/marketplace/connectors') && r.params.get('category') === 'payment' && !r.params.has('search'));
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('installs with the granted scopes and configures with the schema values and the rate limit', () => {
    service.install({ connector_key: 'stripe', name: 'Main', granted_scopes: ['invoicing.read'] }).subscribe();
    const install = httpMock.expectOne((r) => r.url.endsWith('/marketplace/installations'));
    expect(install.request.method).toBe('POST');
    expect(install.request.body).toEqual({ connector_key: 'stripe', name: 'Main', granted_scopes: ['invoicing.read'] });
    install.flush({ data: {} });

    service.configure('i-1', { config: { secret_key: 'value' }, rate_limit_per_minute: 30 }).subscribe();
    const configure = httpMock.expectOne((r) => r.url.endsWith('/installations/i-1/configuration'));
    expect(configure.request.method).toBe('PUT');
    expect(configure.request.body).toEqual({ config: { secret_key: 'value' }, rate_limit_per_minute: 30 });
    configure.flush({ data: {} });
  });

  it('drives the lifecycle, the health checks and the sync runs on the documented routes', () => {
    const calls: [() => void, string, string][] = [
      [() => service.enable('i-1').subscribe(), 'POST', '/installations/i-1/enable'],
      [() => service.disable('i-1').subscribe(), 'POST', '/installations/i-1/disable'],
      [() => service.upgrade('i-1', ['ledger.write']).subscribe(), 'POST', '/installations/i-1/upgrade'],
      [() => service.runHealthCheck('i-1').subscribe(), 'POST', '/installations/i-1/health-checks'],
      [() => service.runSync('i-1', 'orders').subscribe(), 'POST', '/installations/i-1/sync-runs'],
      [() => service.uninstall('i-1').subscribe(), 'DELETE', '/installations/i-1'],
    ];

    for (const [call, method, path] of calls) {
      call();
      const request = httpMock.expectOne((r) => r.url.endsWith(`/marketplace${path}`) && r.method === method);
      request.flush({ data: {} });
    }
  });

  it('knows which fields of a schema are credentials', () => {
    const fields = marketplaceSecretFields({
      config_schema: [
        { key: 'shop', label: 'Shop', type: 'string', required: true, options: [], default: null, help: null },
        { key: 'token', label: 'Token', type: 'secret', required: true, options: [], default: null, help: null },
      ],
    });

    expect(fields.map((field) => field.key)).toEqual(['token']);
  });
});
