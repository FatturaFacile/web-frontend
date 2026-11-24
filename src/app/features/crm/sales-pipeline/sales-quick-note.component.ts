import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import type { SalesDeal } from '@core';
import { TranslatePipe } from '@shared';

/**
 * Bottom sheet for updating the note of a deal in two taps from a smartphone, without opening the deal form. The note
 * either replaces the current one or is appended as a timestamped line.
 */
@Component({
  selector: 'app-sales-quick-note',
  imports: [
    FormsModule,
    NzDrawerModule,
    NzInputModule,
    NzButtonModule,
    NzSwitchModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      nzPlacement="bottom"
      nzHeight="75vh"
      [nzTitle]="('SALESPIPE.NOTE' | translate) + ' · ' + (deal()?.name ?? '')"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        @if (deal()?.notes; as current) {
          <p class="note-label">{{ 'SALESPIPE.NOTE_CURRENT' | translate }}</p>
          <pre class="note-current">{{ current }}</pre>
        }
        <textarea
          nz-input
          rows="5"
          class="note-input"
          data-testid="quick-note-input"
          [placeholder]="'SALESPIPE.NOTE_PLACEHOLDER' | translate"
          [ngModel]="text()"
          (ngModelChange)="text.set($event)"
          maxlength="5000"
        ></textarea>
        <div class="note-append">
          <nz-switch
            [ngModel]="append()"
            (ngModelChange)="append.set($event)"
            data-testid="quick-note-append"
          />
          <span>{{ 'SALESPIPE.NOTE_APPEND' | translate }}</span>
        </div>
        <button
          nz-button
          nzType="primary"
          nzBlock
          nzSize="large"
          data-testid="quick-note-save"
          [disabled]="text().trim() === ''"
          [nzLoading]="saving()"
          (click)="save()"
        >
          {{ 'SALESPIPE.NOTE_SAVE' | translate }}
        </button>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .note-input {
      width: 100%;
      margin-bottom: 12px;
      font-size: 16px;
    }
    .note-label {
      margin: 0 0 4px;
      opacity: 0.65;
    }
    .note-current {
      white-space: pre-wrap;
      margin: 0 0 12px;
      font: inherit;
    }
    .note-append {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 16px;
    }
  `,
})
export class SalesQuickNoteComponent {
  readonly visible = input.required<boolean>();
  readonly deal = input<SalesDeal | null>(null);
  readonly saving = input<boolean>(false);

  readonly saved = output<{ notes: string; append: boolean }>();
  readonly closed = output<void>();

  readonly text = signal('');
  readonly append = signal(true);

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.text.set('');
        this.append.set(true);
      }
    });
  }

  save(): void {
    const notes = this.text().trim();
    if (notes !== '') {
      this.saved.emit({ notes, append: this.append() });
    }
  }
}
