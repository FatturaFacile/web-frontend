import { ApiResponse } from './api.models';

export type ConstructionSiteStatus = 'planning' | 'active' | 'paused' | 'completed';

export interface ConstructionSite {
  id: string;
  code: string;
  name: string;
  address: string;
  client_id: string;
  sia_norm_reference?: string | null;
  npk_code?: string | null;
  start_date?: string | null;
  estimated_end_date?: string | null;
  status?: ConstructionSiteStatus;
}

/** Body of `POST /construction/sites` (SaveConstructionSiteRequest). */
export interface ConstructionSiteRequest {
  client_id: string;
  code: string;
  name: string;
  address: string;
  sia_norm_reference?: string | null;
  npk_code?: string | null;
  start_date?: string | null;
  estimated_end_date?: string | null;
  status?: ConstructionSiteStatus;
}

/** Body of `POST /construction/sal` (StoreSalRequest). */
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
export type TradesBidStatus = 'draft' | 'submitted' | 'accepted' | 'rejected';
export type TradesLanguage = 'de' | 'fr' | 'it' | 'en';

export interface TradesBid {
  id: string;
  bid_number: string;
  construction_site_id?: string | null;
  contact_id: string;
  title: string;
  language: TradesLanguage;
  currency: string;
  tax_rate: string;
  valid_until?: string | null;
  notes?: string | null;
  status: TradesBidStatus;
  created_at?: string;
  updated_at?: string;
  positions?: TradesBidPosition[];
}

/** Bid with the net total the API returns beside it (`meta.net_total`). */
export type TradesBidResponse = ApiResponse<TradesBid> & { meta?: { net_total?: string } };

/** Body of `POST /construction-trades/bids` (SaveBidRequest). */
export interface TradesBidRequest {
  construction_site_id?: string | null;
  contact_id: string;
  title: string;
  language: TradesLanguage;
  currency: string;
  tax_rate: string;
  valid_until?: string | null;
  notes?: string | null;
}

export interface TradesBidPosition {
  id: string;
  bid_id: string;
  position_code: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
  total: string;
}

/** Body of `POST /construction-trades/bids/{id}/positions` (StorePositionRequest). */
export interface TradesBidPositionRequest {
  position_code: string;
  description: string;
  unit: string;
  quantity: string;
  unit_price: string;
}

export interface TradesMeasurement {
  id: string;
  bid_id: string;
  bid_position_id: string;
  measured_on: string;
  quantity: string;
  note?: string | null;
}

/** Body of `POST /construction-trades/bids/{id}/measurements`. */
export interface TradesMeasurementRequest {
  bid_position_id: string;
  measured_on: string;
  quantity: string;
  note?: string | null;
}

export type TradesBillingKind = 'partial' | 'final';
export type TradesBillingBasis = 'percentage' | 'measured';

export interface TradesBilling {
  id: string;
  bid_id: string;
  kind: TradesBillingKind;
  basis?: TradesBillingBasis | null;
  sequence: number;
  billing_date: string;
  percentage?: string | null;
  gross_this: string;
  retention_amount: string;
  amount_invoiced: string;
}

/** Body of `POST /construction-trades/bids/{id}/billings`. */
export interface TradesBillingRequest {
  kind: TradesBillingKind;
  basis?: TradesBillingBasis | null;
  percentage?: string | null;
  date: string;
}

export type TradesCostType = 'labour' | 'material' | 'machine' | 'other';

export interface TradesSiteCost {
  id: string;
  bid_id: string;
  cost_date: string;
  cost_type: TradesCostType;
  description: string;
  amount: string;
}

/** Body of `POST /construction-trades/bids/{id}/site-costs`. */
export interface TradesSiteCostRequest {
  bid_position_id?: string | null;
  cost_type: TradesCostType;
  cost_date: string;
  worker_user_id?: string | null;
  description: string;
  quantity: string;
  unit_cost: string;
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
  name: string;
  source?: string;
  edition?: string | null;
  currency?: string;
  items_count?: number;
}

/** Body of `POST /construction-trades/price-lists` (SavePriceListRequest). */
export interface TradesPriceListRequest {
  name: string;
  source: 'own' | 'npk' | 'crb' | 'asip' | 'other';
  edition?: string | null;
  license_reference?: string | null;
  currency: string;
  languages: TradesLanguage[];
  valid_from?: string | null;
  valid_to?: string | null;
  is_active?: boolean;
}

export interface TradesSiteDiaryEntry {
  id: string;
  construction_site_id: string;
  entry_date: string;
  weather?: string | null;
  workers_present: number;
  work_performed: string;
  incidents?: string | null;
}

/** Body of `POST /construction-trades/sites/{id}/diary`. */
export interface TradesSiteDiaryRequest {
  entry_date: string;
  weather?: string | null;
  workers_present: number;
  work_performed: string;
  incidents?: string | null;
}

export type TradesDocumentKind =
  | 'safety_plan'
  | 'risk_assessment'
  | 'insurance'
  | 'compliance_certificate'
  | 'training_certificate'
  | 'permit'
  | 'other';

export interface TradesSiteDocument {
  id: string;
  construction_site_id: string;
  title: string;
  kind: TradesDocumentKind;
  issued_on?: string | null;
  expires_on?: string | null;
}

/** Body of `POST /construction-trades/sites/{id}/documents`. */
export interface TradesSiteDocumentRequest {
  kind: TradesDocumentKind;
  title: string;
  subcontractor_id?: string | null;
  issued_on?: string | null;
  expires_on?: string | null;
  notes?: string | null;
}

export type TradesSubcontractorStatus = 'active' | 'suspended';

export interface TradesSubcontractor {
  id: string;
  name: string;
  contact_id?: string | null;
  tax_id?: string | null;
  trade?: string | null;
  status?: TradesSubcontractorStatus;
  notes?: string | null;
}

/** Body of `POST /construction-trades/subcontractors` (SiteManagementRequest). */
export interface TradesSubcontractorRequest {
  name: string;
  contact_id?: string | null;
  tax_id?: string | null;
  trade?: string | null;
  status?: TradesSubcontractorStatus;
  notes?: string | null;
}

export interface TradesSubcontract {
  id: string;
  construction_site_id: string;
  subcontractor_id: string;
  bid_id?: string | null;
  description: string;
  contract_amount: string;
  starts_on?: string | null;
  ends_on?: string | null;
  status: 'active' | 'completed' | 'cancelled';
}

/** Body of `POST /construction-trades/sites/{id}/subcontracts`. */
export interface TradesSubcontractRequest {
  subcontractor_id: string;
  bid_id?: string | null;
  description: string;
  contract_amount: string;
  starts_on?: string | null;
  ends_on?: string | null;
}

/** Body of `POST /construction-trades/subcontracts/{id}/certifications`. */
export interface TradesSubcontractCertificationRequest {
  certified_on: string;
  amount: string;
  description: string;
}
