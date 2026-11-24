import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { CustomsExtraApiService } from './customs-extra-api.service';

describe('CustomsExtraApiService', () => {
  let service: CustomsExtraApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [CustomsExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(CustomsExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['getSettings', 'GET', '/customs/settings', () => service.getSettings()],
    ['saveSettings', 'PUT', '/customs/settings', () => service.saveSettings({})],
    ['getMasterData', 'GET', '/customs/master-data/type-1', () => service.getMasterData('type-1')],
    ['createMasterData', 'POST', '/customs/master-data/type-1', () => service.createMasterData('type-1', {})],
    ['updateMasterData', 'PUT', '/customs/master-data/type-1/id-2', () => service.updateMasterData('type-1', 'id-2', {})],
    ['deleteMasterData', 'DELETE', '/customs/master-data/type-1/id-2', () => service.deleteMasterData('type-1', 'id-2')],
    ['getTariffHistory', 'GET', '/customs/tariff-history', () => service.getTariffHistory()],
    ['fromDeliveryNoteDeclaration', 'POST', '/customs/declarations/from-delivery-note', () => service.fromDeliveryNoteDeclaration({})],
    ['reuseDeclarationItem', 'POST', '/customs/declarations/declar-1/items/reuse/reuseI-2', () => service.reuseDeclarationItem('declar-1', 'reuseI-2', {})],
    ['getDeclarationMessage', 'GET', '/customs/declarations/declar-1/message', () => service.getDeclarationMessage('declar-1')],
    ['getAssessmentDecisionControlList', 'GET', '/customs/assessment-decisions/control-list', () => service.getAssessmentDecisionControlList()],
    ['getAssessmentDecisionStatistics', 'GET', '/customs/assessment-decisions/statistics', () => service.getAssessmentDecisionStatistics()],
    ['listAssessmentDecisionRetrievalRuns', 'GET', '/customs/assessment-decisions/retrieval-runs', () => service.listAssessmentDecisionRetrievalRuns()],
    ['getAssessmentDecisionXml', 'GET', '/customs/assessment-decisions/assess-1/xml', () => service.getAssessmentDecisionXml('assess-1')],
    ['getAssessmentDecisionIntegrity', 'GET', '/customs/assessment-decisions/assess-1/integrity', () => service.getAssessmentDecisionIntegrity('assess-1')],
    ['postAssessmentDecision', 'POST', '/customs/assessment-decisions/assess-1/post', () => service.postAssessmentDecision('assess-1', {})],
    ['getLedgerReconciliation', 'GET', '/customs/ledger/reconciliation', () => service.getLedgerReconciliation()],
    ['getTariffGrid', 'GET', '/customs/tariff-grids/tariff-1', () => service.getTariffGrid('tariff-1')],
    ['updateTariffGrid', 'PUT', '/customs/tariff-grids/tariff-1', () => service.updateTariffGrid('tariff-1', {})],
    ['createTariffGridRate', 'POST', '/customs/tariff-grids/tariff-1/rates', () => service.createTariffGridRate('tariff-1', {})],
    ['deleteTariffGridRate', 'DELETE', '/customs/tariff-grids/tariff-1/rates/rateId-2', () => service.deleteTariffGridRate('tariff-1', 'rateId-2')],
    ['getServiceDiscounts', 'GET', '/customs/service-discounts', () => service.getServiceDiscounts()],
    ['saveServiceDiscounts', 'PUT', '/customs/service-discounts', () => service.saveServiceDiscounts({})],
    ['getDossierMonthlySummary', 'GET', '/customs/dossiers/monthly-summary', () => service.getDossierMonthlySummary()],
    ['createDossierCharge', 'POST', '/customs/dossiers/dossie-1/charges', () => service.createDossierCharge('dossie-1', {})],
    ['importAssessmentsDossier', 'POST', '/customs/dossiers/dossie-1/import-assessments', () => service.importAssessmentsDossier('dossie-1', {})],
    ['getDossierAssessmentCheck', 'GET', '/customs/dossiers/dossie-1/assessment-check', () => service.getDossierAssessmentCheck('dossie-1')],
    ['createDossierDocument', 'POST', '/customs/dossiers/dossie-1/documents', () => service.createDossierDocument('dossie-1', {})],
    ['createDossierDelivery', 'POST', '/customs/dossiers/dossie-1/deliveries', () => service.createDossierDelivery('dossie-1', {})],
    ['listDossierQuotes', 'GET', '/customs/dossiers/dossie-1/quotes', () => service.listDossierQuotes('dossie-1')],
    ['createDossierQuoteFromGrid', 'POST', '/customs/dossiers/dossie-1/quotes/from-grid', () => service.createDossierQuoteFromGrid('dossie-1', {})],
    ['createDossierSpotQuote', 'POST', '/customs/dossiers/dossie-1/quotes/spot', () => service.createDossierSpotQuote('dossie-1', {})],
    ['setQuoteStatus', 'POST', '/customs/quotes/quoteI-1/status', () => service.setQuoteStatus('quoteI-1', {})],
    ['listConsolidations', 'GET', '/customs/consolidations', () => service.listConsolidations()],
    ['createConsolidation', 'POST', '/customs/consolidations', () => service.createConsolidation({})],
    ['createConsolidationDossier', 'POST', '/customs/consolidations/consol-1/dossiers/dossie-2', () => service.createConsolidationDossier('consol-1', 'dossie-2', {})],
    ['allocateConsolidation', 'POST', '/customs/consolidations/consol-1/allocate', () => service.allocateConsolidation('consol-1', {})],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.getSettings({ page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/customs/settings'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
