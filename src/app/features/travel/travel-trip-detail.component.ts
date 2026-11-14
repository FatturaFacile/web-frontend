import { Component, computed, effect, inject, OnInit, signal } from '@angular/core';
import {
  AbstractControl,
  FormGroup,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { Observable } from 'rxjs';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  AuthStore,
  ExpenseResource,
  ExpensesApiService,
  I18nService,
  serverErrorMessage,
  TRAVEL_BOOKING_STATUSES,
  TRAVEL_LEG_TYPES,
  TRAVEL_VEHICLE_TYPES,
  TranslateService,
  TravelApiService,
  TravelLeg,
  TravelLegRequest,
  TravelMileageClaim,
  TravelMileageClaimRequest,
  TravelPerDiemDay,
  TravelPerDiemDayRequest,
  TravelTrip,
  TravelTripReport,
} from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { decimalPattern, positiveNumber } from '@shared/utils/decimal-validators';
import { validationTipKey } from '@shared/utils/validation-tip';
import {
  hasTravelAccess,
  TRAVEL_DIRECTION_COLORS,
  TRAVEL_FINANCE_ROLES,
  TRAVEL_MANAGER_ROLES,
  TRAVEL_STATUS_COLORS,
} from './travel.utils';

type MealFlag = 'breakfast_provided' | 'lunch_provided' | 'dinner_provided' | 'lodging_provided';

/** The hotel needs check-in and check-out (API rule of the itinerary). */
function hotelNeedsDates(control: AbstractControl): ValidationErrors | null {
  const type = control.get('leg_type')?.value;
  return type === 'hotel' && (!control.get('departs_at')?.value || !control.get('arrives_at')?.value)
    ? { hotelDates: true }
    : null;
}

/** `datetime-local` value (`Y-m-dTH:i`) of an ISO 8601 instant. */
function toDateTimeLocal(value: string | null): string {
  return value ? value.slice(0, 16) : '';
}

/**
 * A business trip: approval actions, itinerary editor, per diem, mileage, linked expenses, the reconciliation of the
 * advance and the plan-against-actual report.
 */
