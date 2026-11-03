import circleCheck from "@iconify-icons/fa7-solid/circle-check"
import rightFromBracket from "@iconify-icons/fa7-solid/right-from-bracket"
import rightToBracket from "@iconify-icons/fa7-solid/right-to-bracket"
import shieldHalved from "@iconify-icons/fa7-solid/shield-halved"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { DataGrid } from "@inglorious/ui/data-grid"
import { Icon } from "@inglorious/ui/icon"
import { LoadStatus } from "@inglorious/ui/load-status"
import { Progress } from "@inglorious/ui/progress"
import { html, nothing, type TemplateResult } from "@inglorious/web"
import { classMap } from "@inglorious/web/directives/class-map"
import { when } from "@inglorious/web/directives/when"
import { pageRouteChange } from "@inglorious/web/router"

import type {
  AppApi,
  AttendanceGridEntity,
  TimeAttendancePageEntity,
} from "../../../types"
import { describeLoadFailure } from "../../api/http"
import { getTimeAttendance } from "../../api/time-attendance"
import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { formatDecimal } from "../../layout/format"
import { renderKpi } from "../../layout/kpi"
import { renderPageHeader } from "../../layout/page-header"
import { renderTag } from "../../layout/tag"
import type {
  AttendanceRecord,
  TimeAttendanceData,
} from "../../models/time-attendance"
import { withCells } from "../../types/grid-cells"

// The weekly limit the Angular page assumed while the data was missing.
const DEFAULT_WEEKLY_LIMIT_HOURS = 45
const FULL = 100
// Past this share of the weekly limit, the gauge turns red.
const NEAR_LIMIT_PERCENT = 90
const NOTHING_YET = 0
// `toTimeString()` starts with `HH:mm`.
const START = 0
const TIME_LENGTH = 5

export const AttendanceGrid = {
  ...DataGrid,

  /** The records come with the rest of the page's data, which the page loads. */
  rowsReplace(entity: AttendanceGridEntity, rows: AttendanceRecord[]) {
    entity.rows = rows
    if (entity.pagination) entity.pagination.page = 0
  },

  ...withCells((_props, columnId, record: AttendanceRecord) =>
    renderRecordCell(columnId, record),
  ),
}

