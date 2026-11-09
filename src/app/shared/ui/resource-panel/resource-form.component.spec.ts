import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { I18nService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { icons } from '../../../icons-provider';
import { rf, req } from './resource-config.helpers';
import { ResourceFormComponent } from './resource-form.component';

interface FormInternals {
  form: { get: (path: string) => { setValue: (v: unknown) => void; errors: Record<string, unknown> | null } };
  submit: () => void;
  addLine: (field: unknown) => void;
}

describe('ResourceFormComponent', () => {
  let fixture: ComponentFixture<ResourceFormComponent>;
  const fields = [req(rf.decimal('quantity')), rf.text('notes'), rf.lines('lines', [rf.decimal('quantity')])];

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [ResourceFormComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    fixture = TestBed.createComponent(ResourceFormComponent);
    fixture.componentRef.setInput('fields', fields);
  });

  it('does not submit while a required field is empty', () => {
    const saveFn = vi.fn(() => of({}));
    fixture.componentRef.setInput('saveFn', saveFn);
    fixture.detectChanges();
    (fixture.componentInstance as unknown as FormInternals).submit();
    expect(saveFn).not.toHaveBeenCalled();
  });

  it('submits the cleaned body, decimals as strings and lines included', () => {
    const saveFn = vi.fn(() => of({}));
    fixture.componentRef.setInput('saveFn', saveFn);
    fixture.detectChanges();
    const internals = fixture.componentInstance as unknown as FormInternals;
    internals.form.get('quantity').setValue('2.50');
    internals.addLine(fields[2]);
    internals.form.get('lines.0.quantity').setValue('1.25');
    internals.submit();
    expect(saveFn).toHaveBeenCalledWith({ quantity: '2.50', lines: [{ quantity: '1.25' }] });
  });

  it('binds a 422 error to the field', () => {
    const error = new HttpErrorResponse({ status: 422, error: { message: 'x', errors: { quantity: ['Too high'] } } });
    fixture.componentRef.setInput('saveFn', () => throwError(() => error));
    fixture.detectChanges();
    const internals = fixture.componentInstance as unknown as FormInternals;
    internals.form.get('quantity').setValue('9');
    internals.submit();
    expect(internals.form.get('quantity').errors).toEqual({ serverError: 'Too high' });
  });
});
