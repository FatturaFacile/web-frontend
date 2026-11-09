import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import {
  Appointment,
  AppointmentCalendarItem,
  AppointmentConflictCheckRequest,
  CancelAppointmentRequest,
  CreateAppointmentRequest,
  UpdateAppointmentRequest,
} from '../models';
import { AppointmentApiService } from './appointment-api.service';

describe('AppointmentApiService', () => {
  let service: AppointmentApiService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [AppointmentApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AppointmentApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  it('should list and retrieve appointments', () => {
    const mockAppointments: Appointment[] = [
      {
        id: 'app-1',
        title: 'Manutenzione Climatizzatore',
        starts_at: '2026-11-10T09:00:00Z',
        ends_at: '2026-11-10T11:00:00Z',
        contact: { id: 'c-1', name: 'Mario Rossi' },
      },
    ];

    service
      .getAppointments({ technician_id: 'tech-1', status_id: 'st-1', per_page: 25 })
      .subscribe((res) => {
        expect(res.data).toEqual(mockAppointments);
      });

    const req = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/appointments') &&
        r.params.get('technician_id') === 'tech-1' &&
        r.params.get('status_id') === 'st-1' &&
        r.params.get('per_page') === '25',
    );
    expect(req.request.method).toBe('GET');
    req.flush({ data: mockAppointments });

    service.getAppointment('app-1').subscribe((res) => {
      expect(res.data.id).toBe('app-1');
    });
    const singleReq = httpMock.expectOne((r) => r.url.endsWith('/appointments/app-1'));
    expect(singleReq.request.method).toBe('GET');
    singleReq.flush({ data: mockAppointments[0] });
  });

  it('should create, update, patch, and delete appointment', () => {
    const createPayload: CreateAppointmentRequest = {
      title: 'Intervento Caldaia',
      starts_at: '2026-11-12T14:00:00Z',
      ends_at: '2026-11-12T16:00:00Z',
      contact_id: 'c-2',
    };

    service.createAppointment(createPayload).subscribe((res) => {
      expect(res.data.id).toBe('app-new');
    });
    const createReq = httpMock.expectOne((r) => r.url.endsWith('/appointments'));
    expect(createReq.request.method).toBe('POST');
    expect(createReq.request.body).toEqual(createPayload);
    createReq.flush({ data: { id: 'app-new', ...createPayload } });

    const updatePayload: UpdateAppointmentRequest = {
      title: 'Intervento Caldaia Urgente',
    };
    service.updateAppointment('app-new', updatePayload).subscribe();
    const updateReq = httpMock.expectOne((r) => r.url.endsWith('/appointments/app-new'));
    expect(updateReq.request.method).toBe('PUT');
    updateReq.flush({ data: { id: 'app-new', title: 'Intervento Caldaia Urgente' } });

    service.patchAppointment('app-new', { description: 'Portare ricambi guarnizioni' }).subscribe();
    const patchReq = httpMock.expectOne((r) => r.url.endsWith('/appointments/app-new'));
    expect(patchReq.request.method).toBe('PATCH');
    patchReq.flush({ data: { id: 'app-new' } });

    service.deleteAppointment('app-new').subscribe((res) => {
      expect(res.data.id).toBe('app-new');
    });
    const delReq = httpMock.expectOne((r) => r.url.endsWith('/appointments/app-new'));
    expect(delReq.request.method).toBe('DELETE');
    delReq.flush({ data: { id: 'app-new' } });
  });

  it('should get calendar items and check conflicts', () => {
    const mockCalendar: AppointmentCalendarItem[] = [
      {
        id: 'cal-1',
        title: 'Audit Tecnico',
        start: '2026-11-15T08:00:00Z',
        end: '2026-11-15T12:00:00Z',
      },
    ];

    service.getCalendar({ start: '2026-11-01', end: '2026-11-30', technician_id: 'tech-1' }).subscribe((res) => {
      expect(res.data).toEqual(mockCalendar);
    });
    const calReq = httpMock.expectOne(
      (r) =>
        r.url.endsWith('/appointments/calendar') &&
        r.params.get('start') === '2026-11-01' &&
        r.params.get('end') === '2026-11-30' &&
        r.params.get('technician_id') === 'tech-1',
    );
    expect(calReq.request.method).toBe('GET');
    calReq.flush({ data: mockCalendar });

    const conflictPayload: AppointmentConflictCheckRequest = {
      starts_at: '2026-11-15T09:00:00Z',
      ends_at: '2026-11-15T10:00:00Z',
      user_ids: ['tech-1'],
    };
    service.checkConflicts(conflictPayload).subscribe((res) => {
      expect(res.data.has_conflicts).toBe(true);
    });
    const confReq = httpMock.expectOne((r) => r.url.endsWith('/appointments/check-conflicts'));
    expect(confReq.request.method).toBe('POST');
    confReq.flush({ data: { has_conflicts: true, conflicting_appointments: [] } });
  });

  it('should cancel appointment and convert to service report', () => {
    const cancelPayload: CancelAppointmentRequest = { reason: 'Richiesta annullamento cliente' };
    service.cancelAppointment('app-1', cancelPayload).subscribe();
    const cancelReq = httpMock.expectOne((r) => r.url.endsWith('/appointments/app-1/cancel'));
    expect(cancelReq.request.method).toBe('POST');
    cancelReq.flush({ data: { id: 'app-1', cancellation_reason: cancelPayload.reason } });

    service.convertToServiceReport('app-1').subscribe((res) => {
      expect(res.data.service_report_id).toBe('rep-123');
    });
    const convReq = httpMock.expectOne((r) => r.url.endsWith('/appointments/app-1/convert-to-service-report'));
    expect(convReq.request.method).toBe('POST');
    convReq.flush({ data: { service_report_id: 'rep-123' } });
  });
});
