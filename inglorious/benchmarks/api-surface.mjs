// The framework API each app uses: distinct runtime names imported from its
// framework and component library packages, tests excluded.
import { readdirSync, readFileSync, statSync } from "node:fs"
import { join } from "node:path"

import { ANGULAR, INGLORIOUS } from "./paths.mjs"

const IMPORT =
  /import\s+(type\s+)?(?:(\w+)\s*,?\s*)?(?:\{([^}]*)\})?\s*from\s*["']([^"']+)["']/g

report(
  "Angular",
  join(ANGULAR, "src/app"),
  /^(@angular|rxjs|@ngrx|ng-zorro-antd)/,
)
report("Inglorious", join(INGLORIOUS, "src"), /^(@inglorious|lit-html)/)

function report(label, dir, packages) {
  const namesByPackage = new Map()
  for (const file of files(dir)) {
    const source = readFileSync(file, "utf8")
    for (const [, isTypeOnly, defaultName, named = "", spec] of source.matchAll(
      IMPORT,
    )) {
      if (isTypeOnly || !packages.test(spec)) continue
      const name = packageName(spec)
      const names = namesByPackage.get(name) ?? new Set()
      if (defaultName) names.add(`${spec} (default)`)
      for (const entry of named.split(",").map((part) => part.trim())) {
        if (entry && !entry.startsWith("type "))
          names.add(entry.split(/\s+as\s+/)[0])
      }
      namesByPackage.set(name, names)
    }
  }
  const rows = [...namesByPackage]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([name, names]) => ({ package: name, names: names.size }))
  rows.push({
    package: "total",
    names: rows.reduce((sum, { names }) => sum + names, 0),
  })
  console.log(`\n${label}`)
  console.table(rows)
}

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) return files(path)
    return name.endsWith(".ts") && !/\.(spec|test)\.ts$/.test(name)
      ? [path]
      : []
  })
}

function packageName(spec) {
  const parts = spec.split("/")
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]
}
