export interface RentalVehicle {
  id?: string;
  plate: string;
  model: string;
  make?: string;
  type: string;
  client?: string;
  vignette: boolean;
  returnDate?: string;
  status: 'available' | 'rented' | 'maintenance' | 'reserved' | string;
  daily_rate?: number;
  current_mileage?: number;
  fuel_level?: string;
}

export interface RentalBooking {
  id: string;
  vehicle_id: string;
  vehicle_plate?: string;
  vehicle_model?: string;
  client_id: string;
  client_name?: string;
  start_date: string;
  end_date: string;
  status: 'booked' | 'active' | 'completed' | 'cancelled';
  daily_rate: number;
  total_amount: number;
  deposit_amount?: number;
  check_out_mileage?: number;
  check_in_mileage?: number;
  notes?: string | null;
}

export interface CheckInInspectionPayload {
  rental_booking_id: string;
  mileage: number;
  fuel_level: string;
  damage_markers?: string[];
  photos?: string[];
}

export interface CheckOutInspectionPayload {
  rental_booking_id: string;
  mileage: number;
  fuel_level: string;
  damage_markers?: string[];
  photos?: string[];
}

export interface CreateRentalBookingRequest {
  vehicle_id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  daily_rate: number;
  deposit_amount?: number;
}
