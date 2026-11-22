export type SupportedLanguage = 'en' | 'it' | 'de' | 'fr';

/** Where the tenant operates: it selects the regional variant of a language (it-CH, de-CH, fr-CH, it-IT). */
export type TranslationRegion = 'CH' | 'IT';

const REGIONAL_VARIANTS: Readonly<Record<TranslationRegion, readonly SupportedLanguage[]>> = {
  CH: ['it', 'de', 'fr'],
  IT: ['it'],
};

/** The dictionary to load for a language in a region: the regional variant the API ships, else the language itself. */
export function dictionaryLocale(language: SupportedLanguage, region: TranslationRegion | null): string {
  return region !== null && REGIONAL_VARIANTS[region].includes(language) ? `${language}-${region}` : language;
}

/** The region of a tenant country (ISO code): Switzerland and Italy have regional dictionaries. */
export function regionOfCountry(country: string | null | undefined): TranslationRegion | null {
  const code = country?.toUpperCase();
  return code === 'CH' || code === 'IT' ? code : null;
}

export interface LanguageOption {
  readonly code: SupportedLanguage;
  readonly label: string;
  readonly flag: string;
}

export const SUPPORTED_LANGUAGES: readonly LanguageOption[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
];

export type TranslationValue = string | { [key: string]: TranslationValue };
export type TranslationDictionary = Record<string, TranslationValue>;

function asSupportedLanguage(value: string | null | undefined): SupportedLanguage | null {
  return SUPPORTED_LANGUAGES.find((language) => language.code === value)?.code ?? null;
}

/**
 * The first language of a visit: the choice saved in this browser, then the preferred languages of the browser
 * (`it-CH` counts as `it`), then English.
 */
export function resolveInitialLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = asSupportedLanguage(localStorage.getItem('lang'));
    const legacy = asSupportedLanguage(localStorage.getItem('ff_lang'));
    if (saved ?? legacy) {
      return (saved ?? legacy) as SupportedLanguage;
    }
  }
  if (typeof navigator !== 'undefined') {
    for (const language of navigator.languages ?? []) {
      const supported = asSupportedLanguage(language.split('-')[0]?.toLowerCase());
      if (supported) {
        return supported;
      }
    }
  }
  return 'en';
}
