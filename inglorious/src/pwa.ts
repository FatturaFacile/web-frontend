// Only the framework-free helpers: "client" also loads React's and Preact's
// typings, whose global JSX would replace Inglorious's.
/// <reference types="vite-plugin-pwa/vanillajs" />
import { isNative } from "@inglorious/web/mobile"
import { watchPwaUpdate } from "@inglorious/web/pwa"
import { registerSW } from "virtual:pwa-register"

if (!isNative()) {
  registerSW({
    onRegisteredSW(url, registration) {
      if (registration) watchPwaUpdate(registration)
    },
  })
}
