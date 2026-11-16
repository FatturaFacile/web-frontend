import { CdkTrapFocus } from '@angular/cdk/a11y';
import { Component, input, model } from '@angular/core';
import { TranslatePipe } from '../../pipes/translate.pipe';

let nextModalId = 0;

/**
 * A modal dialog (`placement="center"`) or a side drawer (`placement="end"`). While it is open the focus is trapped
 * inside, the Tab key cycles through its controls, Escape and the close button close it, and the focus returns to the
 * element that opened it. The title names the dialog for screen readers (aria-labelledby). Put the buttons in an
 * element with the `appModalFooter` attribute.
 */
@Component({
  selector: 'app-modal',
  imports: [CdkTrapFocus, TranslatePipe],
  // The backdrop is not a control: the keyboard closes the dialog with Escape and the close button.
  host: { '(click)': 'onHostClick($event)' },
  template: `
    @if (open()) {
      <div class="backdrop">
        <section
          [class]="'panel placement-' + placement()"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          [attr.aria-labelledby]="titleId"
          cdkTrapFocus
          [cdkTrapFocusAutoCapture]="true"
          (keydown.escape)="close()"
        >
          <header class="header">
            <h2 class="title" [id]="titleId">{{ heading() }}</h2>
            <button
              type="button"
              class="close"
              [attr.aria-label]="'DESIGN_SYSTEM.CLOSE' | translate"
              (click)="close()"
            >
              <i class="fa-solid fa-xmark" aria-hidden="true"></i>
            </button>
          </header>
          <div class="body"><ng-content /></div>
          <footer class="footer"><ng-content select="[appModalFooter]" /></footer>
        </section>
      </div>
    }
  `,
  styles: `
    .backdrop {
      position: fixed;
      inset: 0;
      z-index: 1000;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: var(--ff-space-4);
      background: var(--ff-color-overlay);
    }

    .panel {
      display: flex;
      flex-direction: column;
      max-height: 100%;
      background: var(--ff-color-surface-raised);
      color: var(--ff-color-text);
      border-radius: var(--ff-radius-lg);
      box-shadow: var(--ff-shadow-elevated);
    }

    .placement-center {
      width: min(560px, 100%);
    }

    .placement-end {
      width: min(440px, 100%);
      height: 100%;
      margin-inline-start: auto;
      border-radius: 0;
    }

    .backdrop:has(.placement-end) {
      padding: 0;
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: var(--ff-space-3);
      padding: var(--ff-space-4);
      border-bottom: 1px solid var(--ff-color-border-subtle);
    }

    .title {
      margin: 0;
      font-size: var(--ff-font-size-lg);
    }

    .close {
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

    .body {
      flex: 1;
      overflow-y: auto;
      padding: var(--ff-space-4);
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: var(--ff-space-2);
      padding: var(--ff-space-3) var(--ff-space-4);
      border-top: 1px solid var(--ff-color-border-subtle);
    }

    .footer:empty {
      display: none;
    }
  `,
})
export class ModalComponent {
  readonly open = model(false);
  /** The title of the dialog (already translated). */
  readonly heading = input.required<string>();
  readonly placement = input<'center' | 'end'>('center');

  protected readonly titleId = `app-modal-title-${++nextModalId}`;

  close(): void {
    this.open.set(false);
  }

  protected onHostClick(event: MouseEvent): void {
    if (event.target instanceof HTMLElement && event.target.classList.contains('backdrop')) {
      this.close();
    }
  }
}
