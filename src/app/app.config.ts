import {
  ApplicationConfig,
  inject,
  LOCALE_ID,
  provideBrowserGlobalErrorListeners,
  isDevMode,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import it from '@angular/common/locales/it';
import de from '@angular/common/locales/de';
import fr from '@angular/common/locales/fr';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { credentialsInterceptor, csrfRefreshInterceptor, tenantAuthInterceptor, errorInterceptor, I18nService } from '@core';
import { routes } from './app.routes';
import { icons } from './icons-provider';
import { provideServiceWorker } from '@angular/service-worker';

registerLocaleData(en);
registerLocaleData(it);
registerLocaleData(de);
registerLocaleData(fr);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    // Angular's DatePipe/DecimalPipe are pure and inject LOCALE_ID once, so the id is resolved
    // from the persisted language at bootstrap. Runtime switches are handled by the signal-aware
    // app pipes (appCurrency, appDecimal).
    { provide: LOCALE_ID, useFactory: () => inject(I18nService).currentLanguage() },
    provideRouter(routes),
    provideHttpClient(
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
      }),
      withInterceptors([credentialsInterceptor, csrfRefreshInterceptor, tenantAuthInterceptor, errorInterceptor]),
    ),
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideNzDateFnsAdapter(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
