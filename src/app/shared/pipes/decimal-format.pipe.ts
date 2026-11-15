import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService, resolveLocale } from '@core';

/** Formats numbers with the active locale's separators; pass `CHF` to get Swiss grouping. */
@Pipe({
  name: 'appDecimal',
  pure: false,
})
export class DecimalFormatPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(
    value: number | null | undefined,
    fractionDigits = 2,
    currencyCode?: string,
    locale?: string,
  ): string {
    if (value === null || value === undefined || isNaN(value)) {
      return '';
    }

    return new Intl.NumberFormat(locale ?? resolveLocale(this.i18n.currentLanguage(), currencyCode), {
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    }).format(value);
  }
}
