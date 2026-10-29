import { TestBed } from '@angular/core/testing';
import { HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { appConfig } from './app.config';
import { AppStore, AuthStore, I18nService } from '@core';

/**
 * Guards against DI cycles (NG0200) across the real application providers:
 * root services that issue HTTP requests while being constructed run the
 * interceptor chain, so an interceptor that eagerly injects them closes a loop.
 */
describe('appConfig dependency graph', () => {
  let httpTesting: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [...appConfig.providers, provideHttpClientTesting()],
    });
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.match(() => true);
  });

  // I18nService swallows load errors (including NG0200), so assert the request actually left.
  it('lets I18nService load its dictionary through the interceptor chain', () => {
    TestBed.inject(I18nService);
    expect(httpTesting.match((req) => req.url.includes('/translations/')).length).toBeGreaterThan(0);
  });

  it.each([
    ['I18nService', I18nService],
    ['AuthStore', AuthStore],
    ['AppStore', AppStore],
  ] as const)('resolves %s without a circular dependency', (_name, token) => {
    expect(() => TestBed.inject(token)).not.toThrow();
  });

  it('runs the interceptor chain on an HTTP error without a circular dependency', () => {
    TestBed.inject(I18nService);
    let error: unknown;
    TestBed.inject(HttpClient)
      .get('/api/v1/anything')
      .subscribe({ error: (e: unknown) => (error = e) });

    httpTesting
      .expectOne('/api/v1/anything')
      .flush({ message: 'boom' }, { status: 500, statusText: 'Server Error' });

    expect(error).toMatchObject({ status: 500 });
  });
});
