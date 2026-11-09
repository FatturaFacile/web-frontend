import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { EamOpsApiService } from '@core';

interface Case {
  name: string;
  call: (s: EamOpsApiService) => Observable<unknown>;
  method: string;
  path: string;
  params?: Record<string, string>;
  body?: unknown;
  blob?: boolean;
}

const CASES: Case[] = [
  { name: 'getMaintenancePlans', call: (s) => s.getMaintenancePlans({ page: 2 }), method: 'GET', path: '/maintenance/plans', params: { page: '2' } },
  { name: 'getMaintenancePlan', call: (s) => s.getMaintenancePlan('p1'), method: 'GET', path: '/maintenance/plans/p1' },
  { name: 'getDueMaintenancePlans', call: (s) => s.getDueMaintenancePlans('2026-11-01'), method: 'GET', path: '/maintenance/plans/due', params: { as_of: '2026-11-01' } },
  {
    name: 'createMaintenancePlan',
    call: (s) => s.createMaintenancePlan({ name: 'Oil', trigger_type: 'time', frequency_days: 90 }),
    method: 'POST',
    path: '/maintenance/plans',
    body: { name: 'Oil', trigger_type: 'time', frequency_days: 90 },
  },
  {
    name: 'updateMaintenancePlan',
    call: (s) => s.updateMaintenancePlan('p1', { name: 'Oil', is_active: false }),
    method: 'PUT',
    path: '/maintenance/plans/p1',
    body: { name: 'Oil', is_active: false },
  },
  {
    name: 'openPlanWorkOrder',
    call: (s) => s.openPlanWorkOrder('p1', '2026-12-01'),
    method: 'POST',
    path: '/maintenance/plans/p1/work-orders',
    body: { scheduled_date: '2026-12-01' },
  },
  { name: 'getWorkOrder', call: (s) => s.getWorkOrder('w1'), method: 'GET', path: '/maintenance/work-orders/w1' },
  { name: 'startWorkOrder', call: (s) => s.startWorkOrder('w1', true), method: 'POST', path: '/maintenance/work-orders/w1/start', body: { stops_asset: true } },
  {
    name: 'issueWorkOrderPart',
    call: (s) => s.issueWorkOrderPart('w1', { product_id: 'pr1', quantity: 2 }),
    method: 'POST',
    path: '/maintenance/work-orders/w1/parts',
    body: { product_id: 'pr1', quantity: 2 },
  },
  {
    name: 'completeWorkOrder',
    call: (s) => s.completeWorkOrder('w1', { labor_cost: 50, condition_after_maintenance: 'good' }),
    method: 'POST',
    path: '/maintenance/work-orders/w1/complete',
    body: { labor_cost: 50, condition_after_maintenance: 'good' },
  },
  { name: 'cancelWorkOrder', call: (s) => s.cancelWorkOrder('w1', 'duplicate'), method: 'POST', path: '/maintenance/work-orders/w1/cancel', body: { reason: 'duplicate' } },
  { name: 'getLocations', call: (s) => s.getLocations(), method: 'GET', path: '/locations' },
  { name: 'createLocation', call: (s) => s.createLocation({ code: 'L1', name: 'HQ' }), method: 'POST', path: '/locations', body: { code: 'L1', name: 'HQ' } },
  { name: 'updateLocation', call: (s) => s.updateLocation('l1', { code: 'L1', name: 'HQ', city: 'Milano' }), method: 'PUT', path: '/locations/l1', body: { code: 'L1', name: 'HQ', city: 'Milano' } },
  { name: 'getAssetClasses', call: (s) => s.getAssetClasses(), method: 'GET', path: '/classes' },
  { name: 'createAssetClass', call: (s) => s.createAssetClass({ code: 'C1', name: 'Vehicles', criticality: 'high' }), method: 'POST', path: '/classes', body: { code: 'C1', name: 'Vehicles', criticality: 'high' } },
  { name: 'getCategory', call: (s) => s.getCategory('k1'), method: 'GET', path: '/categories/k1' },
  { name: 'updateCategory', call: (s) => s.updateCategory('k1', { code: 'K1', name: 'Plant' }), method: 'PUT', path: '/categories/k1', body: { code: 'K1', name: 'Plant' } },
  { name: 'getAssetComponents', call: (s) => s.getAssetComponents('a1'), method: 'GET', path: '/assets/a1/components' },
  { name: 'addAssetComponent', call: (s) => s.addAssetComponent('a1', { name: 'Engine' }), method: 'POST', path: '/assets/a1/components', body: { name: 'Engine' } },
  { name: 'retireAssetComponent', call: (s) => s.retireAssetComponent('a1', 'cm1', 'failed'), method: 'POST', path: '/assets/a1/components/cm1/retire', body: { status: 'failed' } },
  { name: 'assignCustodian', call: (s) => s.assignCustodian('a1', { custodian_user_id: 'u1' }), method: 'POST', path: '/assets/a1/custodians', body: { custodian_user_id: 'u1' } },
  {
    name: 'assignAsset',
    call: (s) => s.assignAsset('a1', { assignee_type: 'employee', assignee_name: 'Mario' }),
    method: 'POST',
    path: '/assets/a1/assignments',
    body: { assignee_type: 'employee', assignee_name: 'Mario' },
  },
  {
    name: 'allocateAssetToProject',
    call: (s) => s.allocateAssetToProject('a1', { project_id: 'pj1', hourly_rate: 12 }),
    method: 'POST',
    path: '/assets/a1/project-allocations',
    body: { project_id: 'pj1', hourly_rate: 12 },
  },
  { name: 'getMeterReadings', call: (s) => s.getMeterReadings('a1'), method: 'GET', path: '/assets/a1/meter-readings' },
  {
    name: 'recordMeterReading',
    call: (s) => s.recordMeterReading('a1', { meter_code: 'km', reading_value: 1200 }),
    method: 'POST',
    path: '/assets/a1/meter-readings',
    body: { meter_code: 'km', reading_value: 1200 },
  },
  { name: 'getMaintenanceSummary', call: (s) => s.getMaintenanceSummary('a1'), method: 'GET', path: '/assets/a1/maintenance-summary' },
  { name: 'getAssetTags', call: (s) => s.getAssetTags(['a1', 'a2']), method: 'GET', path: '/assets/tags' },
  {
    name: 'acquireAsset',
    call: (s) => s.acquireAsset({ source_type: 'passive_invoice_line', source_id: 'l1', category_id: 'k1', capitalize: true }),
    method: 'POST',
    path: '/assets/acquire',
    body: { source_type: 'passive_invoice_line', source_id: 'l1', category_id: 'k1', capitalize: true },
  },
  { name: 'transferAsset', call: (s) => s.transferAsset('a1', { to_location_id: 'l2' }), method: 'POST', path: '/assets/a1/transfer', body: { to_location_id: 'l2' } },
  {
    name: 'valuateAsset',
    call: (s) => s.valuateAsset('a1', { valuation_type: 'impairment', fair_value: 900 }),
    method: 'POST',
    path: '/assets/a1/valuate',
    body: { valuation_type: 'impairment', fair_value: 900 },
  },
  {
    name: 'reverseImpairment',
    call: (s) => s.reverseImpairment('a1', { recoverable_amount: 950 }),
    method: 'POST',
    path: '/assets/a1/reverse-impairment',
    body: { recoverable_amount: 950 },
  },
  { name: 'getAssetHistory', call: (s) => s.getAssetHistory('a1'), method: 'GET', path: '/assets/a1/history' },
  {
    name: 'getDepreciationPreview',
    call: (s) => s.getDepreciationPreview('a1', { ledger_type: 'fiscal', periods: 12 }),
    method: 'GET',
    path: '/assets/a1/depreciation-preview',
    params: { ledger_type: 'fiscal', periods: '12' },
  },
  { name: 'getDepreciationRun', call: (s) => s.getDepreciationRun('r1'), method: 'GET', path: '/depreciation/runs/r1' },
  { name: 'getAssetRegister', call: (s) => s.getAssetRegister({ year: 2026, ledger_type: 'statutory' }), method: 'GET', path: '/reports/asset-register', params: { year: '2026', ledger_type: 'statutory', format: 'json' } },
  { name: 'exportAssetRegister', call: (s) => s.exportAssetRegister({ year: 2026 }), method: 'GET', path: '/reports/asset-register', params: { year: '2026', format: 'csv' }, blob: true },
  { name: 'getExpiringAssets', call: (s) => s.getExpiringAssets(true), method: 'GET', path: '/alerts/expiring', params: { expired: 'true' } },
];

describe('EamOpsApiService', () => {
  let service: EamOpsApiService;
  let httpMock: HttpTestingController;
  const base = `${environment.apiBaseUrl}/eam`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [EamOpsApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(EamOpsApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it.each(CASES)('$name sends $method $path', (c) => {
    c.call(service).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}${c.path}`);
    expect(req.request.method).toBe(c.method);
    for (const [key, value] of Object.entries(c.params ?? {})) {
      expect(req.request.params.get(key)).toBe(value);
    }
    if (c.body !== undefined) {
      expect(req.request.body).toEqual(c.body);
    }
    req.flush(c.blob ? new Blob(['x']) : { data: {} });
  });

  it('sends the asset ids as asset_ids[] query parameters', () => {
    service.getAssetTags(['a1', 'a2']).subscribe();
    const req = httpMock.expectOne((r) => r.url === `${base}/assets/tags`);
    expect(req.request.params.getAll('asset_ids[]')).toEqual(['a1', 'a2']);
    req.flush({ data: [] });
  });
});
