import eyeIcon from "@iconify-icons/fa7-solid/eye"
import eyeSlashIcon from "@iconify-icons/fa7-solid/eye-slash"
import lockOutline from "@iconify-icons/material-symbols/lock-outline"
import mailOutline from "@iconify-icons/material-symbols/mail-outline"
import type { Message } from "@inglorious/i18n"
import { handleAsync } from "@inglorious/store/async"
import { Alert } from "@inglorious/ui/alert"
import { Button } from "@inglorious/ui/button"
import { Card } from "@inglorious/ui/card"
import { Checkbox } from "@inglorious/ui/checkbox"
import { Icon } from "@inglorious/ui/icon"
import { IconButton } from "@inglorious/ui/icon-button"
import { Input } from "@inglorious/ui/input"
import { html, type TemplateResult } from "@inglorious/web"
import { when } from "@inglorious/web/directives/when"
import { Form } from "@inglorious/web/form"
import { safePath } from "@inglorious/web/router"

import type { AppApi, LoginPageEntity, LoginValues } from "../../../types"
import { type Credentials, getProfile, signIn } from "../../api/auth"
import { HttpError, setTenantId } from "../../api/http"
import { HOME_PATH } from "../../config"
import { fieldError } from "../../forms/field-error"
import { applyServerErrors } from "../../forms/server-errors"
import { requireGuest } from "../../guards"
import { t } from "../../i18n"
import type { UserProfile } from "../../models/user"

const MIN_PASSWORD_LENGTH = 6
const UNAUTHORIZED = 401
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

interface SignInSuccess {
  user: UserProfile
}

export const LoginPage = [
  Form,
  {
    passwordToggle(entity: LoginPageEntity) {
      entity.isPasswordVisible = !entity.isPasswordVisible
    },

    submit(entity: LoginPageEntity, _: void, api: AppApi) {
      entity.hasSubmitted = true
      entity.errors = validate(entity.values)
      entity.isValid = !entity.errors.email && !entity.errors.password
      if (!entity.isValid) return

      // A copy: `run` reads it after an await, when this draft is revoked.
      api.notify(`#${entity.id}:signIn`, { ...entity.values })
    },

    ...handleAsync("signIn", {
      start(entity: LoginPageEntity) {
        entity.isSubmitting = true
        entity.failure = null
      },

      async run(credentials: Credentials): Promise<SignInSuccess> {
        const { data } = await signIn(credentials)
        setTenantId(data.tenant_id ?? null)
        // The profile has what the login answer may leave out: the tenants and the language.
        return { user: (await getProfile()).data }
      },

      success(entity: LoginPageEntity, { user }: SignInSuccess, api: AppApi) {
        Form.reset(entity)
        entity.hasSubmitted = false
        api.notify("#session:signIn", user)

        const { query } = api.getEntity("router")!
        api.notify("#router:navigate", {
          to: safePath(query?.from) ?? HOME_PATH,
          replace: true,
        })
      },

      error(entity: LoginPageEntity, error: unknown) {
        entity.failure = describeFailure(entity, error)
      },

      finally(entity: LoginPageEntity) {
        entity.isSubmitting = false
      },
    }),

    render(entity: LoginPageEntity, api: AppApi): TemplateResult {
      const { id } = entity
      const change = (path: keyof LoginValues, value: unknown) =>
        api.notify(`#${id}:fieldChange`, { path, value })

      return html`<div class="ff-login">
        <header class="ff-login-header">
          <h1>Fattura <span class="ff-brand-accent">Facile</span></h1>
          <p>${t("AUTH.SUBTITLE")}</p>
        </header>
        ${Card.render({
          children: html`<form
            class="ff-form"
            novalidate
            @submit=${(event: SubmitEvent) => {
              event.preventDefault()
              api.notify(`#${id}:submit`)
            }}
          >
            ${when(entity.failure, () =>
              Alert.render({
                severity: "error",
                description: t(entity.failure!),
              }),
            )}
            ${Input.render({
              id: `${id}-email`,
              label: t("AUTH.EMAIL"),
              inputType: "email",
              autocomplete: "username",
              icon: Icon.render({ icon: mailOutline }),
              placeholder: "name@company.com",
              isRequired: true,
              isFullWidth: true,
              value: entity.values.email,
              error: fieldError(entity, "email"),
              onChange: (value) => change("email", value),
            })}
            <div class="ff-password">
              ${Input.render({
                id: `${id}-password`,
                label: t("AUTH.PASSWORD"),
                inputType: entity.isPasswordVisible ? "text" : "password",
                autocomplete: "current-password",
                icon: Icon.render({ icon: lockOutline }),
                isRequired: true,
                isFullWidth: true,
                value: entity.values.password,
                error: fieldError(entity, "password"),
                onChange: (value) => change("password", value),
              })}
              ${IconButton.render({
                icon: Icon.render({
                  icon: entity.isPasswordVisible ? eyeSlashIcon : eyeIcon,
                }),
                ariaLabel: t(
                  entity.isPasswordVisible
                    ? "AUTH.HIDE_PASSWORD"
                    : "AUTH.SHOW_PASSWORD",
                ),
                isPressed: entity.isPasswordVisible,
                variant: "ghost",
                className: "ff-password-toggle",
                onClick: () => api.notify(`#${id}:passwordToggle`),
              })}
            </div>
            <div class="ff-login-options">
              ${Checkbox.render({
                id: `${id}-remember`,
                label: t("AUTH.REMEMBER"),
                isChecked: entity.values.remember,
                onChange: (isChecked) => change("remember", isChecked),
              })}
              <a href="mailto:info@fatturafacile.eu">${t("AUTH.FORGOT")}</a>
            </div>
            ${Button.render({
              buttonType: "submit",
              color: "primary",
              size: "lg",
              isFullWidth: true,
              isDisabled: entity.isSubmitting,
              children: t(
                entity.isSubmitting ? "APP.LOADING" : "AUTH.SUBMIT_BTN",
              ),
            })}
          </form>`,
        })}
      </div>`
    },
  },
  requireGuest,
]

function validate(values: LoginValues) {
  const email = !values.email
    ? "AUTH.EMAIL_ERROR"
    : EMAIL.test(values.email)
      ? null
      : "COMMON.VALIDATION.INVALID_EMAIL"
  const password = !values.password
    ? "AUTH.PASSWORD_ERROR"
    : values.password.length < MIN_PASSWORD_LENGTH
      ? "AUTH.PASSWORD_MIN"
      : null

  return { email, password, remember: null }
}

function describeFailure(
  entity: LoginPageEntity,
  error: unknown,
): Message | null {
  const [unmapped] = applyServerErrors(entity, error)
  if (unmapped) return unmapped
  if (!(error instanceof HttpError)) return { key: "ERRORS.NETWORK" }
  if (error.status === UNAUTHORIZED) {
    return error.serverMessage ?? { key: "AUTH.INVALID_CREDENTIALS" }
  }
  // A 422 bound to the fields needs no banner.
  if (!entity.isValid) return null
  return (
    error.serverMessage ?? {
      key: "ERRORS.GENERIC",
      values: { status: error.status },
    }
  )
}

export default LoginPage
