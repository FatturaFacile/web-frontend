import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import {
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  I18nService,
  serverErrorMessage,
  TRAVEL_CURRENCIES,
  TRAVEL_JURISDICTIONS,
  TRAVEL_RATE_SCOPES,
  TRAVEL_VEHICLE_TYPES,
  TranslateService,
  TravelApiService,
  TravelJurisdiction,
  TravelMileageRate,
  TravelMileageRateRequest,
  TravelPerDiemRate,
  TravelPerDiemRateRequest,
} from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { decimalPattern } from '@shared/utils/decimal-validators';
import { validationTipKey } from '@shared/utils/validation-tip';
import { currentYear } from './travel.utils';

const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;

/**
 * Per-diem and mileage rate tables of the company per jurisdiction (IT trasferta rules, CH Spesenreglement), year,
 * scope and country. Everybody reads them; the managers of the trips maintain them.
 */
@Component({
  selector: 'app-travel-rates',
  styleUrl: './travel.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    IconActionDirective,
    ModalActionsDirective,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './travel-rates.component.html',
})
export class TravelRatesComponent implements OnInit {
  private readonly api = inject(TravelApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  /** Whether the member may add, change and remove rates and add the reference rates. */
  readonly canMaintain = input<boolean>(false);

  readonly currencies = TRAVEL_CURRENCIES;
  readonly jurisdictions = TRAVEL_JURISDICTIONS;
  readonly scopes = TRAVEL_RATE_SCOPES;
  readonly vehicleTypes = TRAVEL_VEHICLE_TYPES;

  readonly perDiemRates = signal<TravelPerDiemRate[]>([]);
  readonly mileageRates = signal<TravelMileageRate[]>([]);
  readonly loading = signal<boolean>(false);
  readonly jurisdictionFilter = signal<TravelJurisdiction | ''>('');
  readonly visiblePerDiemRates = computed(() =>
    this.perDiemRates().filter((rate) => !this.jurisdictionFilter() || rate.jurisdiction === this.jurisdictionFilter()),
  );
  readonly visibleMileageRates = computed(() =>
    this.mileageRates().filter((rate) => !this.jurisdictionFilter() || rate.jurisdiction === this.jurisdictionFilter()),
  );

  readonly perDiemModalVisible = signal<boolean>(false);
  readonly mileageModalVisible = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly editingPerDiemId = signal<string | null>(null);
  readonly editingMileageId = signal<string | null>(null);

  readonly perDiemForm = this.fb.group({
    jurisdiction: ['IT' as TravelJurisdiction, [Validators.required]],
    year: [currentYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    scope: ['domestic' as 'domestic' | 'abroad', [Validators.required]],
    country: ['', [Validators.pattern(COUNTRY_PATTERN)]],
    currency: ['EUR' as 'EUR' | 'CHF', [Validators.required]],
    daily_amount: ['', [Validators.required, decimalPattern(2, 6)]],
    tax_free_daily_amount: ['', [decimalPattern(2, 6)]],
    lodging_deduction_percent: ['0', [decimalPattern(4, 3)]],
    breakfast_deduction_percent: ['0', [decimalPattern(4, 3)]],
    meal_deduction_percent: ['0', [decimalPattern(4, 3)]],
    deduct_each_meal: [false],
    half_day_min_hours: [8, [Validators.min(1), Validators.max(24)]],
    full_day_min_hours: [12, [Validators.min(1), Validators.max(24)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly mileageForm = this.fb.group({
    jurisdiction: ['IT' as TravelJurisdiction, [Validators.required]],
    year: [currentYear(), [Validators.required, Validators.min(2000), Validators.max(2100)]],
    vehicle_type: ['car' as 'car' | 'motorcycle' | 'bicycle', [Validators.required]],
    currency: ['EUR' as 'EUR' | 'CHF', [Validators.required]],
    rate_per_km: ['', [Validators.required, decimalPattern(4, 3)]],
    notes: ['', [Validators.maxLength(500)]],
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getPerDiemRates().subscribe({
      next: (res) => this.perDiemRates.set(res?.data ?? []),
      error: () => this.loading.set(false),
    });
    this.api.getMileageRates().subscribe({
      next: (res) => {
        this.mileageRates.set(res?.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  seedDefaults(jurisdiction: TravelJurisdiction): void {
    this.api.seedDefaultRates({ jurisdiction, year: currentYear() }).subscribe({
      next: (res) => {
        const created = (res?.data?.per_diem_created ?? 0) + (res?.data?.mileage_created ?? 0);
        this.message.success(this.translate.instant('TRAVEL.DEFAULTS_ADDED', { count: created }));
        this.load();
      },
      error: () => this.message.error(this.translate.instant('TRAVEL.ACTION_ERROR')),
    });
  }

  openPerDiemModal(rate?: TravelPerDiemRate): void {
    this.editingPerDiemId.set(rate?.id ?? null);
    this.perDiemForm.reset({
      jurisdiction: rate?.jurisdiction ?? 'IT',
      year: rate?.year ?? currentYear(),
      scope: rate?.scope ?? 'domestic',
      country: rate?.country ?? '',
      currency: (rate?.currency as 'EUR' | 'CHF' | undefined) ?? 'EUR',
      daily_amount: rate?.daily_amount ?? '',
      tax_free_daily_amount: rate?.tax_free_daily_amount ?? '',
      lodging_deduction_percent: rate?.lodging_deduction_percent ?? '0',
      breakfast_deduction_percent: rate?.breakfast_deduction_percent ?? '0',
      meal_deduction_percent: rate?.meal_deduction_percent ?? '0',
      deduct_each_meal: rate?.deduct_each_meal ?? false,
      half_day_min_hours: rate?.half_day_min_hours ?? 8,
      full_day_min_hours: rate?.full_day_min_hours ?? 12,
      notes: rate?.notes ?? '',
    });
    this.perDiemModalVisible.set(true);
  }

  savePerDiemRate(): void {
    if (this.perDiemForm.invalid) {
      this.perDiemForm.markAllAsTouched();
      return;
    }

    const value = this.perDiemForm.getRawValue();
    const payload: TravelPerDiemRateRequest = {
      jurisdiction: value.jurisdiction,
      year: value.year,
      scope: value.scope,
      country: value.country ? value.country.toUpperCase() : null,
      currency: value.currency,
      daily_amount: value.daily_amount,
      tax_free_daily_amount: value.tax_free_daily_amount || null,
      lodging_deduction_percent: value.lodging_deduction_percent || null,
      breakfast_deduction_percent: value.breakfast_deduction_percent || null,
      meal_deduction_percent: value.meal_deduction_percent || null,
      deduct_each_meal: value.deduct_each_meal,
      half_day_min_hours: value.half_day_min_hours,
      full_day_min_hours: value.full_day_min_hours,
      notes: value.notes || null,
    };
    const editing = this.editingPerDiemId();
    const request = editing ? this.api.updatePerDiemRate(editing, payload) : this.api.createPerDiemRate(payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.perDiemModalVisible.set(false);
        this.message.success(this.translate.instant('TRAVEL.RATE_SAVED'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.perDiemForm, err);
        this.message.error(unmapped[0] ?? this.translate.instant('TRAVEL.ACTION_ERROR'));
      },
    });
  }

  deletePerDiemRate(rate: TravelPerDiemRate): void {
    this.api.deletePerDiemRate(rate.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('TRAVEL.RATE_DELETED'));
        this.load();
      },
      error: () => this.message.error(this.translate.instant('TRAVEL.ACTION_ERROR')),
    });
  }

  openMileageModal(rate?: TravelMileageRate): void {
    this.editingMileageId.set(rate?.id ?? null);
    this.mileageForm.reset({
      jurisdiction: rate?.jurisdiction ?? 'IT',
      year: rate?.year ?? currentYear(),
      vehicle_type: rate?.vehicle_type ?? 'car',
      currency: (rate?.currency as 'EUR' | 'CHF' | undefined) ?? 'EUR',
      rate_per_km: rate?.rate_per_km ?? '',
      notes: rate?.notes ?? '',
    });
    this.mileageModalVisible.set(true);
  }

  saveMileageRate(): void {
    if (this.mileageForm.invalid) {
      this.mileageForm.markAllAsTouched();
      return;
    }

    const value = this.mileageForm.getRawValue();
    const payload: TravelMileageRateRequest = {
      jurisdiction: value.jurisdiction,
      year: value.year,
      vehicle_type: value.vehicle_type,
      currency: value.currency,
      rate_per_km: value.rate_per_km,
      notes: value.notes || null,
    };
    const editing = this.editingMileageId();
    const request = editing ? this.api.updateMileageRate(editing, payload) : this.api.createMileageRate(payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.mileageModalVisible.set(false);
        this.message.success(this.translate.instant('TRAVEL.RATE_SAVED'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.mileageForm, err);
        this.message.error(unmapped[0] ?? this.translate.instant('TRAVEL.ACTION_ERROR'));
      },
    });
  }

  deleteMileageRate(rate: TravelMileageRate): void {
    this.api.deleteMileageRate(rate.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('TRAVEL.RATE_DELETED'));
        this.load();
      },
      error: () => this.message.error(this.translate.instant('TRAVEL.ACTION_ERROR')),
    });
  }

  errorTip(form: FormGroup, path: string): string {
    const control = form.get(path);
    if (control?.hasError('serverError')) {
      return serverErrorMessage(form, path) ?? '';
    }
    const key = validationTipKey(control ?? null);
    return key ? this.i18n.translate(key) : '';
  }
}
