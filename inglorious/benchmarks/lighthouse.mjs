// Lighthouse on both apps' login pages: five desktop and five mobile runs
// each, medians reported. Build both apps first; needs Google Chrome.
import { spawn, spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"

import { ANGULAR_DIST, INGLORIOUS_DIST } from "./paths.mjs"

const LIGHTHOUSE = "lighthouse@12.8.2"
const RUNS = 5
const KB = 1024
const PERCENT = 100
const SERVER_START_MS = 1000
const CLS_DECIMALS = 3
const APPS = [
  { name: "Angular", dist: ANGULAR_DIST, port: 4301 },
  { name: "Inglorious", dist: INGLORIOUS_DIST, port: 4302 },
]
const FORM_FACTORS = {
  desktop: ["--preset=desktop"],
  mobile: ["--form-factor=mobile"],
}

const out = mkdtempSync(join(tmpdir(), "lighthouse-"))
const servers = APPS.map(({ dist, port }) =>
  spawn(process.execPath, [
    join(import.meta.dirname, "serve.mjs"),
    dist,
    String(port),
  ]),
)
await new Promise((resolve) => setTimeout(resolve, SERVER_START_MS))

try {
  const rows = []
  for (const { name, port } of APPS) {
    for (const [formFactor, flags] of Object.entries(FORM_FACTORS)) {
      const reports = Array.from({ length: RUNS }, (_, run) =>
        audit(
          `http://localhost:${port}/login`,
          flags,
          join(out, `${name}-${formFactor}-${run}.json`),
        ),
      )
      rows.push(summarize(`${name} ${formFactor}`, reports))
    }
  }
  console.table(rows)
} finally {
  servers.forEach((server) => server.kill())
}

function audit(url, flags, path) {
  spawnSync(
    "pnpm",
    [
      "dlx",
      LIGHTHOUSE,
      url,
      ...flags,
      "--quiet",
      "--chrome-flags=--headless=new",
      "--output=json",
      `--output-path=${path}`,
    ],
    { stdio: "inherit" },
  )
  return JSON.parse(readFileSync(path, "utf8"))
}

function summarize(label, reports) {
  const median = (pick) => {
    const values = reports.map(pick).sort((a, b) => a - b)
    return values[Math.floor(values.length / 2)]
  }
  const score = (id) =>
    median((report) => report.categories[id].score * PERCENT)
  const metric = (id) =>
    Math.round(median((report) => report.audits[id].numericValue))
  const transfer = (type) =>
    (
      median((report) =>
        report.audits["network-requests"].details.items
          .filter((item) => !type || item.resourceType === type)
          .reduce((sum, item) => sum + item.transferSize, 0),
      ) / KB
    ).toFixed(1)

  return {
    run: label,
    performance: score("performance"),
    accessibility: score("accessibility"),
    "best practices": score("best-practices"),
    seo: score("seo"),
    "FCP ms": metric("first-contentful-paint"),
    "LCP ms": metric("largest-contentful-paint"),
    "TBT ms": metric("total-blocking-time"),
    CLS: median(
      (report) => report.audits["cumulative-layout-shift"].numericValue,
    ).toFixed(CLS_DECIMALS),
    "SI ms": metric("speed-index"),
    "total kB": transfer(),
    "JS kB": transfer("Script"),
    "CSS kB": transfer("Stylesheet"),
    requests: median(
      (report) => report.audits["network-requests"].details.items.length,
    ),
  }
}
