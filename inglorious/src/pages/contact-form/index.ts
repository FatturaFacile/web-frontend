import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Drawer } from "@inglorious/ui/drawer"
import { Input, type InputProps } from "@inglorious/ui/input"
import { Select } from "@inglorious/ui/select"
import { html, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { getFieldValue } from "@inglorious/web/form"

import type {
  AppApi,
  ContactFormEntity,
  ContactFormValues,
} from "../../../types"
import { createContact, updateContact } from "../../api/contacts"
import { fieldError } from "../../forms/field-error"
import { t } from "../../i18n"
import type { ContactPayload, ContactResource } from "../../models/contact"
import { createResourceForm } from "../../types/resource-form"
import { TYPE_OPTIONS } from "../contacts-grid"
import { toFormValues, toPayload, validate } from "./helpers"

interface Field {
  path: string
  label: string
  inputType?: InputProps["inputType"]
  isRequired?: boolean
}

const IDENTITY_FIELDS: Field[] = [
  { path: "company_name", label: "CRM.CLIENTS.FORM.COMPANY_NAME" },
  { path: "first_name", label: "CRM.CLIENTS.FORM.FIRST_NAME" },
  { path: "last_name", label: "CRM.CLIENTS.FORM.LAST_NAME" },
  { path: "email", label: "CRM.CLIENTS.FORM.EMAIL", inputType: "email" },
  { path: "phone", label: "CRM.CLIENTS.FORM.PHONE", inputType: "tel" },
  { path: "vat_number", label: "CRM.CLIENTS.FORM.VAT_NUMBER" },
  { path: "fiscal_code", label: "CRM.CLIENTS.FORM.FISCAL_CODE" },
  { path: "uid_number", label: "CRM.CLIENTS.FORM.UID" },
  { path: "sdi_code", label: "CRM.CLIENTS.FORM.SDI_CODE" },
  { path: "pec", label: "CRM.CLIENTS.FORM.PEC", inputType: "email" },
  { path: "iban", label: "CRM.CLIENTS.FORM.IBAN" },
  { path: "qr_iban", label: "CRM.CLIENTS.FORM.QR_IBAN" },
  {
    path: "payment_terms_days",
    label: "CRM.CLIENTS.FORM.PAYMENT_TERMS",
    inputType: "number",
  },
]

const ADDRESS_FIELDS: Field[] = [
  { path: "address.street", label: "CRM.CLIENTS.FORM.STREET" },
  { path: "address.house_number", label: "CRM.CLIENTS.FORM.HOUSE_NUMBER" },
  { path: "address.postal_code", label: "CRM.CLIENTS.FORM.POSTAL_CODE" },
  { path: "address.city", label: "CRM.CLIENTS.FORM.CITY" },
  { path: "address.state_canton", label: "CRM.CLIENTS.FORM.STATE" },
]

const COUNTRY_FIELD: Field = {
  path: "country",
  label: "CRM.CLIENTS.FORM.COUNTRY",
  isRequired: true,
}

export const ContactForm = [
  ...createResourceForm({
    toValues: (contact: ContactResource | null) => toFormValues(contact),
    validate,
    toPayload: (values: ContactFormValues) => toPayload(values),
    save: (id: string | null, payload: ContactPayload) =>
      id ? updateContact(id, payload) : createContact(payload),
    createdKey: "CRM.CLIENTS.MESSAGES.CREATED",
    updatedKey: "CRM.CLIENTS.MESSAGES.UPDATED",
  }),
  {
    render(entity: ContactFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      const close = () => api.notify(`#${id}:close`)

      return Drawer.render({
        id: `${id}-drawer`,
        variant: "temporary",
        anchor: "right",
        isOpen: entity.isOpen,
        title: t(
          entity.editingId ? "CRM.CLIENTS.EDIT_TITLE" : "CRM.CLIENTS.NEW",
        ),
        closeLabel: t("COMMON.CLOSE"),
        className: "ff-form-drawer",
        onClose: close,
        children: html`<form
          class="ff-form"
          novalidate
          @submit=${(event: SubmitEvent) => {
            event.preventDefault()
            api.notify(`#${id}:submit`)
          }}
        >
          ${when(entity.failure, () =>
            Alert.render({
              severity: "error",
              description: t(entity.failure!),
            }),
          )}
          ${Select.render({
            id: `${id}-type`,
            label: t("CRM.CLIENTS.FORM.TYPE"),
            isRequired: true,
            isFullWidth: true,
            value: entity.values.type,
            error: fieldError(entity, "type"),
            options: TYPE_OPTIONS.map(({ value, label }) => ({
              value,
              label: t(label),
            })),
            onChange: (value) =>
              api.notify(`#${id}:fieldChange`, { path: "type", value }),
          })}
          ${IDENTITY_FIELDS.map((field) => renderField(entity, api, field))}
          <fieldset class="ff-fieldset">
            <legend>${t("CRM.CLIENTS.FORM.ADDRESS")}</legend>
            ${ADDRESS_FIELDS.map((field) => renderField(entity, api, field))}
          </fieldset>
          ${renderField(entity, api, COUNTRY_FIELD)}
          <div class="ff-form-actions">
            ${Button.render({ children: t("COMMON.CANCEL"), onClick: close })}
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              isDisabled: entity.isSubmitting,
              children: t(entity.isSubmitting ? "APP.LOADING" : "COMMON.SAVE"),
            })}
          </div>
        </form>`,
      })
    },
  },
]

function renderField(
  entity: ContactFormEntity,
  api: AppApi,
  { path, label, inputType = "text", isRequired = false }: Field,
): TemplateResult {
  return Input.render({
    id: `${entity.id}-${path.replace(".", "-")}`,
    label: t(label),
    inputType,
    isRequired,
    isFullWidth: true,
    value: String(getFieldValue(entity, path) ?? ""),
    error: fieldError(entity, path),
    onChange: (value) =>
      api.notify(`#${entity.id}:fieldChange`, { path, value }),
  })
}
