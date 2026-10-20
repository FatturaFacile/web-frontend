import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { provideAnimationsAsync } from '@angular/platform-browser/animations/async';
import { registerLocaleData } from '@angular/common';
import it from '@angular/common/locales/it';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { it_IT, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { authInterceptor, mockDataInterceptor } from '@core';
import { routes } from './app.routes';
import { icons } from './icons-provider';

registerLocaleData(it);

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    provideHttpClient(withInterceptors([mockDataInterceptor, authInterceptor])),
    provideAnimationsAsync(),
    provideNzIcons(icons),
    provideNzI18n(it_IT),
    provideNzDateFnsAdapter(),
  ],
};