export const TimeAttendancePage = [
  {
    routeChange: pageRouteChange<TimeAttendancePageEntity & { id: string }>({
      open: (entity, _, api) => api.notify(`#${entity.id}:fetch`),
    }),

    ...handleAsync("fetch", {
      start(entity: TimeAttendancePageEntity) {
        entity.isLoading = true
        entity.failure = null
      },

      run: () => getTimeAttendance(),

      success(
        entity: TimeAttendancePageEntity,
        { records, ...data }: TimeAttendanceData,
        api: AppApi,
      ) {
        entity.data = data
        api.notify(`#${entity.gridId}:rowsReplace`, records)
      },

      error(entity: TimeAttendancePageEntity, error: unknown) {
        entity.failure = describeLoadFailure(error)
      },

      finally(entity: TimeAttendancePageEntity) {
        entity.isLoading = false
      },
    }),

    // As in Angular, the clock lives in the page only: nothing reaches the
    // backend, and a reload forgets it.
    clockToggle(entity: TimeAttendancePageEntity) {
      const session = entity.data?.todaySession
      if (!session) return

      session.isClockedIn = !session.isClockedIn
      if (session.isClockedIn) {
        session.clockInTime = new Date()
          .toTimeString()
          .slice(START, TIME_LENGTH)
      }
    },

    render(entity: TimeAttendancePageEntity, api: AppApi): TemplateResult {
      const { data } = entity

      return html`
        ${renderPageHeader("ATTENDANCE.TITLE", "ATTENDANCE.SUBTITLE")}
        ${LoadStatus.render({
          isLoading: entity.isLoading && !data,
          loadingLabel: t("APP.LOADING"),
          isError: Boolean(entity.failure),
          error: Alert.render({
            severity: "error",
            description: entity.failure ? t(entity.failure) : "",
            action: Button.render({
              size: "sm",
              children: t("APP.RETRY"),
              onClick: () => api.notify(`#${entity.id}:fetch`),
            }),
          }),
          content: () => html`
            <div class="ff-attendance-cards">
              ${renderTerminal(entity, api)} ${renderLimits(data)}
              ${renderAccruals(data)}
            </div>
            ${Card.render({
              title: t("ATTENDANCE.LOG_TITLE"),
              children: api.render(entity.gridId),
            })}
          `,
        })}
      `
    },
  },
  requireAuth,
]

function renderTerminal(
  entity: TimeAttendancePageEntity,
  api: AppApi,
): TemplateResult {
  const session = entity.data?.todaySession
  const isClockedIn = session?.isClockedIn ?? false

  return Card.render({
    title: t("ATTENDANCE.TERMINAL_TITLE"),
    children: html`<div class="ff-terminal">
      <p class="ff-terminal-status" role="status">
        <span
          class=${classMap({ "ff-status-dot": true, "ff-status-dot-on": isClockedIn })}
        ></span>
        ${t(isClockedIn ? "ATTENDANCE.CLOCKED_IN" : "ATTENDANCE.CLOCKED_OUT")}
      </p>
      <dl class="ff-detail-list">
        <dt>${t("ATTENDANCE.SHIFT_START")}</dt>
        <dd>${session?.clockInTime ?? "--:--"}</dd>
        <dt>${t("ATTENDANCE.LOGGED_BREAK")}</dt>
        <dd>${session?.breakMinutes ?? NOTHING_YET} min</dd>
        <dt>${t("ATTENDANCE.HOURS_TODAY")}</dt>
        <dd>${formatDecimal(session?.totalTodayHours ?? NOTHING_YET)} h</dd>
      </dl>
      ${Button.render({
        size: "lg",
        isFullWidth: true,
        color: isClockedIn ? "error" : "primary",
        variant: isClockedIn ? "outline" : "default",
        isDisabled: !session,
        children: isClockedIn
          ? html`${Icon.render({ icon: rightFromBracket })}
            ${t("ATTENDANCE.BTN_CLOCK_OUT")}`
          : html`${Icon.render({ icon: rightToBracket })}
            ${t("ATTENDANCE.BTN_CLOCK_IN")}`,
        onClick: () => api.notify(`#${entity.id}:clockToggle`),
      })}
    </div>`,
  })
}

function renderLimits(data: TimeAttendancePageEntity["data"]): TemplateResult {
  const worked = data?.summary.weeklyHoursWorked ?? NOTHING_YET
  const limit = data?.summary.weeklyLimitHours ?? DEFAULT_WEEKLY_LIMIT_HOURS
  const percent = Math.min(FULL, Math.round((worked / limit) * FULL))

  return Card.render({
    title: t("ATTENDANCE.LIMITS_TITLE"),
    children: html`<div class="ff-gauge">
      ${Progress.render({
        variant: "circular",
        value: percent,
        color: percent > NEAR_LIMIT_PERCENT ? "error" : "primary",
        size: 120,
        ariaLabel: t("ATTENDANCE.LIMITS_TITLE"),
      })}
      <div>
        <p class="ff-gauge-value"><strong>${worked} h</strong> / ${limit} h</p>
        <p class="ff-sub-text">
          ${t("ATTENDANCE.REGIME_LABEL")} ${data?.summary.regime ?? ""}
        </p>
        ${when(data?.summary.statutoryRestCompliant, () =>
          renderTag(
            html`${Icon.render({ icon: shieldHalved })}
            ${t("ATTENDANCE.REST_COMPLIANT")}`,
            "success",
          ),
        )}
      </div>
    </div>`,
  })
}

function renderAccruals(
  data: TimeAttendancePageEntity["data"],
): TemplateResult {
  const vacations = data?.vacations
  return Card.render({
    title: t("ATTENDANCE.ACCRUALS_TITLE"),
    children: html`<div class="ff-kpis">
        ${renderKpi(
          "ATTENDANCE.VACATION_REMAINING",
          `${vacations?.remainingDays ?? NOTHING_YET} ${t("ATTENDANCE.DAYS_SUFFIX")}`,
          "success",
        )}
        ${renderKpi(
          "ATTENDANCE.TIME_BANK",
          `${vacations?.rolHoursAvailable ?? NOTHING_YET} ${t("ATTENDANCE.HOURS_SUFFIX")}`,
        )}
      </div>
      <p class="ff-sub-text">
        ${t("ATTENDANCE.ANNUAL_ENTITLEMENT", {
          days: vacations?.annualEntitlementDays ?? NOTHING_YET,
        })}
        ·
        ${t("ATTENDANCE.DAYS_TAKEN", { days: vacations?.takenDays ?? NOTHING_YET })}
      </p>`,
  })
}

function renderRecordCell(
  columnId: string,
  record: AttendanceRecord,
): TemplateResult | string | typeof nothing {
  switch (columnId) {
    case "date":
      return html`<strong>${record.date}</strong>`
    case "clockOut":
      return record.clockOut ?? t("ATTENDANCE.SHIFT_IN_PROGRESS")
    case "breakMinutes":
      return `${record.breakMinutes} min`
    case "hoursWorked":
      return html`<strong>${formatDecimal(record.hoursWorked)} h</strong>`
    case "status":
      return record.status === "COMPLETED"
        ? renderTag(t("ATTENDANCE.SHIFT_CLOSED"), "info")
        : renderTag(t("ATTENDANCE.SHIFT_ACTIVE"), "primary")
    case "complianceNotice":
      return html`<span class="ff-compliance"
        >${Icon.render({ icon: circleCheck })} ${record.complianceNotice}</span
      >`
    default:
      return nothing
  }
}

export default TimeAttendancePage
