import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
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
  EXM_CALCULATION_SOURCES,
  ExmAciRate,
  ExmCalculationSource,
  ExmJurisdiction,
  ExmMileagePayload,
  ExmMileageQuote,
  ExpenseManagementApiService,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { defaultCalculationSource, failureOf, today, toNumber } from './expense-management.util';

/**
 * Mileage claim: the vehicle, the route and the distance. The rate comes from the API (ACI table in Italy, TCS or the
 * company regulation in Switzerland) and the quote below the form is recalculated while the user types.
 */
@Component({
  selector: 'app-exm-mileage-form',
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
      @if (errorKey() ?? quoteError(); as error) {
        <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
      }

      <label for="exm-km-date">{{ 'expenseManagement.field.expenseDate' | translate }}</label>
      <input nz-input id="exm-km-date" type="date" formControlName="expense_date" />

      <label for="exm-km-origin">{{ 'expenseManagement.field.origin' | translate }}</label>
      <input nz-input id="exm-km-origin" formControlName="origin_address" maxlength="255" />

      <label for="exm-km-destination">{{
        'expenseManagement.field.destination' | translate
      }}</label>
      <input
        nz-input
        id="exm-km-destination"
        formControlName="destination_address"
        maxlength="255"
      />

      <label for="exm-km-distance">{{ 'expenseManagement.field.distanceKm' | translate }}</label>
      <input
        nz-input
        id="exm-km-distance"
        type="number"
        step="0.1"
        min="0.1"
        formControlName="distance_km"
      />

      <label class="switch">
        <nz-switch formControlName="is_round_trip"></nz-switch>
        <span>{{ 'expenseManagement.field.roundTrip' | translate }}</span>
      </label>

      <label for="exm-km-vehicle">{{ 'expenseManagement.field.vehicle' | translate }}</label>
      <nz-select nzId="exm-km-vehicle" nzShowSearch formControlName="vehicle_class_code">
        @for (rate of vehicles(); track rate.id) {
          <nz-option
            [nzValue]="rate.vehicle_code"
            [nzLabel]="
              rate.make_model ? rate.vehicle_code + ' · ' + rate.make_model : rate.vehicle_code
            "
          ></nz-option>
        }
      </nz-select>

      <label for="exm-km-model">{{ 'expenseManagement.field.vehicleModel' | translate }}</label>
      <input nz-input id="exm-km-model" formControlName="vehicle_make_model" maxlength="120" />

      <label for="exm-km-source">{{
        'expenseManagement.field.calculationSource' | translate
      }}</label>
      <nz-select nzId="exm-km-source" formControlName="calculation_source">
        @for (source of sources; track source) {
          <nz-option
            [nzValue]="source"
            [nzLabel]="'expenseManagement.calculationSource.' + source | translate"
          ></nz-option>
        }
      </nz-select>

      @if (form.controls.calculation_source.value === 'IT_ACI_TABLE') {
        <label for="exm-km-bracket">{{ 'expenseManagement.field.annualKm' | translate }}</label>
        <nz-select nzId="exm-km-bracket" formControlName="annual_km_bracket">
          @for (bracket of brackets; track bracket) {
            <nz-option [nzValue]="bracket" [nzLabel]="bracket + ' km'"></nz-option>
          }
        </nz-select>
      }

      @if (quote(); as current) {
        <section class="quote" aria-live="polite">
          <div>
            {{ 'expenseManagement.mileage.rate' | translate }}:
            {{ current.rate_per_km | money: current.currency }}/km
            @if (current.rate_period) {
              <small>({{ current.rate_period }})</small>
            }
          </div>
          <div>
            {{ 'expenseManagement.mileage.totalKm' | translate }}: {{ current.total_km }} km
          </div>
          <strong>
            {{ 'expenseManagement.mileage.amount' | translate }}:
            {{ current.calculated_amount | money: current.currency }}
          </strong>
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
    .quote {
      display: grid;
      gap: 2px;
      padding: 8px 12px;
      margin-top: 8px;
      border-radius: 4px;
      background: rgba(0, 0, 0, 0.04);
    }
    .actions {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 8px;
    }
  `,
})
export class MileageFormComponent implements OnInit {
  private readonly fb = inject(FormBuilder);
  private readonly api = inject(ExpenseManagementApiService);

  readonly jurisdiction = input<ExmJurisdiction>('IT');
  readonly saving = input(false);
  readonly errorKey = input<string | null>(null);

  readonly saved = output<ExmMileagePayload>();
  readonly cancelled = output<void>();

  protected readonly sources: readonly ExmCalculationSource[] = EXM_CALCULATION_SOURCES;
  protected readonly brackets = [15000, 20000, 30000] as const;

  protected readonly rates = signal<ExmAciRate[]>([]);
  protected readonly quote = signal<ExmMileageQuote | null>(null);
  protected readonly quoteError = signal<string | null>(null);

  protected readonly form = this.fb.nonNullable.group({
    expense_date: [today(), Validators.required],
    origin_address: ['', Validators.required],
    destination_address: ['', Validators.required],
    distance_km: [0, [Validators.required, Validators.min(0.1)]],
    is_round_trip: [false],
    vehicle_class_code: ['', Validators.required],
    vehicle_make_model: [''],
    calculation_source: ['IT_ACI_TABLE' as ExmCalculationSource],
    annual_km_bracket: [15000],
  });

  private readonly value = toSignal(
    this.form.valueChanges.pipe(startWith(this.form.getRawValue()), debounceTime(300)),
    { initialValue: this.form.getRawValue() },
  );

  /** The vehicles of the rate table of the chosen source, without the duplicates of the annual brackets. */
  protected readonly vehicles = computed(() => {
    const source = this.value().calculation_source;
    const seen = new Set<string>();
    return this.rates().filter((rate) => {
      if ((source && rate.source !== source) || seen.has(rate.vehicle_code)) {
        return false;
      }
      seen.add(rate.vehicle_code);
      return true;
    });
  });

  constructor() {
    effect(() => {
      this.form.controls.calculation_source.setValue(
        defaultCalculationSource(this.jurisdiction()),
        {
          emitEvent: true,
        },
      );
    });

    let ticket = 0;
    effect(() => {
      const value = this.value();
      if (!value.vehicle_class_code || toNumber(value.distance_km) <= 0) {
        this.quote.set(null);
        return;
      }
      const current = ++ticket;
      void firstValueFrom(
        this.api.quoteMileage({
          vehicle_class_code: value.vehicle_class_code,
          distance_km: value.distance_km ?? 0,
          is_round_trip: value.is_round_trip ?? false,
          on_date: value.expense_date,
          calculation_source: value.calculation_source,
          annual_km_bracket:
            value.calculation_source === 'IT_ACI_TABLE' ? value.annual_km_bracket : null,
        }),
      )
        .then((response) => {
          if (current === ticket) {
            this.quote.set(response.data);
            this.quoteError.set(null);
          }
        })
        .catch(async (error: unknown) => {
          if (current === ticket) {
            this.quote.set(null);
            this.quoteError.set((await failureOf(error)).errorKey);
          }
        });
    });
  }

  ngOnInit(): void {
    void firstValueFrom(this.api.listAciRates())
      .then((response) => this.rates.set(response.data))
      .catch(() => this.rates.set([]));
  }

  protected submit(): void {
    if (this.form.invalid) {
      return;
    }
    const value = this.form.getRawValue();
    this.saved.emit({
      expense_date: value.expense_date,
      origin_address: value.origin_address,
      destination_address: value.destination_address,
      distance_km: value.distance_km,
      is_round_trip: value.is_round_trip,
      vehicle_class_code: value.vehicle_class_code,
      vehicle_make_model: value.vehicle_make_model || null,
      calculation_source: value.calculation_source,
      annual_km_bracket:
        value.calculation_source === 'IT_ACI_TABLE' ? value.annual_km_bracket : null,
    });
  }
}
