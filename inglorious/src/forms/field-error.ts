import {
  type FormEntity,
  type FormValues,
  getFieldError,
  isFieldTouched,
} from "@inglorious/web/form"

import { t } from "../i18n"

/**
 * A field's error, translated, once there is reason to show it: the field was
 * touched, or the form was submitted. Paths reach into arrays: `lines.0.debit`.
 */
export function fieldError<TValues extends FormValues>(
  form: FormEntity<TValues> & { hasSubmitted: boolean },
  path: string,
): string | undefined {
  const entity = form as unknown as FormEntity
  const error = getFieldError(entity, path)
  if (!error || !(form.hasSubmitted || isFieldTouched(entity, path)))
    return undefined
  return t(error)
}
