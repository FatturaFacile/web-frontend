/**
 * `<input type="datetime-local">` value (local time, no zone) to an ISO-8601 instant for the API.
 * Empty input means "now" on the server, so it is sent as null.
 */
export function toApiDateTime(value: string | null | undefined): string | null {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** `<input type="date">` value (`YYYY-MM-DD`) or null. */
export function toApiDate(value: string | null | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}
