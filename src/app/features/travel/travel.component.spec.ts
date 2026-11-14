import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, TranslateService, TravelApiService, TravelTrip } from '@core';
import { TravelComponent } from './travel.component';

describe('TravelComponent', () => {
  let component: TravelComponent;
  let fixture: ComponentFixture<TravelComponent>;

  const mockTrip: TravelTrip = {
    id: 'trip-1',
    number: 'TR-2027-0001',
    user_id: 'usr-1',
    employee: { id: 'usr-1', name: 'Laura Rossi' },
    purpose: 'Customer workshop in Lugano',
    destination_city: 'Lugano',
    destination_country: 'CH',
    start_date: '2027-06-14',
    end_date: '2027-06-16',
    departure_time: '07:30',
    return_time: '19:00',
    currency: 'CHF',
    rate_jurisdiction: 'CH',
    estimated_budget: '850.00',
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
    created_at: '2027-06-01T07:00:00+00:00',
  };

  const meta = { current_page: 1, from: 1, last_page: 1, per_page: 25, to: 1, total: 1 };

  const apiSpy = {
    getTrips: vi.fn().mockReturnValue(of({ data: [mockTrip], meta })),
    createTrip: vi.fn().mockReturnValue(of({ data: mockTrip })),
    updateTrip: vi.fn().mockReturnValue(of({ data: mockTrip })),
    deleteTrip: vi.fn().mockReturnValue(of(undefined)),
    getPerDiemRates: vi.fn().mockReturnValue(of({ data: [] })),
    getMileageRates: vi.fn().mockReturnValue(of({ data: [] })),
  };

  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  const authStub = {
    activeRoles: () => ['accountant'],
    activeJurisdiction: () => 'CH',
    user: () => ({ id: 'usr-9', permissions: [] }),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [TravelComponent],
      providers: [
        provideRouter([]),
        { provide: TravelApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: AuthStore, useValue: authStub },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TravelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the trips and counts those waiting for approval', () => {
    expect(apiSpy.getTrips).toHaveBeenCalledWith({ status: undefined, search: undefined, page: 1, per_page: 25 });
    expect(component.trips()).toHaveLength(1);
    expect(component.pendingApprovalCount()).toBe(1);
    expect(component.isManager()).toBe(true);
  });

  it('filters by status and returns to the first page', () => {
    component.page.set(3);
    component.onStatusChange('approved');

    expect(component.page()).toBe(1);
    expect(apiSpy.getTrips).toHaveBeenLastCalledWith({ status: 'approved', search: undefined, page: 1, per_page: 25 });
  });

  it('defaults a new trip to the Swiss rates of a Swiss company', () => {
    component.openCreateModal();

    expect(component.tripModalVisible()).toBe(true);
    expect(component.tripForm.getRawValue()).toMatchObject({ destination_country: 'CH', currency: 'CHF', rate_jurisdiction: 'CH' });
  });

  it('mirrors the API rules: dates in order and an advance within the budget', () => {
    component.openCreateModal();
    component.tripForm.patchValue({
      purpose: 'Workshop',
      destination_city: 'Lugano',
      start_date: '2027-06-16',
      end_date: '2027-06-14',
      estimated_budget: '200.00',
      advance_amount: '250.00',
    });

    expect(component.tripForm.controls.end_date.hasError('endsBeforeStart')).toBe(true);
    expect(component.tripForm.controls.advance_amount.hasError('exceedsMax')).toBe(true);
    expect(component.tripForm.invalid).toBe(true);

    component.tripForm.patchValue({ end_date: '2027-06-18', advance_amount: '150.00' });
    expect(component.tripForm.valid).toBe(true);
  });

  it('creates a trip with the API field names and reloads the list', () => {
    component.openCreateModal();
    component.tripForm.patchValue({
      purpose: 'Workshop',
      destination_city: 'Lugano',
      destination_country: 'ch',
      start_date: '2027-06-14',
      end_date: '2027-06-16',
      departure_time: '07:30',
      estimated_budget: '850.00',
      advance_amount: '300.00',
    });

    component.saveTrip();

    expect(apiSpy.createTrip).toHaveBeenCalledWith({
      purpose: 'Workshop',
      destination_city: 'Lugano',
      destination_country: 'CH',
      start_date: '2027-06-14',
      end_date: '2027-06-16',
      departure_time: '07:30',
      return_time: null,
      currency: 'CHF',
      rate_jurisdiction: 'CH',
      estimated_budget: '850.00',
      advance_amount: '300.00',
    });
    expect(component.tripModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
    expect(apiSpy.getTrips).toHaveBeenCalledTimes(2);
  });

  it('shows the 422 error of the API on the field', () => {
    apiSpy.createTrip.mockReturnValueOnce(
      throwError(() => new HttpErrorResponse({ status: 422, error: { message: 'invalid', errors: { advance_amount: ['The advance cannot exceed the estimated budget.'] } } })),
    );
    component.openCreateModal();
    component.tripForm.patchValue({ purpose: 'Workshop', destination_city: 'Lugano', start_date: '2027-06-14', end_date: '2027-06-16' });

    component.saveTrip();

    expect(component.saving()).toBe(false);
    expect(component.tripForm.controls.advance_amount.errors?.['serverError']).toBe('The advance cannot exceed the estimated budget.');
    expect(component.errorTip(component.tripForm, 'advance_amount')).toBe('The advance cannot exceed the estimated budget.');
  });

  it('edits a draft trip with an update request', () => {
    component.openEditModal({ ...mockTrip, status: 'draft' });
    expect(component.editingTripId()).toBe('trip-1');

    component.saveTrip();

    expect(apiSpy.updateTrip).toHaveBeenCalledWith('trip-1', expect.objectContaining({ purpose: 'Customer workshop in Lugano', currency: 'CHF' }));
  });

  it('deletes a draft trip', () => {
    component.deleteTrip(mockTrip);

    expect(apiSpy.deleteTrip).toHaveBeenCalledWith('trip-1');
    expect(messageSpy.success).toHaveBeenCalled();
  });
});
