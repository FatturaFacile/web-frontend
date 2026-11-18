import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';

export const INCOTERMS_2020 = ['EXW', 'FCA', 'CPT', 'CIP', 'DAP', 'DPU', 'DDP', 'FAS', 'FOB', 'CFR', 'CIF'] as const;
export type Incoterm = (typeof INCOTERMS_2020)[number];

export interface CustomsValueRequest {
  incoterm: Incoterm;
  goods_value: number;
  freight?: number | null;
  insurance?: number | null;
}

export interface CustomsValueResult {
  incoterm: Incoterm;
  goods_value: number;
  freight_added: number;
  insurance_added: number;
  customs_value: number;
  statistical_value: number;
}

export interface CrossBorderIssue {
  code: 'incoterm_missing' | 'incoterm_invalid' | 'hs_code_missing' | 'origin_country_missing' | 'net_weight_missing';
  line: number | null;
}

export interface CrossBorderReadiness {
  cross_border: boolean;
  ready: boolean;
  regime: {
    regime: string;
    vat_exempt: boolean;
    reverse_charge: boolean;
    requires_vies: boolean;
    requires_intrastat: boolean;
    requires_customs_declaration: boolean;
  } | null;
  issues: CrossBorderIssue[];
}

/** Foreign trade glue: customs value by Incoterm and the cross-border readiness of an invoice. */
@Service()
export class ForeignTradeApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  calculateCustomsValue(payload: CustomsValueRequest): Observable<ApiResponse<CustomsValueResult>> {
    return this.http.post<ApiResponse<CustomsValueResult>>(`${this.base}/foreign-trade/customs-value`, payload);
  }

  getInvoiceReadiness(invoiceId: string): Observable<ApiResponse<CrossBorderReadiness>> {
    return this.http.get<ApiResponse<CrossBorderReadiness>>(
      `${this.base}/sales/invoices/${invoiceId}/cross-border-readiness`,
    );
  }
}

/** The customs tab of a document is highlighted when the counterparty country differs from the tenant country. */
export function isCrossBorder(tenantCountry: string | null | undefined, counterpartyCountry: string | null | undefined): boolean {
  const a = (tenantCountry ?? '').trim().toUpperCase();
  const b = (counterpartyCountry ?? '').trim().toUpperCase();
  return a !== '' && b !== '' && a !== b;
}
