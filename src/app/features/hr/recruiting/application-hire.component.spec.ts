import { FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrTalentApiService, I18nService } from '@core';
import { ApplicationHireComponent } from './application-hire.component';

describe('ApplicationHireComponent validation', () => {
  const api = { hireCandidate: vi.fn().mockReturnValue(of({ success: true, data: {} })) };

  function createComponent() {
    const fixture = TestBed.createComponent(ApplicationHireComponent);
    fixture.componentRef.setInput('applicationId', 'app-1');
    fixture.detectChanges();
    return fixture.componentInstance as unknown as { form: FormGroup; submit(): void };
  }

  beforeEach(() => {
    api.hireCandidate.mockClear();
    TestBed.configureTestingModule({
      imports: [ApplicationHireComponent],
      providers: [
        { provide: HrTalentApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('does not hire with an empty form', () => {
    const component = createComponent();

    component.submit();

    expect(api.hireCandidate).not.toHaveBeenCalled();
    expect(component.form.get('base_annual_salary')?.hasError('required')).toBe(true);
    expect(component.form.get('hire_date')?.hasError('required')).toBe(true);
  });

  it('rejects an invalid work email and weekly hours out of 1..60', () => {
    const component = createComponent();
    component.form.patchValue({ base_annual_salary: '50000', hire_date: '2026-12-01', work_email: 'nope', weekly_hours: '70' });

    component.submit();

    expect(api.hireCandidate).not.toHaveBeenCalled();
    expect(component.form.get('work_email')?.hasError('email')).toBe(true);
    expect(component.form.get('weekly_hours')?.hasError('range')).toBe(true);
  });

  it('hires when the required fields are valid', () => {
    const component = createComponent();
    component.form.patchValue({ base_annual_salary: '50000', hire_date: '2026-12-01', weekly_hours: '40' });

    component.submit();

    expect(api.hireCandidate).toHaveBeenCalledTimes(1);
  });
});
