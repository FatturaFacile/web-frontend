import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { PlmChangeOrderRequest } from '../models';
import { PlmApiService } from './plm-api.service';

describe('PlmApiService', () => {
  let service: PlmApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [PlmApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(PlmApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('lists change orders with the filters as query parameters, awaiting_me as 1', () => {
    service.getChangeOrders({ status: 'in_review', awaiting_me: true, search: undefined, per_page: 100 }).subscribe();

    const request = httpMock.expectOne((r) => r.url.endsWith('/plm/change-orders') && r.params.get('status') === 'in_review' && r.params.get('awaiting_me') === '1' && !r.params.has('search'));
    expect(request.request.method).toBe('GET');
    request.flush({ data: [] });
  });

  it('creates a change order and moves it through submit, decide, implement and cancel', () => {
    const payload: PlmChangeOrderRequest = { code: 'ECO-1', title: 'T', reason: 'R', approvers: ['u-1'], affected_items: [{ mfg_item_id: 'it-1', to_revision: 'B' }], affected_boms: [{ bom_id: 'bm-1' }] };
    service.createChangeOrder(payload).subscribe();
    const create = httpMock.expectOne((r) => r.url.endsWith('/plm/change-orders') && r.method === 'POST');
    expect(create.request.body).toEqual(payload);
    create.flush({ data: {} });

    service.submitChangeOrder('co-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/change-orders/co-1/submit') && r.method === 'POST').flush({ data: {} });

    service.decideChangeOrder('co-1', { decision: 'reject', comment: 'No' }).subscribe();
    const decide = httpMock.expectOne((r) => r.url.endsWith('/change-orders/co-1/decide'));
    expect(decide.request.body).toEqual({ decision: 'reject', comment: 'No' });
    decide.flush({ data: {} });

    service.implementChangeOrder('co-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/change-orders/co-1/implement') && r.method === 'POST').flush({ data: {} });

    service.cancelChangeOrder('co-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/change-orders/co-1/cancel') && r.method === 'POST').flush({ data: {} });
  });

  it('manages revisions through the release and obsolete actions', () => {
    service.getRevisions({ mfg_item_id: 'it-1', status: 'released' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/revisions') && r.params.get('mfg_item_id') === 'it-1' && r.params.get('status') === 'released').flush({ data: [] });

    service.createRevision({ mfg_item_id: 'it-1', revision: 'A' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/revisions') && r.method === 'POST').flush({ data: {} });

    service.releaseRevision('rv-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/revisions/rv-1/release') && r.method === 'POST').flush({ data: {} });

    service.obsoleteRevision('rv-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/revisions/rv-1/obsolete') && r.method === 'POST').flush({ data: {} });

    service.deleteRevision('rv-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/revisions/rv-1') && r.method === 'DELETE').flush(null);
  });

  it('turns the manufacturing items and bills into select options', () => {
    let items: unknown;
    let boms: unknown;
    service.getItemOptions().subscribe((options) => (items = options));
    httpMock.expectOne((r) => r.url.endsWith('/manufacturing/items') && r.params.get('per_page') === '100').flush({ data: [{ id: 'it-1', item_code: 'BRG-1', name: 'Bearing' }] });
    service.getBomOptions().subscribe((options) => (boms = options));
    httpMock.expectOne((r) => r.url.endsWith('/manufacturing/boms')).flush({ data: [{ id: 'bm-1', bom_number: 'BOM-1', name: 'Pump', revision: 'A' }] });

    expect(items).toEqual([{ id: 'it-1', label: 'BRG-1 - Bearing' }]);
    expect(boms).toEqual([{ id: 'bm-1', label: 'BOM-1 (A) - Pump' }]);
  });

  it('reads a single item revision', () => {
    service.getRevision('rev-1').subscribe();
    const req = httpMock.expectOne((r) => r.url.endsWith('/plm/revisions/rev-1') && r.method === 'GET');
    req.flush({ data: { id: 'rev-1' } });
  });

  it('calls Mod 168 endpoints for dictionary, department sign-off, cutover, CAD import, where-used, bom-diff, compliance and viewer manifest', () => {
    service.getDictionary('it-CH').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/dictionary') && r.params.get('locale') === 'it-CH').flush({ data: {} });

    service.recordDepartmentSignoff('co-1', { department: 'Quality', decision: 'approve' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/change-orders/co-1/department-signoff') && r.method === 'POST').flush({ data: {} });

    service.executeCutover('co-1', { force_immediate_safety_cutover: true }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/change-orders/co-1/execute-cutover') && r.method === 'POST').flush({ data: {} });

    service.importCadBom({ cad_source_system: 'SolidWorks', product_code: 'FG-1', raw_payload: '<bom/>' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/cad-imports') && r.method === 'POST').flush({ data: {} });

    service.commitCadImport('cad-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/cad-imports/cad-1/commit') && r.method === 'POST').flush({ data: {} });

    service.getWhereUsedImpact('it-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/where-used/it-1') && r.method === 'GET').flush({ data: {} });

    service.getBomDiffAndCostRollup({ from_bom_id: 'b-1', to_bom_id: 'b-2' }).subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/bom-diff') && r.params.get('from_bom_id') === 'b-1').flush({ data: {} });

    service.getRevisionCompliance('rv-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/revisions/rv-1/compliance') && r.method === 'GET').flush({ data: {} });

    service.getViewerManifest('rv-1').subscribe();
    httpMock.expectOne((r) => r.url.endsWith('/plm/revisions/rv-1/viewer-manifest') && r.method === 'GET').flush({ data: {} });
  });
});