@Component({
  selector: 'app-travel-trip-detail',
  styleUrl: './travel.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDescriptionsModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    IconActionDirective,
    ModalActionsDirective,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './travel-trip-detail.component.html',
})
export class TravelTripDetailComponent implements OnInit {
  private readonly api = inject(TravelApiService);
  private readonly expensesApi = inject(ExpensesApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly authStore = inject(AuthStore);

  /** Route parameter `:id` of the trip. */
  readonly id = signal<string>(inject(ActivatedRoute).snapshot.paramMap.get('id') ?? '');

  readonly legTypes = TRAVEL_LEG_TYPES;
  readonly bookingStatuses = TRAVEL_BOOKING_STATUSES;
  readonly vehicleTypes = TRAVEL_VEHICLE_TYPES;
  readonly statusColors = TRAVEL_STATUS_COLORS;
  readonly directionColors = TRAVEL_DIRECTION_COLORS;

  readonly report = signal<TravelTripReport | null>(null);
  readonly loading = signal<boolean>(false);
  readonly busy = signal<boolean>(false);
  readonly selectedTabIndex = signal<number>(0);
  readonly perDiemEdits = signal<TravelPerDiemDayRequest[]>([]);

  readonly trip = computed<TravelTrip | null>(() => this.report()?.trip ?? null);
  readonly budget = computed(() => this.report()?.budget ?? null);
  readonly reconciliation = computed(() => this.report()?.reconciliation ?? null);
  readonly legs = computed<TravelLeg[]>(() => this.trip()?.legs ?? []);
  readonly perDiemDays = computed<TravelPerDiemDay[]>(() => this.trip()?.per_diem_days ?? []);
  readonly mileageClaims = computed<TravelMileageClaim[]>(() => this.trip()?.mileage_claims ?? []);
  readonly isOwnTrip = computed(() => this.trip()?.user_id === this.authStore.user()?.id);
  readonly isManager = computed(() => hasTravelAccess(this.authStore, TRAVEL_MANAGER_ROLES, 'manage'));
  readonly isFinance = computed(() => hasTravelAccess(this.authStore, TRAVEL_FINANCE_ROLES, 'reconcile'));
  readonly isOwnerRole = computed(() => this.authStore.activeRoles().map((role) => role.toLowerCase()).includes('owner'));
  readonly isWorking = computed(() => ['draft', 'approved', 'completed'].includes(this.trip()?.status ?? ''));
  readonly canApprove = computed(
    () =>
      this.trip()?.status === 'submitted' &&
      hasTravelAccess(this.authStore, TRAVEL_MANAGER_ROLES, 'approve') &&
      (!this.isOwnTrip() || this.isOwnerRole()),
  );
  readonly canRecordAdvance = computed(() => {
    const trip = this.trip();
    return (
      this.isFinance() &&
      !!trip &&
      ['approved', 'completed'].includes(trip.status) &&
      Number(trip.advance_amount) > 0 &&
      trip.advance_paid_at === null
    );
  });
  readonly totalPerDiem = computed(() => this.reconciliation()?.per_diem_total ?? '0.00');
  readonly totalBookedCost = computed(() => this.budget()?.booked_itinerary ?? '0.00');
  readonly linkableExpenses = signal<ExpenseResource[]>([]);

  readonly legModalVisible = signal<boolean>(false);
  readonly mileageModalVisible = signal<boolean>(false);
  readonly expenseModalVisible = signal<boolean>(false);
  readonly approveModalVisible = signal<boolean>(false);
  readonly rejectModalVisible = signal<boolean>(false);
  readonly advanceModalVisible = signal<boolean>(false);
  readonly editingLegId = signal<string | null>(null);
  readonly editingClaimId = signal<string | null>(null);

  readonly legForm = this.fb.group(
    {
      leg_type: ['flight' as 'flight' | 'train' | 'car' | 'hotel', [Validators.required]],
      from_location: ['', [Validators.maxLength(150)]],
      to_location: ['', [Validators.required, Validators.maxLength(150)]],
      departs_at: [''],
      arrives_at: [''],
      provider: ['', [Validators.maxLength(150)]],
      booking_reference: ['', [Validators.maxLength(60)]],
      booking_status: ['planned' as 'planned' | 'booked' | 'cancelled', [Validators.required]],
      booked_cost: ['', [decimalPattern(2)]],
      notes: ['', [Validators.maxLength(2000)]],
    },
    { validators: [hotelNeedsDates] },
  );

  readonly mileageForm = this.fb.group({
    travel_date: ['', [Validators.required]],
    from_location: ['', [Validators.required, Validators.maxLength(150)]],
    to_location: ['', [Validators.required, Validators.maxLength(150)]],
    vehicle_type: ['car' as 'car' | 'motorcycle' | 'bicycle', [Validators.required]],
    round_trip: [false],
    distance_km: ['', [Validators.required, decimalPattern(2, 5), positiveNumber]],
    notes: ['', [Validators.maxLength(500)]],
  });

  readonly expenseForm = this.fb.group({
    expense_id: ['', [Validators.required]],
  });

  readonly approveForm = this.fb.group({
    advance_amount: ['', [decimalPattern(2)]],
  });

  readonly rejectForm = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(2000)]],
  });

  readonly advanceForm = this.fb.group({
    paid_at: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      this.perDiemEdits.set(
        this.perDiemDays().map((day) => ({
          day: day.day,
          breakfast_provided: day.breakfast_provided,
          lunch_provided: day.lunch_provided,
          dinner_provided: day.dinner_provided,
          lodging_provided: day.lodging_provided,
        })),
      );
    });
  }

  ngOnInit(): void {
    this.refresh();
  }

  refresh(): void {
    this.loading.set(true);
    this.api.getReport(this.id()).subscribe({
      next: (res) => {
        this.report.set(res?.data ?? null);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  // --- Approval flow ---
  private run(request: Observable<unknown>, successKey: string, after?: () => void): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.message.success(this.translate.instant(successKey));
        after?.();
        this.refresh();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.message.error(this.firstServerMessage(err) ?? this.translate.instant('TRAVEL.ACTION_ERROR'));
      },
    });
  }

  private firstServerMessage(err: unknown): string | null {
    const probe = new FormGroup({});
    return applyServerErrors(probe, err)[0] ?? null;
  }

  submit(): void {
    this.run(this.api.submitTrip(this.id()), 'TRAVEL.TRIP_SUBMITTED');
  }

  withdraw(): void {
    this.run(this.api.withdrawTrip(this.id()), 'TRAVEL.TRIP_WITHDRAWN');
  }

  reopen(): void {
    this.run(this.api.reopenTrip(this.id()), 'TRAVEL.TRIP_REOPENED');
  }

  complete(): void {
    this.run(this.api.completeTrip(this.id()), 'TRAVEL.TRIP_COMPLETED');
  }

  reconcile(): void {
    this.run(this.api.reconcileTrip(this.id()), 'TRAVEL.TRIP_RECONCILED');
  }

  openApproveModal(): void {
    this.approveForm.reset({ advance_amount: this.trip()?.advance_amount ?? '' });
    this.approveModalVisible.set(true);
  }

  approve(): void {
    if (this.approveForm.invalid) {
      this.approveForm.markAllAsTouched();
      return;
    }
    const advance = this.approveForm.getRawValue().advance_amount;
    this.run(this.api.approveTrip(this.id(), { advance_amount: advance || null }), 'TRAVEL.TRIP_APPROVED', () => this.approveModalVisible.set(false));
  }

  openRejectModal(): void {
    this.rejectForm.reset({ reason: '' });
    this.rejectModalVisible.set(true);
  }

  reject(): void {
    if (this.rejectForm.invalid) {
      this.rejectForm.markAllAsTouched();
      return;
    }
    this.run(this.api.rejectTrip(this.id(), { reason: this.rejectForm.getRawValue().reason }), 'TRAVEL.TRIP_REJECTED', () => this.rejectModalVisible.set(false));
  }

  openAdvanceModal(): void {
    this.advanceForm.reset({ paid_at: '' });
    this.advanceModalVisible.set(true);
  }

  recordAdvance(): void {
    if (this.advanceForm.invalid) {
      this.advanceForm.markAllAsTouched();
      return;
    }
    this.run(this.api.markAdvancePaid(this.id(), { paid_at: this.advanceForm.getRawValue().paid_at }), 'TRAVEL.ADVANCE_RECORDED', () => this.advanceModalVisible.set(false));
  }

  // --- Itinerary ---
  openLegModal(leg?: TravelLeg): void {
    this.editingLegId.set(leg?.id ?? null);
    this.legForm.reset({
      leg_type: leg?.leg_type ?? 'flight',
      from_location: leg?.from_location ?? '',
      to_location: leg?.to_location ?? '',
      departs_at: toDateTimeLocal(leg?.departs_at ?? null),
      arrives_at: toDateTimeLocal(leg?.arrives_at ?? null),
      provider: leg?.provider ?? '',
      booking_reference: leg?.booking_reference ?? '',
      booking_status: leg?.booking_status ?? 'planned',
      booked_cost: leg?.booked_cost ?? '',
      notes: leg?.notes ?? '',
    });
    this.legModalVisible.set(true);
  }

  saveLeg(): void {
    if (this.legForm.invalid) {
      this.legForm.markAllAsTouched();
      return;
    }
    const value = this.legForm.getRawValue();
    const payload: TravelLegRequest = {
      leg_type: value.leg_type,
      from_location: value.from_location || null,
      to_location: value.to_location,
      departs_at: value.departs_at || null,
      arrives_at: value.arrives_at || null,
      provider: value.provider || null,
      booking_reference: value.booking_reference || null,
      booking_status: value.booking_status,
      booked_cost: value.booked_cost || null,
      currency: this.trip()?.currency ?? null,
      notes: value.notes || null,
    };
    const editing = this.editingLegId();
    this.saveWith(
      editing ? this.api.updateLeg(this.id(), editing, payload) : this.api.addLeg(this.id(), payload),
      this.legForm,
      'TRAVEL.LEG_SAVED',
      () => this.legModalVisible.set(false),
    );
  }

  deleteLeg(leg: TravelLeg): void {
    this.run(this.api.deleteLeg(this.id(), leg.id), 'TRAVEL.LEG_DELETED');
  }

  // --- Per diem ---
  toggleMeal(index: number, flag: MealFlag, checked: boolean): void {
    this.perDiemEdits.update((days) => days.map((day, position) => (position === index ? { ...day, [flag]: checked } : day)));
  }

  mealChecked(index: number, flag: MealFlag): boolean {
    return !!this.perDiemEdits()[index]?.[flag];
  }

  calculatePerDiem(): void {
    const edits = this.perDiemEdits();
    this.run(this.api.calculatePerDiem(this.id(), edits.length > 0 ? { days: edits } : {}), 'TRAVEL.PER_DIEM_CALCULATED');
  }

  // --- Mileage ---
  openMileageModal(claim?: TravelMileageClaim): void {
    this.editingClaimId.set(claim?.id ?? null);
    this.mileageForm.reset({
      travel_date: claim?.travel_date ?? this.trip()?.start_date ?? '',
      from_location: claim?.from_location ?? '',
      to_location: claim?.to_location ?? '',
      vehicle_type: claim?.vehicle_type ?? 'car',
      round_trip: claim?.round_trip ?? false,
      distance_km: claim?.distance_km ?? '',
      notes: claim?.notes ?? '',
    });
    this.mileageModalVisible.set(true);
  }

  saveMileage(): void {
    if (this.mileageForm.invalid) {
      this.mileageForm.markAllAsTouched();
      return;
    }
    const value = this.mileageForm.getRawValue();
    const payload: TravelMileageClaimRequest = {
      travel_date: value.travel_date,
      from_location: value.from_location,
      to_location: value.to_location,
      vehicle_type: value.vehicle_type,
      round_trip: value.round_trip,
      distance_km: value.distance_km,
      notes: value.notes || null,
    };
    const editing = this.editingClaimId();
    this.saveWith(
      editing ? this.api.updateMileageClaim(this.id(), editing, payload) : this.api.addMileageClaim(this.id(), payload),
      this.mileageForm,
      'TRAVEL.MILEAGE_SAVED',
      () => this.mileageModalVisible.set(false),
    );
  }

  deleteMileage(claim: TravelMileageClaim): void {
    this.run(this.api.deleteMileageClaim(this.id(), claim.id), 'TRAVEL.MILEAGE_DELETED');
  }

  // --- Expenses ---
  openExpenseModal(): void {
    const trip = this.trip();
    if (!trip) {
      return;
    }
    this.expenseForm.reset({ expense_id: '' });
    this.linkableExpenses.set([]);
    this.expensesApi.listExpenses({ user_id: trip.user_id, per_page: 100 }).subscribe({
      next: (res) => {
        const linked = new Set((this.reconciliation()?.expenses ?? []).map((expense) => expense.id));
        this.linkableExpenses.set(
          (res?.data ?? []).filter((expense) => expense.status !== 'rejected' && expense.currency === trip.currency && !linked.has(expense.id)),
        );
      },
    });
    this.expenseModalVisible.set(true);
  }

  linkExpense(): void {
    if (this.expenseForm.invalid) {
      this.expenseForm.markAllAsTouched();
      return;
    }
    this.saveWith(
      this.api.linkExpense(this.id(), { expense_id: this.expenseForm.getRawValue().expense_id }),
      this.expenseForm,
      'TRAVEL.EXPENSE_LINKED',
      () => this.expenseModalVisible.set(false),
    );
  }

  unlinkExpense(expenseId: string): void {
    this.run(this.api.unlinkExpense(this.id(), expenseId), 'TRAVEL.EXPENSE_UNLINKED');
  }

  /** Runs a save request whose 422 errors are shown on the form fields. */
  private saveWith(
    request: Observable<unknown>,
    form: FormGroup,
    successKey: string,
    after: () => void,
  ): void {
    this.busy.set(true);
    request.subscribe({
      next: () => {
        this.busy.set(false);
        this.message.success(this.translate.instant(successKey));
        after();
        this.refresh();
      },
      error: (err: unknown) => {
        this.busy.set(false);
        const unmapped = applyServerErrors(form, err);
        this.message.error(unmapped[0] ?? this.translate.instant('TRAVEL.ACTION_ERROR'));
      },
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
