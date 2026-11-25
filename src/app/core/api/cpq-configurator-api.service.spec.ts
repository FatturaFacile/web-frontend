import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { CpqConfiguratorApiService } from './cpq-configurator-api.service';

describe('CpqConfiguratorApiService', () => {
  let service: CpqConfiguratorApiService;
  let httpTesting: HttpTestingController;
  const baseUrl = `${environment.apiBaseUrl}/cpq-configurator`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(CpqConfiguratorApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpTesting.verify());

  it('lists the models with an optional status', () => {
    service.getModels('published').subscribe();
    const request = httpTesting.expectOne(`${baseUrl}/models?status=published`);
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });

    service.getModels().subscribe();
    httpTesting.expectOne(`${baseUrl}/models`).flush({ data: [] });
  });

  it('creates, updates, publishes, archives and deletes a model', () => {
    service.createModel({ code: 'M1' }).subscribe();
    const create = httpTesting.expectOne(`${baseUrl}/models`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({ code: 'M1' });
    create.flush({ data: {} });

    service.updateModel('m1', { base_cost: 10 }).subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/models/m1`).request.method).toBe('PUT');

    service.publishModel('m1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/models/m1/publish`).request.method).toBe('POST');

    service.archiveModel('m1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/models/m1/archive`).request.method).toBe('POST');

    service.deleteModel('m1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/models/m1`).request.method).toBe('DELETE');

    httpTesting.match(() => true).forEach((request) => request.flush({ data: {} }));
  });

  it('reads the diagnostics and checks an expression of a model', () => {
    service.getDiagnostics('m1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/models/m1/diagnostics`).request.method).toBe('GET');

    service.checkExpression('m1', 'flow_rate > 3').subscribe();
    const check = httpTesting.expectOne(`${baseUrl}/models/m1/expression-check`);
    expect(check.request.body).toEqual({ expression: 'flow_rate > 3' });

    httpTesting.match(() => true).forEach((request) => request.flush({ data: {} }));
  });

  it('writes characteristics and options', () => {
    service.createCharacteristic('m1', { code: 'material' }).subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/models/m1/characteristics`).request.method).toBe(
      'POST',
    );

    service.updateCharacteristic('c1', { unit: 'm' }).subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/characteristics/c1`).request.method).toBe('PUT');

    service.deleteCharacteristic('c1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/characteristics/c1`).request.method).toBe('DELETE');

    service.createOption('c1', { code: 'A' }).subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/characteristics/c1/options`).request.method).toBe(
      'POST',
    );

    service.updateOption('o1', { is_default: true }).subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/options/o1`).request.method).toBe('PUT');

    service.deleteOption('o1').subscribe();
    expect(httpTesting.expectOne(`${baseUrl}/options/o1`).request.method).toBe('DELETE');

    httpTesting.match(() => true).forEach((request) => request.flush({ data: {} }));
  });

  it('reaches rules, super-BOM and routing mappings and pricing formulas under their own paths', () => {
    for (const kind of [
      'rules',
      'superbom-mappings',
      'routing-mappings',
      'pricing-formulas',
    ] as const) {
      service.listChildren(kind, 'm1').subscribe();
      expect(httpTesting.expectOne(`${baseUrl}/models/m1/${kind}`).request.method).toBe('GET');

      service.createChild(kind, 'm1', { code: 'x' }).subscribe();
      expect(httpTesting.expectOne(`${baseUrl}/models/m1/${kind}`).request.method).toBe('POST');

      service.updateChild(kind, 'r1', { code: 'x' }).subscribe();
      expect(httpTesting.expectOne(`${baseUrl}/${kind}/r1`).request.method).toBe('PUT');

      service.deleteChild(kind, 'r1').subscribe();
      expect(httpTesting.expectOne(`${baseUrl}/${kind}/r1`).request.method).toBe('DELETE');
    }

    httpTesting.match(() => true).forEach((request) => request.flush({ data: [] }));
  });

  it('evaluates, confirms and previews the proposal of a selection', () => {
    const payload = { selections: { material: 'AISI_316' }, quantity: 2, discount_percent: 5 };

    service.evaluate('m1', payload).subscribe();
    const evaluate = httpTesting.expectOne(`${baseUrl}/models/m1/evaluate`);
    expect(evaluate.request.method).toBe('POST');
    expect(evaluate.request.body).toEqual(payload);
    evaluate.flush({ data: {} });

    service
      .confirm('m1', payload)
      .subscribe((response) => expect(response.meta?.reused).toBe(true));
    httpTesting
      .expectOne(`${baseUrl}/models/m1/confirm`)
      .flush({ data: {}, meta: { reused: true } });

    service.previewProposal('m1', { ...payload, include_breakdown: true }).subscribe();
    const proposal = httpTesting.expectOne(`${baseUrl}/models/m1/proposal`);
    expect(proposal.request.body.include_breakdown).toBe(true);
    proposal.flush({ data: {} });
  });

  it('lists and shows the instances and builds the proposal of an instance', () => {
    service.getInstances({ model_id: 'm1', search: 'Q40' }).subscribe();
    const list = httpTesting.expectOne(`${baseUrl}/instances?model_id=m1&search=Q40`);
    expect(list.request.method).toBe('GET');
    list.flush({ data: [] });

    service.getInstance('i1').subscribe();
    httpTesting.expectOne(`${baseUrl}/instances/i1`).flush({ data: {} });

    service
      .getInstanceProposal('i1', {
        quantity: 3,
        discount_percent: 5,
        include_breakdown: true,
        customer_reference: 'ACME',
      })
      .subscribe();
    const proposal = httpTesting.expectOne(
      (request) => request.url === `${baseUrl}/instances/i1/proposal`,
    );
    expect(proposal.request.params.get('quantity')).toBe('3');
    expect(proposal.request.params.get('include_breakdown')).toBe('1');
    expect(proposal.request.params.get('customer_reference')).toBe('ACME');
    proposal.flush({ data: {} });
  });

  it('downloads the PDF of the proposal as a blob', () => {
    service
      .downloadInstanceProposalPdf('i1', { quantity: 2 })
      .subscribe((blob) => expect(blob.size).toBe(4));

    const request = httpTesting.expectOne(
      (candidate) => candidate.url === `${baseUrl}/instances/i1/proposal/pdf`,
    );
    expect(request.request.responseType).toBe('blob');
    expect(request.request.params.get('quantity')).toBe('2');
    request.flush(new Blob(['%PDF']));
  });
});
