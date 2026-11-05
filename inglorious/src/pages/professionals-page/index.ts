import check from "@iconify-icons/fa7-solid/check"
import { Icon } from "@inglorious/ui/icon"
import { html } from "@inglorious/web"

import { listCases } from "../../api/professionals"
import { t } from "../../i18n"
import { renderTag } from "../../layout/tag"
import type { LegalCase } from "../../models/professionals"
import { createListPage } from "../../types/list-page"

export const ProfessionalsPage = createListPage(
  listCases,
  (columnId, legalCase: LegalCase) => {
    switch (columnId) {
      case "num":
      case "fee":
        return html`<strong>${legalCase[columnId]}</strong>`
      // The Angular page shows every case as compliant, whatever it says.
      case "aml":
        return renderTag(
          html`${Icon.render({ icon: check })}
          ${t("PROFESSIONALS.AML_COMPLIANT")}`,
          "success",
        )
    }
  },
)

export default ProfessionalsPage
