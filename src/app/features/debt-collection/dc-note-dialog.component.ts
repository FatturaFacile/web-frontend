import { Component, effect, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { TranslatePipe } from '@shared';

/** Asks for a short note before a release (an exclusion is lifted and the reason is kept in the history). */
@Component({
  selector: 'app-dc-note-dialog',
  imports: [FormsModule, TranslatePipe, NzInputModule, NzModalModule],
  styleUrl: './debt-collection.scss',
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="titleKey() | translate"
      [nzOkText]="'debtCollection.action.confirm' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkDisabled]="note().trim() === ''"
      [nzOkLoading]="saving()"
      (nzOnOk)="confirmed.emit(note().trim())"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <label class="field" for="dc-note">
          <span>{{ 'debtCollection.field.note' | translate }}</span>
          <textarea
            nz-input
            id="dc-note"
            rows="3"
            maxlength="500"
            [ngModel]="note()"
            (ngModelChange)="note.set($event)"
          ></textarea>
        </label>
      </ng-container>
    </nz-modal>
  `,
})
export class DcNoteDialogComponent {
  readonly open = input(false);
  readonly titleKey = input('debtCollection.exclusion.releaseTitle');
  readonly saving = input(false);
  readonly confirmed = output<string>();
  readonly closed = output<void>();

  protected readonly note = signal('');

  constructor() {
    effect(() => {
      if (this.open()) {
        this.note.set('');
      }
    });
  }
}
