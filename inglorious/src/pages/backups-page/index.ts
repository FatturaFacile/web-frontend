import cloudArrowDown from "@iconify-icons/fa7-solid/cloud-arrow-down"
import database from "@iconify-icons/fa7-solid/database"
import download from "@iconify-icons/fa7-solid/download"
import trash from "@iconify-icons/fa7-solid/trash"
import upload from "@iconify-icons/fa7-solid/upload"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { ConfirmDialog } from "@inglorious/ui/confirm-dialog"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Dialog } from "@inglorious/ui/dialog"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AppApi,
  BackupAction,
  BackupsGridEntity,
  BackupsPageEntity,
} from "../../../types"
import { saveFile } from "../../api/download"
import {
  createBackup,
  deleteBackup,
  downloadBackup,
  listBackups,
  restoreBackup,
  restoreBackupUpload,
} from "../../api/system"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDateTime } from "../../layout/format"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag, type TagColor } from "../../layout/tag"
import type { SystemBackup } from "../../models/system"
import { withCells } from "../../types/grid-cells"
import { createLoadedDataGrid } from "../../types/loaded-data-grid"

const BYTES_PER_UNIT = 1024
const UNITS = ["B", "KB", "MB", "GB"]
const SIZE_DECIMALS = 2
// From a length to the last index.
const LAST = 1

const STATUS_COLORS: Record<SystemBackup["status"], TagColor> = {
  completed: "success",
  in_progress: "info",
  failed: "error",
}

interface BackupsGridProps extends DataGridProps<SystemBackup> {
  onAction?: (action: BackupAction, backup: SystemBackup) => void
}

export const BackupsGrid = {
  ...createLoadedDataGrid(listBackups, (backup: SystemBackup) => backup),

  ...withCells(renderBackupCell, (entity: BackupsGridEntity, api: AppApi) => ({
    // A download starts at once; a restore or a deletion asks first.
    onAction: (action: BackupAction, { id, filename }: SystemBackup) =>
      api.notify(
        `#${entity.pageId}:${action === "download" ? action : `${action}Ask`}`,
        { id, filename },
      ),
  })),
}

/**
 * Every failure here is shown as one, through the toast: the Angular page
 * announced success whatever happened, a restore included.
 */
