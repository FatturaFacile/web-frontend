import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { I18nService, SupportedLanguage } from '@core/i18n';
import { MoneyPipe } from './money.pipe';

/** Removes spaces (incl. no-break variants) and unifies apostrophes across ICU versions. */
const normalize = (s: string): string => s.replace(/[\s  ]/g, '').replace(/[’]/g, "'");

describe('MoneyPipe', () => {
  const language = signal<SupportedLanguage>('it');
  let pipe: MoneyPipe;

  beforeEach(() => {
    language.set('it');
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { currentLanguage: language } }],
    });
    pipe = TestBed.runInInjectionContext(() => new MoneyPipe());
  });

  it('formats number to EUR in it-IT locale', () => {
    expect(normalize(pipe.transform(1234.5, 'EUR', 'it-IT'))).toBe('1234,50€');
  });

  it('formats decimal string to EUR in it-IT locale without float calculations', () => {
    expect(normalize(pipe.transform('1234.50', 'EUR', 'it-IT'))).toBe('1234,50€');
  });

  it('formats decimal string to CHF in de-CH locale', () => {
    expect(normalize(pipe.transform('99.90', 'CHF', 'de-CH'))).toBe('CHF99.90');
  });

  it('returns empty string for null, undefined, empty string or invalid value', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('invalid')).toBe('');
  });

  it.each([
    ['it', 'EUR', '12.345,50€'],
    ['de', 'EUR', '12.345,50€'],
    ['fr', 'EUR', '12345,50€'],
    ['en', 'EUR', '€12,345.50'],
    ['it', 'CHF', "CHF12'345.50"],
    ['de', 'CHF', "CHF12'345.50"],
    ['fr', 'CHF', "12'345.50CHF"],
    ['en', 'CHF', "CHF12'345.50"],
  ] as const)('follows the active language %s for %s', (lang, code, expected) => {
    language.set(lang);
    expect(normalize(pipe.transform('12345.50', code))).toBe(expected);
  });

  it('re-evaluates the same instance when the language changes', () => {
    expect(normalize(pipe.transform(12345.5))).toBe('12.345,50€');
    language.set('en');
    expect(normalize(pipe.transform(12345.5))).toBe('€12,345.50');
  });
});
