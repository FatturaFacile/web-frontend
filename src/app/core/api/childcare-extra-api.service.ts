import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, ChildcareDocument, ChildcareWeeklyPlan, ChildcareWeeklyPlanRequest } from '../models';

export interface ChildcareChildFeePayload {
  fee_plan_id: string;
  valid_from: string;
  valid_to?: string | null;
}

export interface ChildcareChildFee {
  id: string;
  child_id: string;
  fee_plan_id: string;
  valid_from: string;
  valid_to: string | null;
}

export type ChildcareMealRow = Record<string, string | number | boolean | null | object>;

export interface ChildcareEnrolmentPayload {
  child_id: string;
  valid_from: string;
  valid_to?: string | null;
}

export interface ChildcareEnrolment {
  id: string;
  activity_id: string;
  child_id: string;
  valid_from: string;
  valid_to: string | null;
}

export interface ChildcareMessage {
  id: string;
  body: string;
  direction?: string;
  created_at: string;
  read_at?: string | null;
}

export interface ChildcareDocumentUpload {
  title: string;
  requirement_id?: string | null;
  file?: File | null;
}

export interface ChildcareSubsidyRule {
  id: string;
  name: string;
  canton: string;
  method: string;
  parameters: Record<string, string | number | boolean | null>;
  valid_from: string;
  valid_to: string | null;
  source_reference: string | null;
  verified_at: string | null;
  verified_by: string | null;
}

export interface ChildcareSubsidyRulePayload {
  name: string;
  canton: string;
  method: string;
  parameters: Record<string, string | number | boolean | null>;
  valid_from: string;
  valid_to?: string | null;
  source_reference?: string | null;
}

/** Weekly plans, child fees, meals, activity enrolments, messages, document upload/download and subsidy rules of childcare. */
@Service()
export class ChildcareExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/childcare`;

  addWeeklyPlan(childId: string, payload: ChildcareWeeklyPlanRequest): Observable<ApiResponse<ChildcareWeeklyPlan>> {
    return this.http.post<ApiResponse<ChildcareWeeklyPlan>>(`${this.base}/children/${childId}/weekly-plans`, payload);
  }

  assignFee(childId: string, payload: ChildcareChildFeePayload): Observable<ApiResponse<ChildcareChildFee>> {
    return this.http.post<ApiResponse<ChildcareChildFee>>(`${this.base}/children/${childId}/fees`, payload);
  }

  /** Meals expected on a given day (YYYY-MM-DD). */
  getMeals(date: string): Observable<ApiResponse<ChildcareMealRow[]>> {
    return this.http.get<ApiResponse<ChildcareMealRow[]>>(`${this.base}/meals`, { params: toHttpParams({ date }) });
  }

  enrolInActivity(activityId: string, payload: ChildcareEnrolmentPayload): Observable<ApiResponse<ChildcareEnrolment>> {
    return this.http.post<ApiResponse<ChildcareEnrolment>>(`${this.base}/activities/${activityId}/enrolments`, payload);
  }

  getMessages(childId: string): Observable<ApiResponse<ChildcareMessage[]>> {
    return this.http.get<ApiResponse<ChildcareMessage[]>>(`${this.base}/children/${childId}/messages`);
  }

  sendMessage(childId: string, body: string): Observable<ApiResponse<ChildcareMessage>> {
    return this.http.post<ApiResponse<ChildcareMessage>>(`${this.base}/children/${childId}/messages`, { body });
  }

  downloadDocument(documentId: string): Observable<Blob> {
    return this.http.get(`${this.base}/documents/${documentId}/download`, { responseType: 'blob' });
  }

  uploadDocument(childId: string, payload: ChildcareDocumentUpload): Observable<ApiResponse<ChildcareDocument>> {
    const form = new FormData();
    form.append('title', payload.title);
    if (payload.requirement_id) {
      form.append('requirement_id', payload.requirement_id);
    }
    if (payload.file) {
      form.append('file', payload.file);
    }
    return this.http.post<ApiResponse<ChildcareDocument>>(`${this.base}/children/${childId}/documents`, form);
  }

  getSubsidyRules(): Observable<ApiResponse<ChildcareSubsidyRule[]>> {
    return this.http.get<ApiResponse<ChildcareSubsidyRule[]>>(`${this.base}/subsidy-rules`);
  }

  createSubsidyRule(payload: ChildcareSubsidyRulePayload): Observable<ApiResponse<ChildcareSubsidyRule>> {
    return this.http.post<ApiResponse<ChildcareSubsidyRule>>(`${this.base}/subsidy-rules`, payload);
  }

  verifySubsidyRule(id: string, sourceReference: string): Observable<ApiResponse<ChildcareSubsidyRule>> {
    return this.http.post<ApiResponse<ChildcareSubsidyRule>>(`${this.base}/subsidy-rules/${id}/verify`, { source_reference: sourceReference });
  }

  /** CSV (semicolon separated) of the subsidies of a period (YYYY-MM), optionally for one canton. */
  exportSubsidies(period: string, canton?: string): Observable<Blob> {
    return this.http.get(`${this.base}/billing/subsidies/export`, {
      params: toHttpParams({ period, canton }),
      responseType: 'blob',
    });
  }
}
