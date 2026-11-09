import { Component, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';

/** Button that asks for a mandatory reason in a modal before emitting (cancel, reopen, delete with reason). */
@Component({
  selector: 'app-reason-button',
  imports: [ReactiveFormsModule, NzButtonModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <button nz-button nzSize="small" type="button" [nzDanger]="danger()" [nzLoading]="loading()" (click)="open()">
      {{ labelKey() | translate }}
    </button>
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="labelKey() | translate"
      [nzOkText]="'hrmCommon.confirm' | translate"
      [nzCancelText]="'hrmCommon.cancel' | translate"
      [nzOkDanger]="danger()"
      (nzOnOk)="confirm()"
      (nzOnCancel)="visible.set(false)"
    >
      <ng-container *nzModalContent>
        <label for="reason-input">{{ 'hrmCommon.reason' | translate }}</label>
        <textarea nz-input id="reason-input" rows="3" maxlength="500" [formControl]="reason"></textarea>
        @if (reason.touched && reason.invalid) {
          <div class="ant-form-item-explain-error" role="alert">{{ 'hrmCommon.required' | translate }}</div>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class ReasonButtonComponent {
  readonly labelKey = input.required<string>();
  readonly danger = input(false);
  readonly loading = input(false);
  readonly confirmed = output<string>();

  protected readonly visible = signal(false);
  protected readonly reason = new FormControl('', { nonNullable: true, validators: Validators.required });

  protected open(): void {
    this.reason.reset();
    this.visible.set(true);
  }

  protected confirm(): void {
    if (this.reason.invalid) {
      this.reason.markAsTouched();
      return;
    }
    this.visible.set(false);
    this.confirmed.emit(this.reason.value.trim());
  }
}
