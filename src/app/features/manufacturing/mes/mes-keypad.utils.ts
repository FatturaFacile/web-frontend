/** Longest quantity the keypad accepts (digits before the decimal point). */
const MAX_INTEGER_DIGITS = 9;
const MAX_DECIMALS = 4;

/**
 * Applies a key of the numeric keypad to the quantity being typed, as a string so no float error creeps in:
 * digits append, `.` starts the decimals once, `back` removes the last character and `clear` resets to `0`.
 */
export function applyKey(current: string, key: string): string {
  if (key === 'clear') {
    return '0';
  }
  if (key === 'back') {
    const next = current.slice(0, -1);

    return next === '' || next === '-' ? '0' : next;
  }
  if (key === '.') {
    return current.includes('.') ? current : `${current}.`;
  }
  if (!/^\d$/.test(key)) {
    return current;
  }

  const [integer, decimals] = current.split('.');
  if (decimals !== undefined) {
    return decimals.length >= MAX_DECIMALS ? current : `${current}${key}`;
  }
  if (integer === '0') {
    return key;
  }

  return (integer ?? '').length >= MAX_INTEGER_DIGITS ? current : `${current}${key}`;
}

/** Adds a whole number of pieces (the quick increments) to a quantity string. */
export function addPieces(current: string, pieces: number): string {
  const total = Math.max(0, Math.round((Number(current) + pieces) * 10_000) / 10_000);

  return String(total);
}

/** Whether the typed quantity is a number above zero. */
export function isPositiveQuantity(value: string): boolean {
  const parsed = Number(value);

  return value.trim() !== '' && Number.isFinite(parsed) && parsed > 0;
}
