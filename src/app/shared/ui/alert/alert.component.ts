import { Component, computed, input } from '@angular/core';
import type { Tone } from '../badge/badge.component';

const ICONS: Record<Tone, string> = {
  neutral: 'fa-circle-info',
  primary: 'fa-circle-info',
  info: 'fa-circle-info',
  success: 'fa-circle-check',
  warning: 'fa-triangle-exclamation',
  danger: 'fa-circle-exclamation',
};

/**
 * An inline message. A danger alert uses `role="alert"` (read at once); the others are `role="status"` (read when the
 * screen reader is idle). The icon and the title carry the meaning together with the colour.
 */
@Component({
  selector: 'app-alert',
  host: { '[attr.role]': 'role()', '[class]': "'tone-' + tone()" },
  template: `
    <i [class]="'fa-solid icon ' + icon()" aria-hidden="true"></i>
    <div class="content">
      @if (heading()) {
        <strong class="heading">{{ heading() }}</strong>
      }
      <div class="message"><ng-content /></div>
    </div>
  `,
  styles: `
    :host {
      display: flex;
      gap: var(--ff-space-3);
      padding: var(--ff-space-3) var(--ff-space-4);
      border-radius: var(--ff-radius-md);
      border: 1px solid currentColor;
      background: var(--ff-color-surface);
    }

    :host(.tone-success) {
      color: var(--ff-color-success);
    }
    :host(.tone-warning) {
      color: var(--ff-color-warning);
    }
    :host(.tone-danger) {
      color: var(--ff-color-danger);
    }
    :host(.tone-info) {
      color: var(--ff-color-info);
    }

    .icon {
      flex: none;
      margin-top: 3px;
    }

    .heading {
      display: block;
    }

    .heading,
    .message {
      color: var(--ff-color-text);
    }
  `,
})
export class AlertComponent {
  readonly tone = input<Tone>('info');
  readonly heading = input<string>();

  protected readonly role = computed(() => (this.tone() === 'danger' ? 'alert' : 'status'));
  protected readonly icon = computed(() => ICONS[this.tone()]);
}
