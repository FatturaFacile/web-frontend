import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  PtrAssignPayload,
  PtrAssignResult,
  PtrBillingPreviewRow,
  PtrBooking,
  PtrBookingAction,
  PtrBookingFilters,
  PtrBookingInvoice,
  PtrBookingPayload,
  PtrConciergeBookingPayload,
  PtrDddArchive,
  PtrDriver,
  PtrDriverPayload,
  PtrEnvelope,
  PtrExchangeAction,
  PtrFlightResult,
  PtrGenerateSheetPayload,
  PtrGenerateSheetResult,
  PtrHotelContract,
  PtrHotelContractPayload,
  PtrInfringement,
  PtrInvoiceResult,
  PtrLedger,
  PtrLookups,
  PtrPage,
  PtrPersonRef,
  PtrQuote,
  PtrSchoolContract,
  PtrSchoolContractPayload,
  PtrServiceSheet,
  PtrServiceSheetPayload,
  PtrTimeline,
  PtrVehicle,
  PtrVehiclePayload,
  PtrWelcomeSign,
} from '../models';

type Envelope<T> = Observable<PtrEnvelope<T>>;

/** Endpoints of the passenger transport vertical (Mod 176). */
@Service()
export class PassengerTransportApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/passenger-transport`;

  // --- Lookups ---

  getLookups(): Envelope<PtrLookups> {
    return this.http.get<PtrEnvelope<PtrLookups>>(`${this.base}/lookups`);
  }

  searchDrivers(q: string): Envelope<PtrPersonRef[]> {
    return this.http.get<PtrEnvelope<PtrPersonRef[]>>(`${this.base}/lookups/drivers`, {
      params: toHttpParams({ q }),
    });
  }

  searchContacts(q: string): Envelope<PtrPersonRef[]> {
    return this.http.get<PtrEnvelope<PtrPersonRef[]>>(`${this.base}/lookups/contacts`, {
      params: toHttpParams({ q }),
    });
  }

  // --- Dispatch ---

  getTimeline(from: string, to: string): Envelope<PtrTimeline> {
    return this.http.get<PtrEnvelope<PtrTimeline>>(`${this.base}/dispatch/timeline`, {
      params: toHttpParams({ from, to }),
    });
  }

  // --- Bookings ---

  listBookings(filters: PtrBookingFilters = {}): Observable<PtrPage<PtrBooking>> {
    return this.http.get<PtrPage<PtrBooking>>(`${this.base}/bookings`, {
      params: toHttpParams(filters),
    });
  }

  getBooking(id: string): Envelope<PtrBooking> {
    return this.http.get<PtrEnvelope<PtrBooking>>(`${this.base}/bookings/${id}`);
  }

  createBooking(payload: PtrBookingPayload): Envelope<PtrBooking> {
    return this.http.post<PtrEnvelope<PtrBooking>>(`${this.base}/bookings`, payload);
  }

  updateBooking(id: string, payload: Partial<PtrBookingPayload>): Envelope<PtrBooking> {
    return this.http.put<PtrEnvelope<PtrBooking>>(`${this.base}/bookings/${id}`, payload);
  }

  deleteBooking(id: string): Envelope<null> {
    return this.http.delete<PtrEnvelope<null>>(`${this.base}/bookings/${id}`);
  }

  quoteBooking(payload: PtrBookingPayload): Envelope<PtrQuote> {
    return this.http.post<PtrEnvelope<PtrQuote>>(`${this.base}/bookings/quote`, payload);
  }

  transitionBooking(id: string, action: PtrBookingAction): Envelope<PtrBooking> {
    return this.http.post<PtrEnvelope<PtrBooking>>(`${this.base}/bookings/${id}/transition`, {
      action,
    });
  }

  assignBooking(id: string, payload: PtrAssignPayload): Envelope<PtrAssignResult> {
    return this.http.post<PtrEnvelope<PtrAssignResult>>(
      `${this.base}/bookings/${id}/assign`,
      payload,
    );
  }

  trackFlight(id: string): Envelope<{ flight: PtrFlightResult; booking: PtrBooking }> {
    return this.http.post<PtrEnvelope<{ flight: PtrFlightResult; booking: PtrBooking }>>(
      `${this.base}/bookings/${id}/track-flight`,
      {},
    );
  }

  subcontractBooking(
    id: string,
    action: PtrExchangeAction,
    carrierId?: string,
    amount?: string,
  ): Envelope<PtrBooking> {
    return this.http.post<PtrEnvelope<PtrBooking>>(`${this.base}/bookings/${id}/subcontract`, {
      action,
      carrier_id: carrierId,
      amount,
    });
  }

  invoiceBooking(id: string): Envelope<PtrBookingInvoice> {
    return this.http.post<PtrEnvelope<PtrBookingInvoice>>(
      `${this.base}/bookings/${id}/invoice`,
      {},
    );
  }

  uploadWelcomeLogo(id: string, logo: File, text?: string): Envelope<PtrBooking> {
    const body = new FormData();
    body.append('logo', logo);
    if (text) {
      body.append('vip_welcome_sign_text', text);
    }
    return this.http.post<PtrEnvelope<PtrBooking>>(
      `${this.base}/bookings/${id}/welcome-logo`,
      body,
    );
  }

  getWelcomeSign(id: string): Envelope<PtrWelcomeSign> {
    return this.http.get<PtrEnvelope<PtrWelcomeSign>>(`${this.base}/bookings/${id}/welcome-sign`);
  }

  downloadWelcomeSignPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/bookings/${id}/welcome-sign/pdf`, { responseType: 'blob' });
  }

  // --- Service sheets ---

  listSheets(bookingId: string): Envelope<PtrServiceSheet[]> {
    return this.http.get<PtrEnvelope<PtrServiceSheet[]>>(
      `${this.base}/bookings/${bookingId}/service-sheets`,
    );
  }

  openSheet(bookingId: string, payload: PtrServiceSheetPayload = {}): Envelope<PtrServiceSheet> {
    return this.http.post<PtrEnvelope<PtrServiceSheet>>(
      `${this.base}/bookings/${bookingId}/service-sheets`,
      payload,
    );
  }

  generateSheet(
    bookingId: string,
    payload: PtrGenerateSheetPayload,
  ): Envelope<PtrGenerateSheetResult> {
    return this.http.post<PtrEnvelope<PtrGenerateSheetResult>>(
      `${this.base}/bookings/${bookingId}/service-sheets/generate`,
      payload,
    );
  }

  updateSheet(id: string, payload: PtrServiceSheetPayload): Envelope<PtrServiceSheet> {
    return this.http.put<PtrEnvelope<PtrServiceSheet>>(
      `${this.base}/service-sheets/${id}`,
      payload,
    );
  }

  closeSheet(id: string): Envelope<PtrServiceSheet> {
    return this.http.post<PtrEnvelope<PtrServiceSheet>>(
      `${this.base}/service-sheets/${id}/close`,
      {},
    );
  }

  transmitSheet(id: string): Envelope<PtrServiceSheet> {
    return this.http.post<PtrEnvelope<PtrServiceSheet>>(
      `${this.base}/service-sheets/${id}/transmit`,
      {},
    );
  }

  downloadSheetPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/service-sheets/${id}/pdf`, { responseType: 'blob' });
  }

  downloadInterbusPdf(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/service-sheets/${id}/interbus-pdf`, {
      responseType: 'blob',
    });
  }

  // --- Fleet and drivers ---

  listVehicles(q?: string): Observable<PtrPage<PtrVehicle>> {
    return this.http.get<PtrPage<PtrVehicle>>(`${this.base}/vehicles`, {
      params: toHttpParams({ q, per_page: 100 }),
    });
  }

  createVehicle(payload: PtrVehiclePayload): Envelope<PtrVehicle> {
    return this.http.post<PtrEnvelope<PtrVehicle>>(`${this.base}/vehicles`, payload);
  }

  updateVehicle(id: string, payload: Partial<PtrVehiclePayload>): Envelope<PtrVehicle> {
    return this.http.put<PtrEnvelope<PtrVehicle>>(`${this.base}/vehicles/${id}`, payload);
  }

  deleteVehicle(id: string): Envelope<null> {
    return this.http.delete<PtrEnvelope<null>>(`${this.base}/vehicles/${id}`);
  }

  listDrivers(): Observable<PtrPage<PtrDriver>> {
    return this.http.get<PtrPage<PtrDriver>>(`${this.base}/drivers`, {
      params: toHttpParams({ per_page: 100 }),
    });
  }

  createDriver(payload: PtrDriverPayload): Envelope<PtrDriver> {
    return this.http.post<PtrEnvelope<PtrDriver>>(`${this.base}/drivers`, payload);
  }

  updateDriver(id: string, payload: PtrDriverPayload): Envelope<PtrDriver> {
    return this.http.put<PtrEnvelope<PtrDriver>>(`${this.base}/drivers/${id}`, payload);
  }

  // --- Tachograph ---

  listDddArchives(driverEmployeeId?: string): Observable<PtrPage<PtrDddArchive>> {
    return this.http.get<PtrPage<PtrDddArchive>>(`${this.base}/tachograph/archives`, {
      params: toHttpParams({ driver_employee_id: driverEmployeeId, per_page: 50 }),
    });
  }

  uploadDdd(file: File, driverEmployeeId?: string, vehicleId?: string): Envelope<PtrDddArchive> {
    const body = new FormData();
    body.append('file', file);
    if (driverEmployeeId) {
      body.append('driver_employee_id', driverEmployeeId);
    }
    if (vehicleId) {
      body.append('vehicle_id', vehicleId);
    }
    return this.http.post<PtrEnvelope<PtrDddArchive>>(`${this.base}/tachograph/archives`, body);
  }

  downloadDdd(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/tachograph/archives/${id}/download`, {
      responseType: 'blob',
    });
  }

  listInfringements(driverEmployeeId?: string): Observable<PtrPage<PtrInfringement>> {
    return this.http.get<PtrPage<PtrInfringement>>(`${this.base}/tachograph/infringements`, {
      params: toHttpParams({ driver_employee_id: driverEmployeeId, per_page: 100 }),
    });
  }

  // --- Contracts ---

  listHotelContracts(): Observable<PtrPage<PtrHotelContract>> {
    return this.http.get<PtrPage<PtrHotelContract>>(`${this.base}/hotel-contracts`, {
      params: toHttpParams({ per_page: 100 }),
    });
  }

  createHotelContract(payload: PtrHotelContractPayload): Envelope<PtrHotelContract> {
    return this.http.post<PtrEnvelope<PtrHotelContract>>(`${this.base}/hotel-contracts`, payload);
  }

  updateHotelContract(
    id: string,
    payload: Partial<PtrHotelContractPayload>,
  ): Envelope<PtrHotelContract> {
    return this.http.put<PtrEnvelope<PtrHotelContract>>(
      `${this.base}/hotel-contracts/${id}`,
      payload,
    );
  }

  deleteHotelContract(id: string): Envelope<null> {
    return this.http.delete<PtrEnvelope<null>>(`${this.base}/hotel-contracts/${id}`);
  }

  conciergeBooking(contractId: string, payload: PtrConciergeBookingPayload): Envelope<PtrBooking> {
    return this.http.post<PtrEnvelope<PtrBooking>>(
      `${this.base}/hotel-contracts/${contractId}/bookings`,
      payload,
    );
  }

  listSchoolContracts(): Observable<PtrPage<PtrSchoolContract>> {
    return this.http.get<PtrPage<PtrSchoolContract>>(`${this.base}/school-contracts`, {
      params: toHttpParams({ per_page: 100 }),
    });
  }

  createSchoolContract(payload: PtrSchoolContractPayload): Envelope<PtrSchoolContract> {
    return this.http.post<PtrEnvelope<PtrSchoolContract>>(`${this.base}/school-contracts`, payload);
  }

  updateSchoolContract(
    id: string,
    payload: Partial<PtrSchoolContractPayload>,
  ): Envelope<PtrSchoolContract> {
    return this.http.put<PtrEnvelope<PtrSchoolContract>>(
      `${this.base}/school-contracts/${id}`,
      payload,
    );
  }

  deleteSchoolContract(id: string): Envelope<null> {
    return this.http.delete<PtrEnvelope<null>>(`${this.base}/school-contracts/${id}`);
  }

  // --- Billing and service exchange ---

  previewMonth(period: string, contactId?: string): Envelope<PtrBillingPreviewRow[]> {
    return this.http.get<PtrEnvelope<PtrBillingPreviewRow[]>>(
      `${this.base}/billing/monthly-preview`,
      {
        params: toHttpParams({ period, contact_id: contactId }),
      },
    );
  }

  invoiceMonth(period: string, contactIds?: string[]): Envelope<PtrInvoiceResult[]> {
    return this.http.post<PtrEnvelope<PtrInvoiceResult[]>>(
      `${this.base}/billing/monthly-invoices`,
      {
        period,
        contact_ids: contactIds,
      },
    );
  }

  getLedger(period?: string, carrierId?: string): Envelope<PtrLedger> {
    return this.http.get<PtrEnvelope<PtrLedger>>(`${this.base}/subcontract/ledger`, {
      params: toHttpParams({ period, carrier_id: carrierId }),
    });
  }
}
