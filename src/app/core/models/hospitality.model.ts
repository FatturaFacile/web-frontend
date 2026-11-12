export interface HospitalityRoom {
  id: string;
  name: string;
  sort_order?: number | null;
  width?: number | null;
  height?: number | null;
  tables_count?: number;
  created_at?: string;
  updated_at?: string;
}

export interface HospitalityRoomRequest {
  name: string;
  sort_order?: number;
  width?: number;
  height?: number;
}

/** Shapes the API accepts (`in:square,round,rectangle`). */
export type HospitalityTableShape = 'square' | 'round' | 'rectangle';
export type HospitalityTableStatus = 'free' | 'occupied' | 'reserved' | 'billing';

export interface HospitalityTable {
  id: string;
  room_id: string;
  room_name?: string | null;
  name: string;
  seats: number;
  shape: HospitalityTableShape;
  pos_x?: number | null;
  pos_y?: number | null;
  width?: number | null;
  height?: number | null;
  is_active: boolean;
  status?: HospitalityTableStatus;
  current_order_id?: string | null;
}

/** Table of `GET /hospitality/rooms/{id}/plan`, with its open order. */
export interface HospitalityPlanTable {
  id: string;
  name: string;
  seats: number;
  shape: string;
  pos_x: number;
  pos_y: number;
  width: number;
  height: number;
  status: 'occupied' | 'free';
  order_id: string | null;
  covers: string | null;
}

export interface HospitalityRoomPlan {
  room: { id: string; name: string; width: number; height: number };
  tables: HospitalityPlanTable[];
}

/** What is left to pay of an order (`GET /hospitality/orders/{id}/bill`); amounts are decimal strings. */
export interface HospitalityBill {
  order_id: string;
  lines: {
    order_item_id: string;
    description: string;
    remaining_quantity: string;
    unit_price: string;
    tax_rate: string;
    gross: string;
  }[];
  remaining_gross: string;
}

export interface HospitalityTableRequest {
  name: string;
  seats: number;
  shape?: HospitalityTableShape;
  pos_x?: number;
  pos_y?: number;
  width?: number;
  height?: number;
  is_active?: boolean;
}

export type HospitalityOrderStatus = 'open' | 'fired' | 'billed' | 'paid' | 'cancelled';
export type HospitalityItemStatus = 'pending' | 'fired' | 'preparing' | 'ready' | 'served' | 'voided';

export interface HospitalityOrderItem {
  id: string;
  order_id: string;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate?: string;
  subtotal?: string;
  course: number;
  status: HospitalityItemStatus;
  notes?: string | null;
}

export interface HospitalityOrder {
  id: string;
  order_number: string;
  table_id: string;
  table_name?: string | null;
  room_name?: string | null;
  covers: number;
  status: HospitalityOrderStatus;
  currency: string;
  total_amount: string;
  notes?: string | null;
  items?: HospitalityOrderItem[];
  created_at?: string;
  updated_at?: string;
}

export interface HospitalityOrderRequest {
  table_id: string;
  covers: number;
  notes?: string;
}

/** Row of POST /orders/{id}/items: without a product_id the description, unit_price and tax_rate are required. */
export interface HospitalityItemPayload {
  product_id?: string;
  description?: string;
  quantity: number;
  unit_price?: string;
  tax_rate?: number;
  course?: number;
  notes?: string;
}

export interface HospitalityItemsRequest {
  items: HospitalityItemPayload[];
}

export interface HospitalityFireRequest {
  course?: number;
}

export interface HospitalityMoveRequest {
  table_id: string;
}

export interface HospitalityVoidRequest {
  /** Required by the API, 3 to 255 characters. */
  reason: string;
}

export type HospitalityPaymentMode = 'items' | 'equal';
export type HospitalityPaymentMethod = 'cash' | 'card' | 'mixed';

/** Body of POST /orders/{id}/payments (HospitalityRequest, route orders.payments.store). */
export interface HospitalityPaymentRequest {
  pos_session_id: string;
  mode: HospitalityPaymentMode;
  /** Required when the mode is `items`. */
  lines?: { order_item_id: string; quantity: number }[];
  /** Required when the mode is `equal`: the number of equal shares paid now. */
  ways?: number;
  payment_method: HospitalityPaymentMethod;
  /** Required (greater than zero) when the method is `mixed`. */
  cash_amount?: number;
  cash_tendered?: number;
  contact_id?: string;
}

export type KitchenTicketStatus = 'queued' | 'preparing' | 'ready' | 'served';

export interface HospitalityKitchenTicket {
  id: string;
  order_id: string;
  order_number: string;
  table_name: string;
  course: number;
  status: KitchenTicketStatus;
  items: { description?: string; name?: string; quantity: number; notes?: string }[];
  created_at: string;
}

export type ReservationStatus = 'booked' | 'seated' | 'completed' | 'cancelled' | 'no_show';

export interface HospitalityReservation {
  id: string;
  table_id?: string | null;
  table_name?: string | null;
  guest_name: string;
  guest_phone?: string | null;
  guest_email?: string | null;
  party_size: number;
  starts_at: string;
  duration_minutes: number;
  status: ReservationStatus;
  notes?: string | null;
  created_at?: string;
}

export interface HospitalityReservationRequest {
  table_id?: string;
  contact_id?: string;
  guest_name: string;
  guest_phone?: string;
  guest_email?: string;
  party_size: number;
  starts_at: string;
  duration_minutes: number;
  notes?: string;
}
