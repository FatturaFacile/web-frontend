/** Fleet management (company vehicles). Mirrors the API FormRequests of the Fleet module. */

export type FleetVehicleType = 'car' | 'van' | 'truck' | 'motorcycle' | 'bus' | 'trailer' | 'other';
export type FleetFuelType =
  | 'petrol'
  | 'diesel'
  | 'electric'
  | 'hybrid'
  | 'plugin_hybrid'
  | 'lpg'
  | 'cng'
  | 'hydrogen'
  | 'other';
export type FleetVehicleStatus = 'active' | 'maintenance' | 'sold' | 'disposed';
export type FleetOwnership = 'owned' | 'leased' | 'rented';
export type FleetEnergyUnit = 'liter' | 'kwh' | 'kg';
export type FleetServiceType = 'maintenance' | 'repair' | 'tyres' | 'inspection' | 'cleaning' | 'other';
export type FleetDeadlineType = 'road_tax' | 'insurance' | 'inspection' | 'other';
export type FleetDeadlineStatus = 'open' | 'renewed';
export type FleetIncidentKind = 'fine' | 'accident' | 'damage' | 'other';
export type FleetPaymentStatus = 'unpaid' | 'paid' | 'contested' | 'cancelled';

export const FLEET_VEHICLE_TYPES: readonly FleetVehicleType[] = ['car', 'van', 'truck', 'motorcycle', 'bus', 'trailer', 'other'];
export const FLEET_FUEL_TYPES: readonly FleetFuelType[] = [
  'petrol',
  'diesel',
  'electric',
  'hybrid',
  'plugin_hybrid',
  'lpg',
  'cng',
  'hydrogen',
  'other',
];
export const FLEET_VEHICLE_STATUSES: readonly FleetVehicleStatus[] = ['active', 'maintenance', 'sold', 'disposed'];
export const FLEET_OWNERSHIPS: readonly FleetOwnership[] = ['owned', 'leased', 'rented'];
export const FLEET_ENERGY_UNITS: readonly FleetEnergyUnit[] = ['liter', 'kwh', 'kg'];
export const FLEET_SERVICE_TYPES: readonly FleetServiceType[] = ['maintenance', 'repair', 'tyres', 'inspection', 'cleaning', 'other'];
export const FLEET_DEADLINE_TYPES: readonly FleetDeadlineType[] = ['road_tax', 'insurance', 'inspection', 'other'];
export const FLEET_INCIDENT_KINDS: readonly FleetIncidentKind[] = ['fine', 'accident', 'damage', 'other'];
export const FLEET_PAYMENT_STATUSES: readonly FleetPaymentStatus[] = ['unpaid', 'paid', 'contested', 'cancelled'];

/** The unit a fuel type is bought in: electric vehicles charge in kWh, combustion vehicles never do. */
export function fleetEnergyUnitsFor(fuelType: FleetFuelType): readonly FleetEnergyUnit[] {
  if (fuelType === 'electric') {
    return ['kwh'];
  }

  return ['petrol', 'diesel', 'lpg', 'cng', 'hydrogen'].includes(fuelType) ? ['liter', 'kg'] : FLEET_ENERGY_UNITS;
}

export interface FleetEmployeeRef {
  id: string;
  full_name: string;
}

export interface FleetVehicleRef {
  id: string;
  license_plate: string;
}

export interface FleetAssignment {
  id: string;
  vehicle_id: string;
  vehicle?: FleetVehicleRef;
  employee_id: string | null;
  employee?: FleetEmployeeRef | null;
  driver_label: string | null;
  starts_on: string;
  ends_on: string | null;
  start_odometer_km: number;
  end_odometer_km: number | null;
  is_open: boolean;
  notes: string | null;
}

export interface FleetAssignmentRequest {
  vehicle_id?: string;
  employee_id?: string | null;
  driver_label?: string | null;
  starts_on: string;
  ends_on?: string | null;
  start_odometer_km?: number;
  end_odometer_km?: number | null;
  notes?: string | null;
}

