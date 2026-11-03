/// <reference types="vitest/config" />
import fs from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { hmr } from "@inglorious/vite-plugin-hmr"
import { minifyTemplateLiterals } from "rollup-plugin-minify-template-literals"
import { defineConfig, loadEnv } from "vite"
import { ViteImageOptimizer } from "vite-plugin-image-optimizer"
import { VitePWA } from "vite-plugin-pwa"

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DEFAULT_BACKEND_URL = "https://api.fatturafacile.eu"
const SANCTUM_STATEFUL_PORT = 4200
const CERTS_DIR = path.resolve(__dirname, "../certs")

export default defineConfig(({ mode }) => ({
  define: { "process.env": {} },

  server: {
    // Sanctum keeps a cookie session only for origins in its
    // SANCTUM_STATEFUL_DOMAINS, which has the Angular dev server's port: from
    // any other the login succeeds but every later request is a 401.
    port: SANCTUM_STATEFUL_PORT,
    strictPort: true,
    // The Angular app's mkcert certificates, when generated (see ../certs).
    https: readCertificates(),

    // The backend answers on the dev server's own origin, so the Sanctum session
    // and XSRF cookies are first-party: dropping their domain keeps them on localhost.
    proxy: Object.fromEntries(
      ["/api", "/sanctum"].map((prefix) => [
        prefix,
        {
          target:
            loadEnv(mode, process.cwd()).VITE_BACKEND_URL ??
            DEFAULT_BACKEND_URL,
          changeOrigin: true,
          secure: true,
          cookieDomainRewrite: "",
        },
      ]),
    ),
  },

  plugins: [
    VitePWA({
      injectRegister: false,
      registerType: "prompt",
      pwaAssets: {
        image: "public/logo.png",
        preset: "minimal-2023",
      },
      manifest: {
        name: "Fattura Facile",
        short_name: "Fattura Facile",
        description: "Fatturazione e gestionale cross-border Italia-Svizzera.",
        theme_color: "#0f766e",
        background_color: "#ffffff",
        display: "standalone",
        start_url: "/",
      },
    }),
    ViteImageOptimizer(),
    hmr(),
  ],

  build: {
    rollupOptions: {
      plugins: [minifyTemplateLiterals()],
    },
  },

  test: {
    environment: "jsdom",
  },

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
}))

function readCertificates() {
  const cert = path.join(CERTS_DIR, "localhost.crt")
  const key = path.join(CERTS_DIR, "localhost.key")
  if (!fs.existsSync(cert) || !fs.existsSync(key)) return undefined
  return { cert: fs.readFileSync(cert), key: fs.readFileSync(key) }
}
