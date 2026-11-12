export type WorkshopFolderKind = 'mechanics' | 'bodywork' | 'tyres' | 'inspection' | 'other';

export type WorkshopFolderStatus = 'draft' | 'open' | 'in_progress' | 'completed' | 'delivered' | 'cancelled';

export type WorkshopLineType = 'labour' | 'part' | 'paint' | 'sublet' | 'other';

export interface WorkshopFolderLine {
  id: string;
  workshop_folder_id: string;
  line_type: WorkshopLineType;
  product_id?: string | null;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
  subtotal: string;
}

export interface WorkshopFolder {
  id: string;
  folder_number: string;
  vehicle_id: string;
  license_plate?: string | null;
  vin?: string | null;
  vehicle_model?: string | null;
  contact_id?: string | null;
  customer_name?: string | null;
  kind: WorkshopFolderKind;
  status: WorkshopFolderStatus;
  mileage_in?: number | null;
  mileage_out?: number | null;
  received_at?: string | null;
  promised_at?: string | null;
  complaint?: string | null;
  diagnosis?: string | null;
  currency: string;
  total_labour: string;
  total_parts: string;
  total_net: string;
  total_gross: string;
  lines?: WorkshopFolderLine[];
  created_at?: string;
  updated_at?: string;
}

export interface WorkshopFolderRequest {
  vehicle_id: string;
  contact_id?: string;
  kind: WorkshopFolderKind;
  currency: string;
  received_at?: string;
  promised_at?: string;
  mileage_in?: number;
  complaint?: string;
}

export interface WorkshopFolderLineRequest {
  line_type: WorkshopLineType;
  product_id?: string;
  description: string;
  quantity: number;
  unit_price: string;
  tax_rate: string;
}

export interface WorkshopFolderActionRequest {
  status?: WorkshopFolderStatus;
  mileage_out?: number;
  valid_until?: string;
}

export interface WorkshopTimeEntry {
  id: string;
  workshop_folder_id: string;
  folder_number?: string;
  technician_user_id: string;
  technician_name?: string | null;
  started_at: string;
  stopped_at?: string | null;
  minutes: number;
  hourly_rate?: string | null;
  is_billed: boolean;
  notes?: string | null;
}

export interface WorkshopTimeStartRequest {
  technician_user_id?: string;
  notes?: string;
}

export interface WorkshopTimeEntryRequest {
  technician_user_id: string;
  started_at: string;
  minutes: number;
  notes?: string;
}

export interface WorkshopTimeBillRequest {
  hourly_rate: string;
  tax_rate: string;
  description?: string;
}

export interface WorkshopVehicleStockUnit {
  id: string;
  stock_number: string;
  condition: 'new' | 'used';
  make: string;
  model: string;
  vin?: string | null;
  year?: number | null;
  mileage_km?: number | null;
  purchase_price?: string | null;
  list_price: string;
  currency: string;
  status: 'in_stock' | 'reserved' | 'sold';
  sold_at?: string | null;
  buyer_name?: string | null;
  created_at?: string;
}

export interface WorkshopStockUnitRequest {
  stock_number: string;
  condition: 'new' | 'used';
  make: string;
  model: string;
  vin?: string;
  year?: number;
  mileage_km?: number;
  purchase_price?: string;
  list_price: string;
  currency: string;
}

export interface WorkshopSellRequest {
  buyer_contact_id: string;
  sale_date: string;
  sale_price: string;
  tax_rate: string;
}

export type WorkshopRecurringServiceType = 'tyre_storage' | 'maintenance_plan' | 'other';

export type WorkshopRecurringInterval = 'monthly' | 'quarterly' | 'semiannual' | 'yearly';

export interface WorkshopRecurringService {
  id: string;
  vehicle_id: string;
  license_plate?: string | null;
  service_type: string;
  name: string;
  interval: string;
  start_date: string;
  next_due_date?: string | null;
  unit_price: string;
  currency: string;
  is_active: boolean;
}

export interface WorkshopRecurringServiceRequest {
  vehicle_id: string;
  service_type: WorkshopRecurringServiceType;
  name: string;
  interval: WorkshopRecurringInterval;
  start_date: string;
  currency: string;
  unit_price: string;
  tax_rate: string;
}

export interface WorkshopVehicleHistoryEntry {
  id: string;
  folder_number: string;
  kind: string;
  status: string;
  mileage_in?: number | null;
  total_gross: string;
  completed_at?: string | null;
  summary?: string | null;
}

export interface WorkshopFolderParams {
  status?: WorkshopFolderStatus;
  vehicle_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface WorkshopStockParams {
  condition?: 'new' | 'used';
  status?: 'in_stock' | 'reserved' | 'sold';
  search?: string;
  page?: number;
  per_page?: number;
}
