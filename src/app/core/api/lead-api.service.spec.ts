import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { LeadApiService } from './lead-api.service';

describe('LeadApiService', () => {
  let service: LeadApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(LeadApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('lists leads filtered by rating', () => {
    service.list({ rating: 'hot' }).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/crm/leads') && r.params.get('rating') === 'hot');
    expect(req.request.method).toBe('GET');
    req.flush({ data: [], meta: { current_page: 1, total: 0 } });
  });

  it('converts a lead in one click with an empty body', () => {
    service.convert('abc').subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/crm/leads/abc/convert'));
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({});
    req.flush({ account: { id: '1', name: 'Acme' }, contact_id: '2', opportunity: null });
  });
  it('detects duplicates, records behaviour, merges and updates routing rules', () => {
    service.detectDuplicates({ email: 'a@b.it', phone: '' }).subscribe();
    const dup = http.expectOne((r) => r.url.endsWith('/crm/leads/duplicates') && r.params.get('email') === 'a@b.it' && !r.params.has('phone'));
    dup.flush([]);

    service.recordBehavior('x', 'site_visit', 2).subscribe();
    const beh = http.expectOne((r) => r.url.endsWith('/crm/leads/x/behavior'));
    expect(beh.request.body).toEqual({ event: 'site_visit', count: 2 });
    beh.flush({});

    service.merge('x', 'y').subscribe();
    const merge = http.expectOne((r) => r.url.endsWith('/crm/leads/x/merge'));
    expect(merge.request.body).toEqual({ duplicate_id: 'y' });
    merge.flush({});

    service.updateRoutingRule('r', { is_active: false }).subscribe();
    const rule = http.expectOne((r) => r.url.endsWith('/crm/lead-routing-rules/r'));
    expect(rule.request.method).toBe('PUT');
    rule.flush({});
  });
});