import { Card } from "@inglorious/ui/card"
import { html, type TemplateResult } from "@inglorious/web"

import { t } from "../i18n"

export type KpiTone = "primary" | "warning" | "success" | "accent"

/** One figure in a row of `.ff-kpis`, the ng-zorro statistic of the Angular pages. */
export function renderKpi(
  titleKey: string,
  value: TemplateResult | string | number,
  tone: KpiTone = "primary",
): TemplateResult {
  return Card.render({
    children: html`<div class="ff-kpi ff-kpi-${tone}">
      <div class="ff-kpi-title">${t(titleKey)}</div>
      <div class="ff-kpi-value">${value}</div>
    </div>`,
  })
}
