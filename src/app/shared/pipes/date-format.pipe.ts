import { formatDate } from '@angular/common';
import { inject, Pipe, PipeTransform } from '@angular/core';
import { I18nService, resolveLocale } from '@core';

type DateInput = Date | string | number | null | undefined;

const PRESETS: Readonly<Record<string, Intl.DateTimeFormatOptions>> = {
  short: { dateStyle: 'short', timeStyle: 'short' },
  medium: { dateStyle: 'medium', timeStyle: 'medium' },
  long: { dateStyle: 'long', timeStyle: 'long' },
  shortDate: { dateStyle: 'short' },
  mediumDate: { dateStyle: 'medium' },
  shortTime: { timeStyle: 'short' },
  dateTime: { dateStyle: 'medium', timeStyle: 'short' },
};

/**
 * Locale-aware date formatting that follows the runtime language. Presets use `Intl`;
 * any other `format` is treated as an Angular date pattern (e.g. `dd.MM.yyyy`).
 */
@Pipe({
  name: 'appDate',
  pure: false,
})
export class DateFormatPipe implements PipeTransform {
  private readonly i18n = inject(I18nService);

  transform(value: DateInput, format = 'mediumDate', locale?: string): string {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    const date = value instanceof Date ? value : new Date(value);
    if (isNaN(date.getTime())) {
      return '';
    }

    const language = this.i18n.currentLanguage();
    const preset = PRESETS[format];
    if (preset) {
      return new Intl.DateTimeFormat(locale ?? resolveLocale(language), preset).format(date);
    }

    try {
      return formatDate(date, format, locale ?? language);
    } catch {
      return '';
    }
  }
}
