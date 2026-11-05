import { html } from "@inglorious/web"

import { listVehicles } from "../../api/rent"
import { t } from "../../i18n"
import { renderTag } from "../../layout/tag"
import type { RentalVehicle } from "../../models/rent"
import { createListPage } from "../../types/list-page"

export const RentPage = createListPage(
  listVehicles,
  (columnId, vehicle: RentalVehicle) => {
    switch (columnId) {
      case "plate":
        return html`<strong>${vehicle.plate}</strong> - ${vehicle.model}`
      case "vignette":
        return vehicle.vignette
          ? renderTag(t("RENT.VIGNETTE_ACTIVE"), "success")
          : renderTag(t("RENT.VIGNETTE_NONE"))
      case "status":
        return renderTag(vehicle.status, "info")
    }
  },
)

export default RentPage
