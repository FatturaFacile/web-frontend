import { SupportedLanguage } from './i18n.types';

const EU_LOCALES: Readonly<Record<SupportedLanguage, string>> = {
  it: 'it-IT',
  de: 'de-DE',
  fr: 'fr-FR',
  en: 'en-US',
};

const CH_LOCALES: Readonly<Record<SupportedLanguage, string>> = {
  it: 'it-CH',
  de: 'de-CH',
  fr: 'fr-CH',
  en: 'en-CH',
};

/** Maps an app language (and optional currency) to a BCP-47 locale. CHF selects Swiss conventions. */
export function resolveLocale(language: SupportedLanguage, currencyCode?: string | null): string {
  return currencyCode?.toUpperCase() === 'CHF' ? CH_LOCALES[language] : EU_LOCALES[language];
}
