import { registerLocaleData } from '@angular/common';
import de from '@angular/common/locales/de';
import fr from '@angular/common/locales/fr';
import it from '@angular/common/locales/it';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { describe, it as test, expect, beforeEach } from 'vitest';
import { I18nService, SupportedLanguage } from '@core';
import { DateFormatPipe } from './date-format.pipe';

registerLocaleData(de);
registerLocaleData(fr);
registerLocaleData(it);

describe('DateFormatPipe', () => {
  const language = signal<SupportedLanguage>('it');
  const date = new Date(2026, 10, 5, 14, 30, 0); // 5 Nov 2026, local time
  let pipe: DateFormatPipe;

  beforeEach(() => {
    language.set('it');
    TestBed.configureTestingModule({
      providers: [{ provide: I18nService, useValue: { currentLanguage: language } }],
    });
    pipe = TestBed.runInInjectionContext(() => new DateFormatPipe());
  });

  test.each([
    ['it', '05/11/26'],
    ['de', '05.11.26'],
    ['fr', '05/11/2026'],
    ['en', '11/5/26'],
  ] as const)('shortDate follows language %s', (lang, expected) => {
    language.set(lang);
    expect(pipe.transform(date, 'shortDate')).toBe(expected);
  });

  test.each([
    ['it', '05.11.2026'],
    ['de', '05.11.2026'],
    ['fr', '05.11.2026'],
    ['en', '05.11.2026'],
  ] as const)('custom pattern dd.MM.yyyy for %s', (lang, expected) => {
    language.set(lang);
    expect(pipe.transform(date, 'dd.MM.yyyy')).toBe(expected);
  });

  test('re-evaluates the same instance when the language changes', () => {
    const italian = pipe.transform(date, 'MMMM');
    language.set('de');
    expect(pipe.transform(date, 'MMMM')).toBe('November');
    language.set('fr');
    expect(pipe.transform(date, 'MMMM')).toBe('novembre');
    expect(italian).toBe('novembre');
    language.set('en');
    expect(pipe.transform(date, 'MMMM')).toBe('November');
  });

  test('supports time and combined presets', () => {
    language.set('de');
    expect(pipe.transform(date, 'shortTime')).toBe('14:30');
    expect(pipe.transform(date, 'dateTime')).toContain('14:30');
    expect(pipe.transform(date, 'short')).toContain('14:30');
    expect(pipe.transform(date, 'medium')).toContain('14:30:00');
    expect(pipe.transform(date, 'long')).toContain('2026');
  });

  test('explicit locale overrides the active language', () => {
    language.set('en');
    expect(pipe.transform(date, 'shortDate', 'de-CH')).toBe('05.11.26');
    expect(pipe.transform(date, 'dd.MM.yyyy', 'fr-CH')).toBe('05.11.2026');
  });

  test('accepts ISO strings and timestamps', () => {
    expect(pipe.transform('2026-11-05T12:00:00', 'dd.MM.yyyy')).toBe('05.11.2026');
    expect(pipe.transform(date.getTime(), 'dd.MM.yyyy')).toBe('05.11.2026');
  });

  test('returns empty string for null, undefined, empty and invalid dates', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('not-a-date')).toBe('');
    expect(pipe.transform(new Date(NaN))).toBe('');
  });
});
