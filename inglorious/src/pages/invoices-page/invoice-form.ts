import plusIcon from "@iconify-icons/fa7-solid/plus"
import trashIcon from "@iconify-icons/fa7-solid/trash"
import type { Message } from "@inglorious/i18n"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Combobox, type ComboboxOption } from "@inglorious/ui/combobox"
import { Drawer } from "@inglorious/ui/drawer"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Input, type InputProps } from "@inglorious/ui/input"
import { Select } from "@inglorious/ui/select"
import { Textarea } from "@inglorious/ui/textarea"
import { html, type TemplateResult } from "@inglorious/web"
import { withDebounce } from "@inglorious/web/decorators/with-debounce"
import { when } from "@inglorious/web/directives/when"
import { Form } from "@inglorious/web/form"

import type {
  AppApi,
  ContactPickerEntity,
  InvoiceFormEntity,
  InvoiceFormValues,
  InvoiceLineValues,
  WorkspaceEntity,
} from "../../../types"
import { listContacts } from "../../api/contacts"
import { describeLoadFailure } from "../../api/http"
import { createInvoice } from "../../api/invoices"
import { fieldError } from "../../forms/field-error"
import { t } from "../../i18n"
import { formatMoney } from "../../layout/format"
import { contactDisplayName, type ContactResource } from "../../models/contact"
import type {
  CreateInvoicePayload,
  InvoiceDetailResource,
  InvoiceItemResource,
  InvoiceType,
  Jurisdiction,
} from "../../models/invoice"
import { createResourceForm } from "../../types/resource-form"

const NONE = 0
const PERCENT = 100
const WHOLE = 1
const ISO_DATE_LENGTH = 10
const START = 0
// People count lines from one.
const ORDINAL_OFFSET = 1
// An invoice has a line at least.
const MIN_LINES = 1
// The Swiss standard VAT rate, the Angular form's default.
const DEFAULT_TAX_RATE = "8.1"
const NOTES_ROWS = 3
const CONTACTS_PER_SEARCH = 20
// Laravel counts pages from 1.
const FIRST_PAGE = 1
const SEARCH_DEBOUNCE_MS = 250

interface OpenRequest {
  gridId: string
}

export const INVOICE_TYPES: InvoiceType[] = [
  "standard",
  "sdi_electronic",
  "ch_qr_bill",
  "credit_note",
  "proforma",
]

export const JURISDICTIONS: Jurisdiction[] = ["IT", "CH"]
const CURRENCIES = ["CHF", "EUR"]

/**
 * The client field: a combobox that searches the contacts on the server as
 * the user types. The option chosen stays listed whatever the search, for its
 * name to keep showing.
 */
export const ContactPicker = [
  {
    ...Combobox,

    searchChange(entity: ContactPickerEntity, term: string, api: AppApi) {
      Combobox.searchChange(entity, term)
      api.notify(`#${entity.id}:searchSettle`, term)
    },

    // Debounced, so it gets a read-only entity: it may only notify.
    searchSettle(entity: ContactPickerEntity, term: string, api: AppApi) {
      api.notify(`#${entity.id}:load`, term)
    },

    // A search left behind would keep the list narrowed on the next opening.
    close(entity: ContactPickerEntity, _: void, api: AppApi) {
      const hadSearch = Boolean(entity.searchTerm)
      Combobox.close(entity)
      if (hadSearch) api.notify(`#${entity.id}:load`, "")
    },

    /** Starts over on a value, such as the client of a duplicated invoice. */
    reset(entity: ContactPickerEntity, chosen: ComboboxOption | null) {
      Combobox.valueSet(entity, chosen ? optionValue(chosen) : null)
      entity.chosen = chosen
      entity.isOpen = false
    },

    load(entity: ContactPickerEntity, search: string, api: AppApi) {
      entity.requestId += 1
      entity.isLoading = true

      const { id, requestId } = entity
      listContacts({
        page: FIRST_PAGE,
        per_page: CONTACTS_PER_SEARCH,
        search: search || undefined,
      }).then(
        (page) =>
          api.notify(`#${id}:loadSuccess`, {
            requestId,
            options: page.items.map(toContactOption),
          }),
        (error: unknown) =>
          api.notify(`#${id}:loadSuccess`, {
            requestId,
            options: [],
            failure: describeLoadFailure(error),
          }),
      )
    },

    // Answers to an older search are dropped.
    loadSuccess(
      entity: ContactPickerEntity,
      result: {
        requestId: number
        options: ComboboxOption[]
        failure?: Message
      },
    ) {
      if (result.requestId !== entity.requestId) return
      const { chosen } = entity
      const isListed = result.options.some(
        (option) => optionValue(option) === entity.selectedValue,
      )
      entity.options =
        chosen && !isListed ? [chosen, ...result.options] : result.options
      entity.noOptionsMessage = t(result.failure ?? "APP.EMPTY")
      entity.isLoading = false
    },

    optionSelect(
      entity: ContactPickerEntity,
      option: ComboboxOption,
      api: AppApi,
    ) {
      Combobox.optionSelect(entity, option, api)
      entity.chosen = option
    },
  },
  withDebounce(SEARCH_DEBOUNCE_MS, ["searchSettle"]),
]

