import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  HospitalityFireRequest,
  HospitalityItemsRequest,
  HospitalityKitchenTicket,
  HospitalityMoveRequest,
  HospitalityOrder,
  HospitalityOrderItem,
  HospitalityOrderRequest,
  HospitalityPaymentRequest,
  HospitalityReservation,
  HospitalityReservationRequest,
  HospitalityRoom,
  HospitalityRoomRequest,
  HospitalityTable,
  HospitalityTableRequest,
  HospitalityVoidRequest,
  KitchenTicketStatus,
  ReservationStatus,
} from '../models';

@Service()
export class HospitalityApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hospitality`;

  // --- ROOMS & TABLES ---
  getRooms(): Observable<ApiResponse<HospitalityRoom[]>> {
    return this.http.get<ApiResponse<HospitalityRoom[]>>(`${this.base}/rooms`);
  }

  createRoom(payload: HospitalityRoomRequest): Observable<ApiResponse<HospitalityRoom>> {
    return this.http.post<ApiResponse<HospitalityRoom>>(`${this.base}/rooms`, payload);
  }

  getRoomTables(roomId: string): Observable<ApiResponse<HospitalityTable[]>> {
    return this.http.get<ApiResponse<HospitalityTable[]>>(`${this.base}/rooms/${roomId}/tables`);
  }

  createTable(roomId: string, payload: HospitalityTableRequest): Observable<ApiResponse<HospitalityTable>> {
    return this.http.post<ApiResponse<HospitalityTable>>(`${this.base}/rooms/${roomId}/tables`, payload);
  }

  // --- ORDERS & POS COMANDE ---
  getOrders(): Observable<ApiResponse<HospitalityOrder[]>> {
    return this.http.get<ApiResponse<HospitalityOrder[]>>(`${this.base}/orders`);
  }

  getOrder(id: string): Observable<ApiResponse<HospitalityOrder>> {
    return this.http.get<ApiResponse<HospitalityOrder>>(`${this.base}/orders/${id}`);
  }

  createOrder(payload: HospitalityOrderRequest): Observable<ApiResponse<HospitalityOrder>> {
    return this.http.post<ApiResponse<HospitalityOrder>>(`${this.base}/orders`, payload);
  }

  addOrderItems(
    orderId: string,
    payload: HospitalityItemsRequest,
  ): Observable<ApiResponse<HospitalityOrderItem[]>> {
    return this.http.post<ApiResponse<HospitalityOrderItem[]>>(
      `${this.base}/orders/${orderId}/items`,
      payload,
    );
  }

  fireOrderCourse(
    orderId: string,
    payload?: HospitalityFireRequest,
  ): Observable<ApiResponse<{ status: string }>> {
    return this.http.post<ApiResponse<{ status: string }>>(
      `${this.base}/orders/${orderId}/fire`,
      payload || {},
    );
  }

  moveOrderTable(
    orderId: string,
    payload: HospitalityMoveRequest,
  ): Observable<ApiResponse<HospitalityOrder>> {
    return this.http.post<ApiResponse<HospitalityOrder>>(
      `${this.base}/orders/${orderId}/move`,
      payload,
    );
  }

  cancelOrder(orderId: string): Observable<ApiResponse<{ cancelled: boolean }>> {
    return this.http.post<ApiResponse<{ cancelled: boolean }>>(
      `${this.base}/orders/${orderId}/cancel`,
      {},
    );
  }

  voidOrderItem(
    itemId: string,
    payload?: HospitalityVoidRequest,
  ): Observable<ApiResponse<{ voided: boolean }>> {
    return this.http.post<ApiResponse<{ voided: boolean }>>(
      `${this.base}/order-items/${itemId}/void`,
      payload || {},
    );
  }

  printBill(orderId: string): Observable<ApiResponse<{ bill_printed: boolean; total_amount: string }>> {
    return this.http.post<ApiResponse<{ bill_printed: boolean; total_amount: string }>>(
      `${this.base}/orders/${orderId}/bill`,
      {},
    );
  }

  payOrder(
    orderId: string,
    payload: HospitalityPaymentRequest,
  ): Observable<ApiResponse<{ payment_id: string; invoice_id?: string }>> {
    return this.http.post<ApiResponse<{ payment_id: string; invoice_id?: string }>>(
      `${this.base}/orders/${orderId}/payments`,
      payload,
    );
  }

  // --- KITCHEN TICKETS / KDS MONITOR ---
  getKitchenTickets(): Observable<ApiResponse<HospitalityKitchenTicket[]>> {
    return this.http.get<ApiResponse<HospitalityKitchenTicket[]>>(`${this.base}/kitchen-tickets`);
  }

  updateKitchenTicketStatus(
    ticketId: string,
    payload: { status: KitchenTicketStatus },
  ): Observable<ApiResponse<HospitalityKitchenTicket>> {
    return this.http.post<ApiResponse<HospitalityKitchenTicket>>(
      `${this.base}/kitchen-tickets/${ticketId}/status`,
      payload,
    );
  }

  // --- RESERVATIONS ---
  getReservations(): Observable<ApiResponse<HospitalityReservation[]>> {
    return this.http.get<ApiResponse<HospitalityReservation[]>>(`${this.base}/reservations`);
  }

  createReservation(
    payload: HospitalityReservationRequest,
  ): Observable<ApiResponse<HospitalityReservation>> {
    return this.http.post<ApiResponse<HospitalityReservation>>(`${this.base}/reservations`, payload);
  }

  seatReservation(
    reservationId: string,
    payload?: { table_id?: string },
  ): Observable<ApiResponse<HospitalityReservation>> {
    return this.http.post<ApiResponse<HospitalityReservation>>(
      `${this.base}/reservations/${reservationId}/seat`,
      payload || {},
    );
  }

  updateReservationStatus(
    reservationId: string,
    payload: { status: ReservationStatus; reason?: string },
  ): Observable<ApiResponse<HospitalityReservation>> {
    return this.http.post<ApiResponse<HospitalityReservation>>(
      `${this.base}/reservations/${reservationId}/status`,
      payload,
    );
  }
}
