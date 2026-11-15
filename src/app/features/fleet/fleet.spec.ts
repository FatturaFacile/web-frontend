import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { FleetApiService, FleetAssignment, FleetDashboard, FleetDeadline, FleetFuelEntry, FleetVehicle, HrApiService, TranslateService } from '@core';
import { FleetAssignmentsComponent } from './fleet-assignments.component';
import { FleetDashboardComponent } from './fleet-dashboard.component';
import { FleetDeadlinesComponent } from './fleet-deadlines.component';
import { FleetFuelComponent } from './fleet-fuel.component';
import { FleetVehicleDetailComponent } from './fleet-vehicle-detail.component';
import { FleetVehicleFormComponent } from './fleet-vehicle-form.component';
import { FleetVehiclesComponent } from './fleet-vehicles.component';
import { apiErrorText, blankToNull, decimalOrNull, loadEmployees } from './fleet.util';

const vehicle: FleetVehicle = {
  id: 'veh-1',
  license_plate: 'AB123CD',
  vin: null,
  make: 'Fiat',
  model: 'Ducato',
  model_year: 2024,
  vehicle_type: 'van',
  fuel_type: 'diesel',
  status: 'active',
  initial_odometer_km: 10000,
  odometer_km: 12000,
  ownership: 'owned',
  acquired_on: null,
  contract_ends_on: null,
  purchase_value: '20000.00',
  currency: 'EUR',
  asset_id: null,
  notes: null,
  current_assignment: null,
};

const electricVehicle: FleetVehicle = { ...vehicle, id: 'veh-2', license_plate: 'EV111EV', fuel_type: 'electric', odometer_km: 5000 };

const assignment: FleetAssignment = {
  id: 'as-1',
  vehicle_id: 'veh-1',
  employee_id: null,
  driver_label: 'Mario Esterno',
  starts_on: '2027-02-01',
  ends_on: null,
  start_odometer_km: 10000,
  end_odometer_km: null,
  is_open: true,
  notes: null,
};

const deadline: FleetDeadline = {
  id: 'dl-1',
  vehicle_id: 'veh-1',
  deadline_type: 'insurance',
  provider: 'Generali',
  reference: null,
  expires_on: '2027-06-30',
  days_to_expiry: 15,
  is_expired: false,
  cost: '650.00',
  currency: 'EUR',
  status: 'open',
  renewed_at: null,
  notes: null,
};

const fuelEntry: FleetFuelEntry = {
  id: 'fu-1',
  vehicle_id: 'veh-1',
  employee_id: null,
  entry_date: '2027-01-10',
  energy_unit: 'liter',
  quantity: '40.000',
  unit_price: '1.8000',
  total_cost: '72.00',
  currency: 'EUR',
  odometer_km: 10000,
  is_full_tank: true,
  station: null,
  distance_km: null,
  consumption_per_100km: null,
  cost_per_km: null,
  notes: null,
};

const dashboard: FleetDashboard = {
  vehicles: { total: 1, by_status: { active: 1, maintenance: 0, sold: 0, disposed: 0 } },
  totals: { fuel_cost: '192.60', service_cost: '180.00', deadline_cost: '600.00', incident_cost: '85.00', running_cost: '1057.60', distance_km: 1200, cost_per_km: '0.8813' },
  per_vehicle: [],
  upcoming_deadlines: [],
  overdue_services: [],
  unpaid_incidents: { count: 1, amount: '85.00' },
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };
const hrSpy = { getEmployees: vi.fn() };

function configure(api: Record<string, unknown>, extra: unknown[] = []): void {
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: FleetApiService, useValue: api },
      { provide: HrApiService, useValue: hrSpy },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
      ...(extra as never[]),
    ],
  });
}

describe('fleet util', () => {
  it('reads the first validation message of a 422', () => {
    expect(apiErrorText(new HttpErrorResponse({ status: 422, error: { errors: { odometer_km: ['The odometer cannot decrease'] } } }))).toBe('The odometer cannot decrease');
    expect(apiErrorText(new HttpErrorResponse({ status: 500, error: { message: 'Server error' } }))).toBe('Server error');
    expect(apiErrorText(new Error('boom'))).toBeNull();
  });

  it('turns blanks into null and numbers into API strings', () => {
    expect(blankToNull('  ')).toBeNull();
    expect(blankToNull(' abc ')).toBe('abc');
    expect(decimalOrNull(null)).toBeNull();
    expect(decimalOrNull(12.5)).toBe('12.5');
    expect(decimalOrNull(0)).toBe('0');
  });

  it('gives an empty employee list to members without access to the HR module', () => {
    hrSpy.getEmployees.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403 })));
    let result: unknown[] | null = null;
    loadEmployees(hrSpy as unknown as HrApiService).subscribe((employees) => (result = employees));

    expect(result).toEqual([]);
  });
});

