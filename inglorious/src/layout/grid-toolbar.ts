import plusIcon from "@iconify-icons/fa7-solid/plus"
import { Button } from "@inglorious/ui/button"
import { Icon } from "@inglorious/ui/icon"
import { Input } from "@inglorious/ui/input"
import { html, nothing, type TemplateResult } from "@inglorious/web"

import { t } from "../i18n"

interface GridToolbarProps {
  /** The grid's id: the search field's id derives from it. */
  id?: string
  search?: { value: string } | null
  onSearchChange?: (value: string) => void
  /** Translation key of the search field's label and placeholder. */
  searchLabel: string
  /** Controls between the search and the create button, such as filters. */
  controls?: TemplateResult
  /** Translation key of the create button; none without it. */
  createLabel?: string
  onCreate?: () => void
}

/** What sits above a list: a labelled search, filters, and a create button. */
export function renderGridToolbar({
  id,
  search,
  onSearchChange,
  searchLabel,
  controls,
  createLabel,
  onCreate,
}: GridToolbarProps): TemplateResult {
  return html`<div class="iw-data-grid-toolbar ff-grid-toolbar">
    ${Input.render({
      id: `${id}-search`,
      inputType: "search",
      size: "sm",
      ariaLabel: t(searchLabel),
      placeholder: t(searchLabel),
      value: search?.value ?? "",
      onChange: (value) => onSearchChange?.(value),
    })}
    ${controls ?? nothing}
    <span class="ff-spacer"></span>
    ${
      createLabel
        ? Button.render({
            color: "primary",
            size: "sm",
            children: html`${Icon.render({ icon: plusIcon })} ${t(createLabel)}`,
            onClick: () => onCreate?.(),
          })
        : nothing
    }
  </div>`
}
