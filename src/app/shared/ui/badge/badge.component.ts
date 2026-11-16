import { Component, input } from '@angular/core';

export type Tone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info';

/** A short status label. The meaning is in the text, never in the colour alone (WCAG 1.4.1). */
@Component({
  selector: 'app-badge',
  template: `<span [class]="'badge tone-' + tone()"><ng-content /></span>`,
  styles: `
    :host {
      display: inline-flex;
    }

    .badge {
      display: inline-flex;
      align-items: center;
      padding: 2px var(--ff-space-2);
      border-radius: var(--ff-radius-sm);
      font-size: var(--ff-font-size-xs);
      font-weight: 600;
      line-height: 1.5;
    }

    .tone-neutral {
      background: var(--ff-color-neutral-bg);
      color: var(--ff-color-neutral);
    }
    .tone-primary {
      background: var(--ff-color-primary-subtle);
      color: var(--ff-color-text-link);
    }
    .tone-success {
      background: var(--ff-color-success-bg);
      color: var(--ff-color-success);
    }
    .tone-warning {
      background: var(--ff-color-warning-bg);
      color: var(--ff-color-warning);
    }
    .tone-danger {
      background: var(--ff-color-danger-bg);
      color: var(--ff-color-danger);
    }
    .tone-info {
      background: var(--ff-color-info-bg);
      color: var(--ff-color-info);
    }
  `,
})
export class BadgeComponent {
  readonly tone = input<Tone>('neutral');
}
