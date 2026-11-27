import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  GcBillingRequest,
  GcBillingResult,
  GcContract,
  GcContractFilters,
  GcContractPayload,
  GcCrew,
  GcDashboard,
  GcEnvelope,
  GcInterventionPayload,
  GcLicense,
  GcLicenseCheck,
  GcLicensePayload,
  GcOptimizeRequest,
  GcOptimizeResult,
  GcReference,
  GcRescheduleResult,
  GcRoute,
  GcRouteFilters,
  GcSite,
  GcSiteFilters,
  GcSitePayload,
  GcStop,
  GcTreatment,
  GcTreatmentFilters,
  GcTreatmentPayload,
  GcWasteFilters,
  GcWasteSlip,
  GcWasteSlipPayload,
  GcWasteSummary,
} from '../models';

type Envelope<T> = Observable<GcEnvelope<T>>;

/** Endpoints of the green space maintenance vertical (Mod 126): sites, contracts, crews, route planner, treatments and waste slips. */
@Service()
export class GreenCareApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/green-care`;

  // --- Dashboard and reference data ---

  getDashboard(year?: number | null): Envelope<GcDashboard> {
    return this.http.get<GcEnvelope<GcDashboard>>(`${this.base}/dashboard`, { params: toHttpParams({ year }) });
  }

  getReference(): Envelope<GcReference> {
    return this.http.get<GcEnvelope<GcReference>>(`${this.base}/reference`);
  }

  // --- Sites ---

  listSites(filters: GcSiteFilters = {}): Envelope<GcSite[]> {
    return this.http.get<GcEnvelope<GcSite[]>>(`${this.base}/sites`, { params: toHttpParams({ ...filters }) });
  }

  createSite(payload: GcSitePayload): Envelope<GcSite> {
    return this.http.post<GcEnvelope<GcSite>>(`${this.base}/sites`, payload);
  }

  updateSite(id: string, payload: GcSitePayload): Envelope<GcSite> {
    return this.http.put<GcEnvelope<GcSite>>(`${this.base}/sites/${id}`, payload);
  }

  deleteSite(id: string): Envelope<null> {
    return this.http.delete<GcEnvelope<null>>(`${this.base}/sites/${id}`);
  }

  // --- Contracts ---

  listContracts(filters: GcContractFilters = {}): Envelope<GcContract[]> {
    return this.http.get<GcEnvelope<GcContract[]>>(`${this.base}/contracts`, { params: toHttpParams({ ...filters }) });
  }

  getContract(id: string): Envelope<GcContract> {
    return this.http.get<GcEnvelope<GcContract>>(`${this.base}/contracts/${id}`);
  }

  createContract(payload: GcContractPayload): Envelope<GcContract> {
    return this.http.post<GcEnvelope<GcContract>>(`${this.base}/contracts`, payload);
  }

  updateContract(id: string, payload: GcContractPayload): Envelope<GcContract> {
    return this.http.put<GcEnvelope<GcContract>>(`${this.base}/contracts/${id}`, payload);
  }

  deleteContract(id: string): Envelope<null> {
    return this.http.delete<GcEnvelope<null>>(`${this.base}/contracts/${id}`);
  }

  activateContract(id: string): Envelope<GcContract> {
    return this.http.post<GcEnvelope<GcContract>>(`${this.base}/contracts/${id}/activate`, {});
  }

  suspendContract(id: string): Envelope<GcContract> {
    return this.http.post<GcEnvelope<GcContract>>(`${this.base}/contracts/${id}/suspend`, {});
  }

  previewBilling(id: string, payload: GcBillingRequest): Envelope<GcBillingResult> {
    return this.http.post<GcEnvelope<GcBillingResult>>(`${this.base}/contracts/${id}/billing-preview`, payload);
  }

  generateInvoice(id: string, payload: GcBillingRequest): Envelope<GcBillingResult> {
    return this.http.post<GcEnvelope<GcBillingResult>>(`${this.base}/contracts/${id}/generate-invoice`, payload);
  }

  // --- Crews and licenses ---

  listCrews(): Envelope<GcCrew[]> {
    return this.http.get<GcEnvelope<GcCrew[]>>(`${this.base}/crews`, { params: toHttpParams({ per_page: 100 }) });
  }

  createCrew(payload: Partial<GcCrew>): Envelope<GcCrew> {
    return this.http.post<GcEnvelope<GcCrew>>(`${this.base}/crews`, payload);
  }

  updateCrew(id: string, payload: Partial<GcCrew>): Envelope<GcCrew> {
    return this.http.put<GcEnvelope<GcCrew>>(`${this.base}/crews/${id}`, payload);
  }

  deleteCrew(id: string): Envelope<null> {
    return this.http.delete<GcEnvelope<null>>(`${this.base}/crews/${id}`);
  }

  listLicenses(filters: { operator_id?: string | null; only_valid?: boolean | null } = {}): Envelope<GcLicense[]> {
    return this.http.get<GcEnvelope<GcLicense[]>>(`${this.base}/licenses`, { params: toHttpParams({ ...filters }) });
  }

  createLicense(payload: GcLicensePayload): Envelope<GcLicense> {
    return this.http.post<GcEnvelope<GcLicense>>(`${this.base}/licenses`, payload);
  }

  updateLicense(id: string, payload: GcLicensePayload): Envelope<GcLicense> {
    return this.http.put<GcEnvelope<GcLicense>>(`${this.base}/licenses/${id}`, payload);
  }

  deleteLicense(id: string): Envelope<null> {
    return this.http.delete<GcEnvelope<null>>(`${this.base}/licenses/${id}`);
  }

  // --- Routes ---

  listRoutes(filters: GcRouteFilters = {}): Envelope<GcRoute[]> {
    return this.http.get<GcEnvelope<GcRoute[]>>(`${this.base}/routes`, { params: toHttpParams({ ...filters }) });
  }

  getRoute(id: string): Envelope<GcRoute> {
    return this.http.get<GcEnvelope<GcRoute>>(`${this.base}/routes/${id}`);
  }

  updateRoute(id: string, payload: Partial<GcRoute> & { stop_order?: string[] }): Envelope<GcRoute> {
    return this.http.put<GcEnvelope<GcRoute>>(`${this.base}/routes/${id}`, payload);
  }

  deleteRoute(id: string): Envelope<null> {
    return this.http.delete<GcEnvelope<null>>(`${this.base}/routes/${id}`);
  }

  optimizeRoutes(payload: GcOptimizeRequest): Envelope<GcOptimizeResult> {
    return this.http.post<GcEnvelope<GcOptimizeResult>>(`${this.base}/routes/optimize`, payload);
  }

  rescheduleForWeather(payload: { from: string; to: string }): Envelope<GcRescheduleResult> {
    return this.http.post<GcEnvelope<GcRescheduleResult>>(`${this.base}/routes/auto-reschedule-weather`, payload);
  }

  refreshWeather(id: string): Envelope<GcRoute> {
    return this.http.post<GcEnvelope<GcRoute>>(`${this.base}/routes/${id}/refresh-weather`, {});
  }

  logIntervention(stopId: string, payload: GcInterventionPayload): Envelope<GcStop> {
    return this.http.post<GcEnvelope<GcStop>>(`${this.base}/route-stops/${stopId}/intervention`, payload);
  }

  uploadPhotos(stopId: string, type: 'before' | 'after', files: File[]): Envelope<GcStop> {
    const body = new FormData();
    body.append('type', type);
    for (const file of files) {
      body.append('files[]', file);
    }
    return this.http.post<GcEnvelope<GcStop>>(`${this.base}/route-stops/${stopId}/photos`, body);
  }

  // --- Phytosanitary treatments ---

  listTreatments(filters: GcTreatmentFilters = {}): Envelope<GcTreatment[]> {
    return this.http.get<GcEnvelope<GcTreatment[]>>(`${this.base}/treatments`, { params: toHttpParams({ ...filters }) });
  }

  createTreatment(payload: GcTreatmentPayload): Envelope<GcTreatment> {
    return this.http.post<GcEnvelope<GcTreatment>>(`${this.base}/treatments`, payload);
  }

  validateLicense(payload: { operator_id: string; treatment_date: string; site_id?: string | null }): Envelope<GcLicenseCheck> {
    return this.http.post<GcEnvelope<GcLicenseCheck>>(`${this.base}/treatments/validate-license`, payload);
  }

  exportTreatmentsPdf(filters: GcTreatmentFilters = {}): Observable<Blob> {
    return this.http.get(`${this.base}/treatments/export-pdf`, {
      params: toHttpParams({ from: filters.from, to: filters.to, site_id: filters.site_id, operator_id: filters.operator_id }),
      responseType: 'blob',
    });
  }

  // --- Green waste slips ---

  listSlips(filters: GcWasteFilters = {}): Envelope<GcWasteSlip[]> {
    return this.http.get<GcEnvelope<GcWasteSlip[]>>(`${this.base}/slips`, { params: toHttpParams({ ...filters }) });
  }

  createSlip(payload: GcWasteSlipPayload): Envelope<GcWasteSlip> {
    return this.http.post<GcEnvelope<GcWasteSlip>>(`${this.base}/slips`, payload);
  }

  updateSlip(id: string, payload: GcWasteSlipPayload): Envelope<GcWasteSlip> {
    return this.http.put<GcEnvelope<GcWasteSlip>>(`${this.base}/slips/${id}`, payload);
  }

  deleteSlip(id: string): Envelope<null> {
    return this.http.delete<GcEnvelope<null>>(`${this.base}/slips/${id}`);
  }

  getSlipSummary(filters: { from?: string | null; to?: string | null } = {}): Envelope<GcWasteSummary> {
    return this.http.get<GcEnvelope<GcWasteSummary>>(`${this.base}/slips/summary`, { params: toHttpParams({ ...filters }) });
  }
}