describe('FleetVehicleFormComponent', () => {
  const api = { createVehicle: vi.fn(), updateVehicle: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.createVehicle.mockReturnValue(of({ data: vehicle }));
    api.updateVehicle.mockReturnValue(of({ data: vehicle }));
    configure(api);
  });

  it('creates a vehicle with the API payload and emits it', () => {
    const fixture = TestBed.createComponent(FleetVehicleFormComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    const saved = vi.fn();
    component.saved.subscribe(saved);

    component.form.patchValue({ license_plate: 'AB123CD', make: 'Fiat', model: 'Ducato', vehicle_type: 'van', odometer_km: 10000, purchase_value: 20000, vin: '' });
    component.save();

    expect(api.createVehicle).toHaveBeenCalledWith({
      license_plate: 'AB123CD',
      vin: null,
      make: 'Fiat',
      model: 'Ducato',
      model_year: null,
      vehicle_type: 'van',
      fuel_type: 'diesel',
      status: 'active',
      odometer_km: 10000,
      ownership: 'owned',
      acquired_on: null,
      contract_ends_on: null,
      purchase_value: '20000',
      currency: 'EUR',
      asset_id: null,
      notes: null,
    });
    expect(saved).toHaveBeenCalledWith(vehicle);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('edits a vehicle, keeps its odometer as the minimum and shows the API error', () => {
    api.updateVehicle.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { odometer_km: ['The odometer cannot decrease: the vehicle is already at 12000 km.'] } } })));
    const fixture = TestBed.createComponent(FleetVehicleFormComponent);
    fixture.componentRef.setInput('vehicle', vehicle);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.minimumOdometer()).toBe(12000);
    expect(component.form.controls.license_plate.value).toBe('AB123CD');
    expect(component.form.controls.purchase_value.value).toBe(20000);

    component.form.patchValue({ odometer_km: 9000 });
    component.save();

    expect(api.updateVehicle).toHaveBeenCalledWith('veh-1', expect.objectContaining({ odometer_km: 9000 }));
    expect(messageSpy.error).toHaveBeenCalledWith('The odometer cannot decrease: the vehicle is already at 12000 km.');
  });

  it('rejects an asset id that is not a UUID', () => {
    const fixture = TestBed.createComponent(FleetVehicleFormComponent);
    fixture.detectChanges();

    fixture.componentInstance.form.patchValue({ license_plate: 'AB123CD', make: 'Fiat', model: 'Ducato', asset_id: 'not-a-uuid' });
    expect(fixture.componentInstance.form.valid).toBe(false);

    fixture.componentInstance.form.patchValue({ asset_id: '7d3f8a4e-1b2c-4d5e-8f60-123456789abc' });
    expect(fixture.componentInstance.form.valid).toBe(true);
  });
});

describe('FleetVehiclesComponent', () => {
  const api = { getVehicles: vi.fn(), deleteVehicle: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getVehicles.mockReturnValue(of({ data: [{ ...vehicle, current_assignment: { ...assignment, employee: { id: 'emp-1', full_name: 'Anna Rossi' } } }] }));
    api.deleteVehicle.mockReturnValue(of(undefined));
    configure(api);
  });

  it('loads the vehicles with the filters and names the current driver', () => {
    const fixture = TestBed.createComponent(FleetVehiclesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getVehicles).toHaveBeenCalledWith({ search: undefined, status: undefined, per_page: 100 });
    expect(component.driverName(component.vehicles()[0])).toBe('Anna Rossi');

    component.search.set(' ab1 ');
    component.status.set('maintenance');
    component.load();
    expect(api.getVehicles).toHaveBeenLastCalledWith({ search: 'ab1', status: 'maintenance', per_page: 100 });
  });

  it('deletes a vehicle and reloads, or shows the error', () => {
    const fixture = TestBed.createComponent(FleetVehiclesComponent);
    fixture.detectChanges();

    fixture.componentInstance.remove(vehicle);
    expect(api.deleteVehicle).toHaveBeenCalledWith('veh-1');
    expect(messageSpy.success).toHaveBeenCalled();

    api.deleteVehicle.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 403, error: { message: 'Forbidden' } })));
    fixture.componentInstance.remove(vehicle);
    expect(messageSpy.error).toHaveBeenCalledWith('Forbidden');
  });
});

