import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  TmsCarrier,
  TmsStopCompletePayload,
  TmsTariffBand,
  TmsTariffBandPayload,
  TmsTariffTable,
  TmsTrackingEvent,
  TmsTrackingEventPayload,
  TmsTransportOrder,
  TmsTrip,
  TmsTripCompletePayload,
  TransportationDashboard,
  TransportationList,
  TransportationResponse,
} from '../models';

/** The transport dashboard and the dedicated detail screens (orders, trips, carriers, tariffs); the lists are declarative resource pages over the same API. */
@Service()
export class TransportationApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/transportation`;

  getDashboard(days?: number): Observable<TransportationResponse<TransportationDashboard>> {
    let params = new HttpParams();
    if (days !== undefined) {
      params = params.set('days', String(days));
    }
    return this.http.get<TransportationResponse<TransportationDashboard>>(`${this.base}/dashboard`, { params });
  }

  getCarrier(id: string): Observable<TransportationResponse<TmsCarrier>> {
    return this.http.get<TransportationResponse<TmsCarrier>>(`${this.base}/carriers/${id}`);
  }

  getTariffTables(carrierId: string): Observable<TransportationList<TmsTariffTable>> {
    const params = new HttpParams().set('carrier_id', carrierId).set('per_page', '100');
    return this.http.get<TransportationList<TmsTariffTable>>(`${this.base}/tariff-tables`, { params });
  }

  getTariffTable(id: string): Observable<TransportationResponse<TmsTariffTable>> {
    return this.http.get<TransportationResponse<TmsTariffTable>>(`${this.base}/tariff-tables/${id}`);
  }

  getTariffBands(tariffTableId: string): Observable<TransportationList<TmsTariffBand>> {
    const params = new HttpParams().set('tariff_table_id', tariffTableId).set('per_page', '100');
    return this.http.get<TransportationList<TmsTariffBand>>(`${this.base}/tariff-bands`, { params });
  }

  createTariffBand(payload: TmsTariffBandPayload): Observable<TransportationResponse<TmsTariffBand>> {
    return this.http.post<TransportationResponse<TmsTariffBand>>(`${this.base}/tariff-bands`, payload);
  }

  updateTariffBand(id: string, payload: TmsTariffBandPayload): Observable<TransportationResponse<TmsTariffBand>> {
    return this.http.put<TransportationResponse<TmsTariffBand>>(`${this.base}/tariff-bands/${id}`, payload);
  }

  deleteTariffBand(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tariff-bands/${id}`);
  }

  getTransportOrder(id: string): Observable<TransportationResponse<TmsTransportOrder>> {
    return this.http.get<TransportationResponse<TmsTransportOrder>>(`${this.base}/transport-orders/${id}`);
  }

  planTransportOrder(id: string): Observable<TransportationResponse<TmsTransportOrder>> {
    return this.http.post<TransportationResponse<TmsTransportOrder>>(`${this.base}/transport-orders/${id}/plan`, {});
  }

  cancelTransportOrder(id: string): Observable<TransportationResponse<TmsTransportOrder>> {
    return this.http.post<TransportationResponse<TmsTransportOrder>>(`${this.base}/transport-orders/${id}/cancel`, {});
  }

  getTrackingEvents(transportOrderId: string): Observable<TransportationList<TmsTrackingEvent>> {
    const params = new HttpParams().set('transport_order_id', transportOrderId).set('per_page', '100');
    return this.http.get<TransportationList<TmsTrackingEvent>>(`${this.base}/tracking-events`, { params });
  }

  createTrackingEvent(payload: TmsTrackingEventPayload): Observable<TransportationResponse<TmsTrackingEvent>> {
    return this.http.post<TransportationResponse<TmsTrackingEvent>>(`${this.base}/tracking-events`, payload);
  }

  getTrip(id: string): Observable<TransportationResponse<TmsTrip>> {
    return this.http.get<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}`);
  }

  reorderTripStops(id: string, stopIds: string[]): Observable<TransportationResponse<TmsTrip>> {
    return this.http.put<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/stops/sequence`, { stop_ids: stopIds });
  }

  completeTripStop(id: string, stopId: string, payload: TmsStopCompletePayload = {}): Observable<TransportationResponse<TmsTrip>> {
    return this.http.post<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/stops/${stopId}/complete`, payload);
  }

  dispatchTrip(id: string): Observable<TransportationResponse<TmsTrip>> {
    return this.http.post<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/dispatch`, {});
  }

  startTrip(id: string): Observable<TransportationResponse<TmsTrip>> {
    return this.http.post<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/start`, {});
  }

  completeTrip(id: string, payload: TmsTripCompletePayload = {}): Observable<TransportationResponse<TmsTrip>> {
    return this.http.post<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/complete`, payload);
  }

  cancelTrip(id: string): Observable<TransportationResponse<TmsTrip>> {
    return this.http.post<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/cancel`, {});
  }
}
