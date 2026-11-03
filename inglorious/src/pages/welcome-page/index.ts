import cartShopping from "@iconify-icons/fa7-solid/cart-shopping"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { Icon } from "@inglorious/ui/icon"
import { html } from "@inglorious/web"

import { requireAuth } from "../../guards"
import { t } from "../../i18n"
import { renderPageHeader } from "../../layout/page-header"

export const WelcomePage = [
  {
    render() {
      return html`
        ${renderPageHeader("WELCOME.TITLE", "WELCOME.SUBTITLE")}
        ${Card.render({
          title: t("WELCOME.QUICK_ACCESS"),
          children: html`<p>${t("WELCOME.DESC")}</p>
            ${Button.render({
              href: "/orders",
              color: "primary",
              children: html`${Icon.render({ icon: cartShopping })}
              ${t("WELCOME.GO_ORDERS")}`,
            })}`,
        })}
      `
    },
  },
  requireAuth,
]

export default WelcomePage
