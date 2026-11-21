import { computed, Directive, inject, input } from '@angular/core';
import { Router } from '@angular/router';
import { AcademyStore } from './academy.store';

/**
 * `appAcademyTooltip="field_name"`: shows the field tooltip that the contextual help of the current page defines for that
 * field. It renders nothing when the help has no entry for the field.
 */
@Directive({
  selector: '[appAcademyTooltip]',
  host: {
    '[attr.title]': 'text()',
    '[attr.aria-description]': 'text()',
  },
})
export class AcademyTooltipDirective {
  private readonly store = inject(AcademyStore);
  private readonly router = inject(Router);

  readonly field = input.required<string>({ alias: 'appAcademyTooltip' });
  protected readonly text = computed(() => this.store.fieldTooltips()[this.field()] ?? null);

  constructor() {
    this.store.ensureContextualHelp(this.router.url.split(/[?#]/)[0]);
  }
}
