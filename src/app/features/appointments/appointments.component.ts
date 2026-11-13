import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import {
  AbstractControl,
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  ValidationErrors,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCalendarModule } from 'ng-zorro-antd/calendar';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpaceModule } from 'ng-zorro-antd/space';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  Appointment,
  AppointmentApiService,
  AppointmentCalendarItem,
  AppointmentConflictCheckResponse,
  CancelAppointmentRequest,
  ClientApiService,
  ContactResource,
  contactDisplayName,
  CreateAppointmentRequest,
  SettingsApiService,
  TranslateService,
  UserResource,
} from '@core';
import { PageHeaderComponent, TranslatePipe, ModalActionsDirective, IconActionDirective, GridExportDirective, GridSortPipe } from '@shared';

/** Mirrors the API rule `ends_at: after:starts_at`. */
function endsAfterStarts(control: AbstractControl): ValidationErrors | null {
  const startsAt = control.parent?.get('starts_at')?.value;
  const endsAt = control.value;
  if (!startsAt || !endsAt) {
    return null;
  }
  return new Date(endsAt).getTime() > new Date(startsAt).getTime() ? null : { endsBeforeStart: true };
}

@Component({
  selector: 'app-appointments',
  styleUrl: './appointments.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    ModalActionsDirective,
    IconActionDirective,
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzCardModule,
    NzTabsModule,
    NzTableModule,
    NzTagModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzFormModule,
    NzModalModule,
    NzDescriptionsModule,
    NzSpaceModule,
    NzStatisticModule,
    NzPopconfirmModule,
    NzCalendarModule,
    NzAlertModule,
    NzIconModule,
    NzEmptyModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './appointments.component.html',
})
export class AppointmentsComponent implements OnInit {
  private readonly api = inject(AppointmentApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly clientApi = inject(ClientApiService);
  private readonly settingsApi = inject(SettingsApiService);

  readonly contacts = signal<ContactResource[]>([]);
  readonly users = signal<UserResource[]>([]);
  protected readonly contactName = contactDisplayName;

  readonly selectedTabIndex = signal<number>(0);

  // --- APPOINTMENTS LIST ---
  readonly appointments = signal<Appointment[]>([]);
  readonly appointmentsLoading = signal<boolean>(false);
  readonly filterDate = signal<string>('');
  readonly filterTechnicianId = signal<string>('');

  // --- CALENDAR ITEMS ---
  readonly calendarItems = signal<AppointmentCalendarItem[]>([]);
  readonly calendarLoading = signal<boolean>(false);
  readonly selectedCalendarDate = signal<Date>(new Date());

  // --- DRAWER DETAILS ---
  readonly drawerVisible = signal<boolean>(false);
  readonly selectedAppointment = signal<Appointment | null>(null);
  readonly drawerLoading = signal<boolean>(false);

  // --- CONFLICT CHECK TOOL ---
  readonly conflictResult = signal<AppointmentConflictCheckResponse | null>(null);
  readonly conflictChecking = signal<boolean>(false);

  // Derived metrics
  readonly totalUpcoming = computed(() =>
    this.appointments().filter((a) => !a.cancelled_at && new Date(a.starts_at) >= new Date()).length,
  );

  readonly totalCompleted = computed(() =>
    this.appointments().filter((a) => !a.cancelled_at && !!a.service_report_id).length,
  );

  readonly totalCancelled = computed(() =>
    this.appointments().filter((a) => !!a.cancelled_at).length,
  );

  // Modals visibility
  readonly appointmentModalVisible = signal<boolean>(false);
  readonly cancelModalVisible = signal<boolean>(false);

  // Forms
  readonly appointmentForm = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(255)]],
    contact_id: ['', [Validators.required]],
    ticket_id: [''],
    attendee_ids: [[] as string[]],
    starts_at: [new Date().toISOString().substring(0, 16), [Validators.required]],
    ends_at: [new Date(Date.now() + 3600000 * 2).toISOString().substring(0, 16), [Validators.required, endsAfterStarts]],
    address: ['', [Validators.maxLength(255)]],
    description: [''],
    estimated_duration_minutes: [120, [Validators.min(15)]],
  });

  readonly cancelForm = this.fb.group({
    reason: ['', [Validators.required, Validators.maxLength(255)]],
  });

  readonly conflictForm = this.fb.group({
    user_ids: [[] as string[], [Validators.required]],
    starts_at: [new Date().toISOString().substring(0, 16), [Validators.required]],
    ends_at: [new Date(Date.now() + 3600000 * 2).toISOString().substring(0, 16), [Validators.required, endsAfterStarts]],
  });

  private readonly startsChangeSync = [this.appointmentForm, this.conflictForm].map((group) =>
    group.controls.starts_at.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe(() => group.controls.ends_at.updateValueAndValidity({ emitEvent: false })),
  );

  ngOnInit(): void {
    this.settingsApi.getTenantUsers().subscribe({ next: (res) => this.users.set(res.data), error: () => this.users.set([]) });
    this.loadAppointments();
    this.loadCalendar();
  }

  loadAppointments(): void {
    this.appointmentsLoading.set(true);
    this.api
      .getAppointments({
        date: this.filterDate() || undefined,
        technician_id: this.filterTechnicianId() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.appointments.set(res?.data || []);
          this.appointmentsLoading.set(false);
        },
        error: () => {
          this.appointmentsLoading.set(false);
        },
      });
  }

  loadCalendar(): void {
    this.calendarLoading.set(true);
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const end = new Date(now.getFullYear(), now.getMonth() + 2, 0).toISOString();

    this.api.getCalendar({ start, end }).subscribe({
      next: (res) => {
        this.calendarItems.set(res?.data || []);
        this.calendarLoading.set(false);
      },
      error: () => {
        this.calendarLoading.set(false);
      },
    });
  }

  openCreateModal(): void {
    this.appointmentForm.reset({
      title: '',
      contact_id: '',
      ticket_id: '',
      attendee_ids: [],
      starts_at: new Date().toISOString().substring(0, 16),
      ends_at: new Date(Date.now() + 3600000 * 2).toISOString().substring(0, 16),
      address: '',
      description: '',
      estimated_duration_minutes: 120,
    });
    this.clientApi.list({ per_page: 100 }).subscribe({ next: (res) => this.contacts.set(res.data), error: () => this.contacts.set([]) });
    this.appointmentModalVisible.set(true);
  }

  saveAppointment(): void {
    if (this.appointmentForm.invalid) {
      this.appointmentForm.markAllAsTouched();
      return;
    }
    const val = this.appointmentForm.getRawValue();
    const payload: CreateAppointmentRequest = {
      title: val.title,
      starts_at: new Date(val.starts_at).toISOString(),
      ends_at: new Date(val.ends_at).toISOString(),
      contact_id: val.contact_id,
      ticket_id: val.ticket_id || undefined,
      attendees: val.attendee_ids.length > 0 ? val.attendee_ids.map((userId) => ({ user_id: userId, role: 'technician' as const })) : undefined,
      address: val.address || undefined,
      description: val.description || undefined,
      estimated_duration_minutes: val.estimated_duration_minutes ? Number(val.estimated_duration_minutes) : undefined,
    };

    this.api.createAppointment(payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('APPOINTMENTS.APPOINTMENT_CREATED'));
        this.appointmentModalVisible.set(false);
        this.loadAppointments();
        this.loadCalendar();
      },
      error: () => {
        this.message.error(this.translate.instant('APPOINTMENTS.ACTION_ERROR'));
      },
    });
  }

  openAppointmentDrawer(app: Appointment): void {
    this.selectedAppointment.set(app);
    this.drawerVisible.set(true);
    this.loadAppointmentDetails(app.id);
  }

  closeAppointmentDrawer(): void {
    this.drawerVisible.set(false);
    this.selectedAppointment.set(null);
  }

  loadAppointmentDetails(id: string): void {
    this.drawerLoading.set(true);
    this.api.getAppointment(id).subscribe({
      next: (res) => {
        this.selectedAppointment.set(res?.data);
        this.drawerLoading.set(false);
      },
      error: () => {
        this.drawerLoading.set(false);
      },
    });
  }

  openCancelModal(app: Appointment): void {
    this.selectedAppointment.set(app);
    this.cancelForm.reset({ reason: '' });
    this.cancelModalVisible.set(true);
  }

  saveCancel(): void {
    const app = this.selectedAppointment();
    if (!app || this.cancelForm.invalid) {
      this.cancelForm.markAllAsTouched();
      return;
    }
    const val = this.cancelForm.getRawValue();
    const payload: CancelAppointmentRequest = { reason: val.reason };

    this.api.cancelAppointment(app.id, payload).subscribe({
      next: () => {
        this.message.success(this.translate.instant('APPOINTMENTS.APPOINTMENT_CANCELLED'));
        this.cancelModalVisible.set(false);
        this.loadAppointments();
        this.loadCalendar();
        if (this.drawerVisible()) {
          this.closeAppointmentDrawer();
        }
      },
      error: () => {
        this.message.error(this.translate.instant('APPOINTMENTS.ACTION_ERROR'));
      },
    });
  }

  convertToServiceReport(app: Appointment): void {
    this.api.convertToServiceReport(app.id).subscribe({
      next: (res) => {
        this.message.success(
          `${this.translate.instant('APPOINTMENTS.CONVERTED_TO_REPORT')}: #${res?.data?.service_report_id}`,
        );
        this.loadAppointments();
        if (this.drawerVisible()) {
          this.loadAppointmentDetails(app.id);
        }
      },
      error: () => {
        this.message.error(this.translate.instant('APPOINTMENTS.ACTION_ERROR'));
      },
    });
  }

  deleteAppointment(app: Appointment): void {
    this.api.deleteAppointment(app.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('APPOINTMENTS.APPOINTMENT_DELETED'));
        this.loadAppointments();
        this.loadCalendar();
      },
      error: () => {
        this.message.error(this.translate.instant('APPOINTMENTS.ACTION_ERROR'));
      },
    });
  }

  runConflictCheck(): void {
    if (this.conflictForm.invalid) {
      this.conflictForm.markAllAsTouched();
      return;
    }
    this.conflictChecking.set(true);
    const val = this.conflictForm.getRawValue();
    this.api
      .checkConflicts({
        starts_at: new Date(val.starts_at).toISOString(),
        ends_at: new Date(val.ends_at).toISOString(),
        user_ids: val.user_ids,
      })
      .subscribe({
        next: (res) => {
          this.conflictResult.set(res?.data);
          this.conflictChecking.set(false);
        },
        error: () => {
          this.conflictChecking.set(false);
          this.message.error(this.translate.instant('APPOINTMENTS.ACTION_ERROR'));
        },
      });
  }

  getStatusBadgeColor(app: Appointment): string {
    if (app.cancelled_at) return 'error';
    if (app.service_report_id) return 'success';
    if (app.confirmed_at) return 'processing';
    return 'default';
  }

  getStatusLabel(app: Appointment): string {
    if (app.cancelled_at) return this.translate.instant('APPOINTMENTS.STATUS_CANCELLED');
    if (app.service_report_id) return this.translate.instant('APPOINTMENTS.STATUS_COMPLETED');
    if (app.confirmed_at) return this.translate.instant('APPOINTMENTS.STATUS_CONFIRMED');
    return this.translate.instant('APPOINTMENTS.STATUS_SCHEDULED');
  }

  getEventsForDate(date: Date): AppointmentCalendarItem[] {
    const dStr = date.toISOString().substring(0, 10);
    return this.calendarItems().filter((item) => item.start && item.start.startsWith(dStr));
  }
}
