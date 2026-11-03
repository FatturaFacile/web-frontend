import type { Message } from "@inglorious/i18n"

import { API_BASE_URL, CSRF_COOKIE_URL } from "../config"
import { currentLocale } from "../i18n"
import type { ValidationErrorBody } from "../models/api"

const XSRF_COOKIE = "XSRF-TOKEN"
const TENANT_STORAGE_KEY = "ff_active_tenant_id"
const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"])
const CSRF_MISMATCH = 419
const UNPROCESSABLE = 422
const NETWORK_FAILURE = 0

type Method = "GET" | "POST" | "PUT" | "PATCH" | "DELETE"
type Params = Record<string, string | number | boolean | null | undefined>

interface RequestOptions {
  params?: Params
  /** Sent as JSON, or as it is when it is `FormData` (a file upload). */
  body?: unknown
  /** `blob` reads a file the server sends, rather than JSON. */
  responseType?: "json" | "blob"
}

/** A failed request: `status` is 0 when the server could not be reached. */
export class HttpError extends Error {
  /** The `message` of the response body, when the server sent one. */
  readonly serverMessage: string | null

  constructor(
    readonly status: number,
    readonly body: unknown,
    readonly path: string,
  ) {
    const serverMessage = bodyMessage(body)
    super(serverMessage ?? `HTTP ${status}`)
    this.serverMessage = serverMessage
  }
}

export const http = {
  get: <T>(path: string, params?: Params) =>
    request<T>("GET", path, { params }),
  post: <T>(path: string, body?: unknown) => request<T>("POST", path, { body }),
  put: <T>(path: string, body?: unknown) => request<T>("PUT", path, { body }),
  delete: <T>(path: string) => request<T>("DELETE", path, {}),
  download: (path: string) =>
    request<Blob>("GET", path, { responseType: "blob" }),
}

let requestFailListener: ((error: HttpError) => void) | null = null

/** Hears every failed request, as the Angular error interceptors did. */
export function onRequestFail(listener: (error: HttpError) => void) {
  requestFailListener = listener
}

/** Starts the Sanctum session: sets the `XSRF-TOKEN` cookie. */
export async function fetchCsrfCookie(): Promise<void> {
  await fetch(CSRF_COOKIE_URL, {
    credentials: "include",
    headers: { "X-Requested-With": "XMLHttpRequest" },
  })
}

/** What to show where a load failed, in place of what it would have shown. */
export function describeLoadFailure(error: unknown): Message {
  if (error instanceof HttpError && error.status !== NETWORK_FAILURE) {
    return { key: "ERRORS.GENERIC", values: { status: error.status } }
  }
  return { key: "ERRORS.NETWORK" }
}

export function getValidationErrors(
  error: unknown,
): Record<string, string[]> | null {
  if (!(error instanceof HttpError) || error.status !== UNPROCESSABLE) {
    return null
  }
  return (error.body as Partial<ValidationErrorBody> | null)?.errors ?? null
}

export function setTenantId(tenantId: string | null) {
  try {
    if (tenantId) localStorage.setItem(TENANT_STORAGE_KEY, tenantId)
    else localStorage.removeItem(TENANT_STORAGE_KEY)
  } catch {
    // Storage unavailable: requests go out without a tenant.
  }
}

async function request<T>(
  method: Method,
  path: string,
  options: RequestOptions,
  hasRetried = false,
): Promise<T> {
  const url = buildUrl(path, options.params)
  const isForm = options.body instanceof FormData
  const init: RequestInit = {
    method,
    credentials: "include",
    // The browser sets a form's Content-Type, with its boundary.
    headers: buildHeaders(method, options.body !== undefined && !isForm),
    body:
      options.body === undefined || isForm
        ? (options.body as FormData | undefined)
        : JSON.stringify(options.body),
  }

  let response: Response
  try {
    response = await fetch(url, init)
  } catch {
    throw fail(new HttpError(NETWORK_FAILURE, null, path))
  }

  // An expired CSRF token: refresh it and try once more.
  if (response.status === CSRF_MISMATCH && !hasRetried) {
    await fetchCsrfCookie()
    return request<T>(method, path, options, true)
  }

  const body =
    response.ok && options.responseType === "blob"
      ? await response.blob()
      : await readBody(response)
  if (!response.ok) throw fail(new HttpError(response.status, body, path))

  return body as T
}

function buildUrl(path: string, params: Params = {}): string {
  const query = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") {
      query.set(key, String(value))
    }
  }
  const search = query.toString()
  return `${API_BASE_URL}${path}${search ? `?${search}` : ""}`
}

function buildHeaders(method: Method, hasBody: boolean): HeadersInit {
  const headers: Record<string, string> = {
    Accept: "application/json",
    "X-Requested-With": "XMLHttpRequest",
    "X-Language-Code": currentLocale(),
  }
  if (hasBody) headers["Content-Type"] = "application/json"

  const tenantId = readTenantId()
  if (tenantId) headers["X-Tenant-Id"] = tenantId

  const xsrfToken = MUTATING_METHODS.has(method) ? readXsrfCookie() : null
  if (xsrfToken) headers["X-XSRF-TOKEN"] = xsrfToken

  return headers
}

async function readBody(response: Response): Promise<unknown> {
  const text = await response.text()
  if (!text) return null
  try {
    return JSON.parse(text)
  } catch {
    return text
  }
}

function fail(error: HttpError): HttpError {
  requestFailListener?.(error)
  return error
}

function bodyMessage(body: unknown): string | null {
  if (typeof body === "object" && body !== null && "message" in body) {
    return String(body.message)
  }
  return null
}

function readTenantId(): string | null {
  try {
    return localStorage.getItem(TENANT_STORAGE_KEY)
  } catch {
    return null
  }
}

/** Laravel sets the `XSRF-TOKEN` cookie URL-encoded. */
function readXsrfCookie(): string | null {
  const match = document.cookie.match(
    new RegExp(`(?:^|;\\s*)${XSRF_COOKIE}=([^;]*)`),
  )
  if (!match) return null
  const [, token] = match
  try {
    return decodeURIComponent(token)
  } catch {
    return token
  }
}
