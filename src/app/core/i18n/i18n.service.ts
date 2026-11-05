import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { computed, inject, Injectable, signal } from '@angular/core';
import { en_US, it_IT, de_DE, fr_FR, NzI18nService } from 'ng-zorro-antd/i18n';
import { firstValueFrom } from 'rxjs';
import { environment } from '@env';
import {
  resolveInitialLanguage,
  SupportedLanguage,
  SUPPORTED_LANGUAGES,
  TranslationDictionary,
} from './i18n.types';

function getInitialTenantId(): string {
  if (typeof window !== 'undefined' && window.localStorage) {
    return localStorage.getItem('tenant_id') || localStorage.getItem('ff_tenant_id') || '';
  }
  return '';
}

interface ApiResponseTranslations {
  locale: string;
  translations: TranslationDictionary;
}

function resolveTranslation(
  dict: TranslationDictionary | undefined,
  key: string
): string | undefined {
  if (!dict || !key) return undefined;
  if (typeof dict[key] === 'string') {
    return dict[key] as string;
  }
  const parts = key.split('.');
  let current: unknown = dict;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = (current as Record<string, unknown>)[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

@Injectable({
  providedIn: 'root',
})
export class I18nService {
  private readonly http = inject(HttpClient);
  private readonly nzI18n = inject(NzI18nService, { optional: true });

  private readonly apiUrl = environment.apiBaseUrl; // URL base del backend Laravel (versionata)

  readonly languages = SUPPORTED_LANGUAGES;
  readonly currentLanguage = signal<SupportedLanguage>(resolveInitialLanguage());
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
      let dict = (res as ApiResponseTranslations).translations ?? {};
      // se arrivano vuote prendiamo dal fallback
      if (Object.keys(dict).length === 0) {
        dict = await this.loadFallbackDictionary(lang);
      }
      this.dictionaries.update((curr) => ({ ...curr, [lang]: dict }));
      return dict
    } catch (error) {
      console.error(`Impossibile caricare le traduzioni per la lingua ${lang} e tenant ${tenantId}`, error);
      return this.loadFallbackDictionary(lang);
    }
  }

  // Dizionari statici distribuiti con l'app, usati quando l'API delle traduzioni non risponde
  private async loadFallbackDictionary(lang: SupportedLanguage): Promise<TranslationDictionary> {
    try {
      const dict = await firstValueFrom(this.http.get<TranslationDictionary>(`/assets/i18n/${lang}.json`));
      this.dictionaries.update((curr) => ({ ...curr, [lang]: dict }));
      return dict;
    } catch (error) {
      console.error(`Impossibile caricare le traduzioni di fallback per la lingua ${lang}`, error);
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
    let text = resolveTranslation(dict, key) ?? resolveTranslation(fallbackDict, key) ?? key;

    if (params) {
      for (const [paramKey, paramVal] of Object.entries(params)) {
        text = text.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramVal));
      }
    }

    return text;
  }

  instant(key: string, params?: Record<string, string | number>): string {
    return this.translate(key, params);
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

export { I18nService as TranslateService };
