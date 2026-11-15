import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it, expect, beforeEach } from 'vitest';
import { I18nService, SupportedLanguage } from '@core/i18n';
import { CurrencyFormatPipe } from './currency-format.pipe';
import { DecimalFormatPipe } from './decimal-format.pipe';

/** Removes (narrow) no-break/regular spaces and unifies apostrophes so ICU versions compare equal. */
const normalize = (s: string): string => s.replace(/[\s  ]/g, '').replace(/[’]/g, "'");

describe('locale-aware number pipes', () => {
  const language = signal<SupportedLanguage>('it');
  let currency: CurrencyFormatPipe;
  let decimal: DecimalFormatPipe;

  beforeEach(() => {
    language.set('it');
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { currentLanguage: language } }],
    });
    TestBed.runInInjectionContext(() => {
      currency = new CurrencyFormatPipe();
      decimal = new DecimalFormatPipe();
    });
  });

  it('formats EUR with an explicit locale, overriding the active language', () => {
    language.set('en');
    expect(normalize(currency.transform(100.5, 'EUR', 'it-IT'))).toBe('100,50€');
  });

  it('returns empty string for null, undefined, or NaN', () => {
    for (const pipe of [currency, decimal]) {
      expect(pipe.transform(null)).toBe('');
      expect(pipe.transform(undefined)).toBe('');
      expect(pipe.transform(NaN)).toBe('');
    }
  });

  it.each([
    ['it', '12.345,50€'],
    ['de', '12.345,50€'],
    ['fr', '12345,50€'],
    ['en', '€12,345.50'],
  ] as const)('currency EUR follows language %s', (lang, expected) => {
    language.set(lang);
    expect(normalize(currency.transform(12345.5, 'EUR'))).toBe(expected);
  });

  it.each([
    ['it', "CHF12'345.50"],
    ['de', "CHF12'345.50"],
    ['fr', "12'345.50CHF"],
    ['en', "CHF12'345.50"],
  ] as const)('currency CHF follows language %s with Swiss locales', (lang, expected) => {
    language.set(lang);
    expect(normalize(currency.transform(12345.5, 'CHF'))).toBe(expected);
  });

  it.each([
    ['it', 'EUR', '12.345,50'],
    ['de', 'EUR', '12.345,50'],
    ['fr', 'EUR', '12345,50'],
    ['en', 'EUR', '12,345.50'],
    ['it', 'CHF', "12'345.50"],
    ['de', 'CHF', "12'345.50"],
    ['fr', 'CHF', "12'345,50"],
    ['en', 'CHF', "12'345.50"],
  ] as const)('decimal %s/%s', (lang, code, expected) => {
    language.set(lang);
    expect(normalize(decimal.transform(12345.5, 2, code))).toBe(expected);
  });

  it('re-evaluates the same pipe instance when the language signal changes', () => {
    expect(decimal.transform(12345.5)).toBe('12.345,50');
    language.set('en');
    expect(decimal.transform(12345.5)).toBe('12,345.50');
  });
});
