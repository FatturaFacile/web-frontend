import { booleanAttribute, Component, input } from '@angular/core';

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';

/**
 * A native button with the design system look. `loading` keeps the button focusable but inert and tells assistive
 * technology that it is busy (aria-busy); `disabled` uses the native attribute. An icon-only button needs `ariaLabel`.
 */
@Component({
  selector: 'app-button',
  host: { '[class.is-block]': 'block()' },
  template: `
    <button
      [class]="'btn variant-' + variant()"
      [attr.type]="type()"
      [disabled]="disabled()"
      [attr.aria-label]="ariaLabel()"
      [attr.aria-busy]="loading() ? 'true' : null"
      [attr.aria-disabled]="loading() ? 'true' : null"
    >
      @if (loading()) {
        <span class="spinner" aria-hidden="true"></span>
      }
      <ng-content />
    </button>
  `,
  styles: `
    :host {
      display: inline-flex;
    }

    :host(.is-block) {
      display: flex;
    }

    :host(.is-block) .btn {
      width: 100%;
    }

    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: var(--ff-space-2);
      min-width: var(--ff-a11y-target-min);
      min-height: var(--ff-density-control-height);
      padding: 0 var(--ff-space-4);
      border: 1px solid transparent;
      border-radius: var(--ff-radius-md);
      font: inherit;
      font-size: var(--ff-density-font-size);
      font-weight: 500;
      cursor: pointer;
      transition:
        background-color 0.15s ease,
        border-color 0.15s ease;
    }

    .btn:disabled {
      cursor: not-allowed;
      opacity: 0.6;
    }

    .btn[aria-busy='true'] {
      cursor: progress;
      pointer-events: none;
    }

    .variant-primary {
      background: var(--ff-color-primary);
      color: var(--ff-color-on-primary);
    }
    .variant-primary:hover:not(:disabled) {
      background: var(--ff-color-primary-hover);
    }
    .variant-primary:active:not(:disabled) {
      background: var(--ff-color-primary-active);
    }

    .variant-secondary {
      background: var(--ff-color-surface);
      color: var(--ff-color-text);
      border-color: var(--ff-color-border-input);
    }
    .variant-secondary:hover:not(:disabled) {
      background: var(--ff-color-hover);
    }

    .variant-danger {
      background: var(--ff-color-danger);
      color: var(--ff-color-surface);
    }
    .variant-danger:hover:not(:disabled) {
      filter: brightness(0.92);
    }

    .variant-ghost {
      background: transparent;
      color: var(--ff-color-text-link);
    }
    .variant-ghost:hover:not(:disabled) {
      background: var(--ff-color-hover);
    }

    .spinner {
      width: 1em;
      height: 1em;
      border: 2px solid currentColor;
      border-right-color: transparent;
      border-radius: 50%;
      animation: ff-spin 0.8s linear infinite;
    }

    @keyframes ff-spin {
      to {
        transform: rotate(360deg);
      }
    }
  `,
})
export class ButtonComponent {
  readonly variant = input<ButtonVariant>('primary');
  readonly type = input<'button' | 'submit' | 'reset'>('button');
  readonly disabled = input(false, { transform: booleanAttribute });
  readonly loading = input(false, { transform: booleanAttribute });
  readonly block = input(false, { transform: booleanAttribute });
  readonly ariaLabel = input<string | null>(null);
}