export const BackupsPage = [
  {
    routeChange: pageRouteChange<BackupsPageEntity & { id: string }>({
      open: (entity, _, api) => api.notify(`#${entity.gridId}:fetch`),
      close: (entity) => {
        entity.pending = null
        entity.isUploadOpen = false
      },
    }),

    ...handleAsync("create", {
      start(entity: BackupsPageEntity) {
        entity.isCreating = true
      },
      run: () => createBackup(),
      success(entity: BackupsPageEntity, _: unknown, api: AppApi) {
        api.notify("#toast:show", { key: "system.backups.messages.started" })
        api.notify(`#${entity.gridId}:fetch`)
      },
      finally(entity: BackupsPageEntity) {
        entity.isCreating = false
      },
    }),

    // Saving the file is the browser's: the request only fetches it.
    ...handleAsync("download", {
      async run({ id, filename }: { id: string; filename: string }) {
        saveFile(await downloadBackup(id), filename)
      },
    }),

    restoreAsk(
      entity: BackupsPageEntity,
      backup: { id: string; filename: string },
    ) {
      entity.pending = { action: "restore", ...backup }
    },

    deleteAsk(
      entity: BackupsPageEntity,
      backup: { id: string; filename: string },
    ) {
      entity.pending = { action: "delete", ...backup }
    },

    pendingCancel(entity: BackupsPageEntity) {
      if (!entity.isWorking) entity.pending = null
    },

    ...handleAsync("pendingConfirm", {
      start(entity: BackupsPageEntity) {
        entity.isWorking = true
      },
      async run({ action, id }: { action: BackupAction; id: string }) {
        if (action === "restore") await restoreBackup(id)
        else await deleteBackup(id)
        return action
      },
      success(entity: BackupsPageEntity, action: BackupAction, api: AppApi) {
        const filename = entity.pending?.filename ?? ""
        entity.pending = null
        api.notify(
          "#toast:show",
          action === "restore"
            ? {
                key: "system.backups.messages.restoreCompleted",
                values: { filename },
              }
            : { key: "system.backups.messages.removed" },
        )
        api.notify(`#${entity.gridId}:fetch`)
      },
      finally(entity: BackupsPageEntity) {
        entity.isWorking = false
      },
    }),

    uploadOpen(entity: BackupsPageEntity) {
      entity.isUploadOpen = true
    },

    uploadClose(entity: BackupsPageEntity) {
      if (!entity.isUploading) entity.isUploadOpen = false
    },

    // The file goes straight to the request: a File is no state to keep.
    ...handleAsync("upload", {
      start(entity: BackupsPageEntity) {
        entity.isUploading = true
      },
      run: (file: File) => restoreBackupUpload(file),
      success(entity: BackupsPageEntity, _: unknown, api: AppApi) {
        entity.isUploadOpen = false
        api.notify("#toast:show", {
          key: "system.backups.messages.restoreSuccess",
        })
        api.notify(`#${entity.gridId}:fetch`)
      },
      finally(entity: BackupsPageEntity) {
        entity.isUploading = false
      },
    }),

    render(entity: BackupsPageEntity, api: AppApi): TemplateResult {
      const grid = api.getEntity(entity.gridId) as BackupsGridEntity
      const { pending } = entity
      const id = entity.id

      return html`
        ${renderPageHeader("system.backups.title", "system.backups.subtitle")}
        ${when(grid.failure, () =>
          Alert.render({
            severity: "error",
            description: t(grid.failure!),
            action: Button.render({
              size: "sm",
              children: t("APP.RETRY"),
              onClick: () => api.notify(`#${entity.gridId}:fetch`),
            }),
          }),
        )}
        ${Card.render({
          header: html`<div class="ff-card-header-row">
            <h2 class="iw-card-title">${t("system.backups.cardTitle")}</h2>
            <div class="ff-app-bar-actions">
              ${Button.render({
                size: "sm",
                variant: "outline",
                children: html`${Icon.render({ icon: upload })}
                ${t("system.backups.actions.restoreData")}`,
                onClick: () => api.notify(`#${id}:uploadOpen`),
              })}
              ${Button.render({
                size: "sm",
                color: "primary",
                isDisabled: entity.isCreating,
                children: html`${Icon.render({ icon: database })}
                ${t(entity.isCreating ? "APP.LOADING" : "system.backups.actions.create")}`,
                onClick: () => api.notify(`#${id}:create`),
              })}
            </div>
          </div>`,
          children: api.render(entity.gridId),
        })}
        ${ConfirmDialog.render({
          id: `${id}-confirm`,
          isOpen: Boolean(pending),
          tone: pending?.action === "restore" ? "primary" : "danger",
          message: t(
            pending?.action === "restore"
              ? "system.backups.confirmRestore"
              : "system.backups.confirmDelete",
          ),
          children: html`<strong>${pending?.filename}</strong>`,
          confirmLabel: t(
            pending?.action === "restore"
              ? "system.backups.actions.restoreData"
              : "common.actions.delete",
          ),
          cancelLabel: t("common.actions.cancel"),
          busyLabel: t("APP.LOADING"),
          closeLabel: t("COMMON.CLOSE"),
          isBusy: entity.isWorking,
          onConfirm: () =>
            pending &&
            api.notify(`#${id}:pendingConfirm`, {
              action: pending.action,
              id: pending.id,
            }),
          onCancel: () => api.notify(`#${id}:pendingCancel`),
        })}
        ${Dialog.render({
          id: `${id}-upload`,
          isOpen: entity.isUploadOpen,
          title: t("system.backups.modal.title"),
          description: t("system.backups.modal.description"),
          closeLabel: t("COMMON.CLOSE"),
          onClose: () => api.notify(`#${id}:uploadClose`),
          children: Button.render({
            color: "primary",
            accept: ".zip,application/zip",
            isDisabled: entity.isUploading,
            children: html`${Icon.render({ icon: upload })}
            ${t(entity.isUploading ? "APP.LOADING" : "system.backups.actions.chooseZip")}`,
            onFileSelect: (files: FileList) => {
              const [file] = files
              if (file) api.notify(`#${id}:upload`, file)
            },
          }),
        })}
      `
    },
  },
  requireAuth,
]

function renderBackupCell(
  props: BackupsGridProps,
  columnId: string,
  backup: SystemBackup,
): TemplateResult | string | typeof nothing {
  switch (columnId) {
    case "size_bytes":
      return formatBytes(backup.size_bytes)
    case "status":
      return renderTag(
        t(`system.backups.status.${backup.status}`),
        STATUS_COLORS[backup.status] ?? "default",
      )
    case "created_at":
      return formatDateTime(backup.created_at)
    case "actions":
      return html`<div class="ff-row-actions">
        ${(
          [
            ["download", download, "system.backups.actions.download"],
            ["restore", cloudArrowDown, "system.backups.actions.restore"],
            ["delete", trash, "system.backups.actions.delete"],
          ] as const
        ).map(([action, icon, label]) =>
          IconButton.render({
            icon: Icon.render({ icon }),
            ariaLabel: `${t(label)}: ${backup.filename}`,
            variant: "ghost",
            size: "sm",
            color: action === "delete" ? "error" : "default",
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              props.onAction?.(action, backup)
            },
          }),
        )}
      </div>`
    default:
      return nothing
  }
}

function formatBytes(bytes: number): string {
  const [smallest] = UNITS
  if (!bytes) return `0 ${smallest}`
  const unit = Math.min(
    Math.floor(Math.log(bytes) / Math.log(BYTES_PER_UNIT)),
    UNITS.length - LAST,
  )
  const value = bytes / BYTES_PER_UNIT ** unit
  return `${Number(value.toFixed(SIZE_DECIMALS))} ${UNITS[unit]}`
}

export default BackupsPage
