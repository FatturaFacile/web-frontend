import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LeadApiService, toPaginated, unwrapApiData } from './lead-api.service';
import { Lead, LeadConvertResult, LeadSetting, PaginatedResponse } from '../models';

const BASE = 'https://api.test/api/v1';
const CRM = `${BASE}/crm`;

describe('LeadApiService', () => {
  let service: LeadApiService;
  let http: HttpTestingController;
  const originalBase = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = BASE;
    TestBed.configureTestingModule({
      providers: [LeadApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LeadApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalBase;
  });

  it('lists leads with filter params and normalizes partial meta', () => {
    let result: PaginatedResponse<Lead> | undefined;
    service
      .listLeads({ rating: 'hot', min_score: 60, sort: '-score', page: 2, per_page: 10, source: '' })
      .subscribe((r) => (result = r));

    const req = http.expectOne((r) => r.url === `${CRM}/leads`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('rating')).toBe('hot');
    expect(req.request.params.get('min_score')).toBe('60');
    expect(req.request.params.get('sort')).toBe('-score');
    expect(req.request.params.get('page')).toBe('2');
    expect(req.request.params.has('source')).toBe(false);
    req.flush({ data: [{ id: 'l1' }], meta: { current_page: 2, total: 11 } });

    expect(result?.data).toEqual([{ id: 'l1' }]);
    expect(result?.meta.total).toBe(11);
    expect(result?.meta.current_page).toBe(2);
    expect(result?.meta.per_page).toBe(10);
    expect(result?.meta.last_page).toBe(2);
  });

  it('gets a lead from a raw or enveloped body', () => {
    const got: Lead[] = [];
    service.getLead('l1').subscribe((l) => got.push(l));
    http.expectOne(`${CRM}/leads/l1`).flush({ id: 'l1', score: 10 });
    service.getLead('l1').subscribe((l) => got.push(l));
    http.expectOne(`${CRM}/leads/l1`).flush({ success: true, message: '', data: { id: 'l1', score: 20 } });
    expect(got.map((l) => l.score)).toEqual([10, 20]);
  });

  it('lists and posts activity events', () => {
    service.listEvents('l1').subscribe();
    const list = http.expectOne(`${CRM}/leads/l1/events`);
    expect(list.request.method).toBe('GET');
    list.flush({ data: [] });

    const payload = { type: 'email_opened' as const, occurred_at: '2026-11-01T10:00:00Z', metadata: { a: 1 } };
    service.addEvent('l1', payload).subscribe();
    const post = http.expectOne(`${CRM}/leads/l1/events`);
    expect(post.request.method).toBe('POST');
    expect(post.request.body).toEqual(payload);
    post.flush({ data: { id: 'e1' } }, { status: 201, statusText: 'Created' });
  });

  it('unwraps data from event and route envelopes that carry sibling keys', () => {
    let ev: unknown;
    service.addEvent('l1', { type: 'site_visit' }).subscribe((r) => (ev = r));
    http
      .expectOne(`${CRM}/leads/l1/events`)
      .flush({ data: { id: 'e1' }, lead: { id: 'l1', score: 50 } }, { status: 201, statusText: 'Created' });
    expect(ev).toEqual({ id: 'e1' });

    let lead: Lead | undefined;
    service.route('l1').subscribe((r) => (lead = r));
    http
      .expectOne(`${CRM}/leads/l1/route`)
      .flush({ data: { id: 'l1', assigned_user_id: 'u1' }, routing: { assigned_user_id: 'u1', rule_id: 'r1' } });
    expect(lead?.id).toBe('l1');
    expect(lead?.assigned_user_id).toBe('u1');
  });

  it('posts rescore, route and convert', () => {
    service.rescore('l1').subscribe();
    expect(http.expectOne(`${CRM}/leads/l1/rescore`).request.method).toBe('POST');

    service.route('l1').subscribe();
    expect(http.expectOne(`${CRM}/leads/l1/route`).request.method).toBe('POST');

    let result: LeadConvertResult | undefined;
    service.convert('l1', { existing_contact_id: 'c1', create_opportunity: false }).subscribe((r) => (result = r));
    const conv = http.expectOne(`${CRM}/leads/l1/convert`);
    expect(conv.request.method).toBe('POST');
    expect(conv.request.body).toEqual({ existing_contact_id: 'c1', create_opportunity: false });
    conv.flush({ account: { id: 'a1', name: 'Acme' }, contact_id: 'c1', opportunity: null });
    expect(result?.contact_id).toBe('c1');
  });

  it('handles duplicates list, merge and dismiss', () => {
    service.listDuplicates().subscribe();
    const list = http.expectOne((r) => r.url === `${CRM}/duplicates`);
    expect(list.request.params.get('status')).toBe('pending');
    list.flush({ data: [] });

    service.mergeDuplicate('d1', { survivor: 'candidate', field_choices: { email: 'lead' } }).subscribe();
    const merge = http.expectOne(`${CRM}/duplicates/d1/merge`);
    expect(merge.request.method).toBe('POST');
    expect(merge.request.body).toEqual({ survivor: 'candidate', field_choices: { email: 'lead' } });
    merge.flush({});

    service.dismissDuplicate('d1').subscribe();
    expect(http.expectOne(`${CRM}/duplicates/d1/dismiss`).request.method).toBe('POST');
  });

  it('covers scoring rules CRUD and preview', () => {
    service.listScoringRules().subscribe();
    expect(http.expectOne(`${CRM}/scoring-rules`).request.method).toBe('GET');

    const rule = {
      code: 'IND',
      name: 'Industry',
      category: 'demographic' as const,
      field: 'industry',
      operator: 'eq' as const,
      value: 'it',
      points: 10,
      is_active: true,
    };
    service.createScoringRule(rule).subscribe();
    const create = http.expectOne(`${CRM}/scoring-rules`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(rule);

    service.getScoringRule('r1').subscribe();
    expect(http.expectOne(`${CRM}/scoring-rules/r1`).request.method).toBe('GET');

    service.updateScoringRule('r1', { points: 5 }).subscribe();
    const upd = http.expectOne(`${CRM}/scoring-rules/r1`);
    expect(upd.request.method).toBe('PUT');
    expect(upd.request.body).toEqual({ points: 5 });

    service.deleteScoringRule('r1').subscribe();
    expect(http.expectOne(`${CRM}/scoring-rules/r1`).request.method).toBe('DELETE');

    service.previewScore({ lead_id: 'l1' }).subscribe();
    const prev = http.expectOne(`${CRM}/scoring-rules/preview`);
    expect(prev.request.method).toBe('POST');
    expect(prev.request.body).toEqual({ lead_id: 'l1' });
  });

  it('reads and updates lead settings', () => {
    const settings: LeadSetting = {
      warm_threshold: 40,
      hot_threshold: 70,
      auto_qualify_threshold: 80,
      dedup_mode: 'notify',
      dedup_levenshtein_max: 2,
      dedup_similarity_min: 0.85,
      default_country: 'IT',
    };
    service.getSettings().subscribe();
    expect(http.expectOne(`${CRM}/lead-settings`).request.method).toBe('GET');
    service.updateSettings(settings).subscribe();
    const put = http.expectOne(`${CRM}/lead-settings`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual(settings);
  });

  it('covers routing rules CRUD and reorder', () => {
    service.listRoutingRules().subscribe();
    expect(http.expectOne(`${CRM}/routing-rules`).request.method).toBe('GET');

    const rule = {
      name: 'North',
      priority: 1,
      conditions: { regions: ['MI'] },
      strategy: 'round_robin' as const,
      assignee_user_ids: ['u1', 'u2'],
      is_default: false,
      is_active: true,
    };
    service.createRoutingRule(rule).subscribe();
    const create = http.expectOne(`${CRM}/routing-rules`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual(rule);

    service.getRoutingRule('r1').subscribe();
    expect(http.expectOne(`${CRM}/routing-rules/r1`).request.method).toBe('GET');
    service.updateRoutingRule('r1', { name: 'X' }).subscribe();
    expect(http.expectOne(`${CRM}/routing-rules/r1`).request.method).toBe('PUT');
    service.deleteRoutingRule('r1').subscribe();
    expect(http.expectOne(`${CRM}/routing-rules/r1`).request.method).toBe('DELETE');

    service.reorderRoutingRules(['b', 'a']).subscribe();
    const reorder = http.expectOne(`${CRM}/routing-rules/reorder`);
    expect(reorder.request.method).toBe('POST');
    expect(reorder.request.body).toEqual({ ids: ['b', 'a'] });
  });

  it('covers lead sources CRUD and rotate-secret', () => {
    service.listSources().subscribe();
    expect(http.expectOne(`${CRM}/lead-sources`).request.method).toBe('GET');

    service.createSource({ name: 'Site', type: 'web_form' }).subscribe();
    const create = http.expectOne(`${CRM}/lead-sources`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ name: 'Site', type: 'web_form' });

    service.updateSource('s1', { name: 'New' }).subscribe();
    expect(http.expectOne(`${CRM}/lead-sources/s1`).request.method).toBe('PUT');
    service.deleteSource('s1').subscribe();
    expect(http.expectOne(`${CRM}/lead-sources/s1`).request.method).toBe('DELETE');
    service.rotateSourceSecret('s1').subscribe();
    expect(http.expectOne(`${CRM}/lead-sources/s1/rotate-secret`).request.method).toBe('POST');
  });
});

describe('lead envelope helpers', () => {
  it('unwrapApiData keeps raw resources and unwraps envelopes', () => {
    expect(unwrapApiData({ id: 'x' })).toEqual({ id: 'x' });
    expect(unwrapApiData({ data: { id: 'x' } })).toEqual({ id: 'x' });
    expect(unwrapApiData({ success: true, message: 'ok', data: [1] })).toEqual([1]);
  });

  it('toPaginated defaults meta for bare arrays', () => {
    const res = toPaginated<number>([1, 2, 3]);
    expect(res.data).toEqual([1, 2, 3]);
    expect(res.meta.total).toBe(3);
    expect(res.meta.current_page).toBe(1);
  });
});
