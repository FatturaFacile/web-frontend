// Lines of code per feature: non-blank lines that are not only a comment,
// tests excluded. Angular counts TS, HTML, SCSS and LESS; Inglorious TS and
// CSS. Angular's unused payment-selector is left out.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { ANGULAR, INGLORIOUS } from "./paths.mjs"

// Angular's feature folders, and the Inglorious page folders that port them.
const FEATURES = {
  accounting: ["accounting-page"],
  alerts: ["alerts-page"],
  auth: ["login-page"],
  automotive: ["tire-hotel-page"],
  construction: ["construction-page"],
  crm: [
    "contacts-page",
    "contacts-grid",
    "contact-form",
    "clients-page",
    "suppliers-page",
  ],
  dashboard: ["dashboard-page"],
  "field-service": ["field-service-page"],
  hr: ["hr-page"],
  inventory: ["inventory-page"],
  manufacturing: ["manufacturing-page"],
  "order-history": ["orders-page"],
  professionals: ["professionals-page"],
  purchases: ["purchase-orders-page", "expenses-page"],
  rent: ["rent-page"],
  retail: ["retail-page"],
  sales: ["invoices-page", "qr-bill-page"],
  settings: ["settings-page"],
  system: ["backups-page"],
  "time-attendance": ["time-attendance-page"],
  treasury: ["treasury-page"],
  welcome: ["welcome-page"],
}
const DECIMALS = 2

const angular = [
  ...files(join(ANGULAR, "src/app"), [
    ".ts",
    ".html",
    ".scss",
    ".css",
    ".less",
  ]),
  ...["styles.scss", "theme.less", "main.ts", "index.html"].map((name) =>
    join(ANGULAR, "src", name),
  ),
].filter((file) => !file.includes("features/payment-selector"))
const inglorious = [
  ...files(join(INGLORIOUS, "src"), [".ts", ".css"]),
  ...files(join(INGLORIOUS, "types"), [".ts"]),
]

const rows = Object.entries(FEATURES).map(([feature, pages]) =>
  row(
    feature,
    count(angular.filter((file) => file.includes(`/features/${feature}/`))),
    count(
      inglorious.filter((file) =>
        pages.some((page) => file.includes(`/pages/${page}/`)),
      ),
    ),
  ),
)
const sum = (key) => rows.reduce((total, current) => total + current[key], 0)
const features = row("features", sum("angular"), sum("inglorious"))
const total = row("total", count(angular), count(inglorious))
console.table([
  ...rows,
  features,
  row(
    "shared",
    total.angular - features.angular,
    total.inglorious - features.inglorious,
  ),
  total,
  row("source files", angular.length, inglorious.length),
])

function files(dir, extensions) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path, extensions)
    const isSource = extensions.some((extension) => name.endsWith(extension))
    return isSource && !/\.(spec|test)\.ts$/.test(name) ? [path] : []
  })
}

function count(paths) {
  return paths.reduce(
    (total, path) => total + linesOfCode(readFileSync(path, "utf8")),
    0,
  )
}

function linesOfCode(source) {
  let lines = 0
  let isInComment = false
  for (const raw of source.split("\n")) {
    const line = raw.trim()
    if (isInComment) {
      isInComment = !line.includes("*/")
      continue
    }
    if (line.startsWith("/*")) {
      isInComment = !line.includes("*/")
      continue
    }
    if (
      !line ||
      line.startsWith("//") ||
      line.startsWith("*") ||
      line.startsWith("<!--")
    )
      continue
    lines += 1
  }
  return lines
}

function row(feature, angularLines, ingloriousLines) {
  return {
    feature,
    angular: angularLines,
    inglorious: ingloriousLines,
    ratio: Number((ingloriousLines / angularLines).toFixed(DECIMALS)),
  }
}
