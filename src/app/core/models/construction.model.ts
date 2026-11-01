export interface ConstructionSite {
  id?: string;
  code: string;
  client: string;
  location: string;
  regime: 'CH' | 'IT' | string;
  sal: string;
  norm: string;
  vatRegime: string;
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
