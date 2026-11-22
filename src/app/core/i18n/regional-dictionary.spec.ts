import { describe, expect, it } from 'vitest';
import { dictionaryLocale, regionOfCountry } from './i18n.types';

describe('regional dictionaries', () => {
  it('picks the regional variant the API ships', () => {
    expect(dictionaryLocale('de', 'CH')).toBe('de-CH');
    expect(dictionaryLocale('fr', 'CH')).toBe('fr-CH');
    expect(dictionaryLocale('it', 'CH')).toBe('it-CH');
    expect(dictionaryLocale('it', 'IT')).toBe('it-IT');
  });

  it('keeps the language where there is no variant', () => {
    expect(dictionaryLocale('en', 'CH')).toBe('en');
    expect(dictionaryLocale('de', 'IT')).toBe('de');
    expect(dictionaryLocale('fr', 'IT')).toBe('fr');
    expect(dictionaryLocale('de', null)).toBe('de');
  });

  it('maps the tenant country to a region', () => {
    expect(regionOfCountry('ch')).toBe('CH');
    expect(regionOfCountry('IT')).toBe('IT');
    expect(regionOfCountry('DE')).toBeNull();
    expect(regionOfCountry(undefined)).toBeNull();
  });
});
