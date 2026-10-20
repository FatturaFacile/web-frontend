export type SupportedLanguage = 'en' | 'it' | 'de' | 'fr';

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

export type TranslationDictionary = Record<string, string>;
