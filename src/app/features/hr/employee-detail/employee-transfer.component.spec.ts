import { FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrEmployeeApiService, I18nService } from '@core';
import { EmployeeTransferComponent } from './employee-transfer.component';

describe('EmployeeTransferComponent validation', () => {
  const api = {
    getDepartments: vi.fn().mockReturnValue(of({ data: [] })),
    getPositions: vi.fn().mockReturnValue(of({ data: [] })),
    transferEmployee: vi.fn().mockReturnValue(of({ data: {} })),
  };

  function createComponent() {
    const fixture = TestBed.createComponent(EmployeeTransferComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.componentInstance as unknown as { form: FormGroup; submit(): void };
  }

  beforeEach(() => {
    api.transferEmployee.mockClear();
    TestBed.configureTestingModule({
      imports: [EmployeeTransferComponent],
      providers: [
        { provide: HrEmployeeApiService, useValue: api },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('does not submit a reason longer than 500 characters', () => {
    const component = createComponent();
    component.form.patchValue({ reason: 'x'.repeat(501) });

    component.submit();

    expect(api.transferEmployee).not.toHaveBeenCalled();
    expect(component.form.get('reason')?.hasError('maxlength')).toBe(true);
  });

  it('submits when the form is valid', () => {
    const component = createComponent();

    component.submit();

    expect(api.transferEmployee).toHaveBeenCalledTimes(1);
  });
});