/**
 * A new invoice, or a copy of one as a new draft. Its client comes from the
 * contact picker, which notifies the form's `fieldChange` on a choice.
 */
export const InvoiceForm = [
  ...createResourceForm({
    toValues: (_row: { id: string } | null, api: AppApi) => {
      // A new invoice starts in the workspace's jurisdiction and currency.
      const { jurisdiction, currency } = api.getEntity(
        "workspace",
      ) as WorkspaceEntity
      return emptyValues(jurisdiction, currency)
    },
    validate: (values: InvoiceFormValues) => ({
      contact_id: values.contact_id ? null : "validation.required",
      invoice_type: null,
      invoice_number: values.invoice_number.trim()
        ? null
        : "validation.required",
      date: values.date ? null : "validation.dateRequired",
      due_date: null,
      currency: null,
      jurisdiction: null,
      notes: null,
      items: values.items.map((line) => ({
        description: line.description.trim()
          ? null
          : "validation.descriptionRequired",
        quantity:
          Number(line.quantity) > NONE ? null : "validation.quantityRequired",
        unit_price:
          line.unit_price !== "" && Number(line.unit_price) >= NONE
            ? null
            : "validation.priceRequired",
        tax_rate:
          line.tax_rate !== "" && Number(line.tax_rate) >= NONE
            ? null
            : "COMMON.VALIDATION.INVALID_VALUE",
        discount_percentage: null,
      })),
    }),
    toPayload: (values: InvoiceFormValues): CreateInvoicePayload => ({
      contact_id: values.contact_id,
      invoice_type: values.invoice_type,
      invoice_number: values.invoice_number.trim(),
      date: values.date,
      due_date: values.due_date || null,
      currency: values.currency,
      jurisdiction: values.jurisdiction,
      notes: values.notes.trim() || null,
      items: values.items.map(toItem),
    }),
    save: (_id: string | null, payload: CreateInvoicePayload) =>
      createInvoice(payload),
    createdKey: "SALES.INVOICES.MESSAGES.CREATED",
    updatedKey: "SALES.INVOICES.MESSAGES.CREATED",
  }),
  {
    render(entity: InvoiceFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      const { values } = entity
      const change = (path: string, value: unknown) =>
        api.notify(`#${id}:fieldChange`, { path, value })
      const field = (
        path: keyof InvoiceFormValues,
        label: string,
        props: Partial<InputProps> = {},
      ) =>
        Input.render({
          id: `${id}-${path}`,
          label: t(label),
          isFullWidth: true,
          value: values[path] as string,
          error: fieldError(entity, path),
          onChange: (value) => change(path, value),
          ...props,
        })
      const picker = api.getEntity(entity.pickerId) as ContactPickerEntity
      const totals = invoiceTotals(values.items)
      const money = (amount: number) => formatMoney(amount, values.currency)

      return Drawer.render({
        id: `${id}-drawer`,
        variant: "temporary",
        anchor: "right",
        isOpen: entity.isOpen,
        title: t("SALES.INVOICES.NEW"),
        closeLabel: t("COMMON.CLOSE"),
        className: "ff-form-drawer ff-form-drawer-wide",
        onClose: () => api.notify(`#${id}:close`),
        children: html`<form
          class="ff-form ff-form-columns"
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
              className: "ff-form-wide",
            }),
          )}
          <div class="ff-form-wide">
            ${Combobox.render(
              {
                ...picker,
                label: t("SALES.INVOICES.FORM.CONTACT"),
                placeholder: t("SALES.INVOICES.FORM.CONTACT_PLACEHOLDER"),
                searchPlaceholder: t("SALES.INVOICES.FORM.CONTACT_PLACEHOLDER"),
                loadingMessage: t("APP.LOADING"),
                isRequired: true,
                error: fieldError(entity, "contact_id"),
              },
              api,
            )}
          </div>
          ${Select.render({
            id: `${id}-invoice_type`,
            label: t("SALES.INVOICES.FORM.TYPE"),
            isFullWidth: true,
            value: values.invoice_type,
            options: INVOICE_TYPES.map((type) => ({
              value: type,
              label: t(`SALES.INVOICES.TYPES.${type.toUpperCase()}`),
            })),
            onChange: (value) => change("invoice_type", value),
          })}
          ${field("invoice_number", "SALES.INVOICES.FORM.NUMBER", {
            isRequired: true,
          })}
          ${field("date", "SALES.INVOICES.FORM.DATE", {
            inputType: "date",
            isRequired: true,
          })}
          ${field("due_date", "SALES.INVOICES.FORM.DUE_DATE", {
            inputType: "date",
          })}
          ${Select.render({
            id: `${id}-currency`,
            label: t("SALES.INVOICES.FORM.CURRENCY"),
            isFullWidth: true,
            value: values.currency,
            options: CURRENCIES,
            onChange: (value) => change("currency", value),
          })}
          ${Select.render({
            id: `${id}-jurisdiction`,
            label: t("SALES.INVOICES.FORM.JURISDICTION"),
            isFullWidth: true,
            value: values.jurisdiction,
            options: JURISDICTIONS.map((jurisdiction) => ({
              value: jurisdiction,
              label: t(`SALES.INVOICES.JURISDICTIONS.${jurisdiction}`),
            })),
            onChange: (value) => change("jurisdiction", value),
          })}
          <fieldset class="ff-fieldset ff-form-wide">
            <legend>${t("SALES.INVOICES.FORM.ITEMS")}</legend>
            ${values.items.map((line, index) =>
              renderLine(entity, line, index, api),
            )}
            ${Button.render({
              size: "sm",
              variant: "outline",
              children: html`${Icon.render({ icon: plusIcon })}
              ${t("SALES.INVOICES.FORM.ADD_ITEM")}`,
              onClick: () =>
                api.notify(`#${id}:fieldArrayAppend`, {
                  path: "items",
                  value: emptyLine(),
                }),
            })}
          </fieldset>
          <dl class="ff-detail-list ff-form-wide" aria-live="polite">
            <dt>${t("SALES.INVOICES.TOTALS.NET")}</dt>
            <dd>${money(totals.net)}</dd>
            <dt>${t("SALES.INVOICES.TOTALS.VAT")}</dt>
            <dd>${money(totals.vat)}</dd>
            <dt>${t("SALES.INVOICES.TOTALS.GROSS")}</dt>
            <dd><strong>${money(totals.net + totals.vat)}</strong></dd>
          </dl>
          ${Textarea.render({
            id: `${id}-notes`,
            label: t("SALES.INVOICES.FORM.NOTES"),
            rows: NOTES_ROWS,
            isFullWidth: true,
            className: "ff-form-wide",
            value: values.notes,
            onChange: (value) => change("notes", value),
          })}
          <div class="ff-form-actions ff-form-wide">
            ${Button.render({
              children: t("common.actions.cancel"),
              onClick: () => api.notify(`#${id}:close`),
            })}
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              isDisabled: entity.isSubmitting,
              children: t(
                entity.isSubmitting
                  ? "APP.LOADING"
                  : "SALES.INVOICES.FORM.SUBMIT",
              ),
            })}
          </div>
        </form>`,
      })
    },
  },
  // Every opening starts the client field over, with the first contacts
  // listed. A copy keeps the client, type, currency, notes and lines of the
  // invoice; it gets a number and dates of its own.
  <T extends object>(type: T) => {
    const { open } = type as { open: (...args: unknown[]) => void }
    const openWith = (
      entity: InvoiceFormEntity,
      gridId: string,
      chosen: ComboboxOption | null,
      api: AppApi,
    ) => {
      open(entity, { id: null, gridId }, api)
      api.notify(`#${entity.pickerId}:reset`, chosen)
      api.notify(`#${entity.pickerId}:load`, "")
    }

    return {
      open(entity: InvoiceFormEntity, { gridId }: OpenRequest, api: AppApi) {
        openWith(entity, gridId, null, api)
      },

      duplicateOpen(
        entity: InvoiceFormEntity,
        { gridId, invoice }: OpenRequest & { invoice: InvoiceDetailResource },
        api: AppApi,
      ) {
        const contact = invoice.contact ?? invoice.client
        const contactId = contact?.id ?? invoice.contact_id
        openWith(
          entity,
          gridId,
          contactId
            ? {
                value: contactId,
                label: contact ? contactDisplayName(contact) : contactId,
              }
            : null,
          api,
        )
        entity.initialValues = fromInvoice(invoice)
        Form.reset(entity)
      },
    }
  },
]

