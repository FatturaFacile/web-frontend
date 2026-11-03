import { html, type TemplateResult } from "@inglorious/web"

import { t } from "../i18n"

/**
 * The title and subtitle every page opens with. Both are translation keys;
 * `detail`, such as the tenant, follows the subtitle in brackets.
 */
export function renderPageHeader(
  titleKey: string,
  subtitleKey: string,
  detail?: string,
): TemplateResult {
  return html`<header class="ff-page-header">
    <h1>${t(titleKey)}</h1>
    <p>${t(subtitleKey)}${detail ? ` (${detail})` : ""}</p>
  </header>`
}
