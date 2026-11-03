/** Whether a form's errors, at any depth, hold one. */
export function hasErrors(errors: unknown): boolean {
  if (errors === null || errors === undefined) return false
  if (typeof errors !== "object") return Boolean(errors)
  return Object.values(errors).some(hasErrors)
}
