import { inject, Pipe, PipeTransform } from '@angular/core';
import { LookupService } from './lookup.service';

@Pipe({
  name: 'lookupLabel',
  standalone: true,
})
export class LookupLabelPipe implements PipeTransform {
  private readonly lookupService = inject(LookupService);

  /**
   * Transforms a lookup item code into its localized label for a given category.
   *
   * @param value The item code to translate (e.g. 'BANK_TRANSFER', 'KG')
   * @param category The lookup category code (e.g. 'payment_type', 'unit_of_measure')
   * @returns Promise resolving to the localized label or the original code if not found
   */
  async transform(value: string | null | undefined, category: string): Promise<string> {
    if (!value || !category) {
      return value ?? '';
    }

    try {
      return await this.lookupService.getLabel(category, value);
    } catch {
      return value;
    }
  }
}
