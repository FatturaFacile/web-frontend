import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  ApiResponse,
  PaginatedResponse,
  TravelAdvancePaidRequest,
  TravelApproveRequest,
  TravelLeg,
  TravelLegRequest,
  TravelLinkedExpense,
  TravelLinkExpenseRequest,
  TravelMileageClaim,
  TravelMileageClaimRequest,
  TravelMileageRate,
  TravelMileageRateRequest,
  TravelPerDiemRate,
  TravelPerDiemRateRequest,
  TravelPerDiemRequest,
  TravelPerDiemResponse,
  TravelReconciliation,
  TravelRejectRequest,
  TravelSeedRatesRequest,
  TravelSeedRatesResult,
  TravelTrip,
  TravelTripFilters,
  TravelTripReport,
  TravelTripRequest,
} from '../models';

/** Business trips and travel expenses: requests with approval, itinerary, per diem, mileage, reconciliation. */
@Service()
export class TravelApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/travel`;

  // Trips
  getTrips(filters: TravelTripFilters = {}): Observable<PaginatedResponse<TravelTrip>> {
    return this.http.get<PaginatedResponse<TravelTrip>>(`${this.base}/trips`, {
      params: toHttpParams(filters),
    });
  }

  getTrip(id: string): Observable<ApiResponse<TravelTrip>> {
    return this.http.get<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}`);
  }

  createTrip(payload: TravelTripRequest): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips`, payload);
  }

  updateTrip(id: string, payload: TravelTripRequest): Observable<ApiResponse<TravelTrip>> {
    return this.http.put<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}`, payload);
  }

  deleteTrip(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/trips/${id}`);
  }

  // Approval flow
  submitTrip(id: string): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/submit`, {});
  }

  withdrawTrip(id: string): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/withdraw`, {});
  }

  approveTrip(id: string, payload: TravelApproveRequest = {}): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/approve`, payload);
  }

  rejectTrip(id: string, payload: TravelRejectRequest): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/reject`, payload);
  }

  reopenTrip(id: string): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/reopen`, {});
  }

  completeTrip(id: string): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/complete`, {});
  }

  markAdvancePaid(
    id: string,
    payload: TravelAdvancePaidRequest,
  ): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/advance-paid`, payload);
  }

  reconcileTrip(id: string): Observable<ApiResponse<TravelTrip>> {
    return this.http.post<ApiResponse<TravelTrip>>(`${this.base}/trips/${id}/reconcile`, {});
  }

  // Reconciliation and report
  getReconciliation(id: string): Observable<ApiResponse<TravelReconciliation>> {
    return this.http.get<ApiResponse<TravelReconciliation>>(`${this.base}/trips/${id}/reconciliation`);
  }

  getReport(id: string): Observable<ApiResponse<TravelTripReport>> {
    return this.http.get<ApiResponse<TravelTripReport>>(`${this.base}/trips/${id}/report`);
  }

  // Itinerary
  addLeg(tripId: string, payload: TravelLegRequest): Observable<ApiResponse<TravelLeg>> {
    return this.http.post<ApiResponse<TravelLeg>>(`${this.base}/trips/${tripId}/legs`, payload);
  }

  updateLeg(
    tripId: string,
    legId: string,
    payload: TravelLegRequest,
  ): Observable<ApiResponse<TravelLeg>> {
    return this.http.put<ApiResponse<TravelLeg>>(`${this.base}/trips/${tripId}/legs/${legId}`, payload);
  }

  deleteLeg(tripId: string, legId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/trips/${tripId}/legs/${legId}`);
  }

  // Per diem
  getPerDiem(tripId: string): Observable<TravelPerDiemResponse> {
    return this.http.get<TravelPerDiemResponse>(`${this.base}/trips/${tripId}/per-diem`);
  }

  calculatePerDiem(
    tripId: string,
    payload: TravelPerDiemRequest = {},
  ): Observable<TravelPerDiemResponse> {
    return this.http.put<TravelPerDiemResponse>(`${this.base}/trips/${tripId}/per-diem`, payload);
  }

  // Mileage
  addMileageClaim(
    tripId: string,
    payload: TravelMileageClaimRequest,
  ): Observable<ApiResponse<TravelMileageClaim>> {
    return this.http.post<ApiResponse<TravelMileageClaim>>(
      `${this.base}/trips/${tripId}/mileage-claims`,
      payload,
    );
  }

  updateMileageClaim(
    tripId: string,
    claimId: string,
    payload: TravelMileageClaimRequest,
  ): Observable<ApiResponse<TravelMileageClaim>> {
    return this.http.put<ApiResponse<TravelMileageClaim>>(
      `${this.base}/trips/${tripId}/mileage-claims/${claimId}`,
      payload,
    );
  }

  deleteMileageClaim(tripId: string, claimId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/trips/${tripId}/mileage-claims/${claimId}`);
  }

  // Linked expenses
  getTripExpenses(tripId: string): Observable<ApiResponse<TravelLinkedExpense[]>> {
    return this.http.get<ApiResponse<TravelLinkedExpense[]>>(`${this.base}/trips/${tripId}/expenses`);
  }

  linkExpense(
    tripId: string,
    payload: TravelLinkExpenseRequest,
  ): Observable<ApiResponse<{ trip_id: string; expense_id: string }>> {
    return this.http.post<ApiResponse<{ trip_id: string; expense_id: string }>>(
      `${this.base}/trips/${tripId}/expenses`,
      payload,
    );
  }

  unlinkExpense(tripId: string, expenseId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/trips/${tripId}/expenses/${expenseId}`);
  }

  // Rate tables
  getPerDiemRates(
    filters: { jurisdiction?: string; year?: number; scope?: string } = {},
  ): Observable<ApiResponse<TravelPerDiemRate[]>> {
    return this.http.get<ApiResponse<TravelPerDiemRate[]>>(`${this.base}/rates/per-diem`, {
      params: toHttpParams(filters),
    });
  }

  createPerDiemRate(payload: TravelPerDiemRateRequest): Observable<ApiResponse<TravelPerDiemRate>> {
    return this.http.post<ApiResponse<TravelPerDiemRate>>(`${this.base}/rates/per-diem`, payload);
  }

  updatePerDiemRate(
    id: string,
    payload: TravelPerDiemRateRequest,
  ): Observable<ApiResponse<TravelPerDiemRate>> {
    return this.http.put<ApiResponse<TravelPerDiemRate>>(`${this.base}/rates/per-diem/${id}`, payload);
  }

  deletePerDiemRate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rates/per-diem/${id}`);
  }

  getMileageRates(
    filters: { jurisdiction?: string; year?: number; vehicle_type?: string } = {},
  ): Observable<ApiResponse<TravelMileageRate[]>> {
    return this.http.get<ApiResponse<TravelMileageRate[]>>(`${this.base}/rates/mileage`, {
      params: toHttpParams(filters),
    });
  }

  createMileageRate(payload: TravelMileageRateRequest): Observable<ApiResponse<TravelMileageRate>> {
    return this.http.post<ApiResponse<TravelMileageRate>>(`${this.base}/rates/mileage`, payload);
  }

  updateMileageRate(
    id: string,
    payload: TravelMileageRateRequest,
  ): Observable<ApiResponse<TravelMileageRate>> {
    return this.http.put<ApiResponse<TravelMileageRate>>(`${this.base}/rates/mileage/${id}`, payload);
  }

  deleteMileageRate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rates/mileage/${id}`);
  }

  seedDefaultRates(payload: TravelSeedRatesRequest): Observable<ApiResponse<TravelSeedRatesResult>> {
    return this.http.post<ApiResponse<TravelSeedRatesResult>>(`${this.base}/rates/defaults`, payload);
  }
}
