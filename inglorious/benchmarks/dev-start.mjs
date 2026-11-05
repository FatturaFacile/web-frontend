// Dev server start-up: the time until each server says it is ready, and
// until it serves the page and its entry module (Vite compiles on request).
// Run once after deleting .angular/cache and inglorious/node_modules/.vite
// for a cold start, and again for a warm one.
import { spawn } from "node:child_process"
import { stripVTControlCharacters } from "node:util"

import { ANGULAR, INGLORIOUS } from "./paths.mjs"

const TIMEOUT_MS = 180_000
const SERVERS = [
  {
    name: "Angular",
    cwd: ANGULAR,
    port: 4310,
    command: [
      "npx",
      "ng",
      "serve",
      "--port",
      "4310",
      "--ssl=false",
      "--configuration",
      "local",
    ],
  },
  {
    name: "Inglorious",
    cwd: INGLORIOUS,
    port: 4311,
    command: ["npx", "vite", "--port", "4311"],
  },
]

for (const server of SERVERS) {
  const { readyMs, servedMs } = await time(server)
  console.log(
    `${server.name}: ready in ${readyMs} ms, page served in ${servedMs} ms`,
  )
}

function time({ cwd, port, command: [bin, ...args] }) {
  const start = performance.now()
  const child = spawn(bin, args, { cwd, detached: true })
  let output = ""

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => stop(new Error(`No ready message:\n${output}`)),
      TIMEOUT_MS,
    )
    const stop = (error, result) => {
      clearTimeout(timeout)
      process.kill(-child.pid)
      if (error) reject(error)
      else resolve(result)
    }
    const onData = async (data) => {
      output += data
      if (!stripVTControlCharacters(output).includes("Local:")) return
      child.stdout.off("data", onData)
      child.stderr.off("data", onData)
      const readyMs = Math.round(performance.now() - start)
      const base = `http://localhost:${port}`
      const html = await (await fetch(`${base}/login`)).text()
      const [entry] = [
        ...html.matchAll(/<script[^>]*type="module"[^>]*src="([^"]+)"/g),
      ]
        .map(([, src]) => src)
        .reverse()
      if (entry) await (await fetch(new URL(entry, base))).text()
      stop(null, { readyMs, servedMs: Math.round(performance.now() - start) })
    }
    child.stdout.on("data", onData)
    child.stderr.on("data", onData)
  })
}
