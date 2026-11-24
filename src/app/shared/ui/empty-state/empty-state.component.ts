import { Component, input } from '@angular/core';

/**
 * What a list or a page shows when there is nothing to show yet: say what is empty, why, and what to do next. The
 * next step goes in the projected content (usually an `app-button`).
 */
@Component({
  selector: 'app-empty-state',
  template: `
    @if (icon()) {
      <i [class]="'fa-solid icon ' + icon()" aria-hidden="true"></i>
    }
    <h3 class="title">{{ heading() }}</h3>
    @if (description()) {
      <p class="description">{{ description() }}</p>
    }
    <div class="actions"><ng-content /></div>
  `,
  styles: `
    :host {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--ff-space-2);
      padding: var(--ff-space-6) var(--ff-space-4);
      text-align: center;
    }

    .icon {
      color: var(--ff-color-text-muted);
      font-size: 2rem;
    }

    .title {
      margin: 0;
      font-size: var(--ff-font-size-lg);
    }

    .description {
      max-width: 48ch;
      margin: 0;
      color: var(--ff-color-text-secondary);
    }

    .actions:empty {
      display: none;
    }

    .actions {
      margin-top: var(--ff-space-3);
    }
  `,
})
export class EmptyStateComponent {
  readonly heading = input.required<string>();
  readonly description = input<string>();
  /** A Font Awesome class such as `fa-file-invoice`; decorative. */
  readonly icon = input<string>();
}
