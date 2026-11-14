import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  I18nService,
  LaravelPaginationMeta,
  serverErrorMessage,
  TRAVEL_CURRENCIES,
  TRAVEL_JURISDICTIONS,
  TRAVEL_TRIP_STATUSES,
  TranslateService,
  TravelApiService,
  TravelTrip,
  TravelTripRequest,
  TravelTripStatus,
} from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { decimalPattern } from '@shared/utils/decimal-validators';
import { validationTipKey } from '@shared/utils/validation-tip';
import { TravelRatesComponent } from './travel-rates.component';
import {
  hasTravelAccess,
  TRAVEL_MANAGER_ROLES,
  TRAVEL_STATUS_COLORS,
} from './travel.utils';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const COUNTRY_PATTERN = /^[A-Za-z]{2}$/;

/** Mirrors the service rule: the advance cannot exceed the estimated budget. */
function advanceWithinBudget(control: AbstractControl<string>): ValidationErrors | null {
  const budget = Number(control.parent?.get('estimated_budget')?.value || 0);
  const advance = Number(control.value || 0);
  return advance <= budget ? null : { exceedsMax: true };
}

/** Business trips of the company: requests with their status, and the per-diem and mileage rate tables. */
@Component({
  selector: 'app-travel',
  styleUrl: './travel.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    IconActionDirective,
    ModalActionsDirective,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    TravelRatesComponent,
  ],
  templateUrl: './travel.component.html',
})
export class TravelComponent implements OnInit {
  private readonly api = inject(TravelApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);

  readonly statuses = TRAVEL_TRIP_STATUSES;
  readonly currencies = TRAVEL_CURRENCIES;
  readonly jurisdictions = TRAVEL_JURISDICTIONS;
  readonly statusColors = TRAVEL_STATUS_COLORS;

  readonly trips = signal<TravelTrip[]>([]);
  readonly meta = signal<LaravelPaginationMeta | null>(null);
  readonly loading = signal<boolean>(false);
  readonly statusFilter = signal<TravelTripStatus | ''>('');
  readonly searchQuery = signal<string>('');
  readonly page = signal<number>(1);
  readonly selectedTabIndex = signal<number>(0);

  readonly tripModalVisible = signal<boolean>(false);
  readonly saving = signal<boolean>(false);
  readonly editingTripId = signal<string | null>(null);

  readonly isManager = computed(() => hasTravelAccess(this.authStore, TRAVEL_MANAGER_ROLES, 'manage'));
  readonly canMaintainRates = computed(() => hasTravelAccess(this.authStore, TRAVEL_MANAGER_ROLES, 'rates'));
  readonly pendingApprovalCount = computed(() => this.trips().filter((trip) => trip.status === 'submitted').length);

  readonly tripForm = this.fb.group({
    purpose: ['', [Validators.required, Validators.maxLength(500)]],
    destination_city: ['', [Validators.required, Validators.maxLength(120)]],
    destination_country: ['IT', [Validators.required, Validators.pattern(COUNTRY_PATTERN)]],
    start_date: ['', [Validators.required]],
    end_date: ['', [Validators.required, endsNotBefore('start_date', { dateOnly: true })]],
    departure_time: ['', [Validators.pattern(TIME_PATTERN)]],
    return_time: ['', [Validators.pattern(TIME_PATTERN)]],
    currency: ['EUR' as 'EUR' | 'CHF', [Validators.required]],
    rate_jurisdiction: ['IT' as 'IT' | 'CH', [Validators.required]],
    estimated_budget: ['', [decimalPattern(2)]],
    advance_amount: ['', [decimalPattern(2), advanceWithinBudget]],
  });

  constructor() {
    const destroyRef = inject(DestroyRef);
    revalidateOnStartChange(this.tripForm, 'start_date', 'end_date', destroyRef);
    this.tripForm.controls.estimated_budget.valueChanges
      .pipe(takeUntilDestroyed(destroyRef))
      .subscribe(() => this.tripForm.controls.advance_amount.updateValueAndValidity({ emitEvent: false }));
  }

  ngOnInit(): void {
    this.loadTrips();
  }

  loadTrips(): void {
    this.loading.set(true);
    this.api
      .getTrips({
        status: this.statusFilter() || undefined,
        search: this.searchQuery() || undefined,
        page: this.page(),
        per_page: 25,
      })
      .subscribe({
        next: (res) => {
          this.trips.set(res?.data ?? []);
          this.meta.set(res?.meta ?? null);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onStatusChange(status: TravelTripStatus | ''): void {
    this.statusFilter.set(status);
    this.page.set(1);
    this.loadTrips();
  }

  onSearch(query: string): void {
    this.searchQuery.set(query);
    this.page.set(1);
    this.loadTrips();
  }

  onPageChange(page: number): void {
    this.page.set(page);
    this.loadTrips();
  }

  openCreateModal(): void {
    this.editingTripId.set(null);
    this.tripForm.reset({
      purpose: '',
      destination_city: '',
      destination_country: this.authStore.activeJurisdiction() === 'CH' ? 'CH' : 'IT',
      start_date: '',
      end_date: '',
      departure_time: '',
      return_time: '',
      currency: this.authStore.activeJurisdiction() === 'CH' ? 'CHF' : 'EUR',
      rate_jurisdiction: this.authStore.activeJurisdiction() === 'CH' ? 'CH' : 'IT',
      estimated_budget: '',
      advance_amount: '',
    });
    this.tripModalVisible.set(true);
  }

  openEditModal(trip: TravelTrip): void {
    this.editingTripId.set(trip.id);
    this.tripForm.reset({
      purpose: trip.purpose,
      destination_city: trip.destination_city,
      destination_country: trip.destination_country,
      start_date: trip.start_date,
      end_date: trip.end_date,
      departure_time: trip.departure_time ?? '',
      return_time: trip.return_time ?? '',
      currency: trip.currency as 'EUR' | 'CHF',
      rate_jurisdiction: trip.rate_jurisdiction,
      estimated_budget: trip.estimated_budget,
      advance_amount: trip.advance_amount,
    });
    this.tripModalVisible.set(true);
  }

  saveTrip(): void {
    if (this.tripForm.invalid) {
      this.tripForm.markAllAsTouched();
      return;
    }

    const value = this.tripForm.getRawValue();
    const payload: TravelTripRequest = {
      purpose: value.purpose,
      destination_city: value.destination_city,
      destination_country: value.destination_country.toUpperCase(),
      start_date: value.start_date,
      end_date: value.end_date,
      departure_time: value.departure_time || null,
      return_time: value.return_time || null,
      currency: value.currency,
      rate_jurisdiction: value.rate_jurisdiction,
      estimated_budget: value.estimated_budget || null,
      advance_amount: value.advance_amount || null,
    };
    const editing = this.editingTripId();
    const request = editing ? this.api.updateTrip(editing, payload) : this.api.createTrip(payload);

    this.saving.set(true);
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.tripModalVisible.set(false);
        this.message.success(this.translate.instant('TRAVEL.TRIP_SAVED'));
        this.loadTrips();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        const unmapped = applyServerErrors(this.tripForm, err);
        this.message.error(unmapped[0] ?? this.translate.instant('TRAVEL.ACTION_ERROR'));
      },
    });
  }

  deleteTrip(trip: TravelTrip): void {
    this.api.deleteTrip(trip.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('TRAVEL.TRIP_DELETED'));
        this.loadTrips();
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
