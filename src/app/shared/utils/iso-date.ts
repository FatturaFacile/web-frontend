/**
 * Calendar date (yyyy-mm-dd) of a Date in the local time zone. Unlike `toISOString().slice(0, 10)` it does not shift
 * the day for dates built at local midnight (what nz-date-picker emits), so it matches the API `date_format:Y-m-d`.
 */
export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}
