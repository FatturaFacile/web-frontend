import { Pipe, PipeTransform } from '@angular/core';

/**
 * Formats a monetary amount (number or decimal string, e.g. "1234.50")
 * using Intl.NumberFormat according to the given currency and locale.
 * Never used for arithmetic calculations.
 */
@Pipe({
  name: 'money',
})
export class MoneyPipe implements PipeTransform {
  transform(
    value: string | number | null | undefined,
    currencyCode = 'EUR',
    locale = 'it-IT',
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numericValue = typeof value === 'number' ? value : Number(value);
    if (isNaN(numericValue)) {
      return '';
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }
}
