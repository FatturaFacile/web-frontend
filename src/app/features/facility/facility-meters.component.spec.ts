import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { AuthStore, FacilityApiService, FacilityMeter, TranslateService } from '@core';
import { FacilityMetersComponent } from './facility-meters.component';

describe('FacilityMetersComponent', () => {
  const meter: FacilityMeter = {
    id: 'm-1',
    building_id: 'b-1',
    space_id: null,
    kind: 'electricity',
    code: 'EL-01',
    name: 'Main meter',
    unit: 'kWh',
    tariff_per_unit: '0.250000',
    currency: 'EUR',
    rollover_value: null,
    is_active: true,
    installed_on: null,
    last_read_on: '2027-05-10',
    last_value: '1250.500',
    notes: null,
  };

  const api = {
    getMeters: vi.fn(),
    getMeterSummary: vi.fn(),
    getBuildings: vi.fn(),
    getMeterReadings: vi.fn(),
    createMeter: vi.fn(),
    updateMeter: vi.fn(),
    deleteMeter: vi.fn(),
    recordMeterReading: vi.fn(),
    deleteMeterReading: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
  const translate = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
  const auth = { user: () => ({ id: 'usr-1' }), activeRoles: () => ['facility_manager'], userPermissions: () => [] as string[] };

  function create(): FacilityMetersComponent {
    const fixture = TestBed.createComponent(FacilityMetersComponent);
    fixture.detectChanges();
    return fixture.componentInstance;
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.getMeters.mockReturnValue(of({ data: [meter] }));
    api.getMeterSummary.mockReturnValue(of({ data: { year: 2027, rows: [{ month: '2027-05', kind: 'electricity', unit: 'kWh', currency: 'EUR', consumption: '250.500', cost: '62.63', readings: 1 }], totals: [] } }));
    api.getBuildings.mockReturnValue(of({ data: [{ id: 'b-1', code: 'HQ', name: 'Sede', city: null, country: null, notes: null, is_active: true }] }));
    api.getMeterReadings.mockReturnValue(of({ data: [] }));
    api.createMeter.mockReturnValue(of({ data: meter }));
    api.recordMeterReading.mockReturnValue(of({ data: {} }));

    TestBed.configureTestingModule({
      imports: [FacilityMetersComponent],
      providers: [
        { provide: FacilityApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
        { provide: TranslateService, useValue: translate },
        { provide: AuthStore, useValue: auth },
        provideNzIcons(icons),
      ],
    });
  });

  it('loads the meters and the summary of the current year', () => {
    const component = create();

    expect(component.meters()).toHaveLength(1);
    expect(api.getMeterSummary).toHaveBeenCalledWith({ year: new Date().getFullYear(), kind: undefined });
    expect(component.summary()?.rows[0].cost).toBe('62.63');
  });

  it('offers only the units that fit the kind of meter and resets the unit when the kind changes', () => {
    const component = create();
    component.openMeter();

    expect(component.unitsOfKind()).toEqual(['kWh', 'MWh']);
    component.meterForm.patchValue({ kind: 'water' });

    expect(component.unitsOfKind()).toEqual(['m3', 'l']);
    expect(component.meterForm.controls.unit.value).toBe('m3');
  });

  it('keeps the unit of an existing meter when it is opened for editing', () => {
    const component = create();

    component.openMeter({ ...meter, unit: 'MWh' });

    expect(component.meterForm.controls.unit.value).toBe('MWh');
    expect(component.meterForm.controls.tariff_per_unit.value).toBe(0.25);
  });

  it('creates a meter with the tariff and currency as typed in the form request', () => {
    const component = create();
    component.openMeter();
    component.meterForm.patchValue({ building_id: 'b-1', kind: 'water', code: 'WA-01', name: 'Water', tariff_per_unit: 2.5, currency: 'CHF', rollover_value: 99999 });

    component.saveMeter();

    expect(api.createMeter).toHaveBeenCalledWith({
      building_id: 'b-1',
      kind: 'water',
      code: 'WA-01',
      name: 'Water',
      unit: 'm3',
      tariff_per_unit: 2.5,
      currency: 'CHF',
      rollover_value: 99999,
      is_active: true,
    });
  });

  it('records a reading with a numeric value and refreshes the meters and the summary', () => {
    const component = create();
    component.openReading(meter);
    component.readingForm.patchValue({ read_on: '2027-05-11', value: 1300.25, reading_type: 'regular' });

    component.saveReading();

    expect(api.recordMeterReading).toHaveBeenCalledWith('m-1', { read_on: '2027-05-11', value: 1300.25, reading_type: 'regular' });
    expect(message.success).toHaveBeenCalledWith('FACILITY.READING_SAVED');
    expect(api.getMeters).toHaveBeenCalledTimes(2);
  });

  it('shows the reason when a reading is refused', () => {
    api.recordMeterReading.mockReturnValue(throwError(() => ({ error: { errors: { value: ['The value is below the previous reading.'] } } })));
    const component = create();
    component.openReading(meter);
    component.readingForm.patchValue({ value: 10 });

    component.saveReading();

    expect(message.error).toHaveBeenCalled();
    expect(component.readingVisible()).toBe(true);
  });
});
