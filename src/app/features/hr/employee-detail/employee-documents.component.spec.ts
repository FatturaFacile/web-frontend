import { FormGroup } from '@angular/forms';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { HrEmployeeApiService, I18nService, PermissionsService } from '@core';
import { EmployeeDocumentsComponent } from './employee-documents.component';

describe('EmployeeDocumentsComponent validation', () => {
  const api = {
    getEmployeeDocuments: vi.fn().mockReturnValue(of({ data: [] })),
    uploadEmployeeDocument: vi.fn().mockReturnValue(of({ data: {} })),
  };

  function createComponent() {
    const fixture = TestBed.createComponent(EmployeeDocumentsComponent);
    fixture.componentRef.setInput('employeeId', 'emp-1');
    fixture.detectChanges();
    return fixture.componentInstance as unknown as {
      form: FormGroup;
      fileMissing(): boolean;
      file: { set(file: File | null): void };
      upload(): void;
    };
  }

  beforeEach(() => {
    api.uploadEmployeeDocument.mockClear();
    TestBed.configureTestingModule({
      imports: [EmployeeDocumentsComponent],
      providers: [
        { provide: HrEmployeeApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
  });

  it('does not upload without a file or a title, and flags the missing file', () => {
    const component = createComponent();

    component.upload();

    expect(api.uploadEmployeeDocument).not.toHaveBeenCalled();
    expect(component.fileMissing()).toBe(true);
    expect(component.form.get('title')?.hasError('required')).toBe(true);
  });

  it('rejects a title longer than 200 characters', () => {
    const component = createComponent();
    component.file.set(new File(['x'], 'a.pdf'));
    component.form.patchValue({ title: 'x'.repeat(201) });

    component.upload();

    expect(api.uploadEmployeeDocument).not.toHaveBeenCalled();
    expect(component.form.get('title')?.hasError('maxlength')).toBe(true);
  });

  it('uploads when file and title are given', () => {
    const component = createComponent();
    component.file.set(new File(['x'], 'a.pdf'));
    component.form.patchValue({ title: 'Contract' });

    component.upload();

    expect(api.uploadEmployeeDocument).toHaveBeenCalledTimes(1);
  });
});
