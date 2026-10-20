import { Pipe, PipeTransform } from '@angular/core';

@Pipe({
  name: 'appCurrency',
})
export class CurrencyFormatPipe implements PipeTransform {
  transform(value: number | null | undefined, currencyCode = 'EUR', locale = 'it-IT'): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    return new Intl.NumberFormat(locale, {
      style: 'currency',
      currency: currencyCode,
    }).format(value);
  }
}
