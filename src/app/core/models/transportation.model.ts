/** Transportation management (TMS). Mirrors the API of the Transportation module: dashboard payload and enums of the screens. */

export type TmsCarrierMode = 'road' | 'air' | 'sea' | 'rail' | 'courier';
export type TmsRateBasis = 'flat' | 'weight' | 'distance' | 'weight_distance';
export type TmsOrderStatus = 'draft' | 'planned' | 'in_transit' | 'delivered' | 'cancelled' | 'exception';
export type TmsTripStatus = 'planned' | 'dispatched' | 'in_progress' | 'completed' | 'cancelled';
export type TmsTrackingEventType = 'picked_up' | 'in_transit' | 'at_hub' | 'out_for_delivery' | 'delivered' | 'exception' | 'delay';
export type TmsAuditStatus = 'pending' | 'matched' | 'over_billed' | 'under_billed' | 'unmatched';
export type TmsDisputeStatus = 'none' | 'open' | 'resolved_accepted' | 'resolved_credited' | 'rejected';

export const TMS_CARRIER_MODES: readonly TmsCarrierMode[] = ['road', 'air', 'sea', 'rail', 'courier'];
export const TMS_RATE_BASES: readonly TmsRateBasis[] = ['flat', 'weight', 'distance', 'weight_distance'];
export const TMS_ORDER_STATUSES: readonly TmsOrderStatus[] = ['draft', 'planned', 'in_transit', 'delivered', 'cancelled', 'exception'];
export const TMS_TRIP_STATUSES: readonly TmsTripStatus[] = ['planned', 'dispatched', 'in_progress', 'completed', 'cancelled'];
export const TMS_TRACKING_EVENT_TYPES: readonly TmsTrackingEventType[] = ['picked_up', 'in_transit', 'at_hub', 'out_for_delivery', 'delivered', 'exception', 'delay'];
export const TMS_AUDIT_STATUSES: readonly TmsAuditStatus[] = ['pending', 'matched', 'over_billed', 'under_billed', 'unmatched'];
export const TMS_DISPUTE_STATUSES: readonly TmsDisputeStatus[] = ['none', 'open', 'resolved_accepted', 'resolved_credited', 'rejected'];

export interface TransportationResponse<T> {
  data: T;
}

export interface TransportationDashboard {
  period: { from: string; to: string; days: number };
  on_time: { delivered: number; on_time: number; percent: string | null };
  cost_per_km: { trips: number; total_cost: string; total_km: string; value: string | null };
  cost_per_kg: { orders: number; value: string | null };
  orders_by_status: Record<TmsOrderStatus, number>;
  trips_by_status: Record<TmsTripStatus, number>;
  disputes: { open: number; over_billed_amount: string; credited_amount: string };
}

export type TmsStopType = 'pickup' | 'delivery';
export type TmsStopStatus = 'pending' | 'completed' | 'skipped';

export interface TmsCarrierRef {
  id: string;
  code: string;
  name: string;
}

export interface TmsCarrier {
  id: string;
  code: string;
  name: string;
  mode: TmsCarrierMode;
  service_level: string | null;
  currency: string;
  is_active: boolean;
  notes: string | null;
}

export interface TmsTariffTable {
  id: string;
  carrier_id: string;
  name: string;
  currency: string;
  valid_from: string;
  valid_to: string | null;
  rate_basis: TmsRateBasis;
  fuel_surcharge_percent: string;
  minimum_charge: string;
  is_active: boolean;
  notes: string | null;
  carrier?: TmsCarrierRef | null;
  band_count?: number;
}

export interface TmsTariffBand {
  id: string;
  tariff_table_id: string;
  origin_zone: string | null;
  destination_zone: string | null;
  weight_from_kg: string;
  weight_to_kg: string | null;
  distance_from_km: string;
  distance_to_km: string | null;
  fixed_amount: string;
  price_per_kg: string;
  price_per_km: string;
}

/** Payload of a band (TariffBandRequest); the table is only sent on creation. */
export interface TmsTariffBandPayload {
  tariff_table_id?: string;
  origin_zone: string | null;
  destination_zone: string | null;
  weight_from_kg: string;
  weight_to_kg: string | null;
  distance_from_km: string;
  distance_to_km: string | null;
  fixed_amount: string;
  price_per_kg: string;
  price_per_km: string;
}

export interface TmsTripStop {
  id: string;
  trip_id: string;
  sequence: number;
  stop_type: TmsStopType;
  transport_order_id: string | null;
  location: string | null;
  city: string | null;
  planned_arrival_at: string | null;
  actual_arrival_at: string | null;
  actual_departure_at: string | null;
  status: TmsStopStatus;
  order_number?: string | null;
}

export interface TmsTrip {
  id: string;
  number: string;
  status: TmsTripStatus;
  carrier_id: string | null;
  vehicle_id: string | null;
  planned_start_at: string | null;
  planned_end_at: string | null;
  actual_start_at: string | null;
  actual_end_at: string | null;
  capacity_weight_kg: string | null;
  capacity_volume_cbm: string | null;
  planned_distance_km: string | null;
  actual_distance_km: string | null;
  actual_cost: string | null;
  currency: string;
  total_weight_kg: string;
  total_volume_cbm: string;
  utilization_percent: string | null;
  notes: string | null;
  carrier?: TmsCarrierRef | null;
  stops?: TmsTripStop[];
}

export interface TmsTransportOrder {
  id: string;
  number: string;
  reference: string | null;
  status: TmsOrderStatus;
  origin_name: string;
  origin_location: string;
  origin_city: string | null;
  origin_zone: string | null;
  destination_name: string;
  destination_location: string;
  destination_city: string | null;
  destination_zone: string | null;
  pickup_from: string | null;
  pickup_to: string | null;
  delivery_from: string | null;
  delivery_to: string | null;
  weight_kg: string;
  volume_cbm: string;
  pallets: number;
  distance_km: string | null;
  goods_description: string | null;
  carrier_id: string | null;
  currency: string;
  expected_cost: string | null;
  actual_cost: string | null;
  trip_id: string | null;
  delivered_at: string | null;
  notes: string | null;
  carrier?: TmsCarrierRef | null;
  trip?: { id: string; number: string; status: TmsTripStatus } | null;
  is_on_time: boolean | null;
}

export interface TmsTrackingEvent {
  id: string;
  transport_order_id: string;
  event_type: TmsTrackingEventType;
  location: string | null;
  occurred_at: string;
  notes: string | null;
}

/** Payload of a tracking event (TrackingEventRequest). */
export interface TmsTrackingEventPayload {
  transport_order_id: string;
  event_type: TmsTrackingEventType;
  location: string | null;
  occurred_at: string;
  notes: string | null;
}

export interface TmsTripCompletePayload {
  actual_distance_km?: string | null;
  actual_cost?: string | null;
}

export interface TmsStopCompletePayload {
  arrived_at?: string | null;
  departed_at?: string | null;
}

export interface TransportationList<T> {
  data: T[];
}
