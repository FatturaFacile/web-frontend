export type ContactType = "client" | "customer" | "supplier" | "both" | "lead"

export interface ContactAddress {
  street: string
  house_number?: string | null
  postal_code: string
  city: string
  state_canton?: string | null
  country: string
}

/** Contact (client/supplier) as exchanged with `/crm/contacts`. */
export interface ContactResource {
  id: string
  type: ContactType
  country: string
  company_name: string | null
  first_name: string | null
  last_name: string | null
  email: string | null
  phone: string | null
  vat_number: string | null
  fiscal_code: string | null
  uid_number: string | null
  sdi_code: string | null
  pec: string | null
  iban: string | null
  qr_iban: string | null
  payment_terms_days: number | null
  /** What `POST`/`PUT` take. */
  address?: ContactAddress | null
  /** What `GET` answers with instead of `address`. */
  addresses?: ContactAddress[]
}

/** Body of `POST`/`PUT /crm/contacts`. */
export type ContactPayload = Omit<ContactResource, "id" | "addresses">

export function contactDisplayName(contact: ContactResource): string {
  return (
    contact.company_name ||
    [contact.first_name, contact.last_name].filter(Boolean).join(" ") ||
    "-"
  )
}

export function contactTaxId(contact: ContactResource): string {
  return contact.vat_number || contact.fiscal_code || contact.uid_number || "-"
}
