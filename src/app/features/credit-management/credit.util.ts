import { ContactResource, CrmApiService, SettingsApiService } from '@core';
import { catchError, map, Observable, of } from 'rxjs';

export { apiErrorText, blankToNull, decimalOrNull, todayIso } from '../fleet/fleet.util';

export interface CreditCustomerOption {
  id: string;
  name: string;
}

/** Display name of a CRM contact. */
export function contactName(contact: ContactResource): string {
  return contact.company_name || [contact.first_name, contact.last_name].filter(Boolean).join(' ') || contact.id;
}

/** Customers to pick from; members without access to the CRM module get an empty list. */
export function loadCustomers(crm: CrmApiService): Observable<CreditCustomerOption[]> {
  return crm.getClients({ per_page: 100 }).pipe(
    map((response) => response.data.map((contact) => ({ id: contact.id, name: contactName(contact) }))),
    catchError(() => of([])),
  );
}

export interface CreditCollectorOption {
  id: string;
  name: string;
}

/** Members of the company a case can be assigned to; members who cannot list the users get an empty list. */
export function loadCollectors(settings: SettingsApiService): Observable<CreditCollectorOption[]> {
  return settings.getTenantUsers().pipe(
    map((response) => response.data.map((user) => ({ id: user.id, name: user.name }))),
    catchError(() => of([])),
  );
}

/** Colours of the status tags of every credit management status. */
export const CREDIT_STATUS_COLORS: Readonly<Record<string, string>> = {
  open: 'blue',
  in_dunning: 'geekblue',
  promised: 'orange',
  disputed: 'red',
  escalated: 'volcano',
  resolved: 'green',
  written_off: 'default',
  pending: 'orange',
  approved: 'green',
  rejected: 'red',
  cancelled: 'default',
  active: 'green',
  requested: 'orange',
  granted: 'green',
  refused: 'red',
  withdrawn: 'default',
  kept: 'green',
  broken: 'red',
  under_review: 'orange',
  upheld: 'green',
  low: 'green',
  medium: 'gold',
  high: 'orange',
  critical: 'red',
  normal: 'blue',
};

export function statusColor(status: string): string {
  return CREDIT_STATUS_COLORS[status] ?? 'default';
}
