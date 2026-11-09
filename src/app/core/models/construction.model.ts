export interface ConstructionSite {
  id?: string;
  code: string;
  client: string;
  location: string;
  regime: 'CH' | 'IT' | string;
  sal?: string;
  norm?: string;
  vatRegime?: string;
  status?: 'active' | 'planned' | 'completed' | 'suspended';
}

export interface ConstructionSiteRequest {
  code: string;
  client: string;
  location: string;
  regime?: string;
}

export interface ConstructionProgressBillingPayload {
  construction_site_id: string;
  sal_number: string;
  period_start: string;
  period_end: string;
  gross_certified_amount: number;
  retention_percentage?: number;
}

export interface ConstructionProgressBilling {
  id: string;
  construction_site_id: string;
  sal_number: string;
  period_start: string;
  period_end: string;
  gross_certified_amount: number;
  retention_percentage: number;
  net_amount: number;
  status: 'draft' | 'certified' | 'invoiced';
}

// --- CONSTRUCTION TRADES MODELS ---
export type TradesBidStatus = 'draft' | 'submitted' | 'awarded' | 'rejected' | 'closed';

export interface TradesBid {
  id: string;
  site_id?: string | null;
  site_name?: string | null;
  code: string;
  title: string;
  client_name?: string | null;
  currency: string;
  total_amount: string;
  status: TradesBidStatus;
  created_at?: string;
  updated_at?: string;
  positions?: TradesBidPosition[];
}

export interface TradesBidRequest {
  site_id?: string;
  code: string;
  title: string;
  client_name?: string;
  currency: string;
  status?: TradesBidStatus;
}

export interface TradesBidPosition {
  id: string;
  bid_id: string;
  code?: string | null;
  description: string;
  unit: string;
  quantity: number;
  unit_price: string;
  subtotal: string;
}

export interface TradesBidPositionRequest {
  code?: string;
  description: string;
  unit: string;
  quantity: number;
  unit_price: string;
}

export interface TradesMeasurement {
  id: string;
  bid_id: string;
  position_id?: string | null;
  date: string;
  description: string;
  quantity: number;
  notes?: string | null;
}

export interface TradesMeasurementRequest {
  position_id?: string;
  date: string;
  description: string;
  quantity: number;
  notes?: string;
}

export interface TradesBilling {
  id: string;
  bid_id: string;
  sal_number: string;
  date: string;
  amount: string;
  retention_amount: string;
  net_payable: string;
  status: 'draft' | 'certified' | 'invoiced';
}

export interface TradesBillingRequest {
  sal_number: string;
  date: string;
  amount: string;
  retention_amount?: string;
}

export interface TradesSiteCost {
  id: string;
  bid_id: string;
  date: string;
  category: 'material' | 'labour' | 'sublet' | 'equipment' | 'other';
  description: string;
  amount: string;
}

export interface TradesSiteCostRequest {
  date: string;
  category: 'material' | 'labour' | 'sublet' | 'equipment' | 'other';
  description: string;
  amount: string;
}

export interface TradesBudgetControl {
  bid_id: string;
  planned_revenue: string;
  actual_revenue: string;
  planned_costs: string;
  actual_costs: string;
  margin_amount: string;
  margin_percentage: number;
}

export interface TradesPriceList {
  id: string;
  code: string;
  name: string;
  edition_year?: number | null;
  items_count?: number;
}

export interface TradesPriceListRequest {
  code: string;
  name: string;
  edition_year?: number;
}

export interface TradesSiteDiaryEntry {
  id: string;
  site_id: string;
  date: string;
  weather_condition: string;
  workers_count: number;
  equipment_notes?: string | null;
  work_performed: string;
  director_notes?: string | null;
}

export interface TradesSiteDiaryRequest {
  date: string;
  weather_condition: string;
  workers_count: number;
  equipment_notes?: string;
  work_performed: string;
  director_notes?: string;
}

export interface TradesSiteDocument {
  id: string;
  site_id: string;
  title: string;
  category: 'pos' | 'psc' | 'durc' | 'insurance' | 'compliance' | 'other';
  expires_at?: string | null;
  is_expired?: boolean;
}

export interface TradesSiteDocumentRequest {
  title: string;
  category: 'pos' | 'psc' | 'durc' | 'insurance' | 'compliance' | 'other';
  expires_at?: string;
}

export interface TradesSubcontractor {
  id: string;
  company_name: string;
  vat_number: string;
  contact_email?: string | null;
  phone?: string | null;
  qualification?: string | null;
}

export interface TradesSubcontractorRequest {
  company_name: string;
  vat_number: string;
  contact_email?: string;
  phone?: string;
  qualification?: string;
}

export interface TradesSubcontract {
  id: string;
  site_id: string;
  subcontractor_id: string;
  subcontractor_name?: string | null;
  scope_of_work: string;
  contract_amount: string;
  certified_amount?: string | null;
  status: 'active' | 'certified' | 'closed';
}

export interface TradesSubcontractRequest {
  subcontractor_id: string;
  scope_of_work: string;
  contract_amount: string;
}
