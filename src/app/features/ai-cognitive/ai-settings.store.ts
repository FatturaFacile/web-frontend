import { computed, inject, Service, signal } from '@angular/core';
import { finalize, map, Observable, tap } from 'rxjs';
import { AiCognitiveApiService } from './ai-cognitive-api.service';
import {
  AiProvider,
  AiSettings,
  AutomationRule,
  ProviderForm,
  ProviderSetting,
  UsageAudit,
} from './ai-cognitive.models';

/**
 * Signal state of AI governance and provider settings: the provider of the company (local Ollama or a hosted one on its own
 * key), the automation rule of every workflow and the usage of the month. A saved provider or rule replaces its entry, so the
 * forms always show what the server holds.
 */
@Service()
export class AiSettingsStore {
  private readonly api = inject(AiCognitiveApiService);

  readonly settings = signal<AiSettings | null>(null);
  readonly usage = signal<UsageAudit | null>(null);
  readonly loading = signal(false);
  readonly savingKey = signal<string | null>(null);

  readonly externalAllowed = computed(() => this.settings()?.external_providers_allowed ?? false);
  readonly providers = computed(() => this.settings()?.supported_providers ?? []);
  readonly rules = computed(() => this.settings()?.rules ?? []);
  /** Hosted providers that are set up but cannot run because the company did not allow external providers. */
  readonly blockedProviders = computed<AiProvider[]>(() =>
    this.externalAllowed()
      ? []
      : (this.settings()?.providers ?? [])
          .filter((provider) => provider.is_enabled && !provider.is_local)
          .map((provider) => provider.provider),
  );

  load(): Observable<unknown> {
    this.loading.set(true);

    return this.api.settings().pipe(
      tap((res) => this.settings.set(res.data)),
      finalize(() => this.loading.set(false)),
    );
  }

  loadUsage(verifyChain = false): Observable<UsageAudit> {
    return this.api.usageAudit(verifyChain).pipe(
      map((res) => res.data),
      tap((usage) => this.usage.set(usage)),
    );
  }

  providerSetting(provider: AiProvider): ProviderSetting | null {
    return this.settings()?.providers.find((row) => row.provider === provider) ?? null;
  }

  saveProvider(provider: AiProvider, form: ProviderForm): Observable<ProviderSetting> {
    this.savingKey.set(provider);

    return this.api.saveProvider(provider, form).pipe(
      map((res) => res.data),
      tap((saved) =>
        this.settings.update((settings) =>
          settings === null
            ? settings
            : {
                ...settings,
                providers: [
                  ...settings.providers
                    .filter((row) => row.provider !== provider)
                    .map((row) => (saved.is_default ? { ...row, is_default: false } : row)),
                  saved,
                ],
              },
        ),
      ),
      finalize(() => this.savingKey.set(null)),
    );
  }

  saveRule(rule: AutomationRule): Observable<AutomationRule> {
    this.savingKey.set(rule.workflow);

    return this.api.saveRule(rule).pipe(
      map((res) => ({ ...res.data, configured: true })),
      tap((saved) =>
        this.settings.update((settings) =>
          settings === null
            ? settings
            : {
                ...settings,
                rules: settings.rules.map((row) => (row.workflow === saved.workflow ? saved : row)),
              },
        ),
      ),
      finalize(() => this.savingKey.set(null)),
    );
  }
}
