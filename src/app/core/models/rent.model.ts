export interface RentalVehicle {
  id?: string;
  plate: string;
  model: string;
  type: string;
  client: string;
  vignette: boolean;
  returnDate: string;
  status: string;
}

export interface RentalBooking {
  id: string;
  vehicle_id: string;
  client_id: string;
  start_date: string;
  end_date: string;
  status: 'booked' | 'active' | 'completed' | 'cancelled';
  daily_rate: number;
  total_amount: number;
}

export interface CheckInInspectionPayload {
  rental_booking_id: string;
  mileage: number;
  fuel_level: string;
  damage_markers?: string[];
  photos?: string[];
}
