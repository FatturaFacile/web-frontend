import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { TranslateService, TravelApiService, TravelMileageRate, TravelPerDiemRate } from '@core';
import { TravelRatesComponent } from './travel-rates.component';

describe('TravelRatesComponent', () => {
  let component: TravelRatesComponent;
  let fixture: ComponentFixture<TravelRatesComponent>;

  const italian: TravelPerDiemRate = {
    id: 'r1',
    jurisdiction: 'IT',
    year: 2027,
    scope: 'domestic',
    country: null,
    currency: 'EUR',
    daily_amount: '46.48',
    tax_free_daily_amount: '46.48',
    lodging_deduction_percent: '33.3333',
    breakfast_deduction_percent: '0.0000',
    meal_deduction_percent: '33.3333',
    deduct_each_meal: false,
    half_day_min_hours: 8,
    full_day_min_hours: 12,
    notes: null,
  };
  const swiss: TravelPerDiemRate = {
    ...italian,
    id: 'r2',
    jurisdiction: 'CH',
    currency: 'CHF',
    daily_amount: '75.00',
    tax_free_daily_amount: null,
    deduct_each_meal: true,
  };
  const mileage: TravelMileageRate = { id: 'm1', jurisdiction: 'CH', year: 2027, vehicle_type: 'car', currency: 'CHF', rate_per_km: '0.7000', notes: null };

  const apiSpy = {
    getPerDiemRates: vi.fn().mockReturnValue(of({ data: [italian, swiss] })),
    getMileageRates: vi.fn().mockReturnValue(of({ data: [mileage] })),
    createPerDiemRate: vi.fn().mockReturnValue(of({ data: italian })),
    updatePerDiemRate: vi.fn().mockReturnValue(of({ data: italian })),
    createMileageRate: vi.fn().mockReturnValue(of({ data: mileage })),
    seedDefaultRates: vi.fn().mockReturnValue(of({ data: { per_diem_created: 2, mileage_created: 2 } })),
  };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [TravelRatesComponent],
      providers: [
        { provide: TravelApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(TravelRatesComponent);
    fixture.componentRef.setInput('canMaintain', true);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads both rate tables and filters them by jurisdiction', () => {
    expect(component.perDiemRates()).toHaveLength(2);
    expect(component.mileageRates()).toHaveLength(1);

    component.jurisdictionFilter.set('CH');

    expect(component.visiblePerDiemRates().map((rate) => rate.id)).toEqual(['r2']);
    expect(component.visibleMileageRates()).toHaveLength(1);

    component.jurisdictionFilter.set('IT');
    expect(component.visibleMileageRates()).toHaveLength(0);
  });

  it('creates a country row of the per-diem table with the API field names', () => {
    component.openPerDiemModal();
    component.perDiemForm.patchValue({
      jurisdiction: 'IT',
      year: 2027,
      scope: 'abroad',
      country: 'de',
      currency: 'EUR',
      daily_amount: '90.00',
      tax_free_daily_amount: '77.47',
    });
    expect(component.perDiemForm.valid).toBe(true);

    component.savePerDiemRate();

    expect(apiSpy.createPerDiemRate).toHaveBeenCalledWith({
      jurisdiction: 'IT',
      year: 2027,
      scope: 'abroad',
      country: 'DE',
      currency: 'EUR',
      daily_amount: '90.00',
      tax_free_daily_amount: '77.47',
      lodging_deduction_percent: '0',
      breakfast_deduction_percent: '0',
      meal_deduction_percent: '0',
      deduct_each_meal: false,
      half_day_min_hours: 8,
      full_day_min_hours: 12,
      notes: null,
    });
  });

  it('refuses an invalid amount and a three-letter country', () => {
    component.openPerDiemModal();
    component.perDiemForm.patchValue({ daily_amount: '46.481', country: 'ITA' });

    expect(component.perDiemForm.controls.daily_amount.hasError('decimal')).toBe(true);
    expect(component.perDiemForm.controls.country.hasError('pattern')).toBe(true);
    component.savePerDiemRate();
    expect(apiSpy.createPerDiemRate).not.toHaveBeenCalled();
  });

  it('edits a row with an update and a mileage row with a create', () => {
    component.openPerDiemModal(italian);
    component.savePerDiemRate();
    expect(apiSpy.updatePerDiemRate).toHaveBeenCalledWith('r1', expect.objectContaining({ daily_amount: '46.48', tax_free_daily_amount: '46.48' }));

    component.openMileageModal();
    component.mileageForm.patchValue({ jurisdiction: 'CH', currency: 'CHF', rate_per_km: '0.7000' });
    component.saveMileageRate();
    expect(apiSpy.createMileageRate).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: 'CH', vehicle_type: 'car', rate_per_km: '0.7000' }));
  });

  it('adds the reference rates of a jurisdiction and reloads', () => {
    component.seedDefaults('CH');

    expect(apiSpy.seedDefaultRates).toHaveBeenCalledWith(expect.objectContaining({ jurisdiction: 'CH' }));
    expect(messageSpy.success).toHaveBeenCalled();
    expect(apiSpy.getPerDiemRates).toHaveBeenCalledTimes(2);
  });
});
