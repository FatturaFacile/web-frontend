import {
  Directive,
  effect,
  ElementRef,
  inject,
  input,
  Renderer2,
} from '@angular/core';
import { LookupService } from './lookup.service';

@Directive({
  selector: '[appLookupLabel]',
})
export class LookupLabelDirective {
  private readonly elementRef = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly lookupService = inject(LookupService);

  readonly itemCode = input<string | null | undefined>(undefined, { alias: 'appLookupLabel' });
  readonly lookupCategory = input.required<string>();

  constructor() {
    effect(async () => {
      const rawCode = this.itemCode();
      const category = this.lookupCategory();

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
    });
  }
}
