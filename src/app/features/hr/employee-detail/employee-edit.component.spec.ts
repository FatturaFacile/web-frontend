import { TestBed } from '@angular/core/testing';
import { FormGroup } from '@angular/forms';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { EmployeeResource, HrApiService, HrExtraApiService, I18nService } from '@core';
import { EmployeeEditComponent } from './employee-edit.component';

describe('EmployeeEditComponent', () => {
  const api = { updateEmployee: vi.fn(), deleteEmployee: vi.fn() };
  const hrApi = { rehireEmployee: vi.fn() };
  const modal = { confirm: vi.fn() };
  const employee = { id: 'e1', first_name: 'Anna', last_name: 'Rossi', employment_status: 'terminated' } as EmployeeResource;

  function create() {
    const fixture = TestBed.createComponent(EmployeeEditComponent);
    fixture.componentRef.setInput('employee', employee);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      form: FormGroup;
      open(): void;
      submit(): void;
      confirmArchive(): void;
      confirmRehire(): void;
    };
  }

  beforeEach(() => {
    vi.resetAllMocks();
    modal.confirm.mockImplementation((config: { nzOnOk?: () => void }) => config.nzOnOk?.());
    TestBed.configureTestingModule({
      providers: [
        { provide: HrExtraApiService, useValue: api },
        { provide: HrApiService, useValue: hrApi },
        { provide: NzModalService, useValue: modal },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('prefills the form and sends only the editable contact fields', () => {
    api.updateEmployee.mockReturnValue(of({ data: employee }));
    const component = create();
    component.open();
    component.form.patchValue({ phone: ' +41 79 ', personal_email: '' });
    component.submit();
    expect(api.updateEmployee).toHaveBeenCalledWith('e1', { first_name: 'Anna', last_name: 'Rossi', phone: '+41 79', personal_email: null });
  });

  it('does not submit an invalid e-mail', () => {
    const component = create();
    component.open();
    component.form.patchValue({ personal_email: 'nope' });
    component.submit();
    expect(api.updateEmployee).not.toHaveBeenCalled();
  });

  it('archives and rehires after confirmation', () => {
    api.deleteEmployee.mockReturnValue(of(undefined));
    hrApi.rehireEmployee.mockReturnValue(of({ data: employee }));
    const component = create();
    vi.spyOn((component as unknown as { modal: { confirm: unknown } }).modal as { confirm: (c: { nzOnOk?: () => void }) => void }, 'confirm').mockImplementation((config: { nzOnOk?: () => void }) => config.nzOnOk?.());
    component.confirmArchive();
    component.confirmRehire();
    expect(api.deleteEmployee).toHaveBeenCalledWith('e1');
    expect(hrApi.rehireEmployee).toHaveBeenCalledWith('e1', { rehire_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });
  });
});
