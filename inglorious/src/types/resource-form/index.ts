import type { BaseEntity } from "@inglorious/store"
import { handleAsync } from "@inglorious/store/async"
import {
  Form,
  type FormEntity,
  type FormErrors,
  type FormValues,
} from "@inglorious/web/form"

import type { AppApi, ResourceFormFields } from "../../../types"
import { applyServerErrors } from "../../forms/server-errors"
import { hasErrors } from "../../forms/validation"

type ResourceFormEntity<TValues extends FormValues> = BaseEntity &
  FormEntity<TValues> &
  ResourceFormFields & { id: string }

interface ResourceFormOptions<TValues extends FormValues, TRow, TPayload> {
  /** The form's values for a row of the grid, or for a new one. */
  toValues: (row: TRow | null, api: AppApi) => TValues
  /** Errors are translation keys. */
  validate: (values: TValues) => FormErrors<TValues>
  toPayload: (values: TValues, api: AppApi) => TPayload
  /** Creates without an id, updates with one. */
  save: (id: string | null, payload: TPayload) => Promise<unknown>
  /** Translation keys of the toast once saved. */
  createdKey: string
  updatedKey: string
}

interface SaveRequest<TPayload> {
  id: string | null
  payload: TPayload
}

/**
 * The behavior of a form that creates or edits a row of a grid: it opens on
 * the row (or a blank one), validates, saves, binds the server's validation
 * errors to the fields, and has the grid load again. The form's `render` is
 * its own.
 */
export function createResourceForm<
  TValues extends FormValues,
  TRow extends { id: string },
  TPayload,
>({
  toValues,
  validate,
  toPayload,
  save,
  createdKey,
  updatedKey,
}: ResourceFormOptions<TValues, TRow, TPayload>) {
  return [
    Form,
    {
      open(
        entity: ResourceFormEntity<TValues>,
        { id, gridId }: { id: string | null; gridId: string },
        api: AppApi,
      ) {
        const grid = api.getEntity(gridId) as { rows?: TRow[] } | undefined
        const row = grid?.rows?.find((candidate) => candidate.id === id) ?? null

        entity.initialValues = toValues(row, api)
        Form.reset(entity)
        entity.editingId = row?.id ?? null
        entity.gridId = gridId
        entity.hasSubmitted = false
        entity.failure = null
        entity.isOpen = true
      },

      close(entity: ResourceFormEntity<TValues>) {
        if (!entity.isSubmitting) entity.isOpen = false
      },

      submit(entity: ResourceFormEntity<TValues>, _: void, api: AppApi) {
        entity.hasSubmitted = true
        entity.errors = validate(entity.values)
        entity.isValid = !hasErrors(entity.errors)
        if (!entity.isValid) return

        api.notify(`#${entity.id}:save`, {
          id: entity.editingId,
          payload: toPayload(entity.values, api),
        })
      },

      // Inside a generic factory the entity cannot be inferred: it is spelled out.
      ...handleAsync<
        ResourceFormEntity<TValues>,
        SaveRequest<TPayload>,
        unknown,
        AppApi,
        "save"
      >("save", {
        start(entity: ResourceFormEntity<TValues>) {
          entity.isSubmitting = true
          entity.failure = null
        },

        run: ({ id, payload }: SaveRequest<TPayload>) => save(id, payload),

        success(entity: ResourceFormEntity<TValues>, _: unknown, api: AppApi) {
          entity.isOpen = false
          api.notify("#toast:show", {
            key: entity.editingId ? updatedKey : createdKey,
          })
          if (entity.gridId) api.notify(`#${entity.gridId}:fetch`)
        },

        error(entity: ResourceFormEntity<TValues>, error: unknown) {
          const [unmapped = null] = applyServerErrors(entity, error)
          entity.failure = unmapped
        },

        finally(entity: ResourceFormEntity<TValues>) {
          entity.isSubmitting = false
        },
      }),
    },
  ]
}