describe('FleetAssignmentsComponent', () => {
  const api = { getAssignments: vi.fn(), getVehicles: vi.fn(), createAssignment: vi.fn(), updateAssignment: vi.fn(), endAssignment: vi.fn(), deleteAssignment: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getAssignments.mockReturnValue(of({ data: [assignment] }));
    api.getVehicles.mockReturnValue(of({ data: [vehicle, { ...vehicle, id: 'veh-9', status: 'sold' }] }));
    api.createAssignment.mockReturnValue(of({ data: assignment }));
    api.endAssignment.mockReturnValue(of({ data: { ...assignment, is_open: false } }));
    hrSpy.getEmployees.mockReturnValue(of({ data: [{ id: 'emp-1', full_name: 'Anna Rossi' }] }));
    configure(api);
  });

  it('offers only the vehicles that can be assigned and starts from their odometer', () => {
    const fixture = TestBed.createComponent(FleetAssignmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.activeVehicles().map((candidate) => candidate.id)).toEqual(['veh-1']);
    expect(component.employees()).toHaveLength(1);

    component.openModal();
    component.form.controls.vehicle_id.setValue('veh-1');
    expect(component.form.controls.start_odometer_km.value).toBe(12000);
  });

  it('creates an assignment with the API field names', () => {
    const fixture = TestBed.createComponent(FleetAssignmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ vehicle_id: 'veh-1', driver_label: 'Mario Esterno', starts_on: '2027-02-01', start_odometer_km: 12000 });
    component.save();

    expect(api.createAssignment).toHaveBeenCalledWith({ vehicle_id: 'veh-1', employee_id: null, driver_label: 'Mario Esterno', starts_on: '2027-02-01', start_odometer_km: 12000, notes: null });
    expect(component.modalVisible()).toBe(false);
  });

  it('ends an assignment with the date and the odometer at return', () => {
    const fixture = TestBed.createComponent(FleetAssignmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openEnd(assignment);
    component.endForm.patchValue({ ends_on: '2027-04-01', end_odometer_km: 14000 });
    component.saveEnd();

    expect(api.endAssignment).toHaveBeenCalledWith('as-1', { ends_on: '2027-04-01', end_odometer_km: 14000 });
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('limits the list to the vehicle of the vehicle page', () => {
    const fixture = TestBed.createComponent(FleetAssignmentsComponent);
    fixture.componentRef.setInput('vehicleId', 'veh-1');
    fixture.detectChanges();

    expect(api.getAssignments).toHaveBeenCalledWith({ vehicle_id: 'veh-1', per_page: 100 });
  });
});

describe('FleetFuelComponent', () => {
  const api = { getFuelEntries: vi.fn(), getVehicles: vi.fn(), createFuelEntry: vi.fn(), updateFuelEntry: vi.fn(), deleteFuelEntry: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getFuelEntries.mockReturnValue(of({ data: [fuelEntry] }));
    api.getVehicles.mockReturnValue(of({ data: [vehicle, electricVehicle] }));
    api.createFuelEntry.mockReturnValue(of({ data: fuelEntry }));
    api.updateFuelEntry.mockReturnValue(of({ data: fuelEntry }));
    hrSpy.getEmployees.mockReturnValue(of({ data: [] }));
    configure(api);
  });

  it('offers the unit of the fuel type and starts from the odometer of the vehicle', () => {
    const fixture = TestBed.createComponent(FleetFuelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.controls.vehicle_id.setValue('veh-2');

    expect(component.units()).toEqual(['kwh']);
    expect(component.form.controls.energy_unit.value).toBe('kwh');
    expect(component.form.controls.odometer_km.value).toBe(5000);
  });

  it('creates an entry with the price and lets the API compute the total', () => {
    const fixture = TestBed.createComponent(FleetFuelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ vehicle_id: 'veh-1', entry_date: '2027-01-10', quantity: 40, unit_price: 1.8, odometer_km: 12100, station: '' });
    component.save();

    expect(api.createFuelEntry).toHaveBeenCalledWith({
      vehicle_id: 'veh-1',
      entry_date: '2027-01-10',
      energy_unit: 'liter',
      quantity: '40',
      unit_price: '1.8',
      total_cost: null,
      odometer_km: 12100,
      is_full_tank: true,
      station: null,
      employee_id: null,
    });
  });

  it('drops the old total when an edit changes the quantity so the API recomputes it', () => {
    const fixture = TestBed.createComponent(FleetFuelComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal(fuelEntry);
    component.form.patchValue({ quantity: 50 });
    component.save();

    expect(api.updateFuelEntry).toHaveBeenCalledWith('fu-1', expect.objectContaining({ quantity: '50', unit_price: '1.8', total_cost: null }));
  });
});

describe('FleetDeadlinesComponent', () => {
  const api = { getDeadlines: vi.fn(), getVehicles: vi.fn(), createDeadline: vi.fn(), updateDeadline: vi.fn(), renewDeadline: vi.fn(), deleteDeadline: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDeadlines.mockReturnValue(of({ data: [deadline] }));
    api.getVehicles.mockReturnValue(of({ data: [vehicle] }));
    api.renewDeadline.mockReturnValue(of({ data: deadline }));
    configure(api);
  });

  it('lists the open deadlines and maps the window to the API filters', () => {
    const fixture = TestBed.createComponent(FleetDeadlinesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(api.getDeadlines).toHaveBeenLastCalledWith({ vehicle_id: undefined, deadline_type: undefined, status: 'open', expiring: undefined, expired: undefined, per_page: 100 });

    component.window.set('30');
    component.load();
    expect(api.getDeadlines).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'open', expiring: 30, expired: undefined }));

    component.window.set('expired');
    component.load();
    expect(api.getDeadlines).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'open', expiring: undefined, expired: true }));

    component.window.set('renewed');
    component.load();
    expect(api.getDeadlines).toHaveBeenLastCalledWith(expect.objectContaining({ status: 'renewed' }));

    component.window.set('all');
    component.load();
    expect(api.getDeadlines).toHaveBeenLastCalledWith(expect.objectContaining({ status: undefined }));
  });

  it('renews a deadline with the new expiry date', () => {
    const fixture = TestBed.createComponent(FleetDeadlinesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openRenew(deadline);
    expect(component.renewForm.controls.provider.value).toBe('Generali');
    component.renewForm.patchValue({ expires_on: '2028-06-30', cost: 700 });
    component.saveRenew();

    expect(api.renewDeadline).toHaveBeenCalledWith('dl-1', { expires_on: '2028-06-30', cost: '700', provider: 'Generali', reference: null });
    expect(component.renewVisible()).toBe(false);
  });
});

