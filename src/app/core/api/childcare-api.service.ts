import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  ApiResponse,
  ChildcareActivity,
  ChildcareActivityRequest,
  ChildcareAdmitRequest,
  ChildcareAttendance,
  ChildcareAttendanceCorrection,
  ChildcareBill,
  ChildcareBillingRunRequest,
  ChildcareCheckInRequest,
  ChildcareCheckOutRequest,
  ChildcareChild,
  ChildcareChildRequest,
  ChildcareCorrectionRequest,
  ChildcareDailyNote,
  ChildcareDocument,
  ChildcareFeePlan,
  ChildcareFeePlanRequest,
  ChildcareGroup,
  ChildcareGroupRequest,
  ChildcareNoteRequest,
  ChildcareParams,
  ChildcareReferencePerson,
  ChildcareReferencePersonRequest,
  ChildcareRequirement,
  ChildcareRequirementRequest,
  ChildcareStaffHours,
  ChildcareStaffShift,
  ChildcareStaffShiftRequest,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class ChildcareApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/childcare`;

  // --- CHILDREN & GROUPS ---
  getChildren(params?: ChildcareParams): Observable<PaginatedResponse<ChildcareChild>> {
    return this.http.get<PaginatedResponse<ChildcareChild>>(`${this.base}/children`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getChild(id: string): Observable<ApiResponse<ChildcareChild>> {
    return this.http.get<ApiResponse<ChildcareChild>>(`${this.base}/children/${id}`);
  }

  enrolChild(payload: ChildcareChildRequest): Observable<ApiResponse<ChildcareChild>> {
    return this.http.post<ApiResponse<ChildcareChild>>(`${this.base}/children`, payload);
  }

  updateChild(
    id: string,
    payload: Partial<ChildcareChildRequest>,
  ): Observable<ApiResponse<ChildcareChild>> {
    return this.http.put<ApiResponse<ChildcareChild>>(`${this.base}/children/${id}`, payload);
  }

  getWaitingList(): Observable<ApiResponse<ChildcareChild[]>> {
    return this.http.get<ApiResponse<ChildcareChild[]>>(`${this.base}/waiting-list`);
  }

  admitChild(id: string, payload: ChildcareAdmitRequest): Observable<ApiResponse<ChildcareChild>> {
    return this.http.post<ApiResponse<ChildcareChild>>(`${this.base}/children/${id}/admit`, payload);
  }

  getGroups(): Observable<ApiResponse<ChildcareGroup[]>> {
    return this.http.get<ApiResponse<ChildcareGroup[]>>(`${this.base}/groups`);
  }

  createGroup(payload: ChildcareGroupRequest): Observable<ApiResponse<ChildcareGroup>> {
    return this.http.post<ApiResponse<ChildcareGroup>>(`${this.base}/groups`, payload);
  }

  /** Reference persons come with the child resource (`reference_persons`): the API has no dedicated list. */
  getReferencePersons(childId: string): Observable<ApiResponse<ChildcareReferencePerson[]>> {
    return this.http
      .get<ApiResponse<ChildcareChild & { reference_persons?: ChildcareReferencePerson[] }>>(
        `${this.base}/children/${childId}`,
      )
      .pipe(map((res) => ({ ...res, data: res.data?.reference_persons ?? [] })));
  }

  addReferencePerson(
    childId: string,
    payload: ChildcareReferencePersonRequest,
  ): Observable<ApiResponse<ChildcareReferencePerson>> {
    return this.http.post<ApiResponse<ChildcareReferencePerson>>(
      `${this.base}/children/${childId}/reference-persons`,
      payload,
    );
  }

  grantPortalAccess(refPersonId: string): Observable<ApiResponse<{ invitation_sent: boolean }>> {
    return this.http.post<ApiResponse<{ invitation_sent: boolean }>>(
      `${this.base}/reference-persons/${refPersonId}/portal-access`,
      {},
    );
  }

  // --- ATTENDANCE & REGISTER ---
  checkIn(payload: ChildcareCheckInRequest): Observable<ApiResponse<ChildcareAttendance>> {
    return this.http.post<ApiResponse<ChildcareAttendance>>(`${this.base}/attendances/check-in`, payload);
  }

  checkOut(payload: ChildcareCheckOutRequest): Observable<ApiResponse<ChildcareAttendance>> {
    return this.http.post<ApiResponse<ChildcareAttendance>>(
      `${this.base}/attendances/check-out`,
      payload,
    );
  }

  recordAbsence(payload: { child_id: string; date: string; reason?: string }): Observable<ApiResponse<ChildcareAttendance>> {
    return this.http.post<ApiResponse<ChildcareAttendance>>(`${this.base}/attendances/absence`, payload);
  }

  correctAttendance(
    id: string,
    payload: ChildcareCorrectionRequest,
  ): Observable<ApiResponse<ChildcareAttendance>> {
    return this.http.put<ApiResponse<ChildcareAttendance>>(`${this.base}/attendances/${id}`, payload);
  }

  getAttendanceCorrections(id: string): Observable<ApiResponse<ChildcareAttendanceCorrection[]>> {
    return this.http.get<ApiResponse<ChildcareAttendanceCorrection[]>>(
      `${this.base}/attendances/${id}/corrections`,
    );
  }

  getMonthlyRegister(params: { month: string; group_id?: string }): Observable<ApiResponse<ChildcareAttendance[]>> {
    return this.http.get<ApiResponse<ChildcareAttendance[]>>(`${this.base}/attendances/register`, {
      params: toHttpParams(params),
    });
  }

  // --- DAILY NOTES & MEALS ---
  getNotes(params?: { child_id?: string; date?: string }): Observable<ApiResponse<ChildcareDailyNote[]>> {
    return this.http.get<ApiResponse<ChildcareDailyNote[]>>(`${this.base}/notes`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createNote(payload: ChildcareNoteRequest): Observable<ApiResponse<ChildcareDailyNote>> {
    return this.http.post<ApiResponse<ChildcareDailyNote>>(`${this.base}/notes`, payload);
  }

  getDailyReport(childId: string, date?: string): Observable<ApiResponse<{ notes: ChildcareDailyNote[]; attendances: ChildcareAttendance[] }>> {
    return this.http.get<ApiResponse<{ notes: ChildcareDailyNote[]; attendances: ChildcareAttendance[] }>>(
      `${this.base}/children/${childId}/daily-report`,
      { params: date ? toHttpParams({ date }) : undefined },
    );
  }

  // --- ACTIVITIES & SHIFTS ---
  getActivities(): Observable<ApiResponse<ChildcareActivity[]>> {
    return this.http.get<ApiResponse<ChildcareActivity[]>>(`${this.base}/activities`);
  }

  createActivity(payload: ChildcareActivityRequest): Observable<ApiResponse<ChildcareActivity>> {
    return this.http.post<ApiResponse<ChildcareActivity>>(`${this.base}/activities`, payload);
  }

  /** Minutes worked per staff member in a month (the API has no list of single shifts). */
  getStaffHours(params: { month: string; group_id?: string }): Observable<ApiResponse<ChildcareStaffHours[]>> {
    return this.http.get<ApiResponse<ChildcareStaffHours[]>>(`${this.base}/staff-hours`, {
      params: toHttpParams(params),
    });
  }

  createStaffShift(payload: ChildcareStaffShiftRequest): Observable<ApiResponse<ChildcareStaffShift>> {
    return this.http.post<ApiResponse<ChildcareStaffShift>>(`${this.base}/staff-shifts`, payload);
  }

  // --- FEE PLANS & BILLING ---
  getFeePlans(): Observable<ApiResponse<ChildcareFeePlan[]>> {
    return this.http.get<ApiResponse<ChildcareFeePlan[]>>(`${this.base}/fee-plans`);
  }

  createFeePlan(payload: ChildcareFeePlanRequest): Observable<ApiResponse<ChildcareFeePlan>> {
    return this.http.post<ApiResponse<ChildcareFeePlan>>(`${this.base}/fee-plans`, payload);
  }

  runBilling(payload: ChildcareBillingRunRequest): Observable<ApiResponse<{ run_id: string; total_billed: string }>> {
    return this.http.post<ApiResponse<{ run_id: string; total_billed: string }>>(
      `${this.base}/billing/runs`,
      payload,
    );
  }

  getBills(params?: { period?: string }): Observable<ApiResponse<ChildcareBill[]>> {
    return this.http.get<ApiResponse<ChildcareBill[]>>(`${this.base}/billing/bills`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  // --- DOCUMENTS & REQUIREMENTS ---
  getDocumentRequirements(): Observable<ApiResponse<ChildcareRequirement[]>> {
    return this.http.get<ApiResponse<ChildcareRequirement[]>>(`${this.base}/document-requirements`);
  }

  createDocumentRequirement(
    payload: ChildcareRequirementRequest,
  ): Observable<ApiResponse<ChildcareRequirement>> {
    return this.http.post<ApiResponse<ChildcareRequirement>>(
      `${this.base}/document-requirements`,
      payload,
    );
  }

  getChildDocuments(childId: string): Observable<ApiResponse<ChildcareDocument[]>> {
    return this.http.get<ApiResponse<ChildcareDocument[]>>(`${this.base}/children/${childId}/documents`);
  }

  getOutstandingDocuments(): Observable<ApiResponse<ChildcareDocument[]>> {
    return this.http.get<ApiResponse<ChildcareDocument[]>>(`${this.base}/documents/outstanding`);
  }
}
