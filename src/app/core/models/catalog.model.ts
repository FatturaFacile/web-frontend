/** Catalog master data: payment terms, brands, categories, units of measure. */

export type SdiTermsCode = 'TP01' | 'TP02' | 'TP03';

export interface PaymentTermInstallment {
  days?: number | null;
  percentage?: number | string | null;
  [key: string]: unknown;
}

export interface PaymentTerm {
  id: string;
  code: string;
  name: string;
  days?: number | null;
  end_of_month?: boolean | null;
  discount_percent?: string | null;
  discount_days?: number | null;
  sdi_terms_code?: SdiTermsCode | null;
  installments?: PaymentTermInstallment[] | null;
}

export interface PaymentTermPayload {
  code: string;
  name: string;
  days?: number | null;
  end_of_month?: boolean | null;
  discount_percent?: number | string | null;
  discount_days?: number | null;
  sdi_terms_code?: SdiTermsCode | null;
  installments?: PaymentTermInstallment[] | null;
}

export interface PaymentTermScheduleParams {
  amount: number | string;
  date?: string | null;
}

export type PaymentTermSchedule = Record<string, unknown>;

export interface ProductBrand {
  id: string;
  name: string;
}

export interface ProductCategory {
  id: string;
  name: string;
  parent_id?: string | null;
}

export interface ProductCategoryPayload {
  name: string;
  parent_id?: string | null;
}

export interface UnitOfMeasure {
  id: string;
  code: string;
  name: string;
}

export interface UnitOfMeasurePayload {
  code: string;
  name: string;
}
