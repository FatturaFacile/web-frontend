/** Reads a dotted path (`items.0.quantity`) from nested objects and arrays. */
export function getByPath(source: unknown, path: string): unknown {
  let current: unknown = source;
  for (const part of path.split('.')) {
    if (current === null || typeof current !== 'object' || !(part in (current as Record<string, unknown>))) {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}

/** Converts the text of an input to the type of the original value (number stays number). */
export function coerceLike(original: unknown, text: string): unknown {
  if (typeof original === 'number') {
    const parsed = Number(text.replace(',', '.'));

    return text.trim() === '' || Number.isNaN(parsed) ? Number.NaN : parsed;
  }
  if (typeof original === 'boolean') {
    return text === 'true';
  }

  return text;
}
