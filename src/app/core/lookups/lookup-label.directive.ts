import {
  Directive,
  ElementRef,
  inject,
  Input,
  OnChanges,
  Renderer2,
  SimpleChanges,
} from '@angular/core';
import { LookupService } from './lookup.service';

@Directive({
  selector: '[appLookupLabel]',
  standalone: true,
})
export class LookupLabelDirective implements OnChanges {
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly lookupService = inject(LookupService);

  /**
   * The item code to decode (e.g., 'BANK_TRANSFER', 'KG', 'CLOCK_IN').
   */
  @Input('appLookupLabel') itemCode: string | null | undefined;

  /**
   * The category code identifier (e.g., 'payment_type', 'unit_of_measure').
   */
  @Input() lookupCategory!: string;

  async ngOnChanges(changes: SimpleChanges): Promise<void> {
    if (changes['itemCode'] || changes['lookupCategory']) {
      await this.updateTextContent();
    }
  }

  private async updateTextContent(): Promise<void> {
    const rawCode = this.itemCode;
    const category = this.lookupCategory;

    if (!rawCode || !category) {
      this.renderer.setProperty(this.elementRef.nativeElement, 'textContent', rawCode ?? '');
      return;
    }

    try {
      const resolvedLabel = await this.lookupService.getLabel(category, rawCode);
      this.renderer.setProperty(this.elementRef.nativeElement, 'textContent', resolvedLabel);
    } catch {
      this.renderer.setProperty(this.elementRef.nativeElement, 'textContent', rawCode);
    }
  }
}
