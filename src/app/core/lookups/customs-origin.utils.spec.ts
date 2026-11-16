import { describe, expect, it } from 'vitest';
import { COUNTRY_CODES, countryOptions, madeInLabelFor, normalizeTaricCode, pickLocalized, taricLevelOf } from './customs-origin.utils';

describe('customs origin utils', () => {
  it('derives the level from the digit count', () => {
    expect(taricLevelOf('847130')).toBe('HS6');
    expect(taricLevelOf('84713000')).toBe('CN8');
    expect(taricLevelOf('8471300000')).toBe('TARIC10');
  });

  it('rejects codes that are not 6, 8 or 10 digits', () => {
    for (const code of ['', '8471', '8471301', '847130000', '84713000000', '84713a', null, undefined]) {
      expect(taricLevelOf(code)).toBeNull();
    }
  });

  it('strips dots and spaces from a typed code', () => {
    expect(normalizeTaricCode('8471.30 00')).toBe('84713000');
    expect(normalizeTaricCode(null)).toBe('');
  });

  it('builds the made-in label of a country', () => {
    expect(madeInLabelFor('IT')).toBe('Made in Italy');
    expect(madeInLabelFor('ch')).toBe('Swiss Made');
    expect(madeInLabelFor('DE')).toBe('Made in Germany');
    expect(madeInLabelFor(null)).toBe('');
  });

  it('lists every country once, sorted by name', () => {
    expect(new Set(COUNTRY_CODES).size).toBe(COUNTRY_CODES.length);
    const names = countryOptions().map((c) => c.name);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, 'en')));
  });

  it('picks the localized text with fallbacks', () => {
    expect(pickLocalized({ de: 'Laptop', en: 'Laptop EN' }, 'de')).toBe('Laptop');
    expect(pickLocalized({ en: 'Laptop EN' }, 'fr')).toBe('Laptop EN');
    expect(pickLocalized({ it: 'Portatile', de: null }, 'de')).toBe('Portatile');
    expect(pickLocalized(null, 'en')).toBe('');
  });
});
