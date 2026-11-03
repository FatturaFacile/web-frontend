import penIcon from "@iconify-icons/fa7-solid/pen"
import trashIcon from "@iconify-icons/fa7-solid/trash"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Drawer } from "@inglorious/ui/drawer"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Input } from "@inglorious/ui/input"
import { Select } from "@inglorious/ui/select"
import { Switch } from "@inglorious/ui/switch"
import { Textarea } from "@inglorious/ui/textarea"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"

import type {
  AlertFormEntity,
  AlertFormValues,
  AlertsGridEntity,
  AppApi,
} from "../../../types"
import { deleteAlert, listAlerts, saveAlert } from "../../api/alerts"
import { fieldError } from "../../forms/field-error"
import { t } from "../../i18n"
import { formatDateTime } from "../../layout/format"
import { renderGridToolbar } from "../../layout/grid-toolbar"
import { renderTag, type TagColor } from "../../layout/tag"
import type { AlertResource, AlertSeverity } from "../../models/alerts"
import { withCells } from "../../types/grid-cells"
import { createResourceForm } from "../../types/resource-form"
import { createResourcePage } from "../../types/resource-page"
import { createServerDataGrid } from "../../types/server-data-grid"

const TITLE_MAX_LENGTH = 255
const MESSAGE_ROWS = 4

const SEVERITIES: AlertSeverity[] = ["info", "warning", "critical"]

const SEVERITY_COLORS: Record<AlertSeverity, TagColor> = {
  info: "info",
  warning: "warning",
  critical: "error",
}

interface AlertsGridProps extends DataGridProps<AlertResource> {
  onEdit?: (alert: AlertResource) => void
  onDelete?: (alert: AlertResource) => void
}

export const AlertsGrid = [
  ...createServerDataGrid(listAlerts, (alert: AlertResource) => alert),
  {
    ...withCells(renderAlertCell, (entity: AlertsGridEntity, api: AppApi) => ({
      onCreate: () => api.notify(`#${entity.pageId}:createOpen`),
      onEdit: ({ id }: AlertResource) =>
        api.notify(`#${entity.pageId}:editOpen`, id),
      onDelete: ({ id, title }: AlertResource) =>
        api.notify(`#${entity.pageId}:deleteAsk`, { id, name: title }),
    })),

    // The severity filter goes to the server: the Angular page filtered the
    // rows of the current page only, so pages and totals were wrong.
    renderToolbar(props: AlertsGridProps): TemplateResult {
      return renderGridToolbar({
        ...props,
        searchLabel: "alerts.searchPlaceholder",
        createLabel: "alerts.actions.create",
        controls: Select.render({
          id: `${props.id}-severity`,
          size: "sm",
          ariaLabel: t("alerts.form.severity"),
          value: props.filters.severity ?? "",
          options: [
            { value: "", label: t("COMMON.ALL") },
            ...SEVERITIES.map((severity) => ({
              value: severity,
              label: t(`alerts.severity.${severity}`),
            })),
          ],
          onChange: (value) =>
            props.onFilterChange?.({
              columnId: "severity",
              value: value || null,
            }),
        }),
      })
    },
  },
]

