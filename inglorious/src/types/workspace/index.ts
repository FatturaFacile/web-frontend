import { ButtonGroup } from "@inglorious/ui/button-group"
import { Select } from "@inglorious/ui/select"
import { html } from "@inglorious/web"

import type { WorkspaceType } from "../../../types"
import { t } from "../../i18n"
import type { Jurisdiction } from "../../models/invoice"

const CURRENCIES = { IT: "EUR", CH: "CHF" } as const
const FLAGS = { IT: "🇮🇹", CH: "🇨🇭" } as const

/**
 * The jurisdiction and currency the user works in, from the Angular header.
 * Client-side only there too: they shape what pages show, not what the
 * backend answers.
 */
export const Workspace: WorkspaceType = {
  jurisdictionChange(entity, jurisdiction) {
    entity.jurisdiction = jurisdiction
    entity.currency = CURRENCIES[jurisdiction]
  },

  currencyChange(entity, currency) {
    entity.currency = currency
  },

  render(entity, api) {
    return html`<div class="ff-workspace">
      ${ButtonGroup.render({
        size: "sm",
        variant: "outline",
        value: entity.jurisdiction,
        // The short code shows; the full name is the button's accessible name.
        buttons: (["IT", "CH"] as const).map((jurisdiction) => ({
          value: jurisdiction,
          label: t(`HEADER.JURISDICTION_${jurisdiction}`),
          children: `${FLAGS[jurisdiction]} ${jurisdiction}`,
        })),
        onChange: (value) =>
          api.notify(`#${entity.id}:jurisdictionChange`, value as Jurisdiction),
      })}
      ${Select.render({
        id: `${entity.id}-currency`,
        size: "sm",
        ariaLabel: t("SWISS_QR.CURRENCY_LBL"),
        value: entity.currency,
        options: [
          { value: "EUR", label: "€ EUR" },
          { value: "CHF", label: "CHF" },
        ],
        onChange: (value) =>
          api.notify(`#${entity.id}:currencyChange`, value as "EUR" | "CHF"),
      })}
    </div>`
  },
}
