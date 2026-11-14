import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AutomotiveApiService,
  AutomotiveVehicle,
  RentalBooking,
  RentalVehicle,
  RentApiService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { RentComponent } from './rent.component';

describe('RentComponent', () => {
  let component: RentComponent;
  let fixture: ComponentFixture<RentComponent>;
  let rentApiMock: Partial<Record<keyof RentApiService, ReturnType<typeof vi.fn>>>;
  let autoApiMock: Partial<Record<keyof AutomotiveApiService, ReturnType<typeof vi.fn>>>;
  let messageMock: Partial<Record<keyof NzMessageService, ReturnType<typeof vi.fn>>>;

  const mockVehicle: RentalVehicle = {
    id: 'rv-1',
    plate: 'TI 98765',
    model: 'Golf 8',
    make: 'Volkswagen',
    type: 'Berlina',
    client: 'Mario Bianchi',
    vignette: true,
    returnDate: '2026-05-01',
    status: 'available',
    daily_rate: 75,
  };

  const mockBooking: RentalBooking = {
    id: 'bk-1',
    vehicle_id: 'rv-1',
    vehicle_plate: 'TI 98765',
    vehicle_model: 'Golf 8',
    client_id: 'cl-1',
    client_name: 'Mario Bianchi',
    start_date: '2026-04-10',
    end_date: '2026-04-15',
    status: 'booked',
    daily_rate: 75,
    total_amount: 375,
    deposit_amount: 500,
    check_out_mileage: 45000,
  };

  const mockAutoVehicle: AutomotiveVehicle = {
    id: 'av-1',
    license_plate: 'AA123BB',
    make: 'Fiat',
    model: '500',
    year: 2022,
    vin_chassis: 'ZFA312000...',
    client_id: 'cl-1',
  };

  beforeEach(async () => {
    rentApiMock = {
      getVehicles: vi.fn().mockReturnValue(of({ success: true, message: '', data: [mockVehicle], meta: { current_page: 1, from: 1, to: 1, last_page: 1, per_page: 10, total: 1 } })),
      getBookings: vi.fn().mockReturnValue(of({ success: true, message: '', data: [mockBooking], meta: { current_page: 1, from: 1, to: 1, last_page: 1, per_page: 10, total: 1 } })),
      recordCheckInInspection: vi.fn().mockReturnValue(of({ success: true })),
      recordCheckOutInspection: vi.fn().mockReturnValue(of({ success: true })),
    };

    autoApiMock = {
      listVehicles: vi.fn().mockReturnValue(of({ success: true, message: '', data: [mockAutoVehicle], meta: { current_page: 1, from: 1, to: 1, last_page: 1, per_page: 10, total: 1 } })),
      registerVehicle: vi.fn().mockReturnValue(of({ success: true, data: mockAutoVehicle })),
      updateVehicle: vi.fn().mockReturnValue(of({ success: true, data: mockAutoVehicle })),
      deleteVehicle: vi.fn().mockReturnValue(of({ success: true })),
    };

    messageMock = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    const translateMock = {
      instant: vi.fn((key: string) => key),
      translate: vi.fn((key: string) => key),
      currentLang: vi.fn().mockReturnValue('en'),
      get: vi.fn().mockReturnValue(of('')),
      onLangChange: of({ lang: 'en' }),
    };

    await TestBed.configureTestingModule({
      imports: [RentComponent],
      providers: [
        { provide: RentApiService, useValue: rentApiMock },
        { provide: AutomotiveApiService, useValue: autoApiMock },
        { provide: NzMessageService, useValue: messageMock },
        { provide: TranslateService, useValue: translateMock },
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RentComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await fixture.whenStable();
  });

  it('should initialize and load rental vehicles, bookings, and automotive registry', () => {
    expect(component).toBeTruthy();
    expect(rentApiMock['getVehicles']).toHaveBeenCalled();
    expect(component.vehicles().length).toBe(1);
    expect(rentApiMock['getBookings']).toHaveBeenCalled();
    expect(component.bookings().length).toBe(1);
    expect(autoApiMock['listVehicles']).toHaveBeenCalled();
    expect(component.automotiveVehicles().length).toBe(1);
  });

  it('should send the vehicle status filter to the server instead of filtering the page', async () => {
    component.vehiclesGrid.gridFilter.set({ rental_status: ['available'] });
    await fixture.whenStable();
    await new Promise((resolve) => setTimeout(resolve, 400));
    const lastQuery = rentApiMock['getVehicles']!.mock.calls.at(-1)![0] as Record<string, unknown>;
    expect(lastQuery['filter']).toEqual({ rental_status: ['available'] });
  });

  it('should open and close booking drawer', () => {
    component.openBookingDetails(mockBooking);
    expect(component.selectedBooking()?.id).toBe('bk-1');
    expect(component.isBookingDrawerVisible()).toBe(true);

    component.closeBookingDrawer();
    expect(component.isBookingDrawerVisible()).toBe(false);
    expect(component.selectedBooking()).toBeNull();
  });

  it('should handle damage markers addition and removal', () => {
    component.tempDamageMarker.set('Scratch on rear bumper');
    component.addDamageMarker();
    expect(component.currentDamageMarkers()).toEqual(['Scratch on rear bumper']);
    expect(component.tempDamageMarker()).toBe('');

    component.tempDamageMarker.set('Dented door');
    component.addDamageMarker();
    expect(component.currentDamageMarkers().length).toBe(2);

    component.removeDamageMarker(0);
    expect(component.currentDamageMarkers()).toEqual(['Dented door']);
  });

  it('should record check-out inspection', () => {
    component.openCheckOutModal(mockBooking);
    expect(component.isCheckOutModalVisible()).toBe(true);
    expect(component.checkOutForm.value.rental_booking_id).toBe('bk-1');

    component.tempDamageMarker.set('Small rock chip');
    component.addDamageMarker();

    component.checkOutForm.patchValue({
      mileage: 45050,
      fuel_level: '8/8',
    });

    component.submitCheckOutInspection();

    expect(rentApiMock['recordCheckOutInspection']).toHaveBeenCalledWith({
      rental_booking_id: 'bk-1',
      mileage: 45050,
      fuel_level: '8/8',
      damage_markers: ['Small rock chip'],
    });
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isCheckOutModalVisible()).toBe(false);
  });

  it('should record check-in inspection', () => {
    component.openCheckInModal(mockBooking);
    expect(component.isCheckInModalVisible()).toBe(true);

    component.checkInForm.patchValue({
      mileage: 45400,
      fuel_level: '7/8',
    });

    component.submitCheckInInspection();

    expect(rentApiMock['recordCheckInInspection']).toHaveBeenCalledWith({
      rental_booking_id: 'bk-1',
      mileage: 45400,
      fuel_level: '7/8',
      damage_markers: [],
    });
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isCheckInModalVisible()).toBe(false);
  });

  it('should register a new automotive vehicle', () => {
    component.openRegisterVehicleModal();
    expect(component.isVehicleModalVisible()).toBe(true);
    expect(component.isEditingVehicle()).toBe(false);

    component.vehicleForm.patchValue({
      license_plate: 'mi888zz',
      make: 'BMW',
      model: 'Serie 3',
      year: 2023,
      vin_chassis: 'WBA...',
      client_id: 'cl-9',
    });

    component.submitVehicle();

    expect(autoApiMock['registerVehicle']).toHaveBeenCalledWith(
      expect.objectContaining({
        license_plate: 'MI888ZZ',
        make: 'BMW',
        model: 'Serie 3',
        client_id: 'cl-9',
        vin_chassis: 'WBA...',
      }),
    );
    const sent = autoApiMock['registerVehicle']!.mock.calls[0][0] as Record<string, unknown>;
    expect(Object.keys(sent).sort()).toEqual(['client_id', 'license_plate', 'make', 'mileage_km', 'model', 'vin_chassis', 'year']);
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isVehicleModalVisible()).toBe(false);
  });

  it('should not call the API when the vehicle form is submitted empty or with a too long plate', () => {
    component.openRegisterVehicleModal();
    component.submitVehicle();
    expect(autoApiMock['registerVehicle']).not.toHaveBeenCalled();
    expect(component.vehicleForm.controls['license_plate'].touched).toBe(true);

    component.vehicleForm.patchValue({ license_plate: 'X'.repeat(21), make: 'BMW', model: 'Serie 3', client_id: 'cl-9' });
    component.submitVehicle();
    expect(autoApiMock['registerVehicle']).not.toHaveBeenCalled();
  });

  it('should edit an existing automotive vehicle', () => {
    component.openEditVehicleModal(mockAutoVehicle);
    expect(component.isVehicleModalVisible()).toBe(true);
    expect(component.isEditingVehicle()).toBe(true);
    expect(component.editingVehicleId()).toBe('av-1');

    component.vehicleForm.patchValue({
      model: '500 Hybrid',
      client_id: 'cl-1',
    });

    component.submitVehicle();

    expect(autoApiMock['updateVehicle']).toHaveBeenCalledWith(
      'av-1',
      expect.objectContaining({
        model: '500 Hybrid',
      }),
    );
    expect(messageMock['success']).toHaveBeenCalled();
    expect(component.isVehicleModalVisible()).toBe(false);
  });

  it('should delete an automotive vehicle', () => {
    component.deleteVehicle(mockAutoVehicle);
    expect(autoApiMock['deleteVehicle']).toHaveBeenCalledWith('av-1');
    expect(messageMock['success']).toHaveBeenCalled();
  });

  it('should return correct badge colors', () => {
    expect(component.getVehicleStatusBadgeColor('available')).toBe('success');
    expect(component.getVehicleStatusBadgeColor('rented')).toBe('processing');
    expect(component.getVehicleStatusBadgeColor('reserved')).toBe('warning');
    expect(component.getVehicleStatusBadgeColor('maintenance')).toBe('error');
    expect(component.getVehicleStatusBadgeColor('unknown')).toBe('default');

    expect(component.getBookingStatusBadgeColor('active')).toBe('processing');
    expect(component.getBookingStatusBadgeColor('completed')).toBe('success');
    expect(component.getBookingStatusBadgeColor('booked')).toBe('warning');
    expect(component.getBookingStatusBadgeColor('reserved')).toBe('warning');
    expect(component.getBookingStatusBadgeColor('cancelled')).toBe('default');
  });

  it('should handle API errors gracefully', () => {
    rentApiMock['recordCheckOutInspection']!.mockReturnValue(
      throwError(() => ({ error: { message: 'Vehicle already active' } })),
    );
    component.openCheckOutModal(mockBooking);
    component.submitCheckOutInspection();
    expect(messageMock['error']).toHaveBeenCalledWith('Vehicle already active');

    autoApiMock['registerVehicle']!.mockReturnValue(
      throwError(() => ({ error: { message: 'Duplicate license plate' } })),
    );
    component.openRegisterVehicleModal();
    component.vehicleForm.patchValue({
      license_plate: 'AA123BB',
      make: 'Fiat',
      model: '500',
      client_id: 'cl-1',
    });
    component.submitVehicle();
    expect(messageMock['error']).toHaveBeenCalledWith('Duplicate license plate');
  });
});
