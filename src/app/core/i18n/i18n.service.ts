import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { en_US, it_IT, de_DE, fr_FR, NzI18nService } from 'ng-zorro-antd/i18n';
import { firstValueFrom } from 'rxjs';
import { SupportedLanguage, SUPPORTED_LANGUAGES, TranslationDictionary } from './i18n.types';

function getInitialLanguage(): SupportedLanguage {
  if (typeof window !== 'undefined' && window.localStorage) {
    const saved = localStorage.getItem('lang') || localStorage.getItem('ff_lang');
    if (saved === 'en' || saved === 'it' || saved === 'de' || saved === 'fr') {
      return saved;
    }
  }
  return 'en';
}

function getInitialTenantId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('tenant_id') || localStorage.getItem('ff_tenant_id') || 'default';
  }
  return 'default';
}

interface ApiResponseTranslations {
  locale: string;
  translations: TranslationDictionary;
}

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly http = inject(HttpClient);
  private readonly nzI18n = inject(NzI18nService, { optional: true });

  private readonly apiUrl = '/api'; // URL base del backend Laravel

  readonly languages = SUPPORTED_LANGUAGES;
  readonly currentLanguage = signal<SupportedLanguage>(getInitialLanguage());
  readonly currentTenantId = signal<string>(getInitialTenantId());

  // Cache in memoria dei dizionari per lingua
  private readonly dictionaries = signal<Record<string, TranslationDictionary>>({});

  readonly currentDictionary = computed<TranslationDictionary>(() => {
    const lang = this.currentLanguage();
    return this.dictionaries()[lang] ?? {};
  });

  constructor() {
    const initialLang = this.currentLanguage();
    this.syncNzLocale(initialLang);

    // Carica la lingua iniziale dall'API
    this.loadDictionary(initialLang);
    if (initialLang !== 'en') {
      // Precarica l'inglese come lingua di riserva per le chiavi mancanti
      this.loadDictionary('en');
    }
  }

  setTenantId(tenantId: string): void {
    this.currentTenantId.set(tenantId);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem('ff_tenant_id', tenantId);
    }

    // Invalida la cache in memoria e riscarica per il nuovo tenant
    this.dictionaries.set({});
    this.loadDictionary(this.currentLanguage());
    if (this.currentLanguage() !== 'en') {
      this.loadDictionary('en');
    }
  }

  setLanguage(lang: SupportedLanguage): Promise<TranslationDictionary> {
    this.currentLanguage.set(lang);

    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('lang', lang);
      localStorage.setItem('ff_lang', lang);
    }

    if (typeof document !== 'undefined') {
      document.documentElement.lang = lang;
    }

    this.syncNzLocale(lang);
    return this.loadDictionary(lang);
  }

  async loadDictionary(lang: SupportedLanguage): Promise<TranslationDictionary> {
    const existing = this.dictionaries()[lang];
    if (existing) {
      return existing;
    }

    const tenantId = this.currentTenantId();
    const endpoint = `${this.apiUrl}/translations/${lang}`;
    const params = new HttpParams().set('tenant_id', tenantId);
    const headers = new HttpHeaders({ 'X-Tenant-ID': tenantId });

    try {
      const res = await firstValueFrom(
        this.http.get<ApiResponseTranslations | TranslationDictionary>(endpoint, { params, headers })
      );

      // Supporta sia l'oggetto { translations: { ... } } sia la mappa chiave-valore piatta
      const dict = (res as ApiResponseTranslations).translations ?? (res as TranslationDictionary) ?? {};
      this.dictionaries.update((curr) => ({ ...curr, [lang]: dict }));
      return dict;
    } catch (error) {
      console.error(`Impossibile caricare le traduzioni per la lingua ${lang} e tenant ${tenantId}`, error);
      return {};
    }
  }

  async saveTranslation(key: string, value: string): Promise<void> {
    const lang = this.currentLanguage();
    const tenantId = this.currentTenantId();

    try {
      await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/translations`,
          {
            tenant_id: tenantId,
            locale: lang,
            key,
            value,
          },
          {
            headers: new HttpHeaders({ 'X-Tenant-ID': tenantId }),
          }
        )
      );

      // Aggiorna lo stato reattivo in memoria
      this.dictionaries.update((curr) => ({
        ...curr,
        [lang]: {
          ...(curr[lang] ?? {}),
          [key]: value,
        },
      }));
    } catch (error) {
      console.error(`Errore nel salvataggio della traduzione per la chiave ${key}`, error);
      throw error;
    }
  }

  translate(key: string, params?: Record<string, string | number>): string {
    if (!key) return '';

    const dict = this.currentDictionary();
    const fallbackDict = this.dictionaries()['en'] ?? {};
    let text = dict[key] ?? fallbackDict[key] ?? key;

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
