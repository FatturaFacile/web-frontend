import { currentLocale } from "../i18n"

const CENTS = 2

/**
 * An amount in the app's language. The Angular dashboard formatted euros
 * Italian-style and francs Swiss-German-style whatever the language.
 */
export function formatMoney(amount: number, currency: string): string {
  return new Intl.NumberFormat(currentLocale(), {
    style: "currency",
    currency,
    minimumFractionDigits: CENTS,
    maximumFractionDigits: CENTS,
  }).format(amount)
}

/** A date and time in the app's language, from an ISO string. */
export function formatDateTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date)
}

/** A number with fixed decimals in the app's language, as Angular's `number: "1.2-2"`. */
export function formatDecimal(value: number, decimals = CENTS): string {
  return new Intl.NumberFormat(currentLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value)
}

/** A date in the app's language, from an ISO string. */
export function formatDate(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  return new Intl.DateTimeFormat(currentLocale(), {
    dateStyle: "short",
  }).format(date)
}
