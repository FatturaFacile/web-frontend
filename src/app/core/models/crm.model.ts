import { ContactResource } from './client.model';

export interface ContactStatistics {
  total_invoices: number;
  total_revenue: number;
  open_balance: number;
  overdue_balance: number;
  currency?: string;
}

export interface ContactStatementEntry {
  id: string;
  date: string;
  doc_number: string;
  doc_type: string;
  amount: number;
  balance: number;
  due_date: string;
  status: string;
}

export interface ContactStatement {
  contact: ContactResource;
  as_of: string;
  currency: string;
  total_open: number;
  entries: ContactStatementEntry[];
}
