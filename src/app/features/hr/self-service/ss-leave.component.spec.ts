import { FormControl, FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrSelfServiceApiService, I18nService } from '@core';
import { SsLeaveComponent } from './ss-leave.component';

describe('SsLeaveComponent validation', () => {
  const api = {
    getLeaveTypes: vi.fn().mockReturnValue(of({ data: [] })),
    getLeaveBalances: vi.fn().mockReturnValue(of({ data: [] })),
    getLeaveRequests: vi.fn().mockReturnValue(of({ data: [] })),
    submitLeaveRequest: vi.fn().mockReturnValue(of({ data: {} })),
    cancelLeaveRequest: vi.fn().mockReturnValue(of({ data: {} })),
  };

  function createComponent() {
    const fixture = TestBed.createComponent(SsLeaveComponent);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      form: FormGroup;
      cancelReason: FormControl<string>;
      cancelTarget: { set(value: unknown): void };
      submit(): void;
      confirmCancel(): void;
    };
  }

  beforeEach(() => {
    api.submitLeaveRequest.mockClear();
    api.cancelLeaveRequest.mockClear();
    TestBed.configureTestingModule({
      imports: [SsLeaveComponent],
      providers: [
        { provide: HrSelfServiceApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('does not submit an empty request', () => {
    const component = createComponent();

    component.submit();

    expect(api.submitLeaveRequest).not.toHaveBeenCalled();
    expect(component.form.get('leave_type_id')?.hasError('required')).toBe(true);
  });

  it('rejects an end date before the start date and hours outside 0.5..2000', () => {
    const component = createComponent();
    component.form.patchValue({
      leave_type_id: 't1',
      start_date: '2026-09-10',
      end_date: '2026-09-01',
      total_hours: '3000',
    });

    component.submit();

    expect(api.submitLeaveRequest).not.toHaveBeenCalled();
    expect(component.form.get('end_date')?.hasError('dateOrder')).toBe(true);
    expect(component.form.get('total_hours')?.hasError('range')).toBe(true);
  });

  it('does not cancel without a reason of at least 3 characters', () => {
    const component = createComponent();
    component.cancelTarget.set({ id: 'r1' });
    component.cancelReason.setValue('ab');

    component.confirmCancel();

    expect(api.cancelLeaveRequest).not.toHaveBeenCalled();
    expect(component.cancelReason.hasError('minlength')).toBe(true);
  });
});
