import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, PaginatedResponse, QueryFilterParams } from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export type HospitalityRecord = Record<string, unknown>;

/** Hospitality endpoints not covered by HospitalityApiService (stays, group blocks, housekeeping, rate plans). */
@Service()
export class HospitalityExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hospitality`;

  private list(path: string, params?: QueryFilterParams): Observable<PaginatedResponse<HospitalityRecord>> {
    return this.http.get<PaginatedResponse<HospitalityRecord>>(`${this.base}/${path}`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  private one(path: string, params?: QueryFilterParams): Observable<ApiResponse<HospitalityRecord>> {
    return this.http.get<ApiResponse<HospitalityRecord>>(`${this.base}/${path}`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  private post(path: string, payload: HospitalityRecord = {}): Observable<ApiResponse<HospitalityRecord>> {
    return this.http.post<ApiResponse<HospitalityRecord>>(`${this.base}/${path}`, payload);
  }

  private put(path: string, payload: HospitalityRecord): Observable<ApiResponse<HospitalityRecord>> {
    return this.http.put<ApiResponse<HospitalityRecord>>(`${this.base}/${path}`, payload);
  }

  // Accommodations
  getAccommodations(params?: QueryFilterParams) { return this.list('accommodations', params); }
  createAccommodation(payload: HospitalityRecord) { return this.post('accommodations', payload); }
  updateAccommodation(id: string, payload: HospitalityRecord) { return this.put(`accommodations/${id}`, payload); }

  // Room types / rate plans / tables
  getRoomTypes(params?: QueryFilterParams) { return this.list('room-types', params); }
  createRoomType(payload: HospitalityRecord) { return this.post('room-types', payload); }
  updateRoomType(id: string, payload: HospitalityRecord) { return this.put(`room-types/${id}`, payload); }
  getRatePlans(params?: QueryFilterParams) { return this.list('rate-plans', params); }
  createRatePlan(payload: HospitalityRecord) { return this.post('rate-plans', payload); }
  updateRatePlan(id: string, payload: HospitalityRecord) { return this.put(`rate-plans/${id}`, payload); }
  updateTable(id: string, payload: HospitalityRecord) { return this.put(`tables/${id}`, payload); }

  // Reservations
  getReservation(id: string) { return this.one(`reservations/${id}`); }
  updateReservation(id: string, payload: HospitalityRecord) { return this.put(`reservations/${id}`, payload); }
  getReservationAvailability(params: QueryFilterParams) { return this.one('reservations/availability', params); }

  // Folio
  voidFolioEntry(id: string, payload: HospitalityRecord = {}) { return this.post(`folio-entries/${id}/void`, payload); }

  // Stays
  getStayAvailability(params: QueryFilterParams) { return this.one('stay-availability', params); }
  getStayQuote(params: QueryFilterParams) { return this.one('stay-quote', params); }
  getStays(params?: QueryFilterParams) { return this.list('stays', params); }
  createStay(payload: HospitalityRecord) { return this.post('stays', payload); }
  getStay(id: string) { return this.one(`stays/${id}`); }
  cancelStay(id: string, payload: HospitalityRecord = {}) { return this.post(`stays/${id}/cancel`, payload); }
  addStayCharge(id: string, payload: HospitalityRecord) { return this.post(`stays/${id}/charges`, payload); }
  checkInStay(id: string, payload: HospitalityRecord = {}) { return this.post(`stays/${id}/check-in`, payload); }
  checkOutStay(id: string, payload: HospitalityRecord = {}) { return this.post(`stays/${id}/check-out`, payload); }
  getStayFolioStatement(id: string) { return this.one(`stays/${id}/folio-statement`); }
  invoiceStay(id: string, payload: HospitalityRecord = {}) { return this.post(`stays/${id}/invoice`, payload); }
  markStayNoShow(id: string, payload: HospitalityRecord = {}) { return this.post(`stays/${id}/no-show`, payload); }
  addStayPayment(id: string, payload: HospitalityRecord) { return this.post(`stays/${id}/payments`, payload); }

  // Group blocks
  getGroupBlocks(params?: QueryFilterParams) { return this.list('group-blocks', params); }
  createGroupBlock(payload: HospitalityRecord) { return this.post('group-blocks', payload); }
  getGroupBlock(id: string) { return this.one(`group-blocks/${id}`); }
  updateGroupBlock(id: string, payload: HospitalityRecord) { return this.put(`group-blocks/${id}`, payload); }
  cancelGroupBlock(id: string, payload: HospitalityRecord = {}) { return this.post(`group-blocks/${id}/cancel`, payload); }
  setGroupBlockDates(id: string, payload: HospitalityRecord) { return this.post(`group-blocks/${id}/dates`, payload); }
  releaseGroupBlock(id: string, payload: HospitalityRecord = {}) { return this.post(`group-blocks/${id}/release`, payload); }
  addGroupBlockStays(id: string, payload: HospitalityRecord) { return this.post(`group-blocks/${id}/stays`, payload); }

  // Housekeeping
  getHousekeepingTasks(params?: QueryFilterParams) { return this.list('housekeeping-tasks', params); }
  createHousekeepingTask(payload: HospitalityRecord) { return this.post('housekeeping-tasks', payload); }
  startHousekeepingTask(id: string) { return this.post(`housekeeping-tasks/${id}/start`); }
  completeHousekeepingTask(id: string, payload: HospitalityRecord = {}) { return this.post(`housekeeping-tasks/${id}/complete`, payload); }
}
