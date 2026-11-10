import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ActionFormComponent, ActionFormConfig } from './action-form.component';

interface FormAccess {
  form: {
    patchValue(v: object): void;
    get(k: string): { errors: { serverError?: string } | null } | null;
  };
  submit(): void;
}

describe('ActionFormComponent', () => {
  let fixture: ComponentFixture<ActionFormComponent>;
  const submit = vi.fn();

  function configure(extra: Partial<ActionFormConfig> = {}): FormAccess {
    const config: ActionFormConfig = {
      submitLabelKey: 'hrmCommon.save',
      fields: [
        { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true },
        { key: 'amount', labelKey: 'hrmEmp.amount', type: 'decimal', nullable: true },
        { key: 'count', labelKey: 'hrmCommon.hours', type: 'integer' },
        { key: 'note', labelKey: 'hrmCommon.notes', type: 'text' },
        { key: 'active', labelKey: 'hrmCommon.active', type: 'boolean', defaultValue: true },
      ],
      submit,
      ...extra,
    };
    fixture.componentRef.setInput('config', config);
    fixture.detectChanges();
    return fixture.componentInstance as unknown as FormAccess;
  }

  beforeEach(() => {
    submit.mockReset();
    TestBed.resetTestingModule();
    fixture = TestBed.createComponent(ActionFormComponent);
  });

  it('sends the typed values: decimal as string, integer as number, empty nullable as null, empty others omitted', () => {
    submit.mockReturnValue(of({ ok: true }));
    const component = configure();
    const emitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(emitted);

    component.form.patchValue({ name: ' Rossi ', amount: '', count: '12' });
    component.submit();

    expect(submit).toHaveBeenCalledWith({ name: 'Rossi', amount: null, count: 12, active: true });
    expect(emitted).toHaveBeenCalledWith({ ok: true });
  });

  it('does not call the action when a required field is empty or a decimal is malformed', () => {
    const component = configure();
    component.submit();
    component.form.patchValue({ name: 'x', amount: '1,5' });
    component.submit();
    expect(submit).not.toHaveBeenCalled();
  });

  it('binds a 422 to the field', () => {
    submit.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'x', errors: { name: ['Already used'] } },
          }),
      ),
    );
    const component = configure();
    component.form.patchValue({ name: 'x' });
    component.submit();
    expect(component.form.get('name')?.errors?.serverError).toBe('Already used');
  });

  it('empties the form after a successful submit when asked to', () => {
    submit.mockReturnValue(of({}));
    const component = configure({ resetOnSuccess: true });
    component.form.patchValue({ name: 'x' });
    component.submit();
    const reset = fixture.componentInstance as unknown as FormAccess;
    expect(reset.form.get('name')?.errors).not.toBeNull();
  });

  it('disables the submit button without permission', () => {
    configure();
    fixture.componentRef.setInput('canWrite', false);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector(
      'button[type="submit"]',
    ) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
  });
});
