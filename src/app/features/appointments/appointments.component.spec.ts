import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import {
  Appointment,
  AppointmentApiService,
  AppointmentCalendarItem,
  AppointmentConflictCheckResponse,
  ClientApiService,
  SettingsApiService,
  TranslateService,
} from '@core';
import { AppointmentsComponent } from './appointments.component';

describe('AppointmentsComponent', () => {
  let component: AppointmentsComponent;
  let fixture: ComponentFixture<AppointmentsComponent>;

  const mockAppointments: Appointment[] = [
    {
      id: 'app-1',
      title: 'Manutenzione Impianto',
      starts_at: '2026-11-20T10:00:00Z',
      ends_at: '2026-11-20T12:00:00Z',
      contact: { id: 'c-1', name: 'Mario Rossi', phone: '+39 333 111111' },
      address: 'Via Roma 1, Milano',
      attendees: [
        {
          id: 'att-1',
          user_id: 'usr-1',
          role: 'technician',
          status: 'accepted',
          user: { id: 'usr-1', name: 'Luigi Tecnico', email: 'luigi@example.com' },
        },
      ],
      created_at: '2026-11-01',
    },
    {
      id: 'app-2',
      title: 'Verifica Fumi',
      starts_at: '2026-11-21T14:00:00Z',
      ends_at: '2026-11-21T15:30:00Z',
      service_report_id: 'rep-99',
      created_at: '2026-11-02',
    },
  ];

  const mockCalendar: AppointmentCalendarItem[] = [
    {
      id: 'app-1',
      title: 'Manutenzione Impianto',
      start: '2026-11-20T10:00:00Z',
      end: '2026-11-20T12:00:00Z',
    },
  ];

  const mockConflictResponse: AppointmentConflictCheckResponse = {
    has_conflicts: false,
    conflicting_appointments: [],
  };

  const apiSpy = {
    getAppointments: vi.fn().mockImplementation((query: Record<string, unknown>) =>
      of(
        query['grid_values']
          ? { data: [{ value: 'completed', count: 1 }, { value: 'scheduled', count: 3 }] }
          : {
              success: true,
              message: 'ok',
              data: mockAppointments,
              meta: { current_page: 1, last_page: 1, per_page: 10, total: mockAppointments.length, from: 1, to: mockAppointments.length },
            },
      ),
    ),
    getAppointment: vi.fn().mockReturnValue(of({ data: mockAppointments[0] })),
    createAppointment: vi.fn().mockReturnValue(of({ data: mockAppointments[0] })),
    getCalendar: vi.fn().mockReturnValue(of({ data: mockCalendar })),
    cancelAppointment: vi.fn().mockReturnValue(of({ data: { ...mockAppointments[0], cancelled_at: '2026-11-05' } })),
    convertToServiceReport: vi.fn().mockReturnValue(of({ data: { service_report_id: 'rep-100' } })),
    deleteAppointment: vi.fn().mockReturnValue(of({ data: { id: 'app-1' } })),
    checkConflicts: vi.fn().mockReturnValue(of({ data: mockConflictResponse })),
  };

  const messageSpy = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
    info: vi.fn(),
  };

  const translateSpy = {
    instant: vi.fn().mockImplementation((key: string) => key),
    translate: vi.fn().mockImplementation((key: string) => key),
  };

  beforeEach(async () => {
    vi.clearAllMocks();

    await TestBed.configureTestingModule({
      imports: [AppointmentsComponent],
      providers: [
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: AppointmentApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy },
        { provide: ClientApiService, useValue: { list: vi.fn().mockReturnValue(of({ data: [{ id: 'c-1', company_name: 'Rossi SA' }] })) } },
        { provide: SettingsApiService, useValue: { getTenantUsers: vi.fn().mockReturnValue(of({ data: [{ id: 'usr-1', name: 'Luigi Tecnico' }] })) } },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(AppointmentsComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });

  it('should initialize and load appointments and calendar items', () => {
    expect(component).toBeTruthy();
    expect(apiSpy.getAppointments).toHaveBeenCalled();
    expect(apiSpy.getCalendar).toHaveBeenCalled();

    expect(component.appointments.items()).toEqual(mockAppointments);
    expect(component.calendarItems()).toEqual(mockCalendar);
    expect(component.totalCompleted()).toBe(1);
    expect(component.totalUpcoming()).toBe(3);
  });

  it('should create new appointment and refresh list', () => {
    component.openCreateModal();
    expect(component.appointmentModalVisible()).toBe(true);

    component.appointmentForm.patchValue({
      title: 'Installazione Pannelli',
      contact_id: 'c-1',
      starts_at: '2026-11-25T09:00',
      ends_at: '2026-11-25T13:00',
      address: 'Via Garibaldi 5, Torino',
      description: 'Portare inverter e cavi',
      estimated_duration_minutes: 240,
      attendee_ids: ['usr-1'],
    });

    component.saveAppointment();
    const sent = apiSpy.createAppointment.mock.calls[0][0];
    expect(sent.contact_id).toBe('c-1');
    expect(sent.attendees).toEqual([{ user_id: 'usr-1', role: 'technician' }]);
    expect(component.appointmentModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should not create an appointment without a title or with an end before the start', () => {
    component.openCreateModal();
    component.appointmentForm.patchValue({ title: '' });
    component.saveAppointment();
    expect(apiSpy.createAppointment).not.toHaveBeenCalled();
    expect(component.appointmentForm.controls.title.touched).toBe(true);

    component.appointmentForm.patchValue({ title: 'Visita', starts_at: '2026-11-25T13:00', ends_at: '2026-11-25T09:00' });
    component.saveAppointment();
    expect(apiSpy.createAppointment).not.toHaveBeenCalled();
    expect(component.appointmentForm.controls.ends_at.hasError('endsBeforeStart')).toBe(true);
  });

  it('should open appointment drawer and load details', () => {
    component.openAppointmentDrawer(mockAppointments[0]);
    expect(component.drawerVisible()).toBe(true);
    expect(apiSpy.getAppointment).toHaveBeenCalledWith('app-1');

    component.closeAppointmentDrawer();
    expect(component.drawerVisible()).toBe(false);
    expect(component.selectedAppointment()).toBeNull();
  });

  it('should cancel appointment with reason', () => {
    component.openCancelModal(mockAppointments[0]);
    expect(component.cancelModalVisible()).toBe(true);

    component.cancelForm.patchValue({
      reason: 'Cliente assente per emergenza',
    });

    component.saveCancel();
    expect(apiSpy.cancelAppointment).toHaveBeenCalledWith('app-1', {
      reason: 'Cliente assente per emergenza',
    });
    expect(component.cancelModalVisible()).toBe(false);
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should convert appointment to service report', () => {
    component.convertToServiceReport(mockAppointments[0]);
    expect(apiSpy.convertToServiceReport).toHaveBeenCalledWith('app-1');
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should delete appointment', () => {
    component.deleteAppointment(mockAppointments[0]);
    expect(apiSpy.deleteAppointment).toHaveBeenCalledWith('app-1');
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('should run conflict check tool', () => {
    component.conflictForm.patchValue({
      user_ids: ['usr-1'],
      starts_at: '2026-11-22T08:00',
      ends_at: '2026-11-22T12:00',
    });

    component.runConflictCheck();
    expect(apiSpy.checkConflicts.mock.calls[0][0].user_ids).toEqual(['usr-1']);
    expect(component.conflictResult()).toEqual(mockConflictResponse);
  });

  it('should return correct badge color and events for date', () => {
    expect(component.getStatusBadgeColor(mockAppointments[1])).toBe('success');
    expect(component.getStatusLabel(mockAppointments[1])).toBe('APPOINTMENTS.STATUS_COMPLETED');

    const date = new Date('2026-11-20T00:00:00Z');
    const events = component.getEventsForDate(date);
    expect(events.length).toBe(1);
    expect(events[0].title).toBe('Manutenzione Impianto');
  });
});
