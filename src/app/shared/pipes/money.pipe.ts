import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService, resolveLocale } from '@core/i18n';

/**
 * Formats a monetary amount (number or decimal string, e.g. "1234.50")
 * using Intl.NumberFormat according to the given currency and locale.
 * Without an explicit locale it follows the active language (Swiss conventions for CHF).
 * Never used for arithmetic calculations.
 */
@Pipe({
  name: 'money',
  pure: false,
})
export class MoneyPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(
    value: string | number | null | undefined,
    currencyCode: string | null | undefined = 'EUR',
    locale?: string | null,
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numericValue = typeof value === 'number' ? value : Number(value);
    if (isNaN(numericValue)) {
      return '';
    }

    const code = currencyCode || 'EUR';

    return new Intl.NumberFormat(locale || resolveLocale(this.i18n.currentLanguage(), code), {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }
}
