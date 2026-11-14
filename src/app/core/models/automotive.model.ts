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
  /** Vehicle data added by the seasonal switch plan. */
  license_plate?: string | null;
  make?: string | null;
  vehicle_model?: string | null;
}

/** Laravel paginator nested in the success envelope, as returned by the seasonal switch plan. */
export interface TireHotelRecordPage {
  current_page: number;
  data: TireHotelRecord[];
  last_page: number;
  per_page: number;
  total: number;
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
  year?: number | null;
  /** Fields of `SaveCustomerVehicleRequest` (client_id is required on creation). */
  client_id?: string;
  vin_chassis?: string | null;
  mileage_km?: number;
  registration_date?: string | null;
  /** Present only when the API eager-loads the owner (the list does not at the moment). */
  client?: { id: string; company_name?: string | null; first_name?: string | null; last_name?: string | null } | null;
}

/** Body of POST/PUT /automotive/vehicles (`SaveCustomerVehicleRequest`); all fields optional on update. */
export interface AutomotiveVehiclePayload {
  client_id?: string;
  license_plate?: string;
  make?: string;
  model?: string;
  year?: number | null;
  vin_chassis?: string | null;
  registration_date?: string | null;
  mileage_km?: number;
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
