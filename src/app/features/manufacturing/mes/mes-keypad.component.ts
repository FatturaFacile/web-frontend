import { Component, input, model } from '@angular/core';
import { TranslatePipe } from '@shared';
import { addPieces, applyKey } from './mes-keypad.utils';

const KEYS = ['7', '8', '9', '4', '5', '6', '1', '2', '3', '.', '0', 'back'] as const;
const INCREMENTS = [1, 5, 10] as const;

/**
 * Numeric keypad for the shop-floor touch screen: 72 px keys, quick increments and no soft keyboard. The quantity is a
 * string, so decimals are exact.
 */
@Component({
  selector: 'app-mes-keypad',
  imports: [TranslatePipe],
  styles: `
    :host {
      display: block;
    }
    .display {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 16px;
      margin-bottom: 12px;
      border-radius: 12px;
      background: #0b1f33;
      color: #ffffff;
      font-size: 2.5rem;
      font-variant-numeric: tabular-nums;
    }
    .display small {
      font-size: 1rem;
      opacity: 0.85;
    }
    .pad {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
    }
    .quick {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-top: 10px;
    }
    button {
      min-height: 72px;
      border: 2px solid #0b1f33;
      border-radius: 12px;
      background: #ffffff;
      color: #0b1f33;
      font-size: 1.75rem;
      font-weight: 600;
      touch-action: manipulation;
      cursor: pointer;
    }
    button:active {
      background: #d6e4f5;
    }
    button:focus-visible {
      outline: 4px solid #ffb000;
      outline-offset: 2px;
    }
    .quick button {
      font-size: 1.25rem;
      background: #e8f1fb;
    }
  `,
  template: `
    <div class="display" data-testid="keypad-display" role="status">
      <small>{{ label() | translate }}</small>
      <span>{{ value() }}</span>
    </div>
    <div class="pad">
      @for (key of keys; track key) {
        <button
          type="button"
          [attr.data-testid]="'key-' + key"
          [attr.aria-label]="key === 'back' ? ('MFG_MES.KEY_BACKSPACE' | translate) : null"
          (click)="press(key)"
        >
          @if (key === 'back') {
            <i class="fa-solid fa-delete-left" aria-hidden="true"></i>
          } @else {
            {{ key }}
          }
        </button>
      }
    </div>
    <div class="quick">
      @for (step of increments; track step) {
        <button type="button" [attr.data-testid]="'plus-' + step" (click)="plus(step)">
          +{{ step }}
        </button>
      }
      <button type="button" data-testid="key-clear" (click)="press('clear')">
        {{ 'MFG_MES.KEY_CLEAR' | translate }}
      </button>
    </div>
  `,
})
export class MesKeypadComponent {
  /** The quantity, as typed. */
  readonly value = model('0');
  /** Translation key of the label of the display. */
  readonly label = input.required<string>();

  protected readonly keys = KEYS;
  protected readonly increments = INCREMENTS;

  protected press(key: string): void {
    this.value.update((current) => applyKey(current, key));
  }

  protected plus(pieces: number): void {
    this.value.update((current) => addPieces(current, pieces));
  }
}
