import { computed, inject, Injectable, signal } from '@angular/core';
import { en_US, it_IT, de_DE, fr_FR, NzI18nService } from 'ng-zorro-antd/i18n';
import { SupportedLanguage, SUPPORTED_LANGUAGES, TranslationDictionary } from './i18n.types';
import { EN_DICTIONARY } from './dictionaries/en';
import { IT_DICTIONARY } from './dictionaries/it';
import { DE_DICTIONARY } from './dictionaries/de';
import { FR_DICTIONARY } from './dictionaries/fr';

const DICTIONARIES: Record<SupportedLanguage, TranslationDictionary> = {
  en: EN_DICTIONARY,
  it: IT_DICTIONARY,
  de: DE_DICTIONARY,
  fr: FR_DICTIONARY,
};

function getInitialLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('lang') || localStorage.getItem('ff_lang');
    if (saved === 'en' || saved === 'it' || saved === 'de' || saved === 'fr') {
      return saved;
    }
  }
  return 'en'; // Default primary language is English
}

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly nzI18n = inject(NzI18nService, { optional: true });

  readonly languages = SUPPORTED_LANGUAGES;
  readonly currentLanguage = signal<SupportedLanguage>(getInitialLanguage());

  readonly currentDictionary = computed<TranslationDictionary>(() => {
    const lang = this.currentLanguage();
    return DICTIONARIES[lang] ?? DICTIONARIES.en;
  });

  constructor() {
    this.syncNzLocale(this.currentLanguage());
  }

  setLanguage(lang: SupportedLanguage): void {
    if (this.currentLanguage() === lang) return;

    this.currentLanguage.set(lang);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('lang', lang);
      localStorage.setItem('ff_lang', lang);
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }

    this.syncNzLocale(lang);
  }

  translate(key: string, params?: Record<string, string | number>): string {
    if (!key) return '';

    const dict = this.currentDictionary();
    let text = dict[key] ?? EN_DICTIONARY[key] ?? key;

    if (params) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      }
    }

    return text;
  }

  private syncNzLocale(lang: SupportedLanguage): void {
    if (!this.nzI18n) return;

    switch (lang) {
      case 'it':
        this.nzI18n.setLocale(it_IT);
        break;
      case 'de':
        this.nzI18n.setLocale(de_DE);
        break;
      case 'fr':
        this.nzI18n.setLocale(fr_FR);
        break;
      case 'en':
      default:
        this.nzI18n.setLocale(en_US);
        break;
    }
  }
}
