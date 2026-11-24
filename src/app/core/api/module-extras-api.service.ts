import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, LaravelPaginationMeta } from '../models';

type Filters = Record<string, string | number | boolean | null | undefined | string[]>;
/** Request body: field names mirror the Laravel FormRequest of the route. */
type Payload = Record<string, unknown>;
/** Generic resource returned by the API. */
type Row = Record<string, unknown>;
type ListResponse<T> = ApiResponse<T[]> & { meta?: LaravelPaginationMeta };

/** Additional endpoints of the sustainability, governance, fleet, settings, consignment, automotive, dms, platform, communication, rebates API not covered by the dedicated typed services. */
@Service()
export class ModuleExtrasApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /sustainability/catalog */
  getSustainabilityCatalog(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/sustainability/catalog`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /sustainability/factors/{} */
  getSustainabilityFactor(factorId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/sustainability/factors/${factorId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /sustainability/periods/{} */
  getSustainabilityPeriod(periodId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/sustainability/periods/${periodId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /sustainability/activity-records/{} */
  getSustainabilityActivityRecord(activityRecordId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/sustainability/activity-records/${activityRecordId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /sustainability/targets/{} */
  getSustainabilityTarget(targetId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/sustainability/targets/${targetId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /sustainability/materiality-assessments/{} */
  getSustainabilityMaterialityAssessment(materialityAssessmentId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/sustainability/materiality-assessments/${materialityAssessmentId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /sustainability/esrs/datapoints */
  createSustainabilityEsrsDatapoint(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/sustainability/esrs/datapoints`, payload);
  }

  /** PUT /sustainability/esrs/datapoints/{} */
  updateSustainabilityEsrsDatapoint(datapointId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/sustainability/esrs/datapoints/${datapointId}`, payload);
  }

  /** GET /sustainability/supplier-requests/{} */
  getSustainabilitySupplierRequest(supplierRequestId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/sustainability/supplier-requests/${supplierRequestId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /governance/controls/{} */
  getGovernanceControl(controlId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/governance/controls/${controlId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /governance/audits/{} */
  getGovernanceAudit(auditId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/governance/audits/${auditId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /governance/actions/{} */
  getGovernanceAction(actionId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/governance/actions/${actionId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /governance/sod/check */
  checkGovernanceSod(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/governance/sod/check`, payload);
  }

  /** GET /governance/sod/document-rules */
  listGovernanceSodDocumentRules(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/governance/sod/document-rules`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /governance/sod/document-rules/{} */
  updateGovernanceSodDocumentRule(documentRuleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/governance/sod/document-rules/${documentRuleId}`, payload);
  }

  /** GET /governance/obligations/{} */
  getGovernanceObligation(obligationId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/governance/obligations/${obligationId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /fleet/assignments/{} */
  getFleetAssignment(assignmentId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/fleet/assignments/${assignmentId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /fleet/fuel-entries/{} */
  getFleetFuelEntry(fuelEntryId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/fleet/fuel-entries/${fuelEntryId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /fleet/services/{} */
  getFleetService(serviceId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/fleet/services/${serviceId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /fleet/scheduled-services/{} */
  getFleetScheduledService(scheduledServiceId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/fleet/scheduled-services/${scheduledServiceId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /fleet/deadlines/{} */
  getFleetDeadline(deadlineId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/fleet/deadlines/${deadlineId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /fleet/incidents/{} */
  getFleetIncident(incidentId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/fleet/incidents/${incidentId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /settings/sdi-channel */
  getSettingsSdiChannel(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/settings/sdi-channel`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /settings/sdi-channel */
  saveSettingsSdiChannel(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/settings/sdi-channel`, payload);
  }

  /** POST /settings/sdi-channel/poll */
  pollSettingsSdiChannel(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/settings/sdi-channel/poll`, payload);
  }

  /** GET /settings/sdi-channel/quarantine */
  listSdiChannelQuarantine(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/settings/sdi-channel/quarantine`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /settings/sdi-channel/quarantine/{}/retry */
  retrySettingsSdiChannelQuarantine(quarantineId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/settings/sdi-channel/quarantine/${quarantineId}/retry`, payload);
  }

  /** GET /consignment/ledger */
  getConsignmentLedger(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/consignment/ledger`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /consignment/valuation */
  getConsignmentValuation(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/consignment/valuation`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /consignment/consumption-reports */
  listConsignmentConsumptionReports(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/consignment/consumption-reports`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /consignment/consumption-reports */
  createConsignmentConsumptionReport(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/consignment/consumption-reports`, payload);
  }

  /** GET /automotive/inspections/due-list */
  getAutomotiveInspectionDueList(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/automotive/inspections/due-list`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /automotive/inspections/{}/complete */
  completeAutomotiveInspection(inspectionId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/automotive/inspections/${inspectionId}/complete`, payload);
  }

  /** PATCH /automotive/vehicles/{} */
  updateAutomotiveVehicle(vehicleId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.patch<ApiResponse<Row>>(`${this.base}/automotive/vehicles/${vehicleId}`, payload);
  }

  /** POST /dms/documents/{}/extractions */
  createDmsDocumentExtraction(documentId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/dms/documents/${documentId}/extractions`, payload);
  }

  /** GET /dms/approval-requests/{} */
  getDmsApprovalRequest(approvalRequestId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/dms/approval-requests/${approvalRequestId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /dms/ocr-jobs/{} */
  getDmsOcrJob(ocrJobId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/dms/ocr-jobs/${ocrJobId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /platform/notifications/devices */
  createPlatformNotificationDevice(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/platform/notifications/devices`, payload);
  }

  /** GET /communication/campaigns/{} */
  getCommunicationCampaign(campaignId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/communication/campaigns/${campaignId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /rebates/promotions/{} */
  getRebatePromotion(promotionId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/rebates/promotions/${promotionId}`, { params: filters ? toHttpParams(filters) : undefined });
  }
}
