import { Component, computed, inject } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';
import { ToastService } from './toast.service';

/**
 * Renders the toasts of `ToastService`. Errors go to an `alert` region (read at once), everything else to a polite
 * `status` region. Both regions exist from the start, which is what makes screen readers announce what is added to them.
 * Place one instance in the application shell.
 */
@Component({
  selector: 'app-toast-host',
  imports: [TranslatePipe],
  template: `
    <div class="stack">
      <div role="status" aria-live="polite" aria-atomic="false" class="region">
        @for (toast of polite(); track toast.id) {
          <div
            [class]="'toast tone-' + toast.tone"
            (mouseenter)="toasts.pause(toast.id)"
            (mouseleave)="toasts.resume(toast.id)"
            (focusin)="toasts.pause(toast.id)"
            (focusout)="toasts.resume(toast.id)"
          >
            <span class="message">{{ toast.message }}</span>
            <button
              type="button"
              class="dismiss"
              [attr.aria-label]="'DESIGN_SYSTEM.DISMISS' | translate"
              (click)="toasts.dismiss(toast.id)"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        }
      </div>
      <div role="alert" aria-atomic="false" class="region">
        @for (toast of assertive(); track toast.id) {
          <div
            [class]="'toast tone-' + toast.tone"
            (mouseenter)="toasts.pause(toast.id)"
            (mouseleave)="toasts.resume(toast.id)"
            (focusin)="toasts.pause(toast.id)"
            (focusout)="toasts.resume(toast.id)"
          >
            <span class="message">{{ toast.message }}</span>
            <button
              type="button"
              class="dismiss"
              [attr.aria-label]="'DESIGN_SYSTEM.DISMISS' | translate"
              (click)="toasts.dismiss(toast.id)"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </div>
        }
      </div>
    </div>
  `,
  styles: `
    .stack {
      position: fixed;
      right: var(--ff-space-4);
      bottom: var(--ff-space-4);
      z-index: 1100;
      display: flex;
      flex-direction: column;
      gap: var(--ff-space-2);
      width: min(420px, calc(100vw - 2 * var(--ff-space-4)));
      pointer-events: none;
    }

    .region {
      display: flex;
      flex-direction: column;
      gap: var(--ff-space-2);
    }

    .toast {
      display: flex;
      align-items: flex-start;
      justify-content: space-between;
      gap: var(--ff-space-3);
      padding: var(--ff-space-3) var(--ff-space-4);
      background: var(--ff-color-surface-raised);
      color: var(--ff-color-text);
      border: 1px solid var(--ff-color-border);
      border-inline-start-width: 6px;
      border-radius: var(--ff-radius-md);
      box-shadow: var(--ff-shadow-elevated);
      pointer-events: auto;
    }

    .tone-success {
      border-inline-start-color: var(--ff-color-success);
    }
    .tone-warning {
      border-inline-start-color: var(--ff-color-warning);
    }
    .tone-danger {
      border-inline-start-color: var(--ff-color-danger);
    }
    .tone-info,
    .tone-primary {
      border-inline-start-color: var(--ff-color-info);
    }
    .tone-neutral {
      border-inline-start-color: var(--ff-color-neutral);
    }

    .dismiss {
      flex: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: var(--ff-a11y-target-min);
      min-height: var(--ff-a11y-target-min);
      background: transparent;
      color: var(--ff-color-text);
      border: 0;
      border-radius: var(--ff-radius-sm);
      cursor: pointer;
    }
  `,
})
export class ToastHostComponent {
  protected readonly toasts = inject(ToastService);
  protected readonly polite = computed(() =>
    this.toasts.toasts().filter((toast) => toast.tone !== 'danger'),
  );
  protected readonly assertive = computed(() =>
    this.toasts.toasts().filter((toast) => toast.tone === 'danger'),
  );
}