export const AlertForm = [
  ...createResourceForm({
    toValues: (alert: AlertResource | null): AlertFormValues => ({
      title: alert?.title ?? "",
      severity: alert?.severity ?? "info",
      message: alert?.message ?? "",
      is_active: alert?.is_active ?? true,
    }),
    validate: (values: AlertFormValues) => ({
      title: !values.title.trim()
        ? "validation.titleRequired"
        : values.title.length > TITLE_MAX_LENGTH
          ? "COMMON.VALIDATION.INVALID_VALUE"
          : null,
      severity: null,
      message: null,
      is_active: null,
    }),
    toPayload: (values: AlertFormValues) => ({
      title: values.title.trim(),
      severity: values.severity,
      message: values.message.trim() || null,
      is_active: values.is_active,
    }),
    save: saveAlert,
    createdKey: "alerts.messages.created",
    updatedKey: "alerts.messages.updated",
  }),
  {
    render(entity: AlertFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      const change = (path: keyof AlertFormValues, value: unknown) =>
        api.notify(`#${id}:fieldChange`, { path, value })

      return Drawer.render({
        id: `${id}-drawer`,
        variant: "temporary",
        anchor: "right",
        isOpen: entity.isOpen,
        title: t(
          entity.editingId
            ? "alerts.form.editTitle"
            : "alerts.form.createTitle",
        ),
        closeLabel: t("COMMON.CLOSE"),
        className: "ff-form-drawer",
        onClose: () => api.notify(`#${id}:close`),
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
          ${Input.render({
            id: `${id}-title`,
            label: t("alerts.form.title"),
            placeholder: t("alerts.form.titlePlaceholder"),
            isRequired: true,
            isFullWidth: true,
            maxlength: TITLE_MAX_LENGTH,
            value: entity.values.title,
            error: fieldError(entity, "title"),
            onChange: (value) => change("title", value),
          })}
          ${Select.render({
            id: `${id}-severity`,
            label: t("alerts.form.severity"),
            isFullWidth: true,
            value: entity.values.severity,
            options: SEVERITIES.map((severity) => ({
              value: severity,
              label: t(`alerts.severity.${severity}`),
            })),
            onChange: (value) => change("severity", value),
          })}
          ${Textarea.render({
            id: `${id}-message`,
            label: t("alerts.form.message"),
            placeholder: t("alerts.form.messagePlaceholder"),
            rows: MESSAGE_ROWS,
            isFullWidth: true,
            value: entity.values.message,
            onChange: (value) => change("message", value),
          })}
          ${Switch.render({
            id: `${id}-active`,
            label: t("alerts.form.isActive"),
            isChecked: entity.values.is_active,
            onChange: (isChecked) => change("is_active", isChecked),
          })}
          <div class="ff-form-actions">
            ${Button.render({
              children: t("common.actions.cancel"),
              onClick: () => api.notify(`#${id}:close`),
            })}
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              isDisabled: entity.isSubmitting,
              children: t(
                entity.isSubmitting ? "APP.LOADING" : "alerts.form.submit",
              ),
            })}
          </div>
        </form>`,
      })
    },
  },
]

export const AlertsPage = createResourcePage({
  remove: deleteAlert,
  confirmDeleteKey: "alerts.confirmDelete",
  deletedKey: "alerts.messages.deleted",
})

function renderAlertCell(
  props: AlertsGridProps,
  columnId: string,
  alert: AlertResource,
): TemplateResult | string | typeof nothing {
  switch (columnId) {
    case "title":
      return html`<strong>${alert.title}</strong>
        ${when(alert.message, () => html`<div class="ff-sub-text">${alert.message}</div>`)}`
    case "severity":
      return renderTag(
        t(`alerts.severity.${alert.severity}`),
        SEVERITY_COLORS[alert.severity],
      )
    case "is_active":
      return alert.is_active
        ? renderTag(t("common.status.active"), "success")
        : renderTag(t("common.status.inactive"))
    case "created_at":
      return alert.created_at ? formatDateTime(alert.created_at) : ""
    case "actions":
      return html`<div class="ff-row-actions">
        ${IconButton.render({
          icon: Icon.render({ icon: penIcon }),
          ariaLabel: `${t("alerts.actions.edit")}: ${alert.title}`,
          variant: "ghost",
          size: "sm",
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            props.onEdit?.(alert)
          },
        })}
        ${IconButton.render({
          icon: Icon.render({ icon: trashIcon }),
          ariaLabel: `${t("alerts.actions.delete")}: ${alert.title}`,
          variant: "ghost",
          color: "error",
          size: "sm",
          onClick: (event: MouseEvent) => {
            event.stopPropagation()
            props.onDelete?.(alert)
          },
        })}
      </div>`
    default:
      return nothing
  }
}

export default AlertsPage
