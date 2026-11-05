import type { RedirectType } from "../../../types"

/** A route that only sends the browser elsewhere, such as `/` to the home page. */
export const Redirect: RedirectType = {
  routeChange(entity, payload, api) {
    if (payload.route !== entity.id) return
    api.notify("#router:navigate", { to: entity.to, replace: true })
  },

  render() {
    return null
  },
}
