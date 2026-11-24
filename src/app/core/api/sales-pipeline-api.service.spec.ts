import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { SalesPipelineApiService } from './sales-pipeline-api.service';

const BASE = 'https://api.test/api/v1';
const CRM = `${BASE}/crm`;

describe('SalesPipelineApiService', () => {
  let service: SalesPipelineApiService;
  let http: HttpTestingController;
  const originalBase = environment.apiBaseUrl;

  beforeEach(() => {
    environment.apiBaseUrl = BASE;
    TestBed.configureTestingModule({
      providers: [SalesPipelineApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(SalesPipelineApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalBase;
  });

  it('lists the pipelines unwrapping the data envelope', () => {
    let names: string[] = [];
    service
      .listPipelines()
      .subscribe((pipelines) => (names = pipelines.map((pipeline) => pipeline.name)));

    const req = http.expectOne(`${CRM}/pipelines`);
    expect(req.request.method).toBe('GET');
    req.flush({
      data: [
        { id: 'p1', name: 'Core' },
        { id: 'p2', name: 'Italy' },
      ],
    });

    expect(names).toEqual(['Core', 'Italy']);
  });

  it('loads the default pipeline board with the filters as query params and without empty ones', () => {
    service
      .getBoard(null, {
        owner_user_id: 'u1',
        forecast_category: 'commit',
        search: '',
        from: null,
        per_column: 50,
      })
      .subscribe();

    const req = http.expectOne((r) => r.url === `${CRM}/pipelines/default/board`);
    expect(req.request.params.get('owner_user_id')).toBe('u1');
    expect(req.request.params.get('forecast_category')).toBe('commit');
    expect(req.request.params.get('per_column')).toBe('50');
    expect(req.request.params.has('search')).toBe(false);
    expect(req.request.params.has('from')).toBe(false);
    req.flush({
      pipeline: {},
      columns: [],
      totals: { count: 0, amount: '0.00', weighted_amount: '0.00' },
    });
  });

  it('loads the board of a specific pipeline', () => {
    service.getBoard('p9').subscribe();

    http.expectOne((r) => r.url === `${CRM}/pipelines/p9/board`).flush({});
  });

  it('moves a deal with the stage, position and the loss questionnaire', () => {
    let totals: unknown;
    service
      .moveDeal('d1', {
        stage_id: 's4',
        position: 2,
        loss_reason_code: 'price',
        competitor: 'Rival SA',
        loss_notes: 'cheaper',
      })
      .subscribe((result) => (totals = result.stage_totals));

    const req = http.expectOne(`${CRM}/opportunities/d1/move`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({
      stage_id: 's4',
      position: 2,
      loss_reason_code: 'price',
      competitor: 'Rival SA',
      loss_notes: 'cheaper',
    });
    req.flush({
      opportunity: { id: 'd1' },
      stage_totals: { s4: { count: 1, amount: '1.00', weighted_amount: '0.00' } },
    });

    expect(totals).toEqual({ s4: { count: 1, amount: '1.00', weighted_amount: '0.00' } });
  });

  it('updates the quick note with the append flag', () => {
    service.updateNotes('d1', 'Called', true).subscribe();

    const req = http.expectOne(`${CRM}/opportunities/d1/notes`);
    expect(req.request.method).toBe('PATCH');
    expect(req.request.body).toEqual({ notes: 'Called', append: true });
    req.flush({ id: 'd1' });
  });

  it('manages pipelines, stages and loss reasons', () => {
    service
      .createPipeline({ code: 'retail', name: 'Retail', install_standard_stages: true })
      .subscribe();
    expect(http.expectOne(`${CRM}/pipelines`).request.method).toBe('POST');

    service.updatePipeline('p1', { is_default: true }).subscribe();
    expect(http.expectOne(`${CRM}/pipelines/p1`).request.method).toBe('PUT');

    service.deletePipeline('p1').subscribe();
    expect(http.expectOne(`${CRM}/pipelines/p1`).request.method).toBe('DELETE');

    service
      .createStage({ code: 'demo', name: 'Demo', default_probability: 60, pipeline_id: 'p1' })
      .subscribe();
    expect(http.expectOne(`${CRM}/pipeline-stages`).request.body).toMatchObject({
      pipeline_id: 'p1',
      default_probability: 60,
    });

    service
      .updateStage('s1', { default_probability: 40, reprice_open_opportunities: true })
      .subscribe();
    expect(http.expectOne(`${CRM}/pipeline-stages/s1`).request.body).toEqual({
      default_probability: 40,
      reprice_open_opportunities: true,
    });

    service.deleteStage('s1').subscribe();
    expect(http.expectOne(`${CRM}/pipeline-stages/s1`).request.method).toBe('DELETE');

    service.createLossReason({ code: 'x', name: 'X' }).subscribe();
    expect(http.expectOne(`${CRM}/loss-reasons`).request.method).toBe('POST');

    service.updateLossReason('r1', { is_active: false }).subscribe();
    expect(http.expectOne(`${CRM}/loss-reasons/r1`).request.method).toBe('PUT');

    service.deleteLossReason('r1').subscribe();
    expect(http.expectOne(`${CRM}/loss-reasons/r1`).request.method).toBe('DELETE');
  });

  it('unwraps the installed catalog counters', () => {
    let created: unknown;
    service.installCatalog().subscribe((counters) => (created = counters));

    http
      .expectOne(`${CRM}/pipelines/catalog/install`)
      .flush({ created: { pipelines: 1, stages: 6, loss_reasons: 6 } });

    expect(created).toEqual({ pipelines: 1, stages: 6, loss_reasons: 6 });
  });

  it('reads the forecast dashboard, the loss analysis and the stage history', () => {
    service
      .getForecastDashboard({ granularity: 'quarter', year: 2027, quarter: 1, pipeline_id: null })
      .subscribe();
    const forecast = http.expectOne((r) => r.url === `${CRM}/forecasts/dashboard`);
    expect(forecast.request.params.get('granularity')).toBe('quarter');
    expect(forecast.request.params.get('quarter')).toBe('1');
    expect(forecast.request.params.has('pipeline_id')).toBe(false);
    forecast.flush({});

    service.getLossAnalysis({ from: '2027-01-01' }).subscribe();
    const loss = http.expectOne((r) => r.url === `${CRM}/reports/loss-analysis`);
    expect(loss.request.params.get('from')).toBe('2027-01-01');
    loss.flush({});

    let rows = 0;
    service.getHistory('d1').subscribe((history) => (rows = history.length));
    http.expectOne(`${CRM}/opportunities/d1/history`).flush({ data: [{ id: 'h1' }, { id: 'h2' }] });
    expect(rows).toBe(2);
  });

  it('lists the loss reasons from the data envelope', () => {
    let codes: string[] = [];
    service
      .listLossReasons()
      .subscribe((reasons) => (codes = reasons.map((reason) => reason.code)));

    http.expectOne(`${CRM}/loss-reasons`).flush({ data: [{ id: 'r1', code: 'price' }] });

    expect(codes).toEqual(['price']);
  });
});
