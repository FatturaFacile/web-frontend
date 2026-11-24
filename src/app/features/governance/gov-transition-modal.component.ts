import { ChangeDetectionStrategy, Component, computed, effect, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { ModalActionsDirective, TranslatePipe } from '@shared';

/** The status chosen in the dialog and the notes written with it. */
export interface GovTransitionChoice {
  readonly status: string;
  readonly notes: string | null;
}

/**
 * Asks for the target status of a record and, where the rule needs it, the notes (justification, reason, conclusion).
 * Which targets are offered comes from the state machine of the record; the API validates the change.
 */
@Component({
  selector: 'app-gov-transition-modal',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, NzFormModule, NzInputModule, NzModalModule, NzSelectModule, ModalActionsDirective, TranslatePipe],
  template: `
    <nz-modal appModalActions
      [(nzVisible)]="visible"
      [nzTitle]="titleKey() | translate"
      okAction="confirm"
      [nzOkDisabled]="!canConfirm()"
      (nzOnCancel)="visible.set(false)"
      (nzOnOk)="confirm()"
    >
      <ng-container *nzModalContent>
        <nz-form-item>
          <nz-form-label nzRequired>{{ 'GOVERNANCE.TRANSITION.NEW_STATUS' | translate }}</nz-form-label>
          <nz-form-control>
            <nz-select class="w-full" [ngModel]="status()" (ngModelChange)="status.set($event)">
              @for (target of targets(); track target) {
                <nz-option [nzValue]="target" [nzLabel]="statusKeyPrefix() + '.' + target.toUpperCase() | translate"></nz-option>
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label [nzRequired]="notesRequired()">{{ 'GOVERNANCE.TRANSITION.NOTES' | translate }}</nz-form-label>
          <nz-form-control>
            <textarea nz-input rows="4" maxlength="4000" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
          </nz-form-control>
        </nz-form-item>
      </ng-container>
    </nz-modal>
  `,
})
export class GovTransitionModalComponent {
  readonly visible = model<boolean>(false);
  readonly titleKey = input<string>('GOVERNANCE.TRANSITION.TITLE');
  readonly targets = input.required<readonly string[]>();
  /** Prefix of the translation keys of the statuses, for example `GOVERNANCE.RISK_STATUS`. */
  readonly statusKeyPrefix = input.required<string>();
  /** Statuses whose change needs the notes. */
  readonly notesRequiredFor = input<readonly string[]>([]);
  readonly confirmed = output<GovTransitionChoice>();

  readonly status = signal<string>('');
  readonly notes = signal<string>('');

  readonly notesRequired = computed(() => this.notesRequiredFor().includes(this.status()));
  readonly canConfirm = computed(() => this.status() !== '' && (!this.notesRequired() || this.notes().trim() !== ''));

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.status.set(this.targets()[0] ?? '');
        this.notes.set('');
      }
    });
  }

  confirm(): void {
    if (!this.canConfirm()) {
      return;
    }
    this.confirmed.emit({ status: this.status(), notes: this.notes().trim() === '' ? null : this.notes().trim() });
    this.visible.set(false);
  }
}
