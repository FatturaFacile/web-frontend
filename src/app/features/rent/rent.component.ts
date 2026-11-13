import { UpperCasePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, FormGroup, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzBadgeModule } from 'ng-zorro-antd/badge';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDividerModule } from 'ng-zorro-antd/divider';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AutomotiveApiService,
  AutomotiveVehicle,
  AutomotiveVehiclePayload,
  ClientApiService,
  ContactResource,
  contactDisplayName,
  CheckInInspectionPayload,
  CheckOutInspectionPayload,
  RentalBooking,
  RentalVehicle,
  RentApiService,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe, IconActionDirective, ModalActionsDirective } from '@shared';

@Component({
  selector: 'app-rent',
  styleUrl: './rent.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
    UpperCasePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzBadgeModule,
    NzButtonModule,
    NzIconModule,
    NzModalModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDescriptionsModule,
    NzAlertModule,
    NzSpinModule,
    NzDividerModule,
    NzSwitchModule,
    PageHeaderComponent,
    TranslatePipe,
    MoneyPipe,
  ],
  templateUrl: './rent.component.html',
})
export class RentComponent implements OnInit {
  private readonly rentApi = inject(RentApiService);
  private readonly autoApi = inject(AutomotiveApiService);
  private readonly clientApi = inject(ClientApiService);
  private readonly fb = inject(FormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly loading = signal<boolean>(false);
  readonly selectedTabIndex = signal<number>(0);

  // Rental Fleet Vehicles
  readonly vehicles = signal<RentalVehicle[]>([]);
  readonly vehicleFilterStatus = signal<string>('');

  // Rental Bookings
  readonly bookings = signal<RentalBooking[]>([]);
  readonly selectedBooking = signal<RentalBooking | null>(null);
  readonly isBookingDrawerVisible = signal<boolean>(false);

  // Automotive Vehicle Registry
  readonly automotiveVehicles = signal<AutomotiveVehicle[]>([]);
  readonly contacts = signal<ContactResource[]>([]);
  protected readonly contactName = contactDisplayName;
  readonly isVehicleModalVisible = signal<boolean>(false);
  readonly isEditingVehicle = signal<boolean>(false);
  readonly editingVehicleId = signal<string | null>(null);

  // Inspections
  readonly isCheckOutModalVisible = signal<boolean>(false);
  readonly isCheckInModalVisible = signal<boolean>(false);
  readonly inspectingBooking = signal<RentalBooking | null>(null);

  // Damage marker input helper
  readonly tempDamageMarker = signal<string>('');
  readonly currentDamageMarkers = signal<string[]>([]);

  // Forms
  readonly checkOutForm: FormGroup = this.fb.group({
    rental_booking_id: ['', [Validators.required]],
    mileage: [45000, [Validators.required, Validators.min(0)]],
    fuel_level: ['8/8', [Validators.required]],
  });

  readonly checkInForm: FormGroup = this.fb.group({
    rental_booking_id: ['', [Validators.required]],
    mileage: [45250, [Validators.required, Validators.min(0)]],
    fuel_level: ['8/8', [Validators.required]],
  });

  readonly vehicleForm: FormGroup = this.fb.group({
    license_plate: ['', [Validators.required, Validators.maxLength(20)]],
    make: ['', [Validators.required, Validators.maxLength(50)]],
    model: ['', [Validators.required, Validators.maxLength(50)]],
    year: [2024, [Validators.min(1900), Validators.max(2100)]],
    vin_chassis: ['', [Validators.maxLength(30)]],
    mileage_km: [0, [Validators.min(0)]],
    client_id: ['', [Validators.required]],
  });

  ngOnInit(): void {
    this.loadVehicles();
    this.loadBookings();
    this.loadAutomotiveVehicles();
    this.clientApi.list({ per_page: 100 }).subscribe({ next: (res) => this.contacts.set(res.data), error: () => this.contacts.set([]) });
  }

  // --- Rental Fleet Vehicles ---
  loadVehicles(): void {
    this.loading.set(true);
    this.rentApi.getVehicles().subscribe({
      next: (res) => {
        this.vehicles.set(res?.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('RENT.LOAD_VEHICLES_ERROR'));
      },
    });
  }

  // --- Rental Bookings ---
  loadBookings(): void {
    this.loading.set(true);
    this.rentApi.getBookings().subscribe({
      next: (res) => {
        this.bookings.set(res?.data || []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('RENT.LOAD_BOOKINGS_ERROR'));
      },
    });
  }

  openBookingDetails(b: RentalBooking): void {
    this.selectedBooking.set(b);
    this.isBookingDrawerVisible.set(true);
  }

  closeBookingDrawer(): void {
    this.isBookingDrawerVisible.set(false);
    this.selectedBooking.set(null);
  }

  // --- Handover / Check-Out Inspection ---
  openCheckOutModal(booking: RentalBooking): void {
    this.inspectingBooking.set(booking);
    this.currentDamageMarkers.set([]);
    this.checkOutForm.reset({
      rental_booking_id: booking.id,
      mileage: booking.check_out_mileage || 45000,
      fuel_level: '8/8',
    });
    this.isCheckOutModalVisible.set(true);
  }

  closeCheckOutModal(): void {
    this.isCheckOutModalVisible.set(false);
    this.inspectingBooking.set(null);
  }

  submitCheckOutInspection(): void {
    if (this.checkOutForm.invalid) {
      this.checkOutForm.markAllAsTouched();
      return;
    }
    const val = this.checkOutForm.value;
    const payload: CheckOutInspectionPayload = {
      rental_booking_id: val.rental_booking_id,
      mileage: val.mileage,
      fuel_level: val.fuel_level,
      damage_markers: this.currentDamageMarkers(),
    };

    this.loading.set(true);
    this.rentApi.recordCheckOutInspection(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('RENT.CHECK_OUT_RECORDED_SUCCESS'));
        this.closeCheckOutModal();
        this.loadBookings();
        this.loadVehicles();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('RENT.CHECK_OUT_RECORDED_FAILED'));
      },
    });
  }

  // --- Return / Check-In Inspection ---
  openCheckInModal(booking: RentalBooking): void {
    this.inspectingBooking.set(booking);
    this.currentDamageMarkers.set([]);
    this.checkInForm.reset({
      rental_booking_id: booking.id,
      mileage: (booking.check_out_mileage || 45000) + 150,
      fuel_level: '8/8',
    });
    this.isCheckInModalVisible.set(true);
  }

  closeCheckInModal(): void {
    this.isCheckInModalVisible.set(false);
    this.inspectingBooking.set(null);
  }

  submitCheckInInspection(): void {
    if (this.checkInForm.invalid) {
      this.checkInForm.markAllAsTouched();
      return;
    }
    const val = this.checkInForm.value;
    const payload: CheckInInspectionPayload = {
      rental_booking_id: val.rental_booking_id,
      mileage: val.mileage,
      fuel_level: val.fuel_level,
      damage_markers: this.currentDamageMarkers(),
    };

    this.loading.set(true);
    this.rentApi.recordCheckInInspection(payload).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('RENT.CHECK_IN_RECORDED_SUCCESS'));
        this.closeCheckInModal();
        this.loadBookings();
        this.loadVehicles();
      },
      error: (err: unknown) => {
        this.loading.set(false);
        const errorDetail = (err as { error?: { message?: string } })?.error?.message;
        this.message.error(errorDetail || this.translate.instant('RENT.CHECK_IN_RECORDED_FAILED'));
      },
    });
  }

  addDamageMarker(): void {
    const text = this.tempDamageMarker().trim();
    if (text) {
      this.currentDamageMarkers.update((list) => [...list, text]);
      this.tempDamageMarker.set('');
    }
  }

  removeDamageMarker(index: number): void {
    this.currentDamageMarkers.update((list) => list.filter((_, i) => i !== index));
  }

  // --- Automotive Fleet Registry ---
  loadAutomotiveVehicles(): void {
    this.autoApi.getVehicles().subscribe({
      next: (res) => {
        this.automotiveVehicles.set(res?.data?.data ?? []);
      },
      error: () => {
        this.message.error(this.translate.instant('RENT.LOAD_AUTO_VEHICLES_ERROR'));
      },
    });
  }

  openRegisterVehicleModal(): void {
    this.isEditingVehicle.set(false);
    this.editingVehicleId.set(null);
    this.vehicleForm.reset({
      license_plate: '',
      make: '',
      model: '',
      year: 2024,
      vin_chassis: '',
      mileage_km: 0,
      client_id: '',
    });
    this.isVehicleModalVisible.set(true);
  }

  /** Owner shown in the vehicle table: the list does not embed it, so it is resolved from the loaded contacts. */
  protected ownerName(v: AutomotiveVehicle): string {
    const contact = this.contacts().find((c) => c.id === v.client_id);
    return contact ? contactDisplayName(contact) : '-';
  }

  openEditVehicleModal(v: AutomotiveVehicle): void {
    this.isEditingVehicle.set(true);
    this.editingVehicleId.set(v.id);
    this.vehicleForm.patchValue({
      license_plate: v.license_plate,
      make: v.make,
      model: v.model,
      year: v.year || 2024,
      vin_chassis: v.vin_chassis || '',
      mileage_km: v.mileage_km ?? 0,
      client_id: v.client_id || '',
    });
    this.isVehicleModalVisible.set(true);
  }

  closeVehicleModal(): void {
    this.isVehicleModalVisible.set(false);
    this.editingVehicleId.set(null);
  }

  submitVehicle(): void {
    if (this.vehicleForm.invalid) {
      this.vehicleForm.markAllAsTouched();
      return;
    }
    const val = this.vehicleForm.value;
    const payload: AutomotiveVehiclePayload = {
      license_plate: (val.license_plate || '').toUpperCase(),
      make: val.make,
      model: val.model,
      year: val.year,
      vin_chassis: val.vin_chassis || null,
      mileage_km: Number(val.mileage_km ?? 0),
      client_id: val.client_id,
    };

    this.loading.set(true);
    if (this.isEditingVehicle() && this.editingVehicleId()) {
      this.autoApi.updateVehicle(this.editingVehicleId()!, payload).subscribe({
        next: () => {
          this.loading.set(false);
          this.message.success(this.translate.instant('RENT.VEHICLE_UPDATED_SUCCESS'));
          this.closeVehicleModal();
          this.loadAutomotiveVehicles();
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const errorDetail = (err as { error?: { message?: string } })?.error?.message;
          this.message.error(errorDetail || this.translate.instant('RENT.VEHICLE_UPDATE_FAILED'));
        },
      });
    } else {
      this.autoApi.registerVehicle(payload).subscribe({
        next: () => {
          this.loading.set(false);
          this.message.success(this.translate.instant('RENT.VEHICLE_REGISTERED_SUCCESS'));
          this.closeVehicleModal();
          this.loadAutomotiveVehicles();
        },
        error: (err: unknown) => {
          this.loading.set(false);
          const errorDetail = (err as { error?: { message?: string } })?.error?.message;
          this.message.error(errorDetail || this.translate.instant('RENT.VEHICLE_REGISTER_FAILED'));
        },
      });
    }
  }

  deleteVehicle(v: AutomotiveVehicle): void {
    this.loading.set(true);
    this.autoApi.deleteVehicle(v.id).subscribe({
      next: () => {
        this.loading.set(false);
        this.message.success(this.translate.instant('RENT.VEHICLE_DELETED_SUCCESS'));
        this.loadAutomotiveVehicles();
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('RENT.VEHICLE_DELETE_FAILED'));
      },
    });
  }

  // --- Badge Helpers ---
  getVehicleStatusBadgeColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'available':
        return 'success';
      case 'rented':
        return 'processing';
      case 'reserved':
        return 'warning';
      case 'maintenance':
        return 'error';
      default:
        return 'default';
    }
  }

  getBookingStatusBadgeColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active':
        return 'processing';
      case 'completed':
        return 'success';
      case 'booked':
        return 'warning';
      case 'cancelled':
        return 'default';
      default:
        return 'default';
    }
  }
}
