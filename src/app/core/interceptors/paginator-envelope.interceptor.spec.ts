import { provideHttpClient, withInterceptors, HttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { paginatorEnvelopeInterceptor } from './paginator-envelope.interceptor';

describe('paginatorEnvelopeInterceptor', () => {
  let http: HttpClient;
  let ctrl: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([paginatorEnvelopeInterceptor])),
        provideHttpClientTesting(),
      ],
    });
    http = TestBed.inject(HttpClient);
    ctrl = TestBed.inject(HttpTestingController);
  });

  afterEach(() => ctrl.verify());

  it('flattens a Laravel paginator nested in the envelope and builds meta', () => {
    let body: { data: unknown; meta: unknown } | undefined;
    http.get('/x').subscribe((b) => (body = b));
    ctrl.expectOne('/x').flush({
      success: true,
      data: { current_page: 2, data: [{ id: 1 }], per_page: 15, total: 31, last_page: 3, from: 16, to: 16 },
    });
    expect(body?.data).toEqual([{ id: 1 }]);
    expect(body?.meta).toEqual({ current_page: 2, from: 16, to: 16, last_page: 3, per_page: 15, total: 31 });
  });

  it('leaves flat arrays, single objects and bodies with meta untouched', () => {
    const cases = [
      { success: true, data: [{ id: 1 }] },
      { success: true, data: { id: 1, data: [1] } },
      { success: true, data: { current_page: 1, data: [], total: 0 }, meta: { total: 9 } },
    ];
    for (const c of cases) {
      let body: unknown;
      http.get('/y').subscribe((b) => (body = b));
      ctrl.expectOne('/y').flush(c);
      expect(body).toEqual(c);
    }
  });
});
