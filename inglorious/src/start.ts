import { mount } from "@inglorious/web"

import { onRequestFail } from "./api/http"
import { App } from "./app"
import { ready } from "./i18n"
import { store } from "./store"

/** Starts the app in `root`: what main.ts runs, and the tests too. */
export async function start(root: HTMLElement): Promise<void> {
  // Every failed request becomes an event: the session hears expired sessions,
  // the toast everything else worth telling.
  onRequestFail((error) => store.notify("requestFail", error))

  // Mounts once the starting language has loaded, so the first render is
  // already translated.
  await ready
  mount(store, (api) => App.render(api), root)
}
