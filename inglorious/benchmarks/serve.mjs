// Usage: node serve.mjs <dist dir> <port>
// Serves a production build as a CDN would: brotli or gzip, a fallback to
// index.html for client routes, long caching for hashed files. The API
// answers as for a visitor who is not signed in, so no backend is involved.
import { existsSync, readFileSync, statSync } from "node:fs"
import { createServer } from "node:http"
import { extname, join } from "node:path"
import { brotliCompressSync, gzipSync } from "node:zlib"

const UNAUTHORIZED = 401
const NO_CONTENT = 204
const OK = 200

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".css": "text/css",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
  ".webmanifest": "application/manifest+json",
  ".txt": "text/plain",
}
const COMPRESSIBLE = /\.(html|js|css|json|svg|webmanifest|txt)$/
const HASHED = /[-.][\w-]{8,}\.(js|css|woff2)$/

const [root, port] = process.argv.slice(2)
const cache = new Map()

createServer((request, response) => {
  const { pathname } = new URL(request.url, "http://localhost")

  if (pathname.startsWith("/sanctum")) {
    response.writeHead(NO_CONTENT).end()
    return
  }
  if (pathname.startsWith("/api")) {
    response
      .writeHead(UNAUTHORIZED, { "content-type": "application/json" })
      .end(JSON.stringify({ message: "Unauthenticated." }))
    return
  }

  let file = join(root, decodeURIComponent(pathname))
  if (!existsSync(file) || statSync(file).isDirectory())
    file = join(root, "index.html")

  const accepted = request.headers["accept-encoding"] ?? ""
  const encoding = !COMPRESSIBLE.test(file)
    ? null
    : accepted.includes("br")
      ? "br"
      : accepted.includes("gzip")
        ? "gzip"
        : null

  const key = `${file}|${encoding}`
  if (!cache.has(key)) cache.set(key, encode(readFileSync(file), encoding))

  response.writeHead(OK, {
    "content-type": TYPES[extname(file)] ?? "application/octet-stream",
    "cache-control": HASHED.test(file)
      ? "public, max-age=31536000, immutable"
      : "no-cache",
    ...(encoding
      ? { "content-encoding": encoding, vary: "accept-encoding" }
      : {}),
  })
  response.end(cache.get(key))
}).listen(Number(port), () =>
  console.log(`Serving ${root} on http://localhost:${port}`),
)

function encode(buffer, encoding) {
  if (encoding === "br") return brotliCompressSync(buffer)
  if (encoding === "gzip") return gzipSync(buffer)
  return buffer
}
