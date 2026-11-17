export type QrBillLanguage = 'it' | 'de' | 'fr' | 'en';
export type QrBillMode = 'A4_ATTACHED' | 'STANDALONE';
export type QrBillPerforation = 'NONE' | 'DASHED_LINE' | 'DASHED_LINE_WITH_SCISSORS';
export type QrBillReferenceType = 'QRR' | 'SCOR' | 'NON';

export interface GenerateQrBillPdfPayload {
  invoice_id: string;
  mode?: QrBillMode;
  perforation?: QrBillPerforation;
  language?: QrBillLanguage;
}

export interface QrBillAddress {
  address_type: string | null;
  name: string | null;
  street: string | null;
  house_number: string | null;
  postal_code: string | null;
  city: string | null;
  country: string | null;
}

/** Draft values for a supplier invoice, derived from a decoded QR-bill. */
export interface QrBillSupplierDraft {
  supplier_name: string | null;
  supplier_iban: string;
  invoice_number: string | null;
  invoice_date: string | null;
  vat_number: string | null;
  total_amount: number | null;
  currency: string;
  payment_reference: string | null;
  payment_reference_type: QrBillReferenceType | string;
  notes: string | null;
}

export interface ParsedQrBill {
  payload: string;
  version: string;
  iban: string;
  is_qr_iban: boolean;
  creditor: QrBillAddress;
  amount: number | null;
  currency: string;
  debtor: QrBillAddress | null;
  reference_type: QrBillReferenceType | string;
  reference: string | null;
  message: string | null;
  billing_information: Record<string, string>;
  valid: boolean;
  errors: string[];
  draft: QrBillSupplierDraft;
}

export interface QrReferenceCheck {
  valid: boolean;
  reference_type: QrBillReferenceType;
  reference: string | null;
  formatted_reference: string | null;
  is_qr_iban: boolean;
  errors: string[];
  error_codes: string[];
}

export interface QrBillSettingsFields {
  qrr_prefix?: string | null;
  default_reference_type?: QrBillReferenceType | null;
  qr_bill_perforation?: QrBillPerforation | null;
}
