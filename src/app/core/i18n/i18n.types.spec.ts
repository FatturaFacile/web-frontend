import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { resolveInitialLanguage } from '@core/i18n/i18n.types';

describe('resolveInitialLanguage', () => {
  function browserLanguages(...languages: string[]) {
    vi.spyOn(navigator, 'languages', 'get').mockReturnValue(languages);
  }

  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  it('prefers the language saved in the browser', () => {
    browserLanguages('de-CH');
    localStorage.setItem('lang', 'fr');
    expect(resolveInitialLanguage()).toBe('fr');
  });

  it('also reads the legacy key', () => {
    browserLanguages('de-CH');
    localStorage.setItem('ff_lang', 'it');
    expect(resolveInitialLanguage()).toBe('it');
  });

  it('ignores an unsupported saved value', () => {
    browserLanguages('de');
    localStorage.setItem('lang', 'es');
    expect(resolveInitialLanguage()).toBe('de');
  });

  it('uses the browser language, regional variants included', () => {
    browserLanguages('it-CH', 'en');
    expect(resolveInitialLanguage()).toBe('it');
  });

  it('takes the first supported browser language', () => {
    browserLanguages('es-ES', 'pt', 'FR-ch', 'en');
    expect(resolveInitialLanguage()).toBe('fr');
  });

  it('falls back to English', () => {
    browserLanguages('es-ES');
    expect(resolveInitialLanguage()).toBe('en');
  });
});
