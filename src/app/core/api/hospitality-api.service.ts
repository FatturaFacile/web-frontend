import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { forkJoin, map, Observable, of, switchMap } from 'rxjs';
import {
  ApiResponse,
  HospitalityBill,
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
  HospitalityRoomPlan,
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

  getRoomPlan(roomId: string): Observable<ApiResponse<HospitalityRoomPlan>> {
    return this.http.get<ApiResponse<HospitalityRoomPlan>>(`${this.base}/rooms/${roomId}/plan`);
  }

  /** Tables of a room, read from its plan (the API has no table list); `current_order_id` is the open order. */
  getRoomTables(roomId: string): Observable<ApiResponse<HospitalityTable[]>> {
    return this.getRoomPlan(roomId).pipe(
      map((res) => ({
        ...res,
        data: (res.data?.tables ?? []).map(
          (t): HospitalityTable => ({
            id: t.id,
            room_id: roomId,
            room_name: res.data.room?.name ?? null,
            name: t.name,
            seats: t.seats,
            shape: t.shape as HospitalityTable['shape'],
            pos_x: t.pos_x,
            pos_y: t.pos_y,
            width: t.width,
            height: t.height,
            is_active: true,
            status: t.status,
            current_order_id: t.order_id,
          }),
        ),
      })),
    );
  }

  createTable(roomId: string, payload: HospitalityTableRequest): Observable<ApiResponse<HospitalityTable>> {
    return this.http.post<ApiResponse<HospitalityTable>>(`${this.base}/rooms/${roomId}/tables`, payload);
  }

  // --- ORDERS & POS COMANDE ---
  /**
   * Open orders: the API has no order list, so they are collected from the plan of every room
   * (tables with an open order) and loaded one by one. Closed orders cannot be listed.
   */
  getOpenOrders(): Observable<ApiResponse<HospitalityOrder[]>> {
    return this.getRooms().pipe(
      switchMap((rooms) =>
        rooms.data?.length ? forkJoin(rooms.data.map((room) => this.getRoomPlan(room.id))) : of([]),
      ),
      map((plans) =>
        plans
          .flatMap((plan) => plan.data?.tables ?? [])
          .map((table) => table.order_id)
          .filter((id): id is string => !!id),
      ),
      switchMap((ids) => (ids.length ? forkJoin(ids.map((id) => this.getOrder(id))) : of([]))),
      map((orders) => ({ success: true, message: '', data: orders.map((order) => order.data) })),
    );
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

  /** What is left to pay of the order, line by line (the pre-bill). */
  getBill(orderId: string): Observable<ApiResponse<HospitalityBill>> {
    return this.http.get<ApiResponse<HospitalityBill>>(`${this.base}/orders/${orderId}/bill`);
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
