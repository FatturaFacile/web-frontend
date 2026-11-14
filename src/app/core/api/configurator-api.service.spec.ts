import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { ConfiguratorApiService } from './configurator-api.service';

describe('ConfiguratorApiService', () => {
  let service: ConfiguratorApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/configurator`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(ConfiguratorApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists the models with an optional status filter', () => {
    service.getModels('published').subscribe();

    const request = httpTesting.expectOne(`${baseUrl}/models?status=published`);
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('publishes, archives and checks the rules of a model', () => {
    service.publishModel('m1').subscribe();
    httpTesting.expectOne(`${baseUrl}/models/m1/publish`).flush({ data: {} });

    service.archiveModel('m1').subscribe();
    httpTesting.expectOne(`${baseUrl}/models/m1/archive`).flush({ data: {} });

    service.checkRules('m1').subscribe();
    const check = httpTesting.expectOne(`${baseUrl}/models/m1/rule-check`);
    expect(check.request.method).toBe('GET');
    check.flush({ data: { valid: true, problems: [] } });
  });

  it('evaluates a selection without saving it', () => {
    service
      .evaluate('m1', { selections: [{ group: 'size', options: ['M'] }, { group: 'length', value: 4 }], quantity: 2, apply_defaults: true })
      .subscribe();

    const request = httpTesting.expectOne(`${baseUrl}/models/m1/evaluate`);
    expect(request.request.method).toBe('POST');
    expect(request.request.body.selections).toHaveLength(2);
    expect(request.request.body.apply_defaults).toBe(true);
    request.flush({ data: {} });
  });

  it('writes groups, options and rules under their own paths', () => {
    service.createGroup('m1', { code: 'size', name: 'Size', type: 'single' }).subscribe();
    httpTesting.expectOne(`${baseUrl}/models/m1/groups`).flush({ data: {} });

    service.updateGroup('g1', { name: 'Sizes' }).subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/groups/g1`).request.method).toBe('PUT');

    service.createOption('g1', { code: 'M', name: 'Medium', price_delta: 100 }).subscribe();
    httpTesting.expectOne(`${baseUrl}/groups/g1/options`).flush({ data: {} });

    service.deleteOption('o1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/options/o1`).request.method).toBe('DELETE');

    service.createRule('m1', { name: 'Rule', type: 'requires', conditions: [], target_options: ['M'] }).subscribe();
    httpTesting.expectOne(`${baseUrl}/models/m1/rules`).flush({ data: {} });

    service.deleteRule('r1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/rules/r1`).request.method).toBe('DELETE');
  });

  it('runs the lifecycle of a configuration', () => {
    service.getConfigurations({ status: 'draft', model_id: 'm1' }).subscribe();
    httpTesting.expectOne(`${baseUrl}/configurations?status=draft&model_id=m1`).flush({ data: [] });

    service.createConfiguration({ model_id: 'm1', selections: [] }).subscribe();
    httpTesting.expectOne(`${baseUrl}/configurations`).flush({ data: {} });

    service.validateConfiguration('c1').subscribe();
    httpTesting.expectOne(`${baseUrl}/configurations/c1/validate`).flush({ data: {} });

    service.requestApproval('c1').subscribe();
    httpTesting.expectOne(`${baseUrl}/configurations/c1/request-approval`).flush({ data: {} });

    service.approveConfiguration('c1', 'Strategic customer').subscribe();
    const approve = httpTesting.expectOne(`${baseUrl}/configurations/c1/approve`);
    expect(approve.request.body).toEqual({ decision_notes: 'Strategic customer' });
    approve.flush({ data: {} });

    service.rejectConfiguration('c1', 'Too low').subscribe();
    const reject = httpTesting.expectOne(`${baseUrl}/configurations/c1/reject`);
    expect(reject.request.body).toEqual({ decision_notes: 'Too low' });
    reject.flush({ data: {} });

    service.convertToQuote('c1', { valid_until: '2027-07-31' }).subscribe();
    const convert = httpTesting.expectOne(`${baseUrl}/configurations/c1/convert-to-quote`);
    expect(convert.request.body).toEqual({ valid_until: '2027-07-31' });
    convert.flush({ data: {} });
  });
});
