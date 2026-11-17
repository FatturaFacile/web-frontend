import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  TmsCarrier,
  TmsTariffBand,
  TmsTariffTable,
  TmsTrackingEvent,
  TmsTransportOrder,
  TmsTrip,
  TransportationList,
  TransportationResponse,
} from '../models';

export interface TmsListFilters {
  search?: string;
  status?: string;
  carrier_id?: string;
  page?: number;
  per_page?: number;
  [key: string]: string | number | boolean | undefined;
}

export interface TmsCarrierPayload {
  code: string;
  name: string;
  mode?: string;
  service_level?: string | null;
  currency?: string;
  is_active?: boolean;
  notes?: string | null;
}

export interface TmsTariffTablePayload {
  carrier_id: string;
  name: string;
  valid_from: string;
  valid_to?: string | null;
  currency?: string;
  rate_basis?: string;
  fuel_surcharge_percent?: number;
  minimum_charge?: number;
  is_active?: boolean;
  notes?: string | null;
}

export interface TmsTripPayload {
  carrier_id?: string | null;
  vehicle_id?: string | null;
  planned_start_at?: string | null;
  planned_end_at?: string | null;
  capacity_weight_kg?: number | null;
  capacity_volume_cbm?: number | null;
  planned_distance_km?: number | null;
  currency?: string;
  notes?: string | null;
}

export interface TmsTransportOrderPayload {
  reference?: string | null;
  origin_name: string;
  origin_location: string;
  origin_city?: string | null;
  origin_zone?: string | null;
  destination_name: string;
  destination_location: string;
  destination_city?: string | null;
  destination_zone?: string | null;
  pickup_from?: string | null;
  pickup_to?: string | null;
  delivery_from?: string | null;
  delivery_to?: string | null;
  weight_kg: number;
  volume_cbm?: number;
  pallets?: number;
  distance_km?: number | null;
  goods_description?: string | null;
  currency?: string;
  notes?: string | null;
}

export interface TmsRateRequest {
  carrier_id: string;
  weight_kg: number;
  distance_km?: number | null;
  origin_zone?: string | null;
  destination_zone?: string | null;
  date?: string | null;
  currency?: string | null;
}

/** Free-form offer computed by the rate engine. */
export type TmsRateOffer = Record<string, string | number | boolean | null>;

export interface TmsQuoteRequest {
  reference?: string | null;
  transport_order_id?: string | null;
  weight_kg?: number | null;
  distance_km?: number | null;
  origin_zone?: string | null;
  destination_zone?: string | null;
  ship_date?: string | null;
  currency?: string | null;
  notes?: string | null;
}

export interface TmsQuote {
  id: string;
  reference: string | null;
  transport_order_id: string | null;
  ship_date: string;
  weight_kg: string | number;
  distance_km: string | number | null;
  origin_zone: string | null;
  destination_zone: string | null;
  currency: string;
  status: string;
  offers: TmsRateOffer[] | null;
  awarded_carrier_id: string | null;
  awarded_amount: string | number | null;
  awarded_at: string | null;
  notes: string | null;
}

export interface TmsFreightInvoiceLine {
  id: string;
  freight_invoice_id: string;
  transport_order_id: string | null;
  description: string | null;
  billed_amount: string | number;
  expected_amount: string | number | null;
  variance_amount: string | number | null;
  variance_percent: string | number | null;
  audit_status: string;
  order_number?: string | null;
}

export interface TmsFreightInvoice {
  id: string;
  carrier_id: string;
  invoice_number: string;
  invoice_date: string;
  currency: string;
  total_amount: string | number;
  expected_total: string | number | null;
  variance_amount: string | number | null;
  tolerance_percent: string | number | null;
  audit_status: string;
  dispute_status: string;
  dispute_reason: string | null;
  resolution_note: string | null;
  credited_amount: string | number | null;
  audited_at: string | null;
  notes: string | null;
  carrier?: { id: string; code: string; name: string } | null;
  lines?: TmsFreightInvoiceLine[];
}

