import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import {
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  ValidatorFn,
  Validators,
} from '@angular/forms';
import { applyServerErrors, I18nService, isValidationError } from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { Observable } from 'rxjs';
import { CrudField, CrudOption } from '../crud/crud.types';
import { decimalStringValidator } from '../hr-decimal.validator';
import { reportHttpError } from '../hr-http.util';

export interface ActionFormConfig {
  fields: CrudField[];
  /** i18n key of the submit button. */
  submitLabelKey: string;
  submit: (payload: Record<string, unknown>) => Observable<unknown>;
  /** Toast after success (default `hrmCommon.saved`). */
  successKey?: string;
  /** Empties the form after a successful submit. */
  resetOnSuccess?: boolean;
}

let nextFormId = 0;

/**
 * A form driven by the same field definitions as the CRUD table, for an action that is not create/edit of a row
 * (a calculation, an import, a booking ...). Validation messages come from the field flags, 422 errors bind to the fields.
 */
@Component({
  selector: 'app-action-form',
  imports: [
    ReactiveFormsModule,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
      <div
        class="grid gap-x-3"
        style="grid-template-columns: repeat(auto-fill, minmax(220px, 1fr))"
      >
        @for (field of config().fields; track field.key) {
          @if (field.type === 'boolean') {
            <nz-form-item>
              <nz-form-control>
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label nz-checkbox [formControlName]="field.key">{{
                  field.labelKey | translate
                }}</label>
              </nz-form-control>
            </nz-form-item>
          } @else {
            <nz-form-item>
              <nz-form-label [nzRequired]="field.required ?? false" [nzFor]="prefix + field.key">
                {{ field.labelKey | translate }}
              </nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip(field.key)">
                @switch (field.type) {
                  @case ('select') {
                    <nz-select
                      [id]="prefix + field.key"
                      [formControlName]="field.key"
                      nzAllowClear
                      nzShowSearch
                    >
                      @for (option of field.options?.(); track option.value) {
                        <nz-option [nzValue]="option.value" [nzLabel]="optionText(option)" />
                      }
                    </nz-select>
                  }
                  @case ('textarea') {
                    <textarea
                      nz-input
                      rows="4"
                      [id]="prefix + field.key"
                      [formControlName]="field.key"
                    ></textarea>
                  }
                  @case ('datetime') {
                    <input
                      nz-input
                      type="datetime-local"
                      [id]="prefix + field.key"
                      [formControlName]="field.key"
                    />
                  }
                  @case ('date') {
                    <input
                      nz-input
                      type="date"
                      [id]="prefix + field.key"
                      [formControlName]="field.key"
                    />
                  }
                  @case ('decimal') {
                    <input
                      nz-input
                      inputmode="decimal"
                      [id]="prefix + field.key"
                      [formControlName]="field.key"
                    />
                  }
                  @case ('integer') {
                    <input
                      nz-input
                      inputmode="numeric"
                      [id]="prefix + field.key"
                      [formControlName]="field.key"
                    />
                  }
                  @default {
                    <input
                      nz-input
                      [id]="prefix + field.key"
                      [attr.maxlength]="field.maxLength ?? null"
                      [formControlName]="field.key"
                    />
                  }
                }
              </nz-form-control>
            </nz-form-item>
          }
        }
      </div>
      <div class="flex gap-2">
        <button
          nz-button
          nzType="primary"
          type="submit"
          [nzLoading]="saving()"
          [disabled]="!canWrite()"
        >
          {{ config().submitLabelKey | translate }}
        </button>
        <ng-content />
      </div>
    </form>
  `,
})
export class ActionFormComponent {
  readonly config = input.required<ActionFormConfig>();
  /** False disables the submit button (permission). */
  readonly canWrite = input(true);
  /** The response of the server after a successful submit. */
  readonly submitted = output<unknown>();

  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly prefix = `af${nextFormId++}-`;
  protected readonly saving = signal(false);
  protected form = new FormGroup<Record<string, FormControl>>({});
  private readonly fieldKeys = computed(() =>
    this.config()
      .fields.map((f) => f.key)
      .join('|'),
  );

  constructor() {
    effect(() => {
      this.fieldKeys();
      untracked(() => this.buildForm());
    });
  }

  protected optionText(option: CrudOption): string {
    return option.labelKey ? this.i18n.translate(option.labelKey) : (option.label ?? option.value);
  }

  protected errorTip(key: string): string {
    const control = this.form.get(key);
    if (control?.errors?.['serverError']) {
      return String(control.errors['serverError']);
    }
    return this.i18n.translate(
      control?.errors?.['decimal'] ? 'hrmCommon.invalidDecimal' : 'hrmCommon.required',
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.config()
      .submit(this.buildPayload())
      .subscribe({
        next: (result) => {
          this.saving.set(false);
          this.message.success(this.i18n.translate(this.config().successKey ?? 'hrmCommon.saved'));
          if (this.config().resetOnSuccess) {
            this.buildForm();
          }
          this.submitted.emit(result);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          if (isValidationError(err)) {
            applyServerErrors(this.form, err);
          } else {
            reportHttpError(err, this.message, this.i18n);
          }
        },
      });
  }

  private buildForm(): void {
    const controls: Record<string, FormControl> = {};
    for (const field of this.config().fields) {
      const initial =
        field.type === 'boolean'
          ? Boolean(field.defaultValue ?? false)
          : String(field.defaultValue ?? '');
      controls[field.key] = new FormControl(initial, {
        nonNullable: true,
        validators: this.validators(field),
      });
    }
    this.form = new FormGroup(controls);
  }

  private validators(field: CrudField): ValidatorFn[] {
    const list: ValidatorFn[] = [];
    if (field.required) {
      list.push(Validators.required);
    }
    if (field.maxLength) {
      list.push(Validators.maxLength(field.maxLength));
    }
    if (field.type === 'decimal') {
      list.push(decimalStringValidator);
    }
    if (field.type === 'integer') {
      list.push(Validators.pattern(/^\d*$/));
    }
    return list;
  }

  private buildPayload(): Record<string, unknown> {
    const payload: Record<string, unknown> = {};
    const values = this.form.getRawValue();
    for (const field of this.config().fields) {
      const value = values[field.key];
      if (field.type === 'boolean') {
        payload[field.key] = Boolean(value);
        continue;
      }
      const text = String(value ?? '').trim();
      if (text === '') {
        if (field.nullable) {
          payload[field.key] = null;
        }
        continue;
      }
      payload[field.key] =
        field.type === 'integer'
          ? Number(text)
          : field.type === 'datetime' && text.length === 16
            ? text + ':00'
            : text;
    }
    return payload;
  }
}
