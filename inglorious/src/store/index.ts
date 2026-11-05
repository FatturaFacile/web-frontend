import { createStore } from "@inglorious/store"
import { withTransitions } from "@inglorious/ui/view-transitions"
import { Router, setRoutes } from "@inglorious/web/router"
import { MediaQuery } from "@inglorious/web/sensors/media-query"

import type { AppEntity, AppState } from "../../types"
import { I18n } from "../i18n"
import { NotPortedPage } from "../pages/not-ported-page"
import { Redirect } from "../types/redirect"
import { Session } from "../types/session"
import { Shell } from "../types/shell"
import { Toast } from "../types/toast"
import { Workspace } from "../types/workspace"
import { entities } from "./entities"
import { middlewares } from "./middlewares"
import { routes } from "./routes"

setRoutes(routes)

export const store = createStore<AppEntity, AppState>({
  types: {
    Router,
    I18n,
    Session,
    Shell,
    Toast,
    Redirect,
    Workspace,
    MediaQuery,
    NotPortedPage,
  },
  entities,
  middlewares: [withTransitions(), ...middlewares],
})
