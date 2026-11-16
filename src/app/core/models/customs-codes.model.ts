import { PaginatedResponse, QueryFilterParams } from './api.models';

/** Locales the localized catalog texts are stored in. */
export type CatalogLocale = 'it' | 'de' | 'fr' | 'en';

/** Text per locale (any locale may be missing or null). */
export type LocalizedText = Partial<Record<CatalogLocale, string | null>>;

/** HS (6 digits), CN (8 digits) or TARIC (10 digits) level of a customs code. */
export type TaricCodeLevel = 'HS6' | 'CN8' | 'TARIC10';

/** Preferential or non-preferential origin of a product. */
export type CustomsOriginType = 'preferential' | 'non_preferential';

/** Item of `GET /catalog/customs-taric-codes`. */
export interface CustomsTaricCode {
  id: string;
  code: string;
  level: TaricCodeLevel;
  chapter: string;
  description: LocalizedText;
  supplementary_unit: string | null;
  duty_rate_notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Query of `GET /catalog/customs-taric-codes` (`search` matches the code prefix or a localized description). */
export interface CustomsTaricCodeParams extends QueryFilterParams {
  level?: TaricCodeLevel;
  is_active?: boolean;
}

/** Body of `POST` / `PUT /catalog/customs-taric-codes` (level and chapter are derived by the server). */
export interface CustomsTaricCodePayload {
  code: string;
  description: LocalizedText;
  supplementary_unit?: string | null;
  duty_rate_notes?: string | null;
  is_active?: boolean;
}

/** Item of `GET /catalog/free-trade-agreements`. */
export interface FreeTradeAgreement {
  id: string;
  code: string;
  name: LocalizedText;
  /** Uppercase ISO 3166-1 alpha-2 codes. */
  partner_countries: string[];
  value_threshold_eur: number | null;
  value_threshold_chf: number | null;
  proof_types: string[];
  supports_approved_exporter: boolean;
  supports_rex: boolean;
  declaration_templates: LocalizedText;
  declaration_templates_no_auth: LocalizedText;
  notes: string | null;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

/** Query of `GET /catalog/free-trade-agreements`. */
export interface FreeTradeAgreementParams extends QueryFilterParams {
  is_active?: boolean;
}

/** Body of `POST` / `PUT /catalog/free-trade-agreements` (at least two partner countries). */
export interface FreeTradeAgreementPayload {
  code: string;
  name: LocalizedText;
  partner_countries: string[];
  value_threshold_eur?: number | null;
  value_threshold_chf?: number | null;
  proof_types: string[];
  supports_approved_exporter?: boolean;
  supports_rex?: boolean;
  declaration_templates: LocalizedText;
  declaration_templates_no_auth: LocalizedText;
  notes?: string | null;
  is_active?: boolean;
}

/** Body of `POST /sales/invoices/{id}/evaluate-customs-origin`; `apply=false` is a preview, `apply=true` persists. */
export interface EvaluateCustomsOriginPayload {
  locale?: CatalogLocale;
  customs_auth_number?: string | null;
  apply?: boolean;
}

/** `data` of `POST /sales/invoices/{id}/evaluate-customs-origin`. */
export interface CustomsOriginEvaluation {
  exporter_country: string;
  importer_country: string;
  free_trade_agreement_id: string | null;
  free_trade_agreement_code: string | null;
  preferential_value: number;
  threshold: number | null;
  threshold_currency: string;
  above_threshold: boolean;
  authorization_number: string | null;
  authorization_type: 'rex' | 'approved_exporter' | null;
  declaration_allowed: boolean;
  duty_exemption_eligible: boolean;
  locale: string;
  declaration_text: string | null;
  applied: boolean;
}

export type CustomsTaricCodePage = PaginatedResponse<CustomsTaricCode>;
export type FreeTradeAgreementPage = PaginatedResponse<FreeTradeAgreement>;
