import { describe, expect, it } from "vitest"

import { hasErrors } from "../../forms/validation"
import type { ContactResource } from "../../models/contact"
import { toFormValues, toPayload, validate } from "./helpers"

const contact: ContactResource = {
  id: "c1",
  type: "supplier",
  country: "IT",
  company_name: "Rossi Impianti S.r.l.",
  first_name: null,
  last_name: null,
  email: "info@rossi.it",
  phone: null,
  vat_number: "IT12345678901",
  fiscal_code: null,
  uid_number: null,
  sdi_code: "M5UXCR1",
  pec: null,
  iban: null,
  qr_iban: null,
  payment_terms_days: 60,
  address: {
    street: "Via Manzoni",
    house_number: "45",
    postal_code: "20121",
    city: "Milano",
    state_canton: null,
    country: "IT",
  },
}

describe("contact form helpers", () => {
  it("starts a new contact with the Angular defaults", () => {
    const values = toFormValues(null)
    expect(values.type).toBe("client")
    expect(values.country).toBe("CH")
    expect(values.payment_terms_days).toBe("30")
  })

  it("round-trips a contact through the form", () => {
    const payload: Partial<ContactResource> = { ...contact }
    delete payload.id
    expect(toPayload(toFormValues(contact))).toEqual(payload)
  })

  it("leaves the address out without a street and a city", () => {
    const values = toFormValues(contact)
    values.address.city = " "
    expect(toPayload(values).address).toBeNull()
  })

  it("upper-cases the country and empties blank fields", () => {
    const values = { ...toFormValues(null), country: "ch", phone: "  " }
    const payload = toPayload(values)
    expect(payload.country).toBe("CH")
    expect(payload.phone).toBeNull()
  })

  it("validates country and e-mail addresses", () => {
    const errors = validate({
      ...toFormValues(null),
      country: "CHE",
      email: "nope",
      pec: "ok@pec.it",
    })

    expect(errors.country).toBe("COMMON.VALIDATION.INVALID_VALUE")
    expect(errors.email).toBe("COMMON.VALIDATION.INVALID_EMAIL")
    expect(errors.pec).toBeNull()
    expect(errors.address).toEqual({
      street: null,
      house_number: null,
      postal_code: null,
      city: null,
      state_canton: null,
    })
    expect(hasErrors(errors)).toBe(true)
    expect(hasErrors(validate(toFormValues(contact)))).toBe(false)
  })
})
