import arrowsRotate from "@iconify-icons/fa7-solid/arrows-rotate"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { Icon } from "@inglorious/ui/icon"
import { Input } from "@inglorious/ui/input"
import { LoadStatus } from "@inglorious/ui/load-status"
import { Tabs } from "@inglorious/ui/tabs"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { Form } from "@inglorious/web/form"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AppApi,
  SettingsPageEntity,
  SettingsTab,
  TenantFormEntity,
  TenantFormValues,
} from "../../../types"
import { describeLoadFailure } from "../../api/http"
import {
  getTenantSettings,
  listAuditLogs,
  listBranches,
  listRoles,
  listUsers,
  syncExchangeRates,
  updateTenantSettings,
} from "../../api/settings"
import { fieldError } from "../../forms/field-error"
import { applyServerErrors } from "../../forms/server-errors"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDateTime } from "../../layout/format"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag } from "../../layout/tag"
import type {
  AuditLogResource,
  BranchResource,
  TenantSettings,
  UserResource,
} from "../../models/settings"
import { withCells } from "../../types/grid-cells"
import { createLoadedDataGrid } from "../../types/loaded-data-grid"

const SDI_CODE_LENGTH = 7

/** Each tab but the first is a grid; the first is the tenant's form. */
const TABS: { value: SettingsTab; label: string; gridId?: string }[] = [
  { value: "org", label: "settings.tabs.orgData" },
  {
    value: "branches",
    label: "settings.tabs.branches",
    gridId: "branchesGrid",
  },
  { value: "users", label: "settings.tabs.users", gridId: "usersGrid" },
  { value: "roles", label: "settings.tabs.roles", gridId: "rolesGrid" },
  { value: "audit", label: "settings.tabs.audit", gridId: "auditGrid" },
]

// Labels are translation keys; `name` is the only one required.
const TENANT_FIELDS: {
  path: keyof TenantFormValues
  label: string
  type?: "email"
}[] = [
  { path: "name", label: "settings.form.companyName" },
  { path: "legal_name", label: "settings.form.legalName" },
  { path: "fiscal_code", label: "settings.form.taxId" },
  { path: "vat_number", label: "settings.form.vatNumber" },
  { path: "uid_number", label: "settings.form.uidNumber" },
  { path: "default_currency", label: "settings.form.currency" },
  { path: "iban", label: "settings.form.iban" },
  { path: "qr_iban", label: "settings.form.qrIban" },
  { path: "sdi_code", label: "settings.form.sdiCode" },
  { path: "pec_email", label: "settings.form.pecEmail", type: "email" },
]

export const BranchesGrid = {
  ...createLoadedDataGrid(listBranches, (branch: BranchResource) => branch),
  ...withCells((_props, columnId, branch: BranchResource) =>
    columnId === "is_headquarters"
      ? branch.is_headquarters
        ? renderTag(t("settings.tabs.hq"), "info")
        : renderTag(t("settings.tabs.branch"))
      : nothing,
  ),
}

export const UsersGrid = {
  ...createLoadedDataGrid(listUsers, (user: UserResource) => user),
  ...withCells((_props, columnId, user: UserResource) => {
    if (columnId === "is_active") {
      return user.is_active
        ? renderTag(t("common.status.active"), "success")
        : renderTag(t("common.status.inactive"))
    }
    if (columnId === "last_login_at") {
      return user.last_login_at ? formatDateTime(user.last_login_at) : "-"
    }
    return nothing
  }),
}

export const RolesGrid = {
  ...createLoadedDataGrid(listRoles, (role) => role),
  ...withCells(() => nothing),
}

export const AuditGrid = {
  ...createLoadedDataGrid(listAuditLogs, (log: AuditLogResource) => log),
  ...withCells((_props, columnId, log: AuditLogResource) =>
    columnId === "created_at" ? formatDateTime(log.created_at) : nothing,
  ),
}

/**
 * The tenant's own data. The Angular form started filled with an invented
 * company, which stayed there to be saved when loading failed.
 */
