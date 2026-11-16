import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  AuthStore,
  ExpensesApiService,
  TranslateService,
  TravelApiService,
  TravelTrip,
  TravelTripReport,
} from '@core';
import { TravelTripDetailComponent } from './travel-trip-detail.component';

const baseTrip: TravelTrip = {
  id: 'trip-1',
  number: 'TR-2027-0001',
  user_id: 'usr-1',
  employee: { id: 'usr-1', name: 'Laura Rossi' },
  purpose: 'Customer workshop in Bologna',
  destination_city: 'Bologna',
  destination_country: 'IT',
  start_date: '2027-06-14',
  end_date: '2027-06-16',
  departure_time: '08:00',
  return_time: '20:00',
  currency: 'EUR',
  rate_jurisdiction: 'IT',
  estimated_budget: '600.00',
  advance_amount: '300.00',
  advance_paid_at: null,
  status: 'submitted',
  submitted_at: '2027-06-01T08:00:00+00:00',
  approved_by: null,
  approved_at: null,
  rejected_by: null,
  rejected_at: null,
  rejection_reason: null,
  completed_at: null,
  reconciled_at: null,
  reconciled_by: null,
  reconciled_expenses_total: null,
  reconciled_per_diem_total: null,
  reconciled_mileage_total: null,
  reconciled_advance_total: null,
  reconciled_balance: null,
  reconciled_direction: null,
  legs: [],
  per_diem_days: [
    {
      id: 'd1',
      day: '2027-06-14',
      hours_away: '16.00',
      day_factor: '1.00',
      breakfast_provided: false,
      lunch_provided: false,
      dinner_provided: false,
      lodging_provided: false,
      currency: 'EUR',
      gross_amount: '46.48',
      deduction_amount: '0.00',
      amount: '46.48',
      tax_free_amount: '46.48',
      taxable_amount: '0.00',
    },
  ],
  mileage_claims: [],
  created_at: '2027-06-01T07:00:00+00:00',
};

function reportOf(trip: TravelTrip): TravelTripReport {
  return {
    trip,
    frozen: false,
    budget: {
      currency: 'EUR',
      estimated: '600.00',
      booked_itinerary: '320.00',
      booked_by_type: { flight: '140.00', hotel: '180.00' },
      actual: '46.48',
      variance: '-553.52',
      utilization_percent: '7.75',
      within_budget: true,
    },
    reconciliation: {
      currency: 'EUR',
      per_diem_total: '46.48',
      per_diem_taxable_total: '0.00',
      mileage_total: '0.00',
      expenses_total: '0.00',
      total_due: '46.48',
      advance_amount: '300.00',
      advance_paid: '0.00',
      balance: '46.48',
      balance_amount: '46.48',
      direction: 'owed_to_employee',
      pending_expenses: 0,
      rejected_expenses: 0,
      expenses: [],
    },
  };
}

