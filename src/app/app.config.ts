import {
  ApplicationConfig,
  inject,
  isDevMode,
  LOCALE_ID,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { NzA11yPatchService } from './core/a11y/nz-a11y-patch.service';
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
import { idempotencyInterceptor } from '@core/interceptors/idempotency.interceptor';
import { optimisticLockInterceptor } from '@core/interceptors/optimistic-lock.interceptor';
import { paginatedResponseInterceptor } from '@core/interceptors/paginated-response.interceptor';
import { tenantAuthInterceptor } from '@core/interceptors/tenant-auth.interceptor';
import { I18nService, PageTitleStrategy } from '@core/i18n';
import { DisplayPreferencesService, ThemeService } from '@core/theme';
import { PwaUpdateService } from '@core/pwa';
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
    // app pipes (appCurrency, appDecimal, appDate, money).
    { provide: LOCALE_ID, useFactory: () => inject(I18nService).currentLanguage() },
    provideRouter(routes),
    { provide: TitleStrategy, useExisting: PageTitleStrategy },
    provideHttpClient(
      withFetch(),
      withXsrfConfiguration({
        cookieName: 'XSRF-TOKEN',
        headerName: 'X-XSRF-TOKEN',
      }),
      withInterceptors([
        credentialsInterceptor,
        csrfRefreshInterceptor,
        tenantAuthInterceptor,
        idempotencyInterceptor,
        optimisticLockInterceptor,
        paginatedResponseInterceptor,
        errorInterceptor,
      ]),
    ),
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideNzDateFnsAdapter(),
    provideAppInitializer(() => {
      inject(ThemeService);
      inject(DisplayPreferencesService);
      const i18n = inject(I18nService);
      // Bootstrap bloccato (splash + spinner) finché le traduzioni non sono caricate
      return i18n.waitForInitialTranslations();
    }),
    provideAppInitializer(() => {
      inject(NzA11yPatchService).start();
    }),
    provideAppInitializer(() => {
      inject(PwaUpdateService).start();
    }),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