/** A line's amounts: net after the discount, and its VAT. */
export function lineAmounts(line: InvoiceLineValues) {
  const net =
    (Number(line.quantity) || NONE) *
    (Number(line.unit_price) || NONE) *
    (WHOLE - (Number(line.discount_percentage) || NONE) / PERCENT)
  return { net, vat: (net * (Number(line.tax_rate) || NONE)) / PERCENT }
}

export function invoiceTotals(lines: InvoiceLineValues[]) {
  return lines.map(lineAmounts).reduce(
    (totals, line) => ({
      net: totals.net + line.net,
      vat: totals.vat + line.vat,
    }),
    { net: NONE, vat: NONE },
  )
}

function renderLine(
  entity: InvoiceFormEntity,
  line: InvoiceLineValues,
  index: number,
  api: AppApi,
): TemplateResult {
  const id = entity.id
  const ordinal = index + ORDINAL_OFFSET
  const amount = (
    path: keyof InvoiceLineValues,
    label: string,
    props: Partial<InputProps> = {},
  ) =>
    Input.render({
      id: `${id}-item-${index}-${path}`,
      ariaLabel: `${t(label)} ${ordinal}`,
      placeholder: t(label),
      inputType: "number",
      min: 0,
      step: 0.01,
      value: line[path],
      error: fieldError(entity, `items.${index}.${path}`),
      onChange: (value) =>
        api.notify(`#${id}:fieldChange`, {
          path: `items.${index}.${path}`,
          value,
        }),
      ...props,
    })
  const { net } = lineAmounts(line)

  return html`<div class="ff-invoice-line">
    ${amount("description", "SALES.INVOICES.ITEM.DESCRIPTION", {
      inputType: "text",
      isFullWidth: true,
      className: "ff-invoice-line-description",
    })}
    ${amount("quantity", "SALES.INVOICES.ITEM.QTY")}
    ${amount("unit_price", "SALES.INVOICES.ITEM.PRICE")}
    ${amount("tax_rate", "SALES.INVOICES.ITEM.TAX_RATE")}
    ${amount("discount_percentage", "SALES.INVOICES.ITEM.DISCOUNT", {
      max: PERCENT,
    })}
    <output
      class="ff-amount"
      aria-label="${t("SALES.INVOICES.ITEM.SUBTOTAL")} ${ordinal}"
      >${formatMoney(net, entity.values.currency)}</output
    >
    ${IconButton.render({
      icon: Icon.render({ icon: trashIcon }),
      ariaLabel: t("SALES.INVOICES.FORM.REMOVE_ITEM", { n: ordinal }),
      variant: "ghost",
      color: "error",
      isDisabled: entity.values.items.length <= MIN_LINES,
      onClick: () =>
        api.notify(`#${id}:fieldArrayRemove`, { path: "items", index }),
    })}
  </div>`
}

function emptyValues(
  jurisdiction: Jurisdiction,
  currency: string,
): InvoiceFormValues {
  return {
    contact_id: "",
    invoice_type: "standard",
    invoice_number: "",
    date: today(),
    due_date: "",
    currency: currency === "EUR" ? "EUR" : "CHF",
    jurisdiction,
    notes: "",
    items: [emptyLine()],
  }
}

function fromInvoice(invoice: InvoiceDetailResource): InvoiceFormValues {
  const currency = invoice.currency === "EUR" ? "EUR" : "CHF"
  const lines = invoice.items ?? []
  return {
    ...emptyValues(
      invoice.jurisdiction ?? (currency === "EUR" ? "IT" : "CH"),
      currency,
    ),
    contact_id:
      (invoice.contact ?? invoice.client)?.id ?? invoice.contact_id ?? "",
    invoice_type: invoice.invoice_type ?? "standard",
    notes: invoice.notes ?? "",
    items: lines.length ? lines.map(toLine) : [emptyLine()],
  }
}

function emptyLine(): InvoiceLineValues {
  return {
    description: "",
    quantity: "1",
    unit_price: "0",
    tax_rate: DEFAULT_TAX_RATE,
    discount_percentage: "0",
  }
}

function toLine(item: InvoiceItemResource): InvoiceLineValues {
  return {
    description: item.description,
    quantity: String(item.quantity),
    unit_price: String(item.unit_price),
    tax_rate: String(item.tax_rate),
    discount_percentage: String(item.discount_percentage ?? NONE),
  }
}

function toItem(line: InvoiceLineValues): InvoiceItemResource {
  return {
    description: line.description.trim(),
    quantity: Number(line.quantity),
    unit_price: Number(line.unit_price),
    tax_rate: Number(line.tax_rate),
    discount_percentage: Number(line.discount_percentage) || NONE,
  }
}

function toContactOption(contact: ContactResource): ComboboxOption {
  return {
    value: contact.id,
    label: contactDisplayName(contact),
    // The server matches more than the name: these keep its matches listed.
    keywords: [contact.email, contact.vat_number, contact.fiscal_code].filter(
      (keyword): keyword is string => Boolean(keyword),
    ),
  }
}

function optionValue(option: ComboboxOption): string | number {
  return typeof option === "object" ? option.value : option
}

function today(): string {
  return new Date().toISOString().slice(START, ISO_DATE_LENGTH)
}
