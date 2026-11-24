import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LOCALE_ID } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { I18nService, PermissionsService } from '@core';
import { icons } from '../../icons-provider';
import { AccrualLedgersComponent } from './accrual-ledgers.component';
import { DepartmentGanttCalendarComponent } from './department-gantt-calendar.component';
import { LeaveManagementStore } from './leave-management.store';
import { LeaveRequestsComponent } from './leave-requests.component';

const base = `${environment.apiBaseUrl}/leave-management`;
const hrBase = `${environment.apiBaseUrl}/hr`;

describe('Mod 074 Leave Management pages', () => {
  let http: HttpTestingController;
  const message = { success: vi.fn(), error: vi.fn(), info: vi.fn() };

  beforeEach(() => {
    message.success.mockReset();
    message.error.mockReset();
    message.info.mockReset();
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        LeaveManagementStore,
        { provide: LOCALE_ID, useValue: 'it-CH' },
        { provide: NzMessageService, useValue: message },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: PermissionsService, useValue: { canAccess: () => true, canWrite: () => true } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('renders Department Gantt Calendar and triggers staffing threshold button', async () => {
    const fixture = TestBed.createComponent(DepartmentGanttCalendarComponent);
    fixture.detectChanges();

    http.expectOne((r) => r.url === `${hrBase}/employees`).flush({ data: [] });
    http.expectOne((r) => r.url === `${hrBase}/departments`).flush({ data: [] });
    http
      .expectOne((r) => r.url === `${base}/department-calendar`)
      .flush({
        success: true,
        message: '',
        data: {
          from: '2026-11-01',
          to: '2026-11-30',
          department_id: null,
          country: 'CH',
          canton_or_province_code: 'TI',
          total_employees: 0,
          threshold: null,
          days: [],
          employees: [],
        },
      });
    http.expectOne(`${base}/staffing-thresholds`).flush({ success: true, message: '', data: [] });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="lm-gantt-refresh-btn"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="lm-threshold-open-btn"]'),
    ).not.toBeNull();
  });

  it('renders Accrual Ledgers page and monthly accrual trigger', async () => {
    const fixture = TestBed.createComponent(AccrualLedgersComponent);
    fixture.detectChanges();

    http.expectOne((r) => r.url === `${hrBase}/employees`).flush({ data: [] });
    http.expectOne((r) => r.url === `${hrBase}/departments`).flush({ data: [] });
    http
      .expectOne((r) => r.url === `${base}/ledgers`)
      .flush({ success: true, message: '', data: [] });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="lm-run-accruals-btn"]'),
    ).not.toBeNull();
  });

  it('renders Leave Requests page with Standard and INPS PUC / SUVA registration actions', async () => {
    const fixture = TestBed.createComponent(LeaveRequestsComponent);
    fixture.detectChanges();

    http.expectOne((r) => r.url === `${hrBase}/employees`).flush({ data: [] });
    http.expectOne((r) => r.url === `${hrBase}/departments`).flush({ data: [] });
    http
      .expectOne((r) => r.url === `${base}/requests`)
      .flush({ success: true, message: '', data: [] });

    await fixture.whenStable();
    fixture.detectChanges();

    expect(
      fixture.nativeElement.querySelector('[data-testid="lm-new-request-btn"]'),
    ).not.toBeNull();
    expect(
      fixture.nativeElement.querySelector('[data-testid="lm-register-sick-btn"]'),
    ).not.toBeNull();
  });
});
