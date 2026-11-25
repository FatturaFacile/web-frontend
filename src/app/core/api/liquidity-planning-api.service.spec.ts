import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { LiquidityPlanningApiService } from './liquidity-planning-api.service';

describe('LiquidityPlanningApiService', () => {
  let service: LiquidityPlanningApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/liquidity-planning`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [LiquidityPlanningApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LiquidityPlanningApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('asks the overview with the what-if levers as bracketed query parameters', () => {
    service
      .getOverview({ levers: { collection_delay_days: 20, outflow_change_percent: 5 } })
      .subscribe();

    const req = httpTesting.expectOne((r) => r.url === `${base}/overview`);
    expect(req.request.method).toBe('GET');
    expect(req.request.params.get('levers[collection_delay_days]')).toBe('20');
    expect(req.request.params.get('levers[outflow_change_percent]')).toBe('5');
    req.flush({ data: {} });
  });

  it('sends a saved scenario id and drops empty values', () => {
    service.getOverview({ scenario_id: 's-1', as_of: '' }).subscribe();

    const req = httpTesting.expectOne((r) => r.url === `${base}/overview`);
    expect(req.request.params.get('scenario_id')).toBe('s-1');
    expect(req.request.params.has('as_of')).toBe(false);
    req.flush({ data: {} });
  });

  it('downloads the report as PDF and the data as a spreadsheet', () => {
    service.exportReport('pdf', { scenario_id: 's-1' }).subscribe();
    const pdf = httpTesting.expectOne((r) => r.url === `${base}/report/pdf`);
    expect(pdf.request.responseType).toBe('blob');
    pdf.flush(new Blob(['x']));

    service.exportReport('xlsx').subscribe();
    const xlsx = httpTesting.expectOne((r) => r.url === `${base}/export/xlsx`);
    expect(xlsx.request.responseType).toBe('blob');
    xlsx.flush(new Blob(['x']));
  });

  it('manages the saved scenarios', () => {
    service.listScenarios().subscribe();
    httpTesting.expectOne(`${base}/scenarios`).flush({ data: [] });

    service
      .createScenario({ name: 'Late payers', levers: { collection_delay_days: 20 } })
      .subscribe();
    const create = httpTesting.expectOne(`${base}/scenarios`);
    expect(create.request.method).toBe('POST');
    expect(create.request.body).toEqual({
      name: 'Late payers',
      levers: { collection_delay_days: 20 },
    });
    create.flush({ data: {} });

    service.updateScenario('s-1', { name: 'X', levers: {} }).subscribe();
    expect(httpTesting.expectOne(`${base}/scenarios/s-1`).request.method).toBe('PUT');

    service.deleteScenario('s-1').subscribe();
    expect(httpTesting.expectOne(`${base}/scenarios/s-1`).request.method).toBe('DELETE');

    service.getPresets().subscribe();
    httpTesting.expectOne(`${base}/scenarios/presets`).flush({ data: [] });
  });

  it('manages the manual items and the settings', () => {
    service.listManualItems().subscribe();
    httpTesting.expectOne(`${base}/manual-items`).flush({ data: [] });

    service.deleteManualItem('m-1').subscribe();
    expect(httpTesting.expectOne(`${base}/manual-items/m-1`).request.method).toBe('DELETE');

    service.getSettings().subscribe();
    expect(httpTesting.expectOne(`${base}/settings`).request.method).toBe('GET');
  });

  it('filters the alerts and runs the actions', () => {
    service.listAlerts('open').subscribe();
    const list = httpTesting.expectOne((r) => r.url === `${base}/alerts`);
    expect(list.request.params.get('status')).toBe('open');
    list.flush({ data: [] });

    service.evaluateAlerts().subscribe();
    expect(httpTesting.expectOne(`${base}/alerts/evaluate`).request.method).toBe('POST');

    service.acknowledgeAlert('a-1').subscribe();
    expect(httpTesting.expectOne(`${base}/alerts/a-1/acknowledge`).request.method).toBe('POST');

    service.resolveAlert('a-1').subscribe();
    expect(httpTesting.expectOne(`${base}/alerts/a-1/resolve`).request.method).toBe('POST');
  });
});
