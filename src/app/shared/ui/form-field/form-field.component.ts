import { booleanAttribute, Component, computed, input } from '@angular/core';

let nextFieldId = 0;

/**
 * Label, hint and error message around one control (`app-input`, `app-select`). It owns the ids that link them:
 * the label points to the control, and the hint and the error are announced with it (aria-describedby). The error
 * region exists from the start and is polite, so a screen reader reads a new message when validation fails.
 */
@Component({
  selector: 'app-form-field',
  template: `
    <label class="label" [attr.for]="controlId">
      {{ label() }}
      @if (required()) {
        <span class="required" aria-hidden="true">*</span>
      }
    </label>
    <ng-content />
    @if (hint()) {
      <p class="hint" [id]="hintId">{{ hint() }}</p>
    }
    <p class="error" [id]="errorId" aria-live="polite">{{ error() ?? '' }}</p>
  `,
  styles: `
    :host {
      display: block;
      margin-bottom: var(--ff-density-gap);
    }

    .label {
      display: block;
      margin-bottom: var(--ff-space-1);
      color: var(--ff-color-text-secondary);
      font-weight: 500;
    }

    .required {
      margin-inline-start: 2px;
      color: var(--ff-color-danger);
    }

    .hint {
      margin: var(--ff-space-1) 0 0;
      color: var(--ff-color-text-muted);
      font-size: var(--ff-font-size-sm);
    }

    .error {
      min-height: 1.25em;
      margin: var(--ff-space-1) 0 0;
      color: var(--ff-color-danger);
      font-size: var(--ff-font-size-sm);
      font-weight: 500;
    }
  `,
})
export class FormFieldComponent {
  readonly label = input.required<string>();
  readonly hint = input<string>();
  /** The message of the failed validation (already translated); empty or null when the value is valid. */
  readonly error = input<string | null>(null);
  readonly required = input(false, { transform: booleanAttribute });

  private readonly uid = `app-field-${++nextFieldId}`;
  readonly controlId = `${this.uid}-control`;
  readonly hintId = `${this.uid}-hint`;
  readonly errorId = `${this.uid}-error`;

  readonly invalid = computed(() => !!this.error());
  readonly describedBy = computed(() => {
    const ids = [this.hint() ? this.hintId : null, this.error() ? this.errorId : null].filter(
      (id) => id !== null,
    );
    return ids.length > 0 ? ids.join(' ') : null;
  });
}
