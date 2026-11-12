import { Component, input, output, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { CrudOption } from './crud/crud.types';

export type PromptKind = 'reason' | 'decimal' | 'date' | 'select';

/**
 * Button that asks for one value in a modal before emitting. By default a mandatory reason
 * (cancel, reopen, delete with reason); `kind` turns it into a decimal, date or select prompt.
 */
@Component({
  selector: 'app-reason-button',
  imports: [ReactiveFormsModule, NzButtonModule, NzInputModule, NzModalModule, NzSelectModule, TranslatePipe],
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
        <label for="reason-input">{{ fieldLabelKey() | translate }}</label>
        @switch (kind()) {
          @case ('decimal') {
            <input nz-input id="reason-input" inputmode="decimal" [formControl]="reason" />
          }
          @case ('date') {
            <input nz-input id="reason-input" type="date" [formControl]="reason" />
          }
          @case ('select') {
            <nz-select id="reason-input" nzShowSearch [formControl]="reason">
              @for (option of options(); track option.value) {
                <nz-option [nzValue]="option.value" [nzLabel]="option.label ?? option.value" />
              }
            </nz-select>
          }
          @default {
            <textarea nz-input id="reason-input" rows="3" maxlength="500" [formControl]="reason"></textarea>
          }
        }
        @if (reason.touched && reason.invalid) {
          <div class="ant-form-item-explain-error" role="alert">
            {{ (reason.errors?.['pattern'] ? 'hrmCommon.invalidDecimal' : 'hrmCommon.required') | translate }}
          </div>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class ReasonButtonComponent {
  readonly labelKey = input.required<string>();
  readonly fieldLabelKey = input('hrmCommon.reason');
  readonly danger = input(false);
  readonly loading = input(false);
  readonly kind = input<PromptKind>('reason');
  readonly options = input<CrudOption[]>([]);
  /** An empty value is allowed (emits an empty string). */
  readonly optional = input(false);
  readonly confirmed = output<string>();

  protected readonly visible = signal(false);
  protected readonly reason = new FormControl('', { nonNullable: true });

  protected open(): void {
    this.reason.setValidators([
      ...(this.optional() ? [] : [Validators.required]),
      ...(this.kind() === 'decimal' ? [Validators.pattern(/^(\d+(\.\d{1,4})?)?$/)] : []),
    ]);
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
