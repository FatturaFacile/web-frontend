import { ApplicationConfig, provideBrowserGlobalErrorListeners, isDevMode } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import en from '@angular/common/locales/en';
import it from '@angular/common/locales/it';
import de from '@angular/common/locales/de';
import fr from '@angular/common/locales/fr';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { authInterceptor, mockDataInterceptor } from '@core';
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
    provideHttpClient(withInterceptors([mockDataInterceptor, authInterceptor])),
    provideAnimationsAsync(),
    provideNzIcons(icons),
    provideNzI18n(en_US),
    provideNzDateFnsAdapter(),
    provideServiceWorker('ngsw-worker.js', {
      enabled: !isDevMode(),
      registrationStrategy: 'registerWhenStable:30000',
    }),
  ],
};
