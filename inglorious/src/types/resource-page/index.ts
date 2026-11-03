import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { ConfirmDialog } from "@inglorious/ui/confirm-dialog"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type { AppApi, ResourcePageEntity } from "../../../types"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { renderPageHeader } from "../../layout/page-header"

interface ResourcePageOptions {
  /** Deletes a row of the grid. */
  remove: (id: string) => Promise<unknown>
  /** Translation keys: the question before deleting, the toast after. */
  confirmDeleteKey: string
  deletedKey: string
  /** What shows between the header and the list, such as figures. */
  renderSummary?: (entity: ResourcePageEntity, api: AppApi) => TemplateResult
}

/**
 * A page that lists rows of a resource in a grid and edits them with a form:
 * it loads the grid when it opens, opens the form on a row or a blank one,
 * and deletes a row once confirmed. Its entity names the grid, the form and
 * the page's texts.
 */
export function createResourcePage({
  remove,
  confirmDeleteKey,
  deletedKey,
  renderSummary,
}: ResourcePageOptions) {
  return [
    {
      routeChange: pageRouteChange<ResourcePageEntity & { id: string }>({
        open: (entity, _, api) => api.notify(`#${entity.gridId}:fetch`),
        close: (entity) => {
          entity.pendingDelete = null
        },
      }),

      createOpen(entity: ResourcePageEntity, _: void, api: AppApi) {
        api.notify(`#${entity.formId}:open`, {
          id: null,
          gridId: entity.gridId,
        })
      },

      editOpen(entity: ResourcePageEntity, id: string, api: AppApi) {
        api.notify(`#${entity.formId}:open`, { id, gridId: entity.gridId })
      },

      deleteAsk(entity: ResourcePageEntity, row: { id: string; name: string }) {
        entity.pendingDelete = row
      },

      deleteCancel(entity: ResourcePageEntity) {
        if (!entity.isDeleting) entity.pendingDelete = null
      },

      ...handleAsync("delete", {
        start(entity: ResourcePageEntity) {
          entity.isDeleting = true
        },

        run: (id: string) => remove(id),

        success(entity: ResourcePageEntity, _: unknown, api: AppApi) {
          entity.pendingDelete = null
          api.notify("#toast:show", { key: deletedKey })
          api.notify(`#${entity.gridId}:fetch`)
        },

        // The failure is toasted with every other failed request.
        finally(entity: ResourcePageEntity) {
          entity.isDeleting = false
        },
      }),

      render(entity: ResourcePageEntity, api: AppApi): TemplateResult {
        const { pendingDelete, gridId } = entity
        const grid = api.getEntity(gridId) as
          { failure?: string | null } | undefined

        return html`
          ${renderPageHeader(entity.titleKey, entity.subtitleKey)}
          ${renderSummary?.(entity, api) ?? nothing}
          ${when(grid?.failure, () =>
            Alert.render({
              severity: "error",
              description: t(grid!.failure!),
              action: Button.render({
                size: "sm",
                children: t("APP.RETRY"),
                onClick: () => api.notify(`#${gridId}:fetch`),
              }),
            }),
          )}
          ${Card.render({
            title: entity.cardTitleKey ? t(entity.cardTitleKey) : undefined,
            children: api.render(gridId),
          })}
          ${api.render(entity.formId)}
          ${ConfirmDialog.render({
            id: `${entity.id}-delete`,
            isOpen: Boolean(pendingDelete),
            message: t(confirmDeleteKey),
            children: html`<strong>${pendingDelete?.name}</strong>`,
            confirmLabel: t("common.actions.delete"),
            cancelLabel: t("COMMON.CANCEL"),
            busyLabel: t("APP.LOADING"),
            closeLabel: t("COMMON.CLOSE"),
            isBusy: entity.isDeleting,
            onConfirm: () =>
              pendingDelete &&
              api.notify(`#${entity.id}:delete`, pendingDelete.id),
            onCancel: () => api.notify(`#${entity.id}:deleteCancel`),
          })}
        `
      },
    },
    requireAuth,
  ]
}
