import { QueryFilterParams } from './api.models';

export type ContactType = 'client' | 'customer' | 'supplier' | 'both' | 'lead';

/** A contact is a company (company name required) or a person (last name required). */
export type ContactLegalType = 'company' | 'person';

export interface ContactAddress {
  street: string;
  house_number?: string | null;
  postal_code: string;
  city: string;
  state_canton?: string | null;
  country: string;
}

/** Contact (client/supplier) as exchanged with `/crm/contacts`. */
export interface ContactResource {
  id: string;
  type: ContactType;
  legal_type?: ContactLegalType | null;
  country: string;
  company_name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  phone: string | null;
  vat_number: string | null;
  fiscal_code: string | null;
  uid_number: string | null;
  sdi_code: string | null;
  pec: string | null;
  iban: string | null;
  qr_iban: string | null;
  payment_terms_days: number | null;
  /** Billing address sent on save. */
  address?: ContactAddress | null;
  /** Addresses of the contact as returned by the API (the billing one is `type: 'billing'`). */
  addresses?: (ContactAddress & { id?: string; type?: string })[];
}

/** Body of `POST`/`PUT /crm/contacts`. */
export type ContactPayload = Omit<ContactResource, 'id' | 'addresses'>;
export type CreateContactPayload = ContactPayload;
export type UpdateContactPayload = Partial<ContactPayload>;

export interface ContactFilterParams extends QueryFilterParams {
  type?: ContactType;
  country?: string;
}

/** The billing address of a contact, whichever way the API delivered it. */
export function contactBillingAddress(c: ContactResource): ContactAddress | null {
  return c.address ?? c.addresses?.find((a) => a.type === 'billing') ?? c.addresses?.[0] ?? null;
}

export function contactDisplayName(c: ContactResource): string {
  return c.company_name || [c.first_name, c.last_name].filter(Boolean).join(' ') || '-';
}
