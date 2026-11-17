import { HttpErrorResponse } from '@angular/common/http';
import { EnvironmentProviders, Provider, signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { AuthStore, I18nService } from '@core';
import { icons } from '../../../icons-provider';

/** Test-only providers: key-echo translations, minimal auth store, router and icons. */
export function inventoryTestProviders(): (Provider | EnvironmentProviders)[] {
  const translate = (key: string, params?: Record<string, string | number>) =>
    params ? `${key}:${JSON.stringify(params)}` : key;
  return [
    provideRouter([]),
    provideNzIcons(icons),
    provideNzDateFnsAdapter(),
    {
      provide: I18nService,
      useValue: { translate, instant: translate, currentLanguage: signal('en') },
    },
    { provide: AuthStore, useValue: { activeCurrency: () => 'EUR', activeJurisdiction: () => 'IT' } },
  ];
}

export function httpError(status: number, error: unknown = { message: `HTTP ${status}` }): HttpErrorResponse {
  return new HttpErrorResponse({ status, error, url: '/test' });
}
