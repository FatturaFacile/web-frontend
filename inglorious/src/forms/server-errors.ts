import type { FormEntity } from "@inglorious/web/form"

import { getValidationErrors } from "../api/http"

const FIRST_MESSAGE = 0

/**
 * Binds a Laravel 422 response to the form's fields. Dotted keys
 * (`address.city`) reach nested fields. Returns the messages of fields the
 * form does not have, to be shown elsewhere.
 */
export function applyServerErrors(form: FormEntity, error: unknown): string[] {
  const errors = getValidationErrors(error)
  if (!errors) return []

  const unmapped: string[] = []
  for (const [path, messages] of Object.entries(errors)) {
    const message = messages[FIRST_MESSAGE]
    if (hasField(form.values, path)) {
      setPath(form.errors, path, message)
      setPath(form.touched, path, true)
      form.isValid = false
    } else {
      unmapped.push(message)
    }
  }
  return unmapped
}

function hasField(values: Record<string, unknown>, path: string): boolean {
  let node: unknown = values
  for (const key of path.split(".")) {
    if (typeof node !== "object" || node === null || !(key in node)) {
      return false
    }
    node = (node as Record<string, unknown>)[key]
  }
  return true
}

function setPath(target: object, path: string, value: unknown) {
  const keys = path.split(".")
  const last = keys.pop()!
  let node = target as Record<string, unknown>
  for (const key of keys) {
    node[key] ??= {}
    node = node[key] as Record<string, unknown>
  }
  node[last] = value
}