export const TenantForm = [
  Form,
  {
    ...handleAsync("load", {
      start(entity: TenantFormEntity) {
        entity.isLoading = true
        entity.failure = null
      },
      run: async () => (await getTenantSettings()).data,
      success(entity: TenantFormEntity, tenant: TenantSettings) {
        entity.initialValues = toValues(tenant)
        Form.reset(entity)
        entity.hasSubmitted = false
        entity.isLoaded = true
      },
      error(entity: TenantFormEntity, error: unknown) {
        entity.failure = describeLoadFailure(error)
      },
      finally(entity: TenantFormEntity) {
        entity.isLoading = false
      },
    }),

    submit(entity: TenantFormEntity, _: void, api: AppApi) {
      entity.hasSubmitted = true
      entity.errors = validate(entity.values)
      entity.isValid = !Object.values(entity.errors).some(Boolean)
      if (!entity.isValid) return

      api.notify(`#${entity.id}:save`, { ...entity.values })
    },

    ...handleAsync("save", {
      start(entity: TenantFormEntity) {
        entity.isSubmitting = true
        entity.failure = null
      },
      run: (values: TenantFormValues) =>
        updateTenantSettings(toPayload(values)),
      success(_entity: TenantFormEntity, _result: unknown, api: AppApi) {
        api.notify("#toast:show", { key: "settings.messages.saved" })
      },
      error(entity: TenantFormEntity, error: unknown) {
        const [unmapped = null] = applyServerErrors(entity, error)
        entity.failure = unmapped
      },
      finally(entity: TenantFormEntity) {
        entity.isSubmitting = false
      },
    }),

    render(entity: TenantFormEntity, api: AppApi): TemplateResult {
      const id = entity.id
      return html`${LoadStatus.render({
        isLoading: entity.isLoading && !entity.isLoaded,
        loadingLabel: t("APP.LOADING"),
        isError: Boolean(entity.failure) && !entity.isLoaded,
        error: Alert.render({
          severity: "error",
          description: entity.failure ? t(entity.failure) : "",
          action: Button.render({
            size: "sm",
            children: t("APP.RETRY"),
            onClick: () => api.notify(`#${id}:load`),
          }),
        }),
        content: () =>
          html`<form
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
              }),
            )}
            ${TENANT_FIELDS.map(({ path, label, type }) =>
              Input.render({
                id: `${id}-${path}`,
                label: t(label),
                inputType: type ?? "text",
                isRequired: path === "name",
                isFullWidth: true,
                maxlength: path === "sdi_code" ? SDI_CODE_LENGTH : undefined,
                value: entity.values[path],
                error: fieldError(entity, path),
                onChange: (value) =>
                  api.notify(`#${id}:fieldChange`, { path, value }),
              }),
            )}
            <div class="ff-form-actions ff-form-wide">
              ${Button.render({
                buttonType: "submit",
                color: "primary",
                isDisabled: entity.isSubmitting,
                children: t(
                  entity.isSubmitting ? "APP.LOADING" : "settings.form.save",
                ),
              })}
            </div>
          </form>`,
      })}`
    },
  },
]

export const SettingsPage = [
  {
    routeChange: pageRouteChange<SettingsPageEntity & { id: string }>({
      open: (entity, _, api) => {
        api.notify("#tenantForm:load")
        openTab(entity.tab, api)
      },
    }),

    tabChange(entity: SettingsPageEntity, tab: SettingsTab, api: AppApi) {
      entity.tab = tab
      openTab(tab, api)
    },

    ...handleAsync("ratesSync", {
      start(entity: SettingsPageEntity) {
        entity.isSyncing = true
      },
      run: () => syncExchangeRates(),
      success(_entity: SettingsPageEntity, _result: unknown, api: AppApi) {
        api.notify("#toast:show", { key: "settings.messages.ratesSynced" })
      },
      finally(entity: SettingsPageEntity) {
        entity.isSyncing = false
      },
    }),

    render(entity: SettingsPageEntity, api: AppApi): TemplateResult {
      return html`
        ${renderPageHeader("settings.title", "settings.subtitle")}
        ${Card.render({
          header: html`<div class="ff-card-header-row">
            <h2 class="iw-card-title">${t("SETTINGS.CARD_TITLE")}</h2>
            ${Button.render({
              size: "sm",
              variant: "outline",
              isDisabled: entity.isSyncing,
              children: html`${Icon.render({ icon: arrowsRotate })}
              ${t(entity.isSyncing ? "APP.LOADING" : "settings.actions.syncRates")}`,
              onClick: () => api.notify(`#${entity.id}:ratesSync`),
            })}
          </div>`,
          children: Tabs.render({
            id: `${entity.id}-tabs`,
            value: entity.tab,
            items: TABS.map(({ value, label, gridId }) => ({
              value,
              label: t(label),
              // Only the open tab renders.
              panel:
                value === entity.tab
                  ? html`${api.render(gridId ?? "tenantForm")}`
                  : undefined,
            })),
            onChange: (tab) =>
              api.notify(`#${entity.id}:tabChange`, tab as SettingsTab),
          }),
        })}
      `
    },
  },
  requireAuth,
]

function openTab(tab: SettingsTab, api: { notify: AppApi["notify"] }) {
  const gridId = TABS.find(({ value }) => value === tab)?.gridId
  if (gridId) api.notify(`#${gridId}:fetch`)
}

function toValues(tenant: TenantSettings): TenantFormValues {
  return {
    name: tenant.name ?? "",
    legal_name: tenant.legal_name ?? "",
    fiscal_code: tenant.fiscal_code ?? "",
    vat_number: tenant.vat_number ?? "",
    uid_number: tenant.uid_number ?? "",
    default_currency: tenant.default_currency ?? "EUR",
    iban: tenant.iban ?? "",
    qr_iban: tenant.qr_iban ?? "",
    sdi_code: tenant.sdi_code ?? "",
    pec_email: tenant.pec_email ?? "",
  }
}

function validate(values: TenantFormValues) {
  return {
    ...Object.fromEntries(Object.keys(values).map((key) => [key, null])),
    name: values.name.trim() ? null : "validation.nameRequired",
  } as Record<keyof TenantFormValues, string | null>
}

function toPayload(values: TenantFormValues): Partial<TenantSettings> {
  return Object.fromEntries(
    Object.entries(values).map(([key, value]) => [key, value.trim() || null]),
  ) as Partial<TenantSettings>
}

export default SettingsPage
