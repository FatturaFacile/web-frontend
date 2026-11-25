import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { debounceTime, firstValueFrom, startWith } from 'rxjs';
import {
  EXM_ALLOWANCE_METHODS,
  EXM_DESTINATION_TYPES,
  ExmAllowanceMethod,
  ExmDestinationType,
  ExmJurisdiction,
  ExmPerDiem,
  ExmPerDiemPayload,
  ExpenseManagementApiService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { failureOf, isPositive } from './expense-management.util';

/**
 * Per diem of a trip: the destination type (municipality, domestic, international) and the allowance method (flat rate,
 * mixed, analytic). The preview shows the tax-free part against the taxable excess before the allowance is saved.
 */
@Component({
  selector: 'app-exm-per-diem-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSwitchModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  template: `
    <form [formGroup]="form" class="form" (ngSubmit)="submit()">
      @if (errorKey() ?? previewError(); as error) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
      }

      <label for="exm-pd-country">{{ 'expenseManagement.field.country' | translate }}</label>
      <input nz-input id="exm-pd-country" formControlName="country_code" maxlength="2" />

      <label for="exm-pd-destination">{{
        'expenseManagement.field.destinationType' | translate
      }}</label>
      <nz-select nzId="exm-pd-destination" formControlName="destination_type">
        @for (type of destinationTypes; track type) {
          <nz-option
            [nzValue]="type"
            [nzLabel]="'expenseManagement.destinationType.' + type | translate"
          ></nz-option>
        }
      </nz-select>

      <label for="exm-pd-method">{{ 'expenseManagement.field.allowanceMethod' | translate }}</label>
      <nz-select nzId="exm-pd-method" formControlName="allowance_method">
        @for (method of methods; track method) {
          <nz-option
            [nzValue]="method"
            [nzLabel]="'expenseManagement.allowanceMethod.' + method | translate"
          ></nz-option>
        }
      </nz-select>

      <label for="exm-pd-start">{{ 'expenseManagement.field.tripStart' | translate }}</label>
      <input nz-input id="exm-pd-start" type="datetime-local" formControlName="trip_start_at" />

      <label for="exm-pd-end">{{ 'expenseManagement.field.tripEnd' | translate }}</label>
      <input nz-input id="exm-pd-end" type="datetime-local" formControlName="trip_end_at" />

      <label for="exm-pd-rate">{{ 'expenseManagement.field.ratePerDay' | translate }}</label>
      <input
        nz-input
        id="exm-pd-rate"
        type="number"
        step="0.01"
        min="0"
        formControlName="allowance_rate_per_day"
      />

      @if (form.controls.allowance_method.value !== 'analytic') {
        <label class="switch">
          <nz-switch formControlName="lodging_reimbursed"></nz-switch>
          <span>{{ 'expenseManagement.field.lodgingReimbursed' | translate }}</span>
        </label>
        <label class="switch">
          <nz-switch formControlName="meals_reimbursed"></nz-switch>
          <span>{{ 'expenseManagement.field.mealsReimbursed' | translate }}</span>
        </label>
      }

      @if (preview(); as current) {
        <section class="preview" aria-live="polite">
          <div>{{ 'expenseManagement.perDiem.days' | translate }}: {{ current.days_count }}</div>
          <div>
            {{ 'expenseManagement.perDiem.gross' | translate }}:
            {{ current.gross_allowance_amount | money: currency() }}
          </div>
          <div>
            {{ 'expenseManagement.perDiem.dailyLimit' | translate }}:
            {{ current.daily_tax_free_limit | money: currency() }}
          </div>
          <div>
            {{ 'expenseManagement.perDiem.taxFree' | translate }}:
            {{ current.tax_free_amount | money: currency() }}
          </div>
          <strong [class.excess]="hasExcess()">
            {{ 'expenseManagement.perDiem.taxableExcess' | translate }}:
            {{ current.taxable_excess_amount | money: currency() }}
          </strong>
          @for (warning of current.warnings; track warning.code) {
            <nz-alert
              nzType="warning"
              nzShowIcon
              [nzMessage]="'expenseManagement.violation.' + warning.code | translate"
            ></nz-alert>
          }
        </section>
      }

      <div class="actions">
        <button nz-button type="button" (click)="cancelled.emit()">
          {{ 'expenseManagement.action.cancel' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="submit"
          [disabled]="form.invalid || saving()"
          [nzLoading]="saving()"
        >
          {{ 'expenseManagement.action.save' | translate }}
        </button>
      </div>
    </form>
  `,
  styles: `
    .form {
      display: grid;
      gap: 6px;
    }
    .switch {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .preview {
      display: grid;
      gap: 2px;
      padding: 8px 12px;
      margin-top: 8px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.04);
    }
    .excess {
      color: #d4380d;
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class PerDiemFormComponent {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ExpenseManagementApiService);

  readonly jurisdiction = input<ExmJurisdiction>('IT');
  readonly currency = input('EUR');
  readonly saving = input(false);
  readonly errorKey = input<string | null>(null);

  readonly saved = output<ExmPerDiemPayload>();
  readonly cancelled = output<void>();

  protected readonly destinationTypes: readonly ExmDestinationType[] = EXM_DESTINATION_TYPES;
  protected readonly methods: readonly ExmAllowanceMethod[] = EXM_ALLOWANCE_METHODS;

  protected readonly preview = signal<ExmPerDiem | null>(null);
  protected readonly previewError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    country_code: ['IT', [Validators.required, Validators.minLength(2), Validators.maxLength(2)]],
    destination_type: ['domestic' as ExmDestinationType, Validators.required],
    allowance_method: ['flat_rate' as ExmAllowanceMethod, Validators.required],
    trip_start_at: ['', Validators.required],
    trip_end_at: ['', Validators.required],
    allowance_rate_per_day: [0],
    lodging_reimbursed: [false],
    meals_reimbursed: [false],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue()), debounceTime(300)),
    { initialValue: this.form.getRawValue() },
  );

  constructor() {
    effect(() => {
      this.form.controls.country_code.setValue(this.jurisdiction());
    });

    let ticket = 0;
    effect(() => {
      const value = this.value();
      if (!value.trip_start_at || !value.trip_end_at || value.trip_end_at <= value.trip_start_at) {
        this.preview.set(null);
        return;
      }
      const current = ++ticket;
      void firstValueFrom(this.api.previewPerDiem(this.payload()))
        .then((response) => {
          if (current === ticket) {
            this.preview.set(response.data);
            this.previewError.set(null);
          }
        })
        .catch(async (error: unknown) => {
          if (current === ticket) {
            this.preview.set(null);
            this.previewError.set((await failureOf(error)).errorKey);
          }
        });
    });
  }

  protected hasExcess(): boolean {
    return isPositive(this.preview()?.taxable_excess_amount);
  }

  protected submit(): void {
    if (!this.form.invalid) {
      this.saved.emit(this.payload());
    }
  }

  private payload(): ExmPerDiemPayload {
    const value = this.form.getRawValue();
    const analytic = value.allowance_method === 'analytic';
    return {
      country_code: value.country_code.toUpperCase(),
      destination_type: value.destination_type,
      allowance_method: value.allowance_method,
      trip_start_at: value.trip_start_at,
      trip_end_at: value.trip_end_at,
      allowance_rate_per_day: value.allowance_rate_per_day,
      lodging_reimbursed: analytic ? false : value.lodging_reimbursed,
      meals_reimbursed: analytic ? false : value.meals_reimbursed,
    };
  }
}
