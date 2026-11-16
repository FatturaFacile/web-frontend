import { booleanAttribute, Component, inject, input, model } from '@angular/core';
import { FormFieldComponent } from '../form-field/form-field.component';

/** A text control. Inside `app-form-field` it takes the id, the description and the invalid state from the field. */
@Component({
  selector: 'app-input',
  host: { class: 'app-control-host' },
  template: `
    <input
      class="app-control"
      [id]="field?.controlId ?? null"
      [type]="type()"
      [value]="value()"
      [disabled]="disabled()"
      [placeholder]="placeholder()"
      [attr.autocomplete]="autocomplete()"
      [attr.inputmode]="inputmode()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-describedby]="field?.describedBy() ?? null"
      [attr.aria-invalid]="field?.invalid() ? 'true' : null"
      [attr.aria-required]="field?.required() ? 'true' : null"
      (input)="onInput($event)"
    />
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class InputComponent {
  protected readonly field = inject(FormFieldComponent, { optional: true });

  readonly value = model('');
  readonly type = input<'text' | 'email' | 'password' | 'search' | 'tel' | 'url' | 'number'>(
    'text',
  );
  readonly placeholder = input('');
  readonly autocomplete = input<string | null>(null);
  readonly inputmode = input<string | null>(null);
  readonly disabled = input(false, { transform: booleanAttribute });
  /** Needed only when the control has no `app-form-field` label. */
  readonly ariaLabel = input<string | null>(null);

  protected onInput(event: Event): void {
    this.value.set((event.target as HTMLInputElement).value);
  }
}
