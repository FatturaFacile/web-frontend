import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { EsgActivityRecordRequest, EsgEmissionFactor } from '../models';
import { SustainabilityApiService } from './sustainability-api.service';

describe('SustainabilityApiService', () => {
  let service: SustainabilityApiService;
  let httpMock: HttpTestingController;

  const factor: EsgEmissionFactor = {
    id: 'fac-1',
    code: 'EX-ELEC-IT',
    version: 1,
    name: 'Grid electricity Italy',
    activity_type: 'electricity_grid',
    unit: 'kWh',
    scope: 2,
    category: 'purchased_electricity',
    kg_co2e_per_unit: '0.25000000',
    region: 'IT',
    source: 'EXAMPLE value',
    source_year: 2023,
    is_example: true,
    is_active: true,
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [SustainabilityApiService, provideHttpClient(), provideHttpClientTesting()],
    });

    service = TestBed.inject(SustainabilityApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists the factors with the filters as query parameters and booleans as 0/1', () => {
    service.getFactors({ activity_type: 'electricity_grid', region: 'IT', latest_only: true, is_active: false }).subscribe((response) => {
      expect(response.data).toEqual([factor]);
    });

    const request = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/sustainability/factors') &&
        r.params.get('activity_type') === 'electricity_grid' &&
        r.params.get('region') === 'IT' &&
        r.params.get('latest_only') === '1' &&
        r.params.get('is_active') === '0',
    );
    expect(request.request.method).toBe('GET');
    request.flush({ data: [factor] });
  });

  it('skips empty filters', () => {
    service.getActivityRecords({ from: '', scope: 2 }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/sustainability/activity-records'));
    expect(request.request.params.has('from')).toBe(false);
    expect(request.request.params.get('scope')).toBe('2');
    request.flush({ data: [] });
  });

  it('records activity data with the exact decimal strings', () => {
    const payload: EsgActivityRecordRequest = { activity_type: 'electricity_grid', activity_date: '2027-03-10', quantity: '1234.5', unit: 'kWh', region: 'IT' };

    service.createActivityRecord(payload).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/sustainability/activity-records'));
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual(payload);
    request.flush({ data: {} });
  });

  it('creates a new factor version and deletes a factor', () => {
    service.newFactorVersion('fac-1', { kg_co2e_per_unit: '0.2', source: 'Updated', source_year: 2025 }).subscribe();
    const version = httpMock.expectOne((r) => r.url.endsWith('/sustainability/factors/fac-1/new-version'));
    expect(version.request.method).toBe('POST');
    version.flush({ data: { ...factor, version: 2 } });

    service.deleteFactor('fac-1').subscribe((response) => expect(response).toBeNull());
    const removal = httpMock.expectOne((r) => r.url.endsWith('/sustainability/factors/fac-1'));
    expect(removal.request.method).toBe('DELETE');
    removal.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('closes and reopens periods and reads the inventory of a period', () => {
    service.closePeriod('per-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/sustainability/periods/per-1/close')).flush({ data: {} });

    service.reopenPeriod('per-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/sustainability/periods/per-1/reopen')).flush({ data: {} });

    service.getInventory('per-1').subscribe();
    const inventory = httpMock.expectOne((r) => r.url.endsWith('/sustainability/inventory'));
    expect(inventory.request.params.get('reporting_period_id')).toBe('per-1');
    inventory.flush({ data: null });
  });

  it('drives the target lifecycle and the KPI and materiality endpoints', () => {
    service.activateTarget('tgt-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/sustainability/targets/tgt-1/activate')).flush({ data: {} });

    service.evaluateTarget('tgt-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/sustainability/targets/tgt-1/evaluate')).flush({ data: {} });

    service.recordKpiValue({ kpi_definition_id: 'kpi-1', reporting_period_id: 'per-1', value: '12.5' }).subscribe();
    const value = httpMock.expectOne((r) => r.url.endsWith('/sustainability/kpi-values'));
    expect(value.request.method).toBe('PUT');
    value.flush({ data: {} });

    service.approveMaterialityAssessment('dma-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/sustainability/materiality-assessments/dma-1/approve')).flush({ data: {} });

    service.installDefaultKpis().subscribe((response) => expect(response.created).toBe(14));
    httpMock.expectOne((r) => r.url.endsWith('/sustainability/kpis/install-defaults')).flush({ created: 14 });
  });
});
