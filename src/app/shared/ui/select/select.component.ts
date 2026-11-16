import { booleanAttribute, Component, inject, input, model } from '@angular/core';
import { FormFieldComponent } from '../form-field/form-field.component';

export interface SelectOption {
  readonly value: string;
  /** The visible text, already translated. */
  readonly label: string;
  readonly disabled?: boolean;
}

/** A native select: the platform gives the keyboard handling, the announcement and the touch picker for free. */
@Component({
  selector: 'app-select',
  host: { class: 'app-control-host' },
  template: `
    <select
      class="app-control"
      [id]="field?.controlId ?? null"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-describedby]="field?.describedBy() ?? null"
      [attr.aria-invalid]="field?.invalid() ? 'true' : null"
      [attr.aria-required]="field?.required() ? 'true' : null"
      (change)="onChange($event)"
    >
      @if (placeholder()) {
        <option value="" [selected]="value() === ''">{{ placeholder() }}</option>
      }
      @for (option of options(); track option.value) {
        <option
          [value]="option.value"
          [disabled]="option.disabled ?? false"
          [selected]="option.value === value()"
        >
          {{ option.label }}
        </option>
      }
    </select>
  `,
  styles: `
    :host {
      display: block;
    }
  `,
})
export class SelectComponent {
  protected readonly field = inject(FormFieldComponent, { optional: true });

  readonly value = model('');
  readonly options = input.required<readonly SelectOption[]>();
  readonly placeholder = input('');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);

  protected onChange(event: Event): void {
    this.value.set((event.target as HTMLSelectElement).value);
  }
}
