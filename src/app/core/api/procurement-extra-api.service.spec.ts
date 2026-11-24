import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ProcurementExtraApiService } from './procurement-extra-api.service';

describe('ProcurementExtraApiService', () => {
  let service: ProcurementExtraApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ProcurementExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ProcurementExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['createSupplier', 'POST', '/procurement/suppliers', () => service.createSupplier({})],
    ['getSupplier', 'GET', '/procurement/suppliers/suppli-1', () => service.getSupplier('suppli-1')],
    ['updateSupplier', 'PUT', '/procurement/suppliers/suppli-1', () => service.updateSupplier('suppli-1', {})],
    ['deleteSupplier', 'DELETE', '/procurement/suppliers/suppli-1', () => service.deleteSupplier('suppli-1')],
    ['listEvaluations', 'GET', '/procurement/evaluations', () => service.listEvaluations()],
    ['createSupplierEvaluation', 'POST', '/procurement/suppliers/suppli-1/evaluations', () => service.createSupplierEvaluation('suppli-1', {})],
    ['getSupplierScorecard', 'GET', '/procurement/suppliers/suppli-1/scorecard', () => service.getSupplierScorecard('suppli-1')],
    ['listContracts', 'GET', '/procurement/contracts', () => service.listContracts()],
    ['createContract', 'POST', '/procurement/contracts', () => service.createContract({})],
    ['getContract', 'GET', '/procurement/contracts/contra-1', () => service.getContract('contra-1')],
    ['updateContract', 'PUT', '/procurement/contracts/contra-1', () => service.updateContract('contra-1', {})],
    ['deleteContract', 'DELETE', '/procurement/contracts/contra-1', () => service.deleteContract('contra-1')],
    ['getRequisition', 'GET', '/procurement/requisitions/requis-1', () => service.getRequisition('requis-1')],
    ['updateRequisition', 'PUT', '/procurement/requisitions/requis-1', () => service.updateRequisition('requis-1', {})],
    ['deleteRequisition', 'DELETE', '/procurement/requisitions/requis-1', () => service.deleteRequisition('requis-1')],
    ['cancelRequisition', 'POST', '/procurement/requisitions/requis-1/cancel', () => service.cancelRequisition('requis-1', {})],
    ['updatePurchaseOrder', 'PUT', '/procurement/purchase-orders/purcha-1', () => service.updatePurchaseOrder('purcha-1', {})],
    ['deletePurchaseOrder', 'DELETE', '/procurement/purchase-orders/purcha-1', () => service.deletePurchaseOrder('purcha-1')],
    ['listReturns', 'GET', '/procurement/returns', () => service.listReturns()],
    ['createPurchaseOrderReturn', 'POST', '/procurement/purchase-orders/purcha-1/returns', () => service.createPurchaseOrderReturn('purcha-1', {})],
    ['getReturn', 'GET', '/procurement/returns/return-1', () => service.getReturn('return-1')],
    ['createPriceCheck', 'POST', '/procurement/price-checks', () => service.createPriceCheck({})],
    ['getSettings', 'GET', '/procurement/settings', () => service.getSettings()],
    ['saveSettings', 'PUT', '/procurement/settings', () => service.saveSettings({})],
    ['listApprovalMatrices', 'GET', '/procurement/approval-matrices', () => service.listApprovalMatrices()],
    ['createApprovalMatrice', 'POST', '/procurement/approval-matrices', () => service.createApprovalMatrice({})],
    ['deleteApprovalMatrice', 'DELETE', '/procurement/approval-matrices/approv-1', () => service.deleteApprovalMatrice('approv-1')],
    ['listCatalogs', 'GET', '/procurement/catalogs', () => service.listCatalogs()],
    ['createCatalog', 'POST', '/procurement/catalogs', () => service.createCatalog({})],
    ['getCatalog', 'GET', '/procurement/catalogs/catalo-1', () => service.getCatalog('catalo-1')],
    ['updateCatalog', 'PUT', '/procurement/catalogs/catalo-1', () => service.updateCatalog('catalo-1', {})],
    ['createCatalogPrice', 'POST', '/procurement/catalogs/catalo-1/prices', () => service.createCatalogPrice('catalo-1', {})],
    ['getCatalogPrice', 'GET', '/procurement/catalogs/catalo-1/price', () => service.getCatalogPrice('catalo-1')],
    ['listOffers', 'GET', '/procurement/offers', () => service.listOffers()],
    ['updateSupplierQualification', 'PUT', '/procurement/suppliers/suppli-1/qualification', () => service.updateSupplierQualification('suppli-1', {})],
    ['listSupplierDocuments', 'GET', '/procurement/suppliers/suppli-1/documents', () => service.listSupplierDocuments('suppli-1')],
    ['createSupplierDocument', 'POST', '/procurement/suppliers/suppli-1/documents', () => service.createSupplierDocument('suppli-1', {})],
    ['getSupplierDocumentExpiring', 'GET', '/procurement/supplier-documents/expiring', () => service.getSupplierDocumentExpiring()],
    ['deleteSupplierDocument', 'DELETE', '/procurement/supplier-documents/suppli-1', () => service.deleteSupplierDocument('suppli-1')],
    ['expireSupplierQualification', 'POST', '/procurement/supplier-qualifications/expire', () => service.expireSupplierQualification({})],
    ['getSupplierPerformance', 'GET', '/procurement/suppliers/suppli-1/performance', () => service.getSupplierPerformance('suppli-1')],
    ['computeSupplierEvaluation', 'POST', '/procurement/suppliers/suppli-1/evaluations/compute', () => service.computeSupplierEvaluation('suppli-1', {})],
    ['listRfqs', 'GET', '/procurement/rfqs', () => service.listRfqs()],
    ['createRfq', 'POST', '/procurement/rfqs', () => service.createRfq({})],
    ['getRfq', 'GET', '/procurement/rfqs/rfqId-1', () => service.getRfq('rfqId-1')],
    ['issueRfq', 'POST', '/procurement/rfqs/rfqId-1/issue', () => service.issueRfq('rfqId-1', {})],
    ['createRfqQuote', 'POST', '/procurement/rfqs/rfqId-1/quotes', () => service.createRfqQuote('rfqId-1', {})],
    ['getRfqComparison', 'GET', '/procurement/rfqs/rfqId-1/comparison', () => service.getRfqComparison('rfqId-1')],
    ['awardRfq', 'POST', '/procurement/rfqs/rfqId-1/award', () => service.awardRfq('rfqId-1', {})],
    ['cancelRfq', 'POST', '/procurement/rfqs/rfqId-1/cancel', () => service.cancelRfq('rfqId-1', {})],
    ['listContractLines', 'GET', '/procurement/contracts/contra-1/lines', () => service.listContractLines('contra-1')],
    ['createContractLine', 'POST', '/procurement/contracts/contra-1/lines', () => service.createContractLine('contra-1', {})],
    ['createContractCallOff', 'POST', '/procurement/contracts/contra-1/call-offs', () => service.createContractCallOff('contra-1', {})],
    ['createReturnCreditNote', 'POST', '/procurement/returns/return-1/credit-note', () => service.createReturnCreditNote('return-1', {})],
    ['listLandedCosts', 'GET', '/procurement/landed-costs', () => service.listLandedCosts()],
    ['createLandedCost', 'POST', '/procurement/landed-costs', () => service.createLandedCost({})],
    ['getLandedCost', 'GET', '/procurement/landed-costs/landed-1', () => service.getLandedCost('landed-1')],
    ['postLandedCost', 'POST', '/procurement/landed-costs/landed-1/post', () => service.postLandedCost('landed-1', {})],
    ['cancelLandedCost', 'POST', '/procurement/landed-costs/landed-1/cancel', () => service.cancelLandedCost('landed-1', {})],
    ['getAnalyticsSpend', 'GET', '/procurement/analytics/spend', () => service.getAnalyticsSpend()],
    ['listAnalyticsOpenOrders', 'GET', '/procurement/analytics/open-orders', () => service.listAnalyticsOpenOrders()],
    ['getAnalyticsPriceVariance', 'GET', '/procurement/analytics/price-variance', () => service.getAnalyticsPriceVariance()],
    ['listPurchaseSuggestions', 'GET', '/procurement/purchase-suggestions', () => service.listPurchaseSuggestions()],
    ['generatePurchaseSuggestion', 'POST', '/procurement/purchase-suggestions/generate', () => service.generatePurchaseSuggestion({})],
    ['convertPurchaseSuggestion', 'POST', '/procurement/purchase-suggestions/convert', () => service.convertPurchaseSuggestion({})],
    ['dismissPurchaseSuggestion', 'POST', '/procurement/purchase-suggestions/purcha-1/dismiss', () => service.dismissPurchaseSuggestion('purcha-1', {})],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.getSupplier('suppli-1', { page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/procurement/suppliers/suppli-1'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
