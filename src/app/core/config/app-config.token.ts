import { InjectionToken } from '@angular/core';

export interface AppConfig {
  readonly appTitle: string;
  readonly defaultLanguage: string;
  readonly apiBaseUrl: string;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG', {
  providedIn: 'root',
  factory: () => ({
    appTitle: 'Fattura Facile',
    defaultLanguage: 'it-IT',
    apiBaseUrl: '/api',
  }),
});
