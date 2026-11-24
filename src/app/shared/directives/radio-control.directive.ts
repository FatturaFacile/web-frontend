import { afterNextRender, Directive, ElementRef, inject } from '@angular/core';

/**
 * Explicit label/control association for `<label nz-radio>` and `<label nz-radio-button>`.
 *
 * ng-zorro renders the native radio `<input>` inside the label, but the radio components expose no `nzId`.
 * The label carries a `for` attribute (static or `[attr.for]`); this directive copies it to the id of the
 * rendered input, so the label is bound to its control by id as well as by nesting (WCAG 1.3.1 / 4.1.2).
 */
@Directive({
  selector: '[appRadioControl]',
})
export class RadioControlDirective {
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;

  constructor() {
    afterNextRender(() => {
      const id = this.host.getAttribute('for');
      const input = this.host.querySelector<HTMLInputElement>('input[type="radio"]');
      if (id && input) {
        input.id = id;
      }
    });
  }
}
