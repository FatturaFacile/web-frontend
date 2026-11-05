// Bundle sizes of both production builds, raw, gzip and brotli.
// Initial: what index.html loads (scripts, module preloads, stylesheets)
// and the JS those import statically. All: every .js and .css but the
// service worker's. Build both apps first.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs"
import { dirname, join, resolve } from "node:path"
import { brotliCompressSync, constants, gzipSync } from "node:zlib"

import { ANGULAR_DIST, INGLORIOUS_DIST } from "./paths.mjs"

const KB = 1024
const GZIP_LEVEL = 9
const BROTLI_QUALITY = 11
const LABEL_WIDTH = 16
const COLUMN_WIDTH = 10
const SERVICE_WORKER =
  /^(sw|ngsw-worker|safety-worker|worker-basic|workbox-.*)(\.min)?\.js$/

for (const [label, dist] of [
  ["Angular", ANGULAR_DIST],
  ["Inglorious", INGLORIOUS_DIST],
]) {
  report(label, dist)
}

function report(label, dist) {
  const initial = initialFiles(dist)
  const all = allFiles(dist)

  console.log(`\n${label}`)
  console.log(row("", "raw kB", "gzip kB", "br kB"))
  printSizes("initial JS", sizes(initial, ".js"))
  printSizes("initial CSS", sizes(initial, ".css"))
  printSizes("initial total", sizes(initial))
  printSizes("all JS", sizes(all, ".js"))
  printSizes("all CSS", sizes(all, ".css"))
  printSizes("all total", sizes(all))
}

function initialFiles(dist) {
  const html = readFileSync(join(dist, "index.html"), "utf8")
  const tags = [
    ...html.matchAll(/<script[^>]*src="([^"]+)"/g),
    ...html.matchAll(
      /<link[^>]*rel="(?:stylesheet|modulepreload)"[^>]*href="([^"]+)"/g,
    ),
  ]
  const files = new Set()
  const visit = (file) => {
    if (files.has(file) || !existsSync(file)) return
    files.add(file)
    if (!file.endsWith(".js")) return
    const source = readFileSync(file, "utf8")
    for (const [, spec] of source.matchAll(
      /(?:\bfrom|\bimport)\s*["']([^"']+\.js)["']/g,
    )) {
      visit(resolve(dirname(file), spec))
    }
  }
  for (const [, url] of tags) {
    if (!/^https?:/.test(url)) visit(resolve(dist, url.replace(/^\//, "")))
  }
  return [...files]
}

function allFiles(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return allFiles(path)
    return /\.(js|css)$/.test(name) && !SERVICE_WORKER.test(name) ? [path] : []
  })
}

function sizes(files, extension = "") {
  return files
    .filter((file) => file.endsWith(extension))
    .map((file) => readFileSync(file))
    .reduce(
      (total, buffer) => ({
        raw: total.raw + buffer.length,
        gzip: total.gzip + gzipSync(buffer, { level: GZIP_LEVEL }).length,
        brotli:
          total.brotli +
          brotliCompressSync(buffer, {
            params: { [constants.BROTLI_PARAM_QUALITY]: BROTLI_QUALITY },
          }).length,
      }),
      { raw: 0, gzip: 0, brotli: 0 },
    )
}

function printSizes(label, { raw, gzip, brotli }) {
  console.log(
    row(label, ...[raw, gzip, brotli].map((bytes) => (bytes / KB).toFixed(1))),
  )
}

function row(label, ...cells) {
  return [
    label.padEnd(LABEL_WIDTH),
    ...cells.map((cell) => cell.padStart(COLUMN_WIDTH)),
  ].join("")
}
