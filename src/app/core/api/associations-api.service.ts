import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AssociationCourse,
  AssociationCourseParams,
  AssociationCourseRequest,
  AssociationDonation,
  AssociationDonationParams,
  AssociationDonationRequest,
  AssociationFeeAssignment,
  AssociationFeeAssignmentRequest,
  AssociationFeeParams,
  AssociationFeePlan,
  AssociationMeeting,
  AssociationMeetingParams,
  AssociationMeetingRequest,
  AssociationMember,
  AssociationMemberParams,
  AssociationMemberRequest,
  AssociationPaymentRequest,
  AssociationReimbursement,
  AssociationReimbursementParams,
  AssociationReimbursementRequest,
  AssociationVolunteer,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

@Service()
export class AssociationsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  // --- MEMBERS ---
  getMembers(params?: AssociationMemberParams): Observable<PaginatedResponse<AssociationMember>> {
    return this.http.get<PaginatedResponse<AssociationMember>>(`${this.base}/associations/members`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMember(id: string): Observable<ApiResponse<AssociationMember>> {
    return this.http.get<ApiResponse<AssociationMember>>(`${this.base}/associations/members/${id}`);
  }

  createMember(payload: AssociationMemberRequest): Observable<ApiResponse<AssociationMember>> {
    return this.http.post<ApiResponse<AssociationMember>>(`${this.base}/associations/members`, payload);
  }

  updateMember(
    id: string,
    payload: Partial<AssociationMemberRequest>,
  ): Observable<ApiResponse<AssociationMember>> {
    return this.http.put<ApiResponse<AssociationMember>>(`${this.base}/associations/members/${id}`, payload);
  }

  deleteMember(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/associations/members/${id}`);
  }

  getMemberFeeStanding(id: string): Observable<ApiResponse<{ is_in_good_standing: boolean; outstanding_amount: string }>> {
    return this.http.get<ApiResponse<{ is_in_good_standing: boolean; outstanding_amount: string }>>(
      `${this.base}/associations/members/${id}/fee-standing`,
    );
  }

  // --- FEES & INSTALMENTS ---
  getFeeAssignments(params?: AssociationFeeParams): Observable<PaginatedResponse<AssociationFeeAssignment>> {
    return this.http.get<PaginatedResponse<AssociationFeeAssignment>>(
      `${this.base}/associations/fee-assignments`,
      {
        params: params ? toHttpParams(params) : undefined,
      },
    );
  }

  /** Fee plans to pick from when assigning a fee (`fee_plan_id` is required by the API). */
  getFeePlans(): Observable<PaginatedResponse<AssociationFeePlan>> {
    return this.http.get<PaginatedResponse<AssociationFeePlan>>(`${this.base}/associations/catalogs/fee-plans`, {
      params: { per_page: 100 },
    });
  }

  createFeeAssignment(payload: AssociationFeeAssignmentRequest): Observable<ApiResponse<AssociationFeeAssignment>> {
    return this.http.post<ApiResponse<AssociationFeeAssignment>>(
      `${this.base}/associations/fee-assignments`,
      payload,
    );
  }

  cancelFeeAssignment(id: string): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(
      `${this.base}/associations/fee-assignments/${id}/cancel`,
      {},
    );
  }

  recordFeePayment(
    instalmentId: string,
    payload: AssociationPaymentRequest,
  ): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(
      `${this.base}/associations/instalments/${instalmentId}/payments`,
      payload,
    );
  }

  // --- COURSES & ATTENDANCE ---
  getCourses(params?: AssociationCourseParams): Observable<PaginatedResponse<AssociationCourse>> {
    return this.http.get<PaginatedResponse<AssociationCourse>>(`${this.base}/associations/courses`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createCourse(payload: AssociationCourseRequest): Observable<ApiResponse<AssociationCourse>> {
    return this.http.post<ApiResponse<AssociationCourse>>(`${this.base}/associations/courses`, payload);
  }

  updateCourse(
    id: string,
    payload: Partial<AssociationCourseRequest>,
  ): Observable<ApiResponse<AssociationCourse>> {
    return this.http.put<ApiResponse<AssociationCourse>>(`${this.base}/associations/courses/${id}`, payload);
  }

  deleteCourse(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/associations/courses/${id}`);
  }

  getCourseParticipants(courseId: string): Observable<ApiResponse<AssociationMember[]>> {
    return this.http.get<ApiResponse<AssociationMember[]>>(
      `${this.base}/associations/courses/${courseId}/participants`,
    );
  }

  enrolInCourse(
    courseId: string,
    payload: { member_id: string },
  ): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(
      `${this.base}/associations/courses/${courseId}/enrolments`,
      payload,
    );
  }

  // --- DONATIONS & 5 PER MILLE ---
  getDonations(params?: AssociationDonationParams): Observable<PaginatedResponse<AssociationDonation>> {
    return this.http.get<PaginatedResponse<AssociationDonation>>(`${this.base}/associations/donations`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createDonation(payload: AssociationDonationRequest): Observable<ApiResponse<AssociationDonation>> {
    return this.http.post<ApiResponse<AssociationDonation>>(`${this.base}/associations/donations`, payload);
  }

  generateDonationReceipt(donationId: string): Observable<ApiResponse<{ receipt_number: string }>> {
    return this.http.post<ApiResponse<{ receipt_number: string }>>(
      `${this.base}/associations/donations/${donationId}/receipt`,
      {},
    );
  }

  /** Allocations of the 5 per mille received (paginated list; the year is only a client-side filter). */
  getFivePerMille(): Observable<PaginatedResponse<{ id: string; reference_year: string; received_on: string; amount: string }>> {
    return this.http.get<PaginatedResponse<{ id: string; reference_year: string; received_on: string; amount: string }>>(
      `${this.base}/associations/five-per-mille`,
      { params: { per_page: 100 } },
    );
  }

  // --- MEETINGS & MINUTES ---
  getMeetings(params?: AssociationMeetingParams): Observable<PaginatedResponse<AssociationMeeting>> {
    return this.http.get<PaginatedResponse<AssociationMeeting>>(`${this.base}/associations/meetings`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createMeeting(payload: AssociationMeetingRequest): Observable<ApiResponse<AssociationMeeting>> {
    return this.http.post<ApiResponse<AssociationMeeting>>(`${this.base}/associations/meetings`, payload);
  }

  // --- VOLUNTEERS & RUNTS ---
  getVolunteers(year?: number): Observable<ApiResponse<AssociationVolunteer[]>> {
    const yr = year || new Date().getFullYear();
    return this.http.get<ApiResponse<AssociationVolunteer[]>>(
      `${this.base}/associations/volunteers/year/${yr}`,
    );
  }

  getVolunteerExpiries(): Observable<ApiResponse<{ expired_count: number; expiring_soon_count: number }>> {
    return this.http.get<ApiResponse<{ expired_count: number; expiring_soon_count: number }>>(
      `${this.base}/associations/volunteers/expiries`,
    );
  }

  getReimbursements(params?: AssociationReimbursementParams): Observable<PaginatedResponse<AssociationReimbursement>> {
    return this.http.get<PaginatedResponse<AssociationReimbursement>>(`${this.base}/associations/reimbursements`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createReimbursement(payload: AssociationReimbursementRequest): Observable<ApiResponse<AssociationReimbursement>> {
    return this.http.post<ApiResponse<AssociationReimbursement>>(
      `${this.base}/associations/reimbursements`,
      payload,
    );
  }

  decideReimbursement(
    id: string,
    payload: { approved: boolean; reason?: string },
  ): Observable<ApiResponse<AssociationReimbursement>> {
    return this.http.post<ApiResponse<AssociationReimbursement>>(
      `${this.base}/associations/reimbursements/${id}/decision`,
      payload,
    );
  }

  payReimbursement(
    id: string,
    payload: { paid_on: string; payment_method: 'cash' | 'bank' },
  ): Observable<ApiResponse<{ success: boolean }>> {
    return this.http.post<ApiResponse<{ success: boolean }>>(
      `${this.base}/associations/reimbursements/${id}/pay`,
      payload,
    );
  }
}
