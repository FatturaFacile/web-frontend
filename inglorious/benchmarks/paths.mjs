import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

/** The repository's root: the Angular app's, with Inglorious in `inglorious/`. */
export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..")
export const ANGULAR = ROOT
export const INGLORIOUS = join(ROOT, "inglorious")
export const ANGULAR_DIST = join(ANGULAR, "dist", "fatturafacile", "browser")
export const INGLORIOUS_DIST = join(INGLORIOUS, "dist")
