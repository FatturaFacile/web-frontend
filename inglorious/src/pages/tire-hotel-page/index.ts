import bell from "@iconify-icons/fa7-solid/bell"
import check from "@iconify-icons/fa7-solid/check"
import circleDot from "@iconify-icons/fa7-solid/circle-dot"
import snowflake from "@iconify-icons/fa7-solid/snowflake"
import sun from "@iconify-icons/fa7-solid/sun"
import warehouse from "@iconify-icons/fa7-solid/warehouse"
import { handleAsync } from "@inglorious/store/async"
import { optimistic } from "@inglorious/store/optimistic"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { type DataGridProps } from "@inglorious/ui/data-grid"
import { Icon } from "@inglorious/ui/icon"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AppApi,
  TireHotelGridEntity,
  TireHotelPageEntity,
} from "../../../types"
import { listTireRecords, sendTireReminder } from "../../api/automotive"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { renderKpi } from "../../layout/kpi"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag } from "../../layout/tag"
import type { TireRecord } from "../../models/automotive"
import { withCells } from "../../types/grid-cells"
import { createLoadedDataGrid } from "../../types/loaded-data-grid"

// Plates from Ticino and Geneva: Swiss customers, tagged apart.
const SWISS_PLATE = /^(TI|GE)/

interface Reminder {
  id: string
  plate: string
}

interface TireHotelGridProps extends DataGridProps<TireRecord> {
  onRemind?: (reminder: Reminder) => void
}

export const TireHotelGrid = {
  ...createLoadedDataGrid(listTireRecords, (record: TireRecord) => record),

  // Shows the reminder as sent at once, and takes it back if the request fails.
  // (The Angular page showed it as sent even then.)
  ...optimistic(
    handleAsync("remind", {
      run: async ({ plate, id }: Reminder) => {
        await sendTireReminder(id)
        return plate
      },

      success(_entity: TireHotelGridEntity, plate: string, api: AppApi) {
        api.notify("#toast:show", {
          key: "automotive.tireHotel.notifySuccess",
          values: { plate },
        })
      },
    }),
    (entity: TireHotelGridEntity, { id }: Reminder) => ({
      rows: entity.rows.map((row) =>
        row.id === id ? { ...row, reminderSent: true } : row,
      ),
    }),
  ),

  ...withCells(renderTireCell, (entity: TireHotelGridEntity, api: AppApi) => ({
    onRemind: (reminder: Reminder) =>
      api.notify(`#${entity.id}:remind`, reminder),
  })),
}

export const TireHotelPage = [
  {
    routeChange: pageRouteChange<TireHotelPageEntity & { id: string }>({
      open: (entity, _, api) => api.notify(`#${entity.gridId}:fetch`),
    }),

    render(entity: TireHotelPageEntity, api: AppApi): TemplateResult {
      const grid = api.getEntity(entity.gridId) as TireHotelGridEntity
      const count = (season: string) =>
        grid.rows.filter((row) => row.season === season).length

      return html`
        ${renderPageHeader("TIRE_HOTEL.TITLE", "TIRE_HOTEL.SUBTITLE")}
        <div class="ff-kpis">
          ${renderKpi(
            "TIRE_HOTEL.SETS_STORED",
            html`${Icon.render({ icon: circleDot })} ${grid.rows.length}`,
          )}
          ${renderKpi("TIRE_HOTEL.WINTER_TIRES", count("WINTER"))}
          ${renderKpi("TIRE_HOTEL.SUMMER_TIRES", count("SUMMER"), "warning")}
        </div>
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
          title: t("TIRE_HOTEL.LOG_TITLE"),
          children: api.render(entity.gridId),
        })}
      `
    },
  },
  requireAuth,
]

function renderTireCell(
  props: TireHotelGridProps,
  columnId: string,
  tire: TireRecord,
): TemplateResult | string | typeof nothing {
  switch (columnId) {
    case "vehiclePlate":
      return html`${renderTag(
          tire.vehiclePlate,
          SWISS_PLATE.test(tire.vehiclePlate) ? "error" : "info",
        )}
        <div class="ff-sub-text">${tire.vehicleModel}</div>`
    case "customerName":
      return html`<strong>${tire.customerName}</strong>`
    case "season":
      return tire.season === "WINTER"
        ? renderTag(
            html`${Icon.render({ icon: snowflake })}
            ${t("automotive.tireHotel.season.winter")}`,
            "info",
          )
        : renderTag(
            html`${Icon.render({ icon: sun })}
            ${t("automotive.tireHotel.season.summer")}`,
            "warning",
          )
    case "brandModel":
      return html`${tire.brandModel}
        <div class="ff-sub-text">DOT: ${tire.dot} • ${tire.rimType}</div>`
    case "treadDepthMm": {
      const depth = tire.treadDepthMm
      return html`<div class="ff-tread">
        <span>Ant: ${depth.frontLeft} / ${depth.frontRight} mm</span>
        <span>Post: ${depth.rearLeft} / ${depth.rearRight} mm</span>
      </div>`
    }
    case "rackLocation":
      return renderTag(
        html`${Icon.render({ icon: warehouse })} ${tire.rackLocation}`,
        "secondary",
      )
    case "reminderSent":
      return tire.reminderSent
        ? renderTag(
            html`${Icon.render({ icon: check })}
            ${t("automotive.tireHotel.status.sent")}`,
            "success",
          )
        : Button.render({
            size: "sm",
            variant: "outline",
            children: html`${Icon.render({ icon: bell })} SMS/WhatsApp`,
            onClick: (event: MouseEvent) => {
              event.stopPropagation()
              props.onRemind?.({ id: tire.id, plate: tire.vehiclePlate })
            },
          })
    default:
      return nothing
  }
}

export default TireHotelPage
