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
    currencyCode: string | null | undefined = 'EUR',
    locale: string | null | undefined = 'it-IT',
  ): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const numericValue = typeof value === 'number' ? value : Number(value);
    if (isNaN(numericValue)) {
      return '';
    }

    const code = currencyCode || 'EUR';
    const loc = locale || 'it-IT';

    return new Intl.NumberFormat(loc, {
      style: 'currency',
      currency: code,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(numericValue);
  }
}
