import { inject, Service } from '@angular/core';
import { I18nService } from '@core';
import { humanize } from './resource-panel.utils';

/** Translation helpers of the resource panels, reactive to language changes when read in a template. */
@Service()
export class ResourceLabelsService {
  private readonly i18n = inject(I18nService);

  /** Label of a field or column: explicit key, else `RES.F.<key>`, humanised when untranslated. */
  field(key: string, labelKey?: string): string {
    const translationKey = labelKey ?? `RES.F.${key}`;
    const text = this.i18n.translate(translationKey);
    return text === translationKey ? humanize(key.split('.').pop() ?? key) : text;
  }

  /** Label of an enum value (`RES.V.<value>`), humanised when untranslated. */
  value(value: unknown): string {
    const raw = String(value ?? '');
    const key = `RES.V.${raw}`;
    const text = this.i18n.translate(key);
    return text === key ? humanize(raw) : text;
  }

  text(key: string, params?: Record<string, string | number>): string {
    return this.i18n.translate(key, params);
  }
}