export interface TmsFreightInvoicePayload {
  carrier_id?: string;
  invoice_number: string;
  invoice_date: string;
  currency?: string | null;
  notes?: string | null;
  lines?: { transport_order_id?: string | null; description?: string | null; billed_amount: number }[];
}

export interface TmsFreightInvoiceFilters extends TmsListFilters {
  audit_status?: string;
  dispute_status?: string;
  from?: string;
  to?: string;
}

export interface TmsDisputeResolution {
  resolution: 'accepted' | 'credited' | 'rejected';
  note: string;
  credited_amount?: number | null;
}

/** Carriers, tariffs, trips, transport orders, quotes, tracking and freight invoices CRUD of the transportation module. */
@Service()
export class TransportationExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/transportation`;

  calculateRate(payload: TmsRateRequest): Observable<TransportationResponse<TmsRateOffer>> {
    return this.http.post<TransportationResponse<TmsRateOffer>>(`${this.base}/rates/calculate`, payload);
  }

  // Carriers
  getCarriers(filters?: TmsListFilters): Observable<TransportationList<TmsCarrier>> {
    return this.http.get<TransportationList<TmsCarrier>>(`${this.base}/carriers`, { params: filters ? toHttpParams(filters) : undefined });
  }

  createCarrier(payload: TmsCarrierPayload): Observable<TransportationResponse<TmsCarrier>> {
    return this.http.post<TransportationResponse<TmsCarrier>>(`${this.base}/carriers`, payload);
  }

  updateCarrier(id: string, payload: Partial<TmsCarrierPayload>): Observable<TransportationResponse<TmsCarrier>> {
    return this.http.put<TransportationResponse<TmsCarrier>>(`${this.base}/carriers/${id}`, payload);
  }

  deleteCarrier(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/carriers/${id}`);
  }

  // Tariff tables and bands
  createTariffTable(payload: TmsTariffTablePayload): Observable<TransportationResponse<TmsTariffTable>> {
    return this.http.post<TransportationResponse<TmsTariffTable>>(`${this.base}/tariff-tables`, payload);
  }

  updateTariffTable(id: string, payload: Partial<TmsTariffTablePayload>): Observable<TransportationResponse<TmsTariffTable>> {
    return this.http.put<TransportationResponse<TmsTariffTable>>(`${this.base}/tariff-tables/${id}`, payload);
  }

  deleteTariffTable(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/tariff-tables/${id}`);
  }

  getTariffBand(id: string): Observable<TransportationResponse<TmsTariffBand>> {
    return this.http.get<TransportationResponse<TmsTariffBand>>(`${this.base}/tariff-bands/${id}`);
  }

  // Trips
  getTrips(filters?: TmsListFilters): Observable<TransportationList<TmsTrip>> {
    return this.http.get<TransportationList<TmsTrip>>(`${this.base}/trips`, { params: filters ? toHttpParams(filters) : undefined });
  }

  createTrip(payload: TmsTripPayload): Observable<TransportationResponse<TmsTrip>> {
    return this.http.post<TransportationResponse<TmsTrip>>(`${this.base}/trips`, payload);
  }

  updateTrip(id: string, payload: TmsTripPayload): Observable<TransportationResponse<TmsTrip>> {
    return this.http.put<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}`, payload);
  }

  deleteTrip(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/trips/${id}`);
  }

  addTripOrders(id: string, orderIds: string[]): Observable<TransportationResponse<TmsTrip>> {
    return this.http.post<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/orders`, { order_ids: orderIds });
  }

  removeTripOrder(id: string, orderId: string): Observable<TransportationResponse<TmsTrip>> {
    return this.http.delete<TransportationResponse<TmsTrip>>(`${this.base}/trips/${id}/orders/${orderId}`);
  }

  // Transport orders
  getTransportOrders(filters?: TmsListFilters): Observable<TransportationList<TmsTransportOrder>> {
    return this.http.get<TransportationList<TmsTransportOrder>>(`${this.base}/transport-orders`, { params: filters ? toHttpParams(filters) : undefined });
  }

  createTransportOrder(payload: TmsTransportOrderPayload): Observable<TransportationResponse<TmsTransportOrder>> {
    return this.http.post<TransportationResponse<TmsTransportOrder>>(`${this.base}/transport-orders`, payload);
  }

  updateTransportOrder(id: string, payload: Partial<TmsTransportOrderPayload>): Observable<TransportationResponse<TmsTransportOrder>> {
    return this.http.put<TransportationResponse<TmsTransportOrder>>(`${this.base}/transport-orders/${id}`, payload);
  }

  deleteTransportOrder(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/transport-orders/${id}`);
  }

  assignCarrier(id: string, carrierId: string, expectedCost?: number | null): Observable<TransportationResponse<TmsTransportOrder>> {
    return this.http.post<TransportationResponse<TmsTransportOrder>>(`${this.base}/transport-orders/${id}/assign-carrier`, {
      carrier_id: carrierId,
      expected_cost: expectedCost ?? null,
    });
  }

  // Quotes
  getQuotes(filters?: TmsListFilters): Observable<TransportationList<TmsQuote>> {
    return this.http.get<TransportationList<TmsQuote>>(`${this.base}/quotes`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getQuote(id: string): Observable<TransportationResponse<TmsQuote>> {
    return this.http.get<TransportationResponse<TmsQuote>>(`${this.base}/quotes/${id}`);
  }

  createQuote(payload: TmsQuoteRequest): Observable<TransportationResponse<TmsQuote>> {
    return this.http.post<TransportationResponse<TmsQuote>>(`${this.base}/quotes`, payload);
  }

  deleteQuote(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/quotes/${id}`);
  }

  awardQuote(id: string, carrierId: string): Observable<TransportationResponse<TmsQuote>> {
    return this.http.post<TransportationResponse<TmsQuote>>(`${this.base}/quotes/${id}/award`, { carrier_id: carrierId });
  }

  // Tracking
  getTrackingEvent(id: string): Observable<TransportationResponse<TmsTrackingEvent>> {
    return this.http.get<TransportationResponse<TmsTrackingEvent>>(`${this.base}/tracking-events/${id}`);
  }

  // Freight invoices
  getFreightInvoices(filters?: TmsFreightInvoiceFilters): Observable<TransportationList<TmsFreightInvoice>> {
    return this.http.get<TransportationList<TmsFreightInvoice>>(`${this.base}/freight-invoices`, { params: filters ? toHttpParams(filters) : undefined });
  }

  getFreightInvoice(id: string): Observable<TransportationResponse<TmsFreightInvoice>> {
    return this.http.get<TransportationResponse<TmsFreightInvoice>>(`${this.base}/freight-invoices/${id}`);
  }

  createFreightInvoice(payload: TmsFreightInvoicePayload): Observable<TransportationResponse<TmsFreightInvoice>> {
    return this.http.post<TransportationResponse<TmsFreightInvoice>>(`${this.base}/freight-invoices`, payload);
  }

  updateFreightInvoice(id: string, payload: Partial<TmsFreightInvoicePayload>): Observable<TransportationResponse<TmsFreightInvoice>> {
    return this.http.put<TransportationResponse<TmsFreightInvoice>>(`${this.base}/freight-invoices/${id}`, payload);
  }

  deleteFreightInvoice(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/freight-invoices/${id}`);
  }

  auditFreightInvoice(id: string, tolerancePercent?: number | null): Observable<TransportationResponse<TmsFreightInvoice>> {
    return this.http.post<TransportationResponse<TmsFreightInvoice>>(`${this.base}/freight-invoices/${id}/audit`, {
      tolerance_percent: tolerancePercent ?? null,
    });
  }

  disputeFreightInvoice(id: string, reason: string): Observable<TransportationResponse<TmsFreightInvoice>> {
    return this.http.post<TransportationResponse<TmsFreightInvoice>>(`${this.base}/freight-invoices/${id}/dispute`, { reason });
  }

  resolveFreightInvoiceDispute(id: string, payload: TmsDisputeResolution): Observable<TransportationResponse<TmsFreightInvoice>> {
    return this.http.post<TransportationResponse<TmsFreightInvoice>>(`${this.base}/freight-invoices/${id}/resolve-dispute`, payload);
  }
}
