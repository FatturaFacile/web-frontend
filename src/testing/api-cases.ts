import { Type } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

export interface ApiCase<S> {
  name: string;
  call: (service: S) => Observable<unknown>;
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  /** Path after `environment.apiBaseUrl`, starting with a slash. */
  path: string;
  body?: unknown;
  params?: Record<string, string>;
}

/** Table-driven check of an API service: one request per case (method, URL, params, body, response). */
export function describeApiCases<S>(title: string, serviceType: Type<S>, cases: ApiCase<S>[]): void {
  describe(title, () => {
    let service: S;
    let httpTesting: HttpTestingController;

    beforeEach(() => {
      TestBed.configureTestingModule({
        providers: [serviceType, provideHttpClient(), provideHttpClientTesting()],
      });
      service = TestBed.inject(serviceType);
      httpTesting = TestBed.inject(HttpTestingController);
    });

    afterEach(() => httpTesting.verify());

    it.each(cases)('$name calls $method $path', ({ call, method, path, body, params }) => {
      let result: unknown;
      call(service).subscribe((res) => (result = res));

      const req = httpTesting.expectOne((r) => r.url === `${environment.apiBaseUrl}${path}`);
      expect(req.request.method).toBe(method);
      for (const [key, value] of Object.entries(params ?? {})) {
        expect(req.request.params.get(key)).toBe(value);
      }
      if (body !== undefined) {
        expect(req.request.body).toEqual(body);
      }
      const response = { success: true, message: 'ok', data: { id: 'x' } };
      req.flush(response);
      expect(result).toEqual(response);
    });
  });
}
