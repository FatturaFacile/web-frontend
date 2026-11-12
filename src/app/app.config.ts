import { ApplicationConfig, provideBrowserGlobalErrorListeners, provideAppInitializer, inject, isDevMode } from '@angular/core';
import { provideRouter, TitleStrategy } from '@angular/router';
import { provideHttpClient, withFetch, withInterceptors, withXsrfConfiguration } from '@angular/common/http';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import it from '@angular/common/locales/it';
import de from '@angular/common/locales/de';
import fr from '@angular/common/locales/fr';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { credentialsInterceptor } from '@core/interceptors/credentials.interceptor';
import { csrfRefreshInterceptor } from '@core/interceptors/csrf-refresh.interceptor';
import { errorInterceptor } from '@core/interceptors/error.interceptor';
import { tenantAuthInterceptor } from '@core/interceptors/tenant-auth.interceptor';
import { I18nService, PageTitleStrategy } from '@core/i18n';
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
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
      }),
      withInterceptors([credentialsInterceptor, csrfRefreshInterceptor, tenantAuthInterceptor, errorInterceptor]),
    ),
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideNzDateFnsAdapter(),
    provideAppInitializer(() => {
      const i18n = inject(I18nService);
      return i18n.loadInitialTranslations();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
