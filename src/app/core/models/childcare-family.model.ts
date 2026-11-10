/** Family portal of the childcare module: the guardian is identified by a personal token, not by a user account. */

export interface FamilyChild {
  id: string;
  reference_code: string;
  first_name: string;
  last_name: string;
}

export interface FamilyAttendanceDay {
  date: string;
  status: string;
  absence_reason: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
}

export interface FamilyDailyReportNote {
  category: string;
  body: string;
}

export interface FamilyDailyReport {
  child_id: string;
  date: string;
  status: string | null;
  check_in_at: string | null;
  check_out_at: string | null;
  picked_up_by: string | null;
  meals: string | string[];
  notes: FamilyDailyReportNote[];
}

export interface FamilyInvoice {
  id: string;
  invoice_number: string;
  date: string;
  currency: string;
  /** Decimal string. */
  total_gross: string;
  payment_status: string;
}

export interface FamilyDocument {
  id: string;
  child_id: string;
  title: string;
  status: string;
  has_file: boolean;
  signed_at: string | null;
}

export interface FamilyDocumentSignRequest {
  /** Between 3 and 150 characters. */
  signed_name: string;
  accept: true;
}

export interface FamilyDocumentSigned {
  id: string;
  status: string;
  signed_at: string | null;
}

export interface FamilyMessage {
  id: string;
  child_id: string;
  direction: string;
  body: string;
  created_at: string | null;
}

export interface FamilyMessageRequest {
  child_id: string;
  /** At most 5000 characters. */
  body: string;
}

export interface FamilyData<T> {
  data: T;
}
