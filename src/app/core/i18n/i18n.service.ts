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

  // Richieste HTTP in corso per deduplicare chiamate concorrenti dello stesso tenant
  private readonly inFlightRequests = new Map<string, Promise<TranslationDictionary>>();

  readonly currentDictionary = computed<TranslationDictionary>(() => {
    const lang = this.currentLanguage();
    return this.dictionaries()[lang] ?? {};
  });

  constructor() {
    const initialLang = this.currentLanguage();
    if (typeof document !== 'undefined') {
      document.documentElement.lang = initialLang;
    }
    this.syncNzLocale(initialLang);

    // Carica la lingua iniziale dall'API e precarica l'eventuale fallback
    void this.loadInitialTranslations();
  }

  /**
   * Carica la lingua attiva e l'inglese come fallback (in parallelo se lingua attiva != 'en').
   * Risolve sempre senza lanciare eccezioni per garantire che il bootstrap dell'app non si blocchi.
   */
  loadInitialTranslations(): Promise<TranslationDictionary[]> {
    const initialLang = this.currentLanguage();
    const tasks: Promise<TranslationDictionary>[] = [this.loadDictionary(initialLang)];
    if (initialLang !== 'en') {
      tasks.push(this.loadDictionary('en'));
    }
    return Promise.all(tasks).catch((error: unknown) => {
      console.error('Impossibile completare il caricamento iniziale delle traduzioni', error);
      return [];
    });
  }

  setTenantId(tenantId: string): void {
    this.currentTenantId.set(tenantId);
    if (typeof window !== 'undefined' && window.localStorage) {
      localStorage.setItem('tenant_id', tenantId);
      localStorage.setItem('ff_tenant_id', tenantId);
    }

    // Invalida la cache in memoria e le richieste in sospeso per il nuovo tenant
    this.inFlightRequests.clear();
    this.dictionaries.set({});
    void this.loadInitialTranslations();
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

  loadDictionary(lang: SupportedLanguage): Promise<TranslationDictionary> {
    const existing = this.dictionaries()[lang];
    if (existing) {
      return Promise.resolve(existing);
    }

    const tenantId = this.currentTenantId();
    const flightKey = `${lang}:${tenantId}`;
    const inFlight = this.inFlightRequests.get(flightKey);
    if (inFlight) {
      return inFlight;
    }

    const endpoint = `${this.apiUrl}/translations/${lang}`;
    const params = new HttpParams().set('tenant_id', tenantId);
    const headers = new HttpHeaders({ 'X-Tenant-ID': tenantId });

    const requestPromise = (async () => {
      try {
        const res = await firstValueFrom(
          this.http.get<ApiResponseTranslations | TranslationDictionary>(endpoint, { params, headers })
        );

        // Le traduzioni arrivano solo dall'API (seeders + eventuali override del tenant): il frontend non ne ha una copia
        const dict = (res as ApiResponseTranslations).translations ?? {};
        this.dictionaries.update((curr) => ({ ...curr, [lang]: dict }));
        return dict;
      } catch (error) {
        // Il dizionario non viene memorizzato: la prossima richiesta riprova
        console.error(`Impossibile caricare le traduzioni per la lingua ${lang} e tenant ${tenantId}`, error);
        return {};
      } finally {
        this.inFlightRequests.delete(flightKey);
      }
    })();

    this.inFlightRequests.set(flightKey, requestPromise);
    return requestPromise;
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
        text = text.replace(new RegExp(`\\{${paramKey}}`, 'g'), String(paramVal));
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
