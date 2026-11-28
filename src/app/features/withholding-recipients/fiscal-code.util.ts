/** Month letters of the Italian Codice Fiscale: A = January ... T = December. */
const MONTH_LETTERS = 'ABCDEHLMPRST';

const FISCAL_CODE_PATTERN = new RegExp(`^[A-Z]{6}\\d{2}[${MONTH_LETTERS}]\\d{2}[A-Z]\\d{3}[A-Z]$`);

/** Minimum age assumed for a recipient: the century of the two-digit year is chosen against it. */
const MINIMUM_AGE = 14;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

function isRealDate(year: number, month: number, day: number): boolean {
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day
  );
}

/** Whether the text is a well formed personal Codice Fiscale (16 characters); the check character is not verified. */
export function isFiscalCodeShape(value: string | null | undefined): boolean {
  return FISCAL_CODE_PATTERN.test((value ?? '').trim().toUpperCase());
}

/** `YYYY-MM-DD` of a local date. */
export function isoDate(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/**
 * Birth date written in a Codice Fiscale, as `YYYY-MM-DD`; null when the code is not well formed or encodes no real date.
 * The day is increased by 40 for women. The century is not encoded, so it is resolved like the API does: the person is at
 * least 14 years old on the reference date and as young as possible.
 */
export function birthDateFromFiscalCode(
  value: string | null | undefined,
  reference: Date = new Date(),
): string | null {
  const code = (value ?? '').trim().toUpperCase();
  if (!FISCAL_CODE_PATTERN.test(code)) {
    return null;
  }

  const shortYear = Number(code.slice(6, 8));
  const month = MONTH_LETTERS.indexOf(code[8]) + 1;
  const rawDay = Number(code.slice(9, 11));
  const day = rawDay > 40 ? rawDay - 40 : rawDay;

  const referenceYear = reference.getFullYear();
  const century = referenceYear - (referenceYear % 100);
  const limit = Date.UTC(referenceYear - MINIMUM_AGE, reference.getMonth(), reference.getDate());

  for (const year of [century + shortYear, century - 100 + shortYear]) {
    if (!isRealDate(year, month, day)) {
      continue;
    }
    if (Date.UTC(year, month - 1, day) <= limit) {
      return `${year}-${pad(month)}-${pad(day)}`;
    }
  }

  return null;
}

/** The sex a Codice Fiscale encodes (day over 40 is female), or null when it is not well formed. */
export function sexFromFiscalCode(value: string | null | undefined): 'F' | 'M' | null {
  const code = (value ?? '').trim().toUpperCase();
  if (!FISCAL_CODE_PATTERN.test(code)) {
    return null;
  }
  return Number(code.slice(9, 11)) > 40 ? 'F' : 'M';
}
