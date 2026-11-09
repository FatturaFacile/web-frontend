import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it } from 'vitest';
import { HrLeaveApiService, HrSelfServiceApiService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { SelfServiceComponent } from './self-service.component';

const profile = {
  id: 'e1',
  employee_number: 'E-001',
  full_name: 'Mario Rossi',
  work_email: 'mario@example.test',
  department_id: null,
  position_id: null,
  manager_id: null,
  employment_status: 'active',
  employment_type: 'full_time',
  hire_date: '2024-01-15',
  fte_ratio: '1.00',
};

function setup(profileResult: unknown) {
  const api = {
    getProfile: () => profileResult,
    getLeaveBalances: () => of({ success: true, message: '', data: [] }),
    getLeaveRequests: () => of({ success: true, message: '', data: [] }),
    getTraining: () => of({ success: true, message: '', data: { training_records: [], certifications: [] } }),
    getDocuments: () => of({ success: true, message: '', data: [] }),
  };
  TestBed.configureTestingModule({
    providers: [
      provideNzIcons(icons),
      { provide: HrSelfServiceApiService, useValue: api },
      { provide: HrLeaveApiService, useValue: { getLeaveTypes: () => of({ success: true, message: '', data: [] }) } },
    ],
  });
  const fixture = TestBed.createComponent(SelfServiceComponent);
  fixture.detectChanges();
  return fixture;
}

describe('SelfServiceComponent', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('shows the profile tabs for a linked employee', async () => {
    const fixture = setup(of({ success: true, message: '', data: profile }));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mario Rossi');
  });

  it('shows the not-linked state on 403', async () => {
    const fixture = setup(throwError(() => new HttpErrorResponse({ status: 403 })));
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('nz-result')).not.toBeNull();
    expect(fixture.nativeElement.querySelector('nz-tabs')).toBeNull();
  });
});
