import penIcon from "@iconify-icons/fa7-solid/pen"
import trashIcon from "@iconify-icons/fa7-solid/trash"
import { Chip } from "@inglorious/ui/chip"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Select } from "@inglorious/ui/select"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"

import type { AppApi, ContactRow, ContactsGridEntity } from "../../../types"
import { listContacts } from "../../api/contacts"
import { t } from "../../i18n"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import {
  contactDisplayName,
  type ContactResource,
  contactTaxId,
  type ContactType,
} from "../../models/contact"
import { withCells } from "../../types/grid-cells"
import { createServerDataGrid } from "../../types/server-data-grid"

const TYPE_COLORS: Partial<Record<ContactType, "primary" | "secondary">> = {
  client: "primary",
  supplier: "secondary",
}

// Labels are translation keys, translated when rendered.
export const TYPE_OPTIONS: { value: ContactType; label: string }[] = [
  { value: "client", label: "CRM.CLIENTS.TYPES.CLIENT" },
  { value: "supplier", label: "CRM.CLIENTS.TYPES.SUPPLIER" },
  { value: "both", label: "CRM.CLIENTS.TYPES.BOTH" },
  { value: "lead", label: "CRM.CLIENTS.TYPES.LEAD" },
]

interface ContactsGridProps extends DataGridProps<ContactRow> {
  onCreate?: () => void
  onEdit?: (row: ContactRow) => void
  onDelete?: (row: ContactRow) => void
}

export const ContactsGrid = [
  ...createServerDataGrid(listContacts, toContactRow),
  {
    ...withCells(renderContent, (entity: ContactsGridEntity, api: AppApi) => ({
      onCreate: () => api.notify(`#${entity.pageId}:createOpen`),
      onEdit: (row: ContactRow) =>
        api.notify(`#${entity.pageId}:editOpen`, row.id),
      onDelete: ({ id, name }: ContactRow) =>
        api.notify(`#${entity.pageId}:deleteAsk`, { id, name }),
    })),

    // The type filter and the "New" button sit with the search, above the grid.
    renderToolbar(props: ContactsGridProps): TemplateResult {
      return renderGridToolbar({
        ...props,
        searchLabel: "CRM.CLIENTS.SEARCH_PLACEHOLDER",
        createLabel: "CRM.CLIENTS.NEW",
        controls: Select.render({
          id: `${props.id}-type`,
          size: "sm",
          ariaLabel: t("CRM.CLIENTS.FILTER_TYPE"),
          value: props.filters.type ?? "",
          options: [
            { value: "", label: t("COMMON.ALL") },
            ...TYPE_OPTIONS.map(({ value, label }) => ({
              value,
              label: t(label),
            })),
          ],
          onChange: (value) =>
            props.onFilterChange?.({ columnId: "type", value: value || null }),
        }),
      })
    },
  },
]

function toContactRow(contact: ContactResource): ContactRow {
  const person = [contact.first_name, contact.last_name]
    .filter(Boolean)
    .join(" ")
  return {
    ...contact,
    name: contactDisplayName(contact),
    contactPerson: contact.company_name && person ? person : null,
    taxId: contactTaxId(contact),
  }
}

function renderContent(
  props: ContactsGridProps,
  columnId: string,
  row: ContactRow,
): TemplateResult | typeof nothing {
  switch (columnId) {
    case "name":
      return html`<strong>${row.name}</strong> ${when(
          row.contactPerson,
          () => html`<div class="ff-sub-text">${row.contactPerson}</div>`,
        )}`

    case "type":
      return Chip.render({
        size: "sm",
        color: TYPE_COLORS[row.type] ?? "info",
        children: t(`CRM.CLIENTS.TYPES.${row.type.toUpperCase()}`),
      })

    case "country":
      return Chip.render({ size: "sm", children: row.country })

    case "actions":
      return html`<div class="ff-row-actions">
        ${IconButton.render({
          icon: Icon.render({ icon: penIcon }),
          ariaLabel: t("CRM.CLIENTS.ACTIONS.EDIT", { name: row.name }),
          variant: "ghost",
          size: "sm",
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            props.onEdit?.(row)
          },
        })}
        ${IconButton.render({
          icon: Icon.render({ icon: trashIcon }),
          ariaLabel: t("CRM.CLIENTS.ACTIONS.DELETE", { name: row.name }),
          variant: "ghost",
          color: "error",
          size: "sm",
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            props.onDelete?.(row)
          },
        })}
      </div>`

    default:
      return nothing
  }
}
