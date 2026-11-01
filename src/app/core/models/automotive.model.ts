export type TireSeason = 'SUMMER' | 'WINTER' | 'ALL_SEASON';

export interface TireTreadDepth {
  frontLeft: number;
  frontRight: number;
  rearLeft: number;
  rearRight: number;
}

export interface TireRecord {
  id: string;
  customerName: string;
  vehiclePlate: string;
  vehicleModel: string;
  season: TireSeason;
  brandModel: string;
  dot: string;
  treadDepthMm: TireTreadDepth;
  hasRims: boolean;
  rimType: string;
  rackLocation: string;
  depositDate: string;
  status: string;
  reminderSent: boolean;
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