export interface FleetAssignmentEndRequest {
  ends_on: string;
  end_odometer_km: number;
}

export interface FleetVehicle {
  id: string;
  license_plate: string;
  vin: string | null;
  make: string;
  model: string;
  model_year: number | null;
  vehicle_type: FleetVehicleType;
  fuel_type: FleetFuelType;
  status: FleetVehicleStatus;
  initial_odometer_km: number;
  odometer_km: number;
  ownership: FleetOwnership;
  acquired_on: string | null;
  contract_ends_on: string | null;
  purchase_value: string | null;
  currency: string;
  asset_id: string | null;
  notes: string | null;
  current_assignment?: FleetAssignment | null;
}

export interface FleetVehicleRequest {
  license_plate: string;
  vin?: string | null;
  make: string;
  model: string;
  model_year?: number | null;
  vehicle_type?: FleetVehicleType;
  fuel_type?: FleetFuelType;
  status?: FleetVehicleStatus;
  odometer_km?: number;
  ownership?: FleetOwnership;
  acquired_on?: string | null;
  contract_ends_on?: string | null;
  purchase_value?: string | null;
  currency?: string;
  asset_id?: string | null;
  notes?: string | null;
}

export interface FleetVehicleFilters {
  status?: FleetVehicleStatus;
  vehicle_type?: FleetVehicleType;
  fuel_type?: FleetFuelType;
  ownership?: FleetOwnership;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface FleetFuelEntry {
  id: string;
  vehicle_id: string;
  vehicle?: FleetVehicleRef;
  employee_id: string | null;
  employee?: FleetEmployeeRef | null;
  entry_date: string;
  energy_unit: FleetEnergyUnit;
  quantity: string;
  unit_price: string | null;
  total_cost: string;
  currency: string;
  odometer_km: number;
  is_full_tank: boolean;
  station: string | null;
  distance_km: number | null;
  consumption_per_100km: string | null;
  cost_per_km: string | null;
  notes: string | null;
}

export interface FleetFuelEntryRequest {
  vehicle_id?: string;
  employee_id?: string | null;
  entry_date: string;
  energy_unit: FleetEnergyUnit;
  quantity: string;
  unit_price?: string | null;
  total_cost?: string | null;
  currency?: string;
  odometer_km: number;
  is_full_tank?: boolean;
  station?: string | null;
  notes?: string | null;
}

export interface FleetServiceRecord {
  id: string;
  vehicle_id: string;
  vehicle?: FleetVehicleRef;
  scheduled_service_id: string | null;
  service_type: FleetServiceType;
  service_date: string;
  odometer_km: number;
  vendor: string | null;
  description: string;
  reference: string | null;
  cost: string;
  currency: string;
  notes: string | null;
}

export interface FleetServiceRecordRequest {
  vehicle_id?: string;
  scheduled_service_id?: string | null;
  service_type?: FleetServiceType;
  service_date: string;
  odometer_km: number;
  vendor?: string | null;
  description: string;
  reference?: string | null;
  cost?: string;
  currency?: string;
  notes?: string | null;
}

export interface FleetScheduledService {
  id: string;
  vehicle_id: string;
  vehicle: (FleetVehicleRef & { odometer_km: number }) | null;
  name: string;
  service_type: FleetServiceType;
  interval_days: number | null;
  interval_km: number | null;
  last_service_on: string | null;
  last_service_km: number | null;
  next_due_on: string | null;
  next_due_km: number | null;
  is_active: boolean;
  days_to_due: number | null;
  km_to_due: number | null;
  is_overdue: boolean;
  notes: string | null;
}

export interface FleetScheduledServiceRequest {
  vehicle_id?: string;
  name: string;
  service_type?: FleetServiceType;
  interval_days?: number | null;
  interval_km?: number | null;
  last_service_on?: string | null;
  last_service_km?: number | null;
  next_due_on?: string | null;
  next_due_km?: number | null;
  is_active?: boolean;
  notes?: string | null;
}

export interface FleetDeadline {
  id: string;
  vehicle_id: string;
  vehicle?: FleetVehicleRef;
  deadline_type: FleetDeadlineType;
  provider: string | null;
  reference: string | null;
  expires_on: string;
  days_to_expiry: number;
  is_expired: boolean;
  cost: string;
  currency: string;
  status: FleetDeadlineStatus;
  renewed_at: string | null;
  notes: string | null;
}

export interface FleetDeadlineRequest {
  vehicle_id?: string;
  deadline_type: FleetDeadlineType;
  provider?: string | null;
  reference?: string | null;
  expires_on: string;
  cost?: string;
  currency?: string;
  notes?: string | null;
}

export interface FleetDeadlineRenewRequest {
  expires_on: string;
  cost?: string | null;
  provider?: string | null;
  reference?: string | null;
  notes?: string | null;
}

export interface FleetDeadlineFilters {
  vehicle_id?: string;
  deadline_type?: FleetDeadlineType;
  status?: FleetDeadlineStatus;
  /** Open deadlines expiring within that many days (expired ones included). */
  expiring?: number;
  expired?: boolean;
  page?: number;
  per_page?: number;
}

export interface FleetIncident {
  id: string;
  vehicle_id: string;
  vehicle?: FleetVehicleRef;
  employee_id: string | null;
  employee?: FleetEmployeeRef | null;
  kind: FleetIncidentKind;
  occurred_on: string;
  reference: string | null;
  description: string;
  location: string | null;
  amount: string;
  currency: string;
  payment_status: FleetPaymentStatus;
  due_on: string | null;
  paid_on: string | null;
  is_overdue: boolean;
  notes: string | null;
}

export interface FleetIncidentRequest {
  vehicle_id?: string;
  employee_id?: string | null;
  kind?: FleetIncidentKind;
  occurred_on: string;
  reference?: string | null;
  description: string;
  location?: string | null;
  amount?: string;
  currency?: string;
  payment_status?: FleetPaymentStatus;
  due_on?: string | null;
  paid_on?: string | null;
  notes?: string | null;
}

export interface FleetVehicleCosts {
  vehicle_id: string;
  license_plate: string;
  make: string;
  model: string;
  status: FleetVehicleStatus;
  odometer_km: number;
  distance_km: number;
  fuel_cost: string;
  service_cost: string;
  deadline_cost: string;
  incident_cost: string;
  running_cost: string;
  purchase_value: string | null;
  total_cost_of_ownership: string;
  cost_per_km: string | null;
  average_consumption_per_100km: string | null;
}

export interface FleetDashboard {
  vehicles: { total: number; by_status: Record<FleetVehicleStatus, number> };
  totals: {
    fuel_cost: string;
    service_cost: string;
    deadline_cost: string;
    incident_cost: string;
    running_cost: string;
    distance_km: number;
    cost_per_km: string | null;
  };
  per_vehicle: FleetVehicleCosts[];
  upcoming_deadlines: {
    id: string;
    vehicle_id: string;
    license_plate: string | null;
    deadline_type: FleetDeadlineType;
    expires_on: string;
    days_to_expiry: number;
    is_expired: boolean;
  }[];
  overdue_services: {
    id: string;
    vehicle_id: string;
    license_plate: string | null;
    name: string;
    days_to_due: number | null;
    km_to_due: number | null;
    is_overdue: boolean;
  }[];
  unpaid_incidents: { count: number; amount: string };
}

/** The API wraps every record or list in `data`; lists that paginate add the Laravel `meta`. */
export interface FleetResponse<T> {
  data: T;
  meta?: { current_page: number; last_page: number; per_page: number; total: number };
}
