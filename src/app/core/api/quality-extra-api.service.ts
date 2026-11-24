import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  QualityComplaint,
  QualityComplaintRequest,
  QualityInstrument,
  QualityResponse,
  SpcCharacteristic,
  SpcCharacteristicRequest,
} from '../models';

export interface QualityListFilters {
  status?: string;
  page?: number;
  per_page?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface SpcSampleRow {
  id: string;
  measurements: number[];
  sampled_at: string | null;
  lot: string | null;
  instrument_id: string | null;
}

export interface QualityCapaAction {
  id: string;
  nonconformity_id: string | null;
  number: string;
  type: string;
  title: string;
  description: string | null;
  owner_id: string;
  due_date: string;
  status: string;
  completed_at: string | null;
  effectiveness_check_due_date: string | null;
  effectiveness_result: string | null;
  effectiveness_notes: string | null;
  is_overdue: boolean;
}

export interface QualityNonconformity {
  id: string;
  number: string;
  title: string;
  description: string | null;
  source: string;
  severity: string;
  status: string;
  detected_at: string;
  owner_id: string | null;
  contact_id: string | null;
  containment_action: string | null;
  root_cause: string | null;
  closed_at: string | null;
  closure_notes: string | null;
  capa_actions?: QualityCapaAction[];
}

export interface QualityNonconformityRequest {
  title: string;
  description?: string | null;
  source: string;
  severity?: string | null;
  detected_at?: string | null;
  owner_id?: string | null;
  contact_id?: string | null;
  mfg_non_conformance_id?: string | null;
  containment_action?: string | null;
}

export type QualityNonconformityUpdate = Partial<Omit<QualityNonconformityRequest, 'source' | 'detected_at'>> & {
  root_cause?: string | null;
};

export interface QualityCapaRequest {
  nonconformity_id?: string | null;
  type?: string | null;
  title: string;
  description?: string | null;
  owner_id: string;
  due_date: string;
  effectiveness_check_due_date?: string | null;
}

export type QualityCapaUpdate = Partial<Omit<QualityCapaRequest, 'nonconformity_id' | 'type'>>;

export interface QualityAuditChecklistItem {
  id: string;
  audit_id: string;
  position: number;
  clause: string | null;
  requirement: string;
  result: string | null;
  notes: string | null;
}

export interface QualityAuditFinding {
  id: string;
  audit_id: string;
  checklist_item_id: string | null;
  number: string;
  classification: string;
  description: string;
  nonconformity_id: string | null;
  status: string;
}

export interface QualityAudit {
  id: string;
  number: string;
  title: string;
  scope: string | null;
  audit_type: string;
  planned_date: string;
  performed_date: string | null;
  lead_auditor_id: string | null;
  auditee: string | null;
  status: string;
  summary: string | null;
  checklist?: QualityAuditChecklistItem[];
  findings?: QualityAuditFinding[];
}

export interface QualityAuditRequest {
  title: string;
  scope?: string | null;
  audit_type?: string | null;
  planned_date: string;
  lead_auditor_id?: string | null;
  auditee?: string | null;
  checklist?: { clause?: string | null; requirement: string }[];
}

export type QualityAuditUpdate = Partial<Omit<QualityAuditRequest, 'checklist'>>;

export interface QualityAuditFindingRequest {
  classification: string;
  description: string;
  checklist_item_id?: string | null;
  owner_id?: string | null;
}

export interface QualityProcedure {
  id: string;
  code: string;
  version: number;
  title: string;
  description: string | null;
  document_id: string | null;
  owner_id: string | null;
  author_id: string | null;
  status: string;
  effective_date: string | null;
  review_due_date: string | null;
  rejection_reason: string | null;
}

export interface QualityProcedureRequest {
  code: string;
  title: string;
  description?: string | null;
  document_id?: string | null;
  owner_id?: string | null;
  review_due_date?: string | null;
}

export type QualityProcedureUpdate = Partial<Omit<QualityProcedureRequest, 'code'>>;

/** SPC detail, complaint detail/edit/link, nonconformities, CAPA actions, audits and procedures of the quality module. */
@Service()
export class QualityExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/quality`;

  // SPC characteristics
  getCharacteristic(id: string): Observable<QualityResponse<SpcCharacteristic>> {
    return this.http.get<QualityResponse<SpcCharacteristic>>(`${this.base}/spc/characteristics/${id}`);
  }

  updateCharacteristic(id: string, payload: Partial<SpcCharacteristicRequest>): Observable<QualityResponse<SpcCharacteristic>> {
    return this.http.put<QualityResponse<SpcCharacteristic>>(`${this.base}/spc/characteristics/${id}`, payload);
  }

  getSpcSamples(id: string, filters?: QualityListFilters): Observable<QualityResponse<SpcSampleRow[]>> {
    return this.http.get<QualityResponse<SpcSampleRow[]>>(`${this.base}/spc/characteristics/${id}/samples`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  // Instruments
  getInstrument(id: string): Observable<QualityResponse<QualityInstrument>> {
    return this.http.get<QualityResponse<QualityInstrument>>(`${this.base}/instruments/${id}`);
  }

  // Complaints
  getComplaint(id: string): Observable<QualityResponse<QualityComplaint>> {
    return this.http.get<QualityResponse<QualityComplaint>>(`${this.base}/complaints/${id}`);
  }

  updateComplaint(id: string, payload: Partial<QualityComplaintRequest>): Observable<QualityResponse<QualityComplaint>> {
    return this.http.put<QualityResponse<QualityComplaint>>(`${this.base}/complaints/${id}`, payload);
  }

  /** Links the complaint to an existing nonconformity or CAPA action (at least one is required). */
  linkComplaint(id: string, payload: { nonconformity_id?: string | null; capa_action_id?: string | null }): Observable<QualityResponse<QualityComplaint>> {
    return this.http.post<QualityResponse<QualityComplaint>>(`${this.base}/complaints/${id}/link`, payload);
  }

  raiseComplaintNonconformity(id: string): Observable<QualityResponse<QualityNonconformity>> {
    return this.http.post<QualityResponse<QualityNonconformity>>(`${this.base}/complaints/${id}/raise-nonconformity`, {});
  }

  // Nonconformities
  getNonconformities(filters?: QualityListFilters): Observable<QualityResponse<QualityNonconformity[]>> {
    return this.http.get<QualityResponse<QualityNonconformity[]>>(`${this.base}/nonconformities`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getNonconformity(id: string): Observable<QualityResponse<QualityNonconformity>> {
    return this.http.get<QualityResponse<QualityNonconformity>>(`${this.base}/nonconformities/${id}`);
  }

  createNonconformity(payload: QualityNonconformityRequest): Observable<QualityResponse<QualityNonconformity>> {
    return this.http.post<QualityResponse<QualityNonconformity>>(`${this.base}/nonconformities`, payload);
  }

  updateNonconformity(id: string, payload: QualityNonconformityUpdate): Observable<QualityResponse<QualityNonconformity>> {
    return this.http.put<QualityResponse<QualityNonconformity>>(`${this.base}/nonconformities/${id}`, payload);
  }

  investigateNonconformity(id: string, ownerId?: string | null): Observable<QualityResponse<QualityNonconformity>> {
    return this.http.post<QualityResponse<QualityNonconformity>>(`${this.base}/nonconformities/${id}/investigate`, { owner_id: ownerId ?? null });
  }

  closeNonconformity(id: string, closureNotes?: string | null): Observable<QualityResponse<QualityNonconformity>> {
    return this.http.post<QualityResponse<QualityNonconformity>>(`${this.base}/nonconformities/${id}/close`, { closure_notes: closureNotes ?? null });
  }

  cancelNonconformity(id: string, reason: string): Observable<QualityResponse<QualityNonconformity>> {
    return this.http.post<QualityResponse<QualityNonconformity>>(`${this.base}/nonconformities/${id}/cancel`, { reason });
  }

  // CAPA actions
  getCapaActions(filters?: QualityListFilters): Observable<QualityResponse<QualityCapaAction[]>> {
    return this.http.get<QualityResponse<QualityCapaAction[]>>(`${this.base}/capa-actions`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getCapaAction(id: string): Observable<QualityResponse<QualityCapaAction>> {
    return this.http.get<QualityResponse<QualityCapaAction>>(`${this.base}/capa-actions/${id}`);
  }

  createCapaAction(payload: QualityCapaRequest): Observable<QualityResponse<QualityCapaAction>> {
    return this.http.post<QualityResponse<QualityCapaAction>>(`${this.base}/capa-actions`, payload);
  }

  updateCapaAction(id: string, payload: QualityCapaUpdate): Observable<QualityResponse<QualityCapaAction>> {
    return this.http.put<QualityResponse<QualityCapaAction>>(`${this.base}/capa-actions/${id}`, payload);
  }

  startCapaAction(id: string): Observable<QualityResponse<QualityCapaAction>> {
    return this.http.post<QualityResponse<QualityCapaAction>>(`${this.base}/capa-actions/${id}/start`, {});
  }

  completeCapaAction(id: string, effectivenessCheckDueDate?: string | null): Observable<QualityResponse<QualityCapaAction>> {
    return this.http.post<QualityResponse<QualityCapaAction>>(`${this.base}/capa-actions/${id}/complete`, {
      effectiveness_check_due_date: effectivenessCheckDueDate ?? null,
    });
  }

  verifyCapaEffectiveness(id: string, payload: { result: 'effective' | 'not_effective'; notes?: string | null }): Observable<QualityResponse<QualityCapaAction>> {
    return this.http.post<QualityResponse<QualityCapaAction>>(`${this.base}/capa-actions/${id}/verify-effectiveness`, payload);
  }

  cancelCapaAction(id: string): Observable<QualityResponse<QualityCapaAction>> {
    return this.http.post<QualityResponse<QualityCapaAction>>(`${this.base}/capa-actions/${id}/cancel`, {});
  }

  // Audits
  getAudits(filters?: QualityListFilters): Observable<QualityResponse<QualityAudit[]>> {
    return this.http.get<QualityResponse<QualityAudit[]>>(`${this.base}/audits`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getAudit(id: string): Observable<QualityResponse<QualityAudit>> {
    return this.http.get<QualityResponse<QualityAudit>>(`${this.base}/audits/${id}`);
  }

  createAudit(payload: QualityAuditRequest): Observable<QualityResponse<QualityAudit>> {
    return this.http.post<QualityResponse<QualityAudit>>(`${this.base}/audits`, payload);
  }

  updateAudit(id: string, payload: QualityAuditUpdate): Observable<QualityResponse<QualityAudit>> {
    return this.http.put<QualityResponse<QualityAudit>>(`${this.base}/audits/${id}`, payload);
  }

  startAudit(id: string): Observable<QualityResponse<QualityAudit>> {
    return this.http.post<QualityResponse<QualityAudit>>(`${this.base}/audits/${id}/start`, {});
  }

  completeAudit(id: string, summary?: string | null): Observable<QualityResponse<QualityAudit>> {
    return this.http.post<QualityResponse<QualityAudit>>(`${this.base}/audits/${id}/complete`, { summary: summary ?? null });
  }

  cancelAudit(id: string): Observable<QualityResponse<QualityAudit>> {
    return this.http.post<QualityResponse<QualityAudit>>(`${this.base}/audits/${id}/cancel`, {});
  }

  recordAuditChecklistResult(
    auditId: string,
    itemId: string,
    payload: { result: string; notes?: string | null },
  ): Observable<QualityResponse<QualityAuditChecklistItem>> {
    return this.http.put<QualityResponse<QualityAuditChecklistItem>>(`${this.base}/audits/${auditId}/checklist/${itemId}`, payload);
  }

  addAuditFinding(auditId: string, payload: QualityAuditFindingRequest): Observable<QualityResponse<QualityAuditFinding>> {
    return this.http.post<QualityResponse<QualityAuditFinding>>(`${this.base}/audits/${auditId}/findings`, payload);
  }

  // Procedures
  getProcedures(filters?: QualityListFilters): Observable<QualityResponse<QualityProcedure[]>> {
    return this.http.get<QualityResponse<QualityProcedure[]>>(`${this.base}/procedures`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getProcedure(id: string): Observable<QualityResponse<QualityProcedure>> {
    return this.http.get<QualityResponse<QualityProcedure>>(`${this.base}/procedures/${id}`);
  }

  createProcedure(payload: QualityProcedureRequest): Observable<QualityResponse<QualityProcedure>> {
    return this.http.post<QualityResponse<QualityProcedure>>(`${this.base}/procedures`, payload);
  }

  updateProcedure(id: string, payload: QualityProcedureUpdate): Observable<QualityResponse<QualityProcedure>> {
    return this.http.put<QualityResponse<QualityProcedure>>(`${this.base}/procedures/${id}`, payload);
  }

  submitProcedure(id: string): Observable<QualityResponse<QualityProcedure>> {
    return this.http.post<QualityResponse<QualityProcedure>>(`${this.base}/procedures/${id}/submit`, {});
  }

  approveProcedure(id: string): Observable<QualityResponse<QualityProcedure>> {
    return this.http.post<QualityResponse<QualityProcedure>>(`${this.base}/procedures/${id}/approve`, {});
  }

  rejectProcedure(id: string, reason: string): Observable<QualityResponse<QualityProcedure>> {
    return this.http.post<QualityResponse<QualityProcedure>>(`${this.base}/procedures/${id}/reject`, { reason });
  }

  reviseProcedure(id: string): Observable<QualityResponse<QualityProcedure>> {
    return this.http.post<QualityResponse<QualityProcedure>>(`${this.base}/procedures/${id}/revise`, {});
  }

  obsoleteProcedure(id: string): Observable<QualityResponse<QualityProcedure>> {
    return this.http.post<QualityResponse<QualityProcedure>>(`${this.base}/procedures/${id}/obsolete`, {});
  }
}