describe('TravelTripDetailComponent', () => {
  const apiSpy = {
    getReport: vi.fn(),
    submitTrip: vi.fn().mockReturnValue(of({ data: baseTrip })),
    approveTrip: vi.fn().mockReturnValue(of({ data: baseTrip })),
    rejectTrip: vi.fn().mockReturnValue(of({ data: baseTrip })),
    completeTrip: vi.fn().mockReturnValue(of({ data: baseTrip })),
    reconcileTrip: vi.fn().mockReturnValue(of({ data: baseTrip })),
    markAdvancePaid: vi.fn().mockReturnValue(of({ data: baseTrip })),
    calculatePerDiem: vi.fn().mockReturnValue(of({ data: [], totals: {} })),
    addMileageClaim: vi.fn().mockReturnValue(of({ data: {} })),
    addLeg: vi.fn().mockReturnValue(of({ data: {} })),
  };
  const expensesSpy = { listExpenses: vi.fn().mockReturnValue(of({ data: [] })) };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    currentLanguage: () => 'it', translate: vi.fn().mockImplementation((key: string) => key),
  };

  async function open(trip: TravelTrip, roles: string[], userId = 'usr-9'): Promise<TravelTripDetailComponent> {
    apiSpy.getReport.mockReturnValue(of({ data: reportOf(trip) }));

    await TestBed.configureTestingModule({
      imports: [TravelTripDetailComponent],
      providers: [
        provideRouter([{ path: 'travel/:id', component: TravelTripDetailComponent }]),
        { provide: TravelApiService, useValue: apiSpy },
        { provide: ExpensesApiService, useValue: expensesSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: AuthStore, useValue: { activeRoles: () => roles, user: () => ({ id: userId, permissions: [] }), activeJurisdiction: () => 'IT' } },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    const harness = await RouterTestingHarness.create();
    return harness.navigateByUrl(`/travel/${trip.id}`, TravelTripDetailComponent);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    apiSpy.submitTrip.mockReturnValue(of({ data: baseTrip }));
    apiSpy.approveTrip.mockReturnValue(of({ data: baseTrip }));
    apiSpy.rejectTrip.mockReturnValue(of({ data: baseTrip }));
    apiSpy.markAdvancePaid.mockReturnValue(of({ data: baseTrip }));
    apiSpy.calculatePerDiem.mockReturnValue(of({ data: [], totals: {} }));
  });

  it('loads the report of the trip of the route', async () => {
    const component = await open(baseTrip, ['accountant']);

    expect(apiSpy.getReport).toHaveBeenCalledWith('trip-1');
    expect(component.trip()?.number).toBe('TR-2027-0001');
    expect(component.budget()?.booked_itinerary).toBe('320.00');
    expect(component.perDiemEdits()).toHaveLength(1);
  });

  it('lets an approver decide a submitted trip of somebody else', async () => {
    const component = await open(baseTrip, ['hr']);

    expect(component.canApprove()).toBe(true);
    component.openApproveModal();
    expect(component.approveForm.getRawValue().advance_amount).toBe('300.00');
    component.approveForm.patchValue({ advance_amount: '250.00' });
    component.approve();

    expect(apiSpy.approveTrip).toHaveBeenCalledWith('trip-1', { advance_amount: '250.00' });
    expect(component.approveModalVisible()).toBe(false);
  });

  it('keeps an approver from deciding their own trip, except the owner', async () => {
    const own = await open(baseTrip, ['accountant'], 'usr-1');
    expect(own.canApprove()).toBe(false);

    TestBed.resetTestingModule();
    const owner = await open(baseTrip, ['owner'], 'usr-1');
    expect(owner.canApprove()).toBe(true);
  });

  it('does not offer the approval to a plain member', async () => {
    const component = await open(baseTrip, ['member']);

    expect(component.canApprove()).toBe(false);
    expect(component.isManager()).toBe(false);
  });

  it('requires a reason to reject', async () => {
    const component = await open(baseTrip, ['admin']);

    component.openRejectModal();
    component.reject();
    expect(apiSpy.rejectTrip).not.toHaveBeenCalled();

    component.rejectForm.patchValue({ reason: 'Budget frozen' });
    component.reject();
    expect(apiSpy.rejectTrip).toHaveBeenCalledWith('trip-1', { reason: 'Budget frozen' });
  });

  it('offers the advance payment to finance only once, for an approved trip with an advance', async () => {
    const approved = { ...baseTrip, status: 'approved' as const };

    expect((await open(approved, ['accountant'])).canRecordAdvance()).toBe(true);

    TestBed.resetTestingModule();
    expect((await open({ ...approved, advance_paid_at: '2027-06-12' }, ['accountant'])).canRecordAdvance()).toBe(false);

    TestBed.resetTestingModule();
    expect((await open(approved, ['hr'])).canRecordAdvance()).toBe(false);
  });

  it('sends the meals provided per day when the per diem is calculated again', async () => {
    const component = await open({ ...baseTrip, status: 'approved' }, ['member'], 'usr-1');

    component.toggleMeal(0, 'lunch_provided', true);
    expect(component.mealChecked(0, 'lunch_provided')).toBe(true);
    component.calculatePerDiem();

    expect(apiSpy.calculatePerDiem).toHaveBeenCalledWith('trip-1', {
      days: [{ day: '2027-06-14', breakfast_provided: false, lunch_provided: true, dinner_provided: false, lodging_provided: false }],
    });
  });

  it('requires check-in and check-out for a hotel leg and sends the currency of the trip', async () => {
    const component = await open({ ...baseTrip, status: 'draft' }, ['member'], 'usr-1');

    component.openLegModal();
    component.legForm.patchValue({ leg_type: 'hotel', to_location: 'Hotel Centro', booked_cost: '180.00' });
    expect(component.legForm.hasError('hotelDates')).toBe(true);

    component.legForm.patchValue({ departs_at: '2027-06-14T15:00', arrives_at: '2027-06-16T11:00' });
    expect(component.legForm.valid).toBe(true);
    component.saveLeg();

    expect(apiSpy.addLeg).toHaveBeenCalledWith('trip-1', expect.objectContaining({ leg_type: 'hotel', currency: 'EUR', booked_cost: '180.00' }));
  });

  it('mirrors the mileage rules: a positive distance with two decimals', async () => {
    const component = await open({ ...baseTrip, status: 'approved' }, ['member'], 'usr-1');

    component.openMileageModal();
    component.mileageForm.patchValue({ travel_date: '2027-06-14', from_location: 'Milano', to_location: 'Bologna', distance_km: '0' });
    expect(component.mileageForm.controls.distance_km.hasError('positive')).toBe(true);

    component.mileageForm.patchValue({ distance_km: '84.50', round_trip: true });
    expect(component.mileageForm.valid).toBe(true);
    component.saveMileage();

    expect(apiSpy.addMileageClaim).toHaveBeenCalledWith('trip-1', {
      travel_date: '2027-06-14',
      from_location: 'Milano',
      to_location: 'Bologna',
      vehicle_type: 'car',
      round_trip: true,
      distance_km: '84.50',
      notes: null,
    });
  });

  it('freezes the editors once the trip is submitted', async () => {
    const component = await open(baseTrip, ['member'], 'usr-1');

    expect(component.isWorking()).toBe(false);
  });
});
