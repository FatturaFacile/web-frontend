/** A tire set stored in the tire hotel (`TireHotelRecord`). Tread depths are decimal strings. */
export interface TireHotelRecord {
  id: string;
  tenant_id: string | null;
  vehicle_id: string;
  season: string;
  brand: string;
  model: string | null;
  size: string;
  dot: string | null;
  front_left_tread_mm: string;
  front_right_tread_mm: string;
  rear_left_tread_mm: string;
  rear_right_tread_mm: string;
  warehouse_shelf_location: string | null;
  status: string;
  notes: string | null;
  created_at: string | null;
  updated_at: string | null;
  deleted_at: string | null;
}

/** Response of `POST /automotive/tire-hotel/check-in`. */
export interface TireCheckInResult {
  id: string;
  status: string;
}

export interface AutomotiveVehicle {
  id: string;
  license_plate: string;
  make: string;
  model: string;
  year?: number;
  vin?: string;
  customer_id?: string;
  customer_name?: string;
  last_service_date?: string;
}

/** Laravel paginator nested in the success envelope, as returned by the vehicle list. */
export interface AutomotiveVehiclePage {
  current_page: number;
  data: AutomotiveVehicle[];
  last_page: number;
  per_page: number;
  total: number;
}

export interface TireCheckInPayload {
  vehicle_id: string;
  season: 'summer' | 'winter' | 'all_season';
  brand: string;
  model?: string | null;
  size: string;
  dot?: string | null;
  front_left_tread_mm: number;
  front_right_tread_mm: number;
  rear_left_tread_mm: number;
  rear_right_tread_mm: number;
  warehouse_shelf_location: string;
}
