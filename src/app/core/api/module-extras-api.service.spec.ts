import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { ModuleExtrasApiService } from './module-extras-api.service';

describe('ModuleExtrasApiService', () => {
  let service: ModuleExtrasApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [ModuleExtrasApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(ModuleExtrasApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['getSustainabilityCatalog', 'GET', '/sustainability/catalog', () => service.getSustainabilityCatalog()],
    ['getSustainabilityFactor', 'GET', '/sustainability/factors/factor-1', () => service.getSustainabilityFactor('factor-1')],
    ['getSustainabilityPeriod', 'GET', '/sustainability/periods/period-1', () => service.getSustainabilityPeriod('period-1')],
    ['getSustainabilityActivityRecord', 'GET', '/sustainability/activity-records/activi-1', () => service.getSustainabilityActivityRecord('activi-1')],
    ['getSustainabilityTarget', 'GET', '/sustainability/targets/target-1', () => service.getSustainabilityTarget('target-1')],
    ['getSustainabilityMaterialityAssessment', 'GET', '/sustainability/materiality-assessments/materi-1', () => service.getSustainabilityMaterialityAssessment('materi-1')],
    ['createSustainabilityEsrsDatapoint', 'POST', '/sustainability/esrs/datapoints', () => service.createSustainabilityEsrsDatapoint({})],
    ['updateSustainabilityEsrsDatapoint', 'PUT', '/sustainability/esrs/datapoints/datapo-1', () => service.updateSustainabilityEsrsDatapoint('datapo-1', {})],
    ['getSustainabilitySupplierRequest', 'GET', '/sustainability/supplier-requests/suppli-1', () => service.getSustainabilitySupplierRequest('suppli-1')],
    ['getGovernanceControl', 'GET', '/governance/controls/contro-1', () => service.getGovernanceControl('contro-1')],
    ['getGovernanceAudit', 'GET', '/governance/audits/auditI-1', () => service.getGovernanceAudit('auditI-1')],
    ['getGovernanceAction', 'GET', '/governance/actions/action-1', () => service.getGovernanceAction('action-1')],
    ['checkGovernanceSod', 'POST', '/governance/sod/check', () => service.checkGovernanceSod({})],
    ['listGovernanceSodDocumentRules', 'GET', '/governance/sod/document-rules', () => service.listGovernanceSodDocumentRules()],
    ['updateGovernanceSodDocumentRule', 'PUT', '/governance/sod/document-rules/docume-1', () => service.updateGovernanceSodDocumentRule('docume-1', {})],
    ['getGovernanceObligation', 'GET', '/governance/obligations/obliga-1', () => service.getGovernanceObligation('obliga-1')],
    ['getFleetAssignment', 'GET', '/fleet/assignments/assign-1', () => service.getFleetAssignment('assign-1')],
    ['getFleetFuelEntry', 'GET', '/fleet/fuel-entries/fuelEn-1', () => service.getFleetFuelEntry('fuelEn-1')],
    ['getFleetService', 'GET', '/fleet/services/servic-1', () => service.getFleetService('servic-1')],
    ['getFleetScheduledService', 'GET', '/fleet/scheduled-services/schedu-1', () => service.getFleetScheduledService('schedu-1')],
    ['getFleetDeadline', 'GET', '/fleet/deadlines/deadli-1', () => service.getFleetDeadline('deadli-1')],
    ['getFleetIncident', 'GET', '/fleet/incidents/incide-1', () => service.getFleetIncident('incide-1')],
    ['getSettingsSdiChannel', 'GET', '/settings/sdi-channel', () => service.getSettingsSdiChannel()],
    ['saveSettingsSdiChannel', 'PUT', '/settings/sdi-channel', () => service.saveSettingsSdiChannel({})],
    ['pollSettingsSdiChannel', 'POST', '/settings/sdi-channel/poll', () => service.pollSettingsSdiChannel({})],
    ['listSdiChannelQuarantine', 'GET', '/settings/sdi-channel/quarantine', () => service.listSdiChannelQuarantine()],
    ['retrySettingsSdiChannelQuarantine', 'POST', '/settings/sdi-channel/quarantine/quaran-1/retry', () => service.retrySettingsSdiChannelQuarantine('quaran-1', {})],
    ['getConsignmentLedger', 'GET', '/consignment/ledger', () => service.getConsignmentLedger()],
    ['getConsignmentValuation', 'GET', '/consignment/valuation', () => service.getConsignmentValuation()],
    ['listConsignmentConsumptionReports', 'GET', '/consignment/consumption-reports', () => service.listConsignmentConsumptionReports()],
    ['createConsignmentConsumptionReport', 'POST', '/consignment/consumption-reports', () => service.createConsignmentConsumptionReport({})],
    ['getAutomotiveInspectionDueList', 'GET', '/automotive/inspections/due-list', () => service.getAutomotiveInspectionDueList()],
    ['completeAutomotiveInspection', 'POST', '/automotive/inspections/inspec-1/complete', () => service.completeAutomotiveInspection('inspec-1', {})],
    ['updateAutomotiveVehicle', 'PATCH', '/automotive/vehicles/vehicl-1', () => service.updateAutomotiveVehicle('vehicl-1', {})],
    ['createDmsDocumentExtraction', 'POST', '/dms/documents/docume-1/extractions', () => service.createDmsDocumentExtraction('docume-1', {})],
    ['getDmsApprovalRequest', 'GET', '/dms/approval-requests/approv-1', () => service.getDmsApprovalRequest('approv-1')],
    ['getDmsOcrJob', 'GET', '/dms/ocr-jobs/ocrJob-1', () => service.getDmsOcrJob('ocrJob-1')],
    ['createPlatformNotificationDevice', 'POST', '/platform/notifications/devices', () => service.createPlatformNotificationDevice({})],
    ['getCommunicationCampaign', 'GET', '/communication/campaigns/campai-1', () => service.getCommunicationCampaign('campai-1')],
    ['getRebatePromotion', 'GET', '/rebates/promotions/promot-1', () => service.getRebatePromotion('promot-1')],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.getSustainabilityCatalog({ page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/sustainability/catalog'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
