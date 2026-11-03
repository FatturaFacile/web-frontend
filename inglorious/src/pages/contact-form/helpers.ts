import type { FormErrors } from "@inglorious/web/form"

import type { ContactFormValues } from "../../../types"
import type { ContactPayload, ContactResource } from "../../models/contact"

const DEFAULT_COUNTRY = "CH"
const DEFAULT_PAYMENT_TERMS_DAYS = "30"
const COUNTRY_CODE_LENGTH = 2
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function toFormValues(
  contact: ContactResource | null,
): ContactFormValues {
  const [firstAddress] = contact?.addresses ?? []
  const address = contact?.address ?? firstAddress ?? null
  return {
    type: contact?.type ?? "client",
    country: contact?.country ?? DEFAULT_COUNTRY,
    company_name: contact?.company_name ?? "",
    first_name: contact?.first_name ?? "",
    last_name: contact?.last_name ?? "",
    email: contact?.email ?? "",
    phone: contact?.phone ?? "",
    vat_number: contact?.vat_number ?? "",
    fiscal_code: contact?.fiscal_code ?? "",
    uid_number: contact?.uid_number ?? "",
    sdi_code: contact?.sdi_code ?? "",
    pec: contact?.pec ?? "",
    iban: contact?.iban ?? "",
    qr_iban: contact?.qr_iban ?? "",
    payment_terms_days: contact
      ? String(contact.payment_terms_days ?? "")
      : DEFAULT_PAYMENT_TERMS_DAYS,
    address: {
      street: address?.street ?? "",
      house_number: address?.house_number ?? "",
      postal_code: address?.postal_code ?? "",
      city: address?.city ?? "",
      state_canton: address?.state_canton ?? "",
    },
  }
}

export function toPayload(values: ContactFormValues): ContactPayload {
  const country = values.country.trim().toUpperCase()
  const { address } = values
  const hasAddress = Boolean(address.street.trim() && address.city.trim())
  const paymentTerms = values.payment_terms_days.trim()

  return {
    type: values.type,
    country,
    company_name: nullable(values.company_name),
    first_name: nullable(values.first_name),
    last_name: nullable(values.last_name),
    email: nullable(values.email),
    phone: nullable(values.phone),
    vat_number: nullable(values.vat_number),
    fiscal_code: nullable(values.fiscal_code),
    uid_number: nullable(values.uid_number),
    sdi_code: nullable(values.sdi_code),
    pec: nullable(values.pec),
    iban: nullable(values.iban),
    qr_iban: nullable(values.qr_iban),
    payment_terms_days: paymentTerms ? Number(paymentTerms) : null,
    address: hasAddress
      ? {
          street: address.street,
          house_number: nullable(address.house_number),
          postal_code: address.postal_code,
          city: address.city,
          state_canton: nullable(address.state_canton),
          country,
        }
      : null,
  }
}

/** Errors are translation keys; the rules are the Angular form's. */
export function validate(
  values: ContactFormValues,
): FormErrors<ContactFormValues> {
  const errors = blankErrors(values)
  const country = values.country.trim()

  if (!values.type) errors.type = "COMMON.VALIDATION.REQUIRED"
  if (!country) errors.country = "COMMON.VALIDATION.REQUIRED"
  else if (country.length !== COUNTRY_CODE_LENGTH) {
    errors.country = "COMMON.VALIDATION.INVALID_VALUE"
  }
  if (values.email && !EMAIL.test(values.email)) {
    errors.email = "COMMON.VALIDATION.INVALID_EMAIL"
  }
  if (values.pec && !EMAIL.test(values.pec)) {
    errors.pec = "COMMON.VALIDATION.INVALID_EMAIL"
  }

  return errors
}

function nullable(value: string): string | null {
  return value.trim() || null
}

function blankErrors(values: ContactFormValues): FormErrors<ContactFormValues> {
  const blank = (source: object): Record<string, unknown> =>
    Object.fromEntries(
      Object.entries(source).map(([key, value]) => [
        key,
        typeof value === "object" && value !== null ? blank(value) : null,
      ]),
    )
  return blank(values) as FormErrors<ContactFormValues>
}