describe('FleetDashboardComponent', () => {
  const api = { getDashboard: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getDashboard.mockReturnValue(of({ data: dashboard }));
    configure(api);
  });

  it('loads the dashboard for the expiry window', () => {
    const fixture = TestBed.createComponent(FleetDashboardComponent);
    fixture.detectChanges();

    expect(api.getDashboard).toHaveBeenCalledWith(30);
    expect(fixture.componentInstance.dashboard()?.totals.running_cost).toBe('1057.60');

    fixture.componentInstance.days.set(60);
    fixture.componentInstance.load();
    expect(api.getDashboard).toHaveBeenLastCalledWith(60);
  });
});

describe('FleetVehicleDetailComponent', () => {
  const api = {
    getVehicle: vi.fn(),
    getVehicleCosts: vi.fn(),
    getAssignments: vi.fn(),
    getFuelEntries: vi.fn(),
    getServices: vi.fn(),
    getScheduledServices: vi.fn(),
    getDeadlines: vi.fn(),
    getIncidents: vi.fn(),
    getVehicles: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getVehicle.mockReturnValue(of({ data: vehicle }));
    api.getVehicleCosts.mockReturnValue(of({ data: { running_cost: '1057.60' } }));
    for (const method of ['getAssignments', 'getFuelEntries', 'getServices', 'getScheduledServices', 'getDeadlines', 'getIncidents', 'getVehicles'] as const) {
      api[method].mockReturnValue(of({ data: [] }));
    }
    hrSpy.getEmployees.mockReturnValue(of({ data: [] }));
    configure(api, [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'veh-1' } } } }]);
  });

  it('loads the vehicle and its costs from the route', () => {
    const fixture = TestBed.createComponent(FleetVehicleDetailComponent);
    fixture.detectChanges();

    expect(api.getVehicle).toHaveBeenCalledWith('veh-1');
    expect(api.getVehicleCosts).toHaveBeenCalledWith('veh-1');
    expect(fixture.componentInstance.vehicle()?.license_plate).toBe('AB123CD');
    expect(fixture.componentInstance.subtitle()).toBe('Fiat Ducato');
  });
});
