export function formatDateToIso(date: Date): string {
  return date.toISOString();
}

export function isValidDate(date: unknown): date is Date {
  return date instanceof Date && !isNaN(date.getTime());
}
