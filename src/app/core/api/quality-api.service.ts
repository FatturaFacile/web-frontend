import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ComplaintAction,
  QualityCalibration,
  QualityCalibrationImpact,
  QualityCalibrationRequest,
  QualityComplaint,
  QualityComplaintFilters,
  QualityComplaintRequest,
  QualityInstrument,
  QualityInstrumentFilters,
  QualityInstrumentRequest,
  QualityKpis,
  QualityResponse,
  SpcCharacteristic,
  SpcCharacteristicRequest,
  SpcChart,
  SpcSampleRequest,
  SpcSampleResponse,
} from '../models';

/** SPC, measuring instruments with calibrations and customer complaints of the quality module. */
@Service()
export class QualityApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/quality`;

  // SPC
  getCharacteristics(): Observable<QualityResponse<SpcCharacteristic[]>> {
    return this.http.get<QualityResponse<SpcCharacteristic[]>>(`${this.base}/spc/characteristics`, { params: this.params({ per_page: 100 }) });
  }

  createCharacteristic(payload: SpcCharacteristicRequest): Observable<QualityResponse<SpcCharacteristic>> {
    return this.http.post<QualityResponse<SpcCharacteristic>>(`${this.base}/spc/characteristics`, payload);
  }

  deleteCharacteristic(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/spc/characteristics/${id}`);
  }

  getSpcChart(id: string, limit?: number): Observable<QualityResponse<SpcChart>> {
    return this.http.get<QualityResponse<SpcChart>>(`${this.base}/spc/characteristics/${id}/chart`, { params: this.params({ limit }) });
  }

  addSpcSample(id: string, payload: SpcSampleRequest): Observable<SpcSampleResponse> {
    return this.http.post<SpcSampleResponse>(`${this.base}/spc/characteristics/${id}/samples`, payload);
  }

  deleteSpcSample(sampleId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/spc/samples/${sampleId}`);
  }

  getKpis(): Observable<QualityResponse<QualityKpis>> {
    return this.http.get<QualityResponse<QualityKpis>>(`${this.base}/kpis`);
  }

  // Instruments
  getInstruments(filters?: QualityInstrumentFilters): Observable<QualityResponse<QualityInstrument[]>> {
    return this.http.get<QualityResponse<QualityInstrument[]>>(`${this.base}/instruments`, { params: this.params({ per_page: 100, ...filters }) });
  }

  createInstrument(payload: QualityInstrumentRequest): Observable<QualityResponse<QualityInstrument>> {
    return this.http.post<QualityResponse<QualityInstrument>>(`${this.base}/instruments`, payload);
  }

  updateInstrument(id: string, payload: Partial<QualityInstrumentRequest>): Observable<QualityResponse<QualityInstrument>> {
    return this.http.put<QualityResponse<QualityInstrument>>(`${this.base}/instruments/${id}`, payload);
  }

  retireInstrument(id: string): Observable<QualityResponse<QualityInstrument>> {
    return this.http.post<QualityResponse<QualityInstrument>>(`${this.base}/instruments/${id}/retire`, {});
  }

  getCalibrations(instrumentId: string): Observable<QualityResponse<QualityCalibration[]>> {
    return this.http.get<QualityResponse<QualityCalibration[]>>(`${this.base}/instruments/${instrumentId}/calibrations`);
  }

  recordCalibration(instrumentId: string, payload: QualityCalibrationRequest): Observable<QualityResponse<QualityCalibration>> {
    return this.http.post<QualityResponse<QualityCalibration>>(`${this.base}/instruments/${instrumentId}/calibrations`, payload);
  }

  getCalibrationImpact(calibrationId: string): Observable<QualityResponse<QualityCalibrationImpact>> {
    return this.http.get<QualityResponse<QualityCalibrationImpact>>(`${this.base}/calibrations/${calibrationId}/impact`);
  }

  // Complaints
  getComplaints(filters?: QualityComplaintFilters): Observable<QualityResponse<QualityComplaint[]>> {
    return this.http.get<QualityResponse<QualityComplaint[]>>(`${this.base}/complaints`, { params: this.params({ per_page: 100, ...filters }) });
  }

  createComplaint(payload: QualityComplaintRequest): Observable<QualityResponse<QualityComplaint>> {
    return this.http.post<QualityResponse<QualityComplaint>>(`${this.base}/complaints`, payload);
  }

  /** A complaint transition: reply sends reply_text, root-cause root_cause, reject reason, close closure_notes. */
  complaintAction(id: string, action: ComplaintAction, payload: Record<string, string | null> = {}): Observable<QualityResponse<QualityComplaint>> {
    return this.http.post<QualityResponse<QualityComplaint>>(`${this.base}/complaints/${id}/${action}`, payload);
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
