import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService, resolveLocale } from '@core';

@Pipe({
  name: 'appCurrency',
  pure: false,
})
export class CurrencyFormatPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: number | null | undefined, currencyCode = 'EUR', locale?: string): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    return new Intl.NumberFormat(locale ?? resolveLocale(this.i18n.currentLanguage(), currencyCode), {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  }
}
