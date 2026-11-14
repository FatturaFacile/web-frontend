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

  it('does not submit a required lines field left without rows', () => {
    const saveFn = vi.fn(() => of({}));
    fixture.componentRef.setInput('fields', [req(rf.lines('lines', [rf.decimal('quantity')]))]);
    fixture.componentRef.setInput('saveFn', saveFn);
    fixture.detectChanges();
    const internals = fixture.componentInstance as unknown as FormInternals;
    internals.form.get('lines.0.quantity').setValue('1');
    (internals.form as unknown as { get: (p: string) => { removeAt: (i: number) => void } }).get('lines').removeAt(0);
    internals.submit();
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

  describe('cross-field rules', () => {
    const setup = (ruleFields: ReturnType<typeof rf.text>[]) => {
      const saveFn = vi.fn(() => of({}));
      fixture.componentRef.setInput('fields', ruleFields);
      fixture.componentRef.setInput('saveFn', saveFn);
      fixture.detectChanges();
      return { saveFn, internals: fixture.componentInstance as unknown as FormInternals };
    };

    it('applies gte:<field>, min and max to decimals and revalidates when the sibling changes', () => {
      const { saveFn, internals } = setup([
        rf.decimal('min_weight_kg', { min: 0 }),
        rf.decimal('max_weight_kg', { atLeastField: 'min_weight_kg' }),
      ]);
      internals.form.get('max_weight_kg').setValue('5');
      internals.form.get('min_weight_kg').setValue('10');
      expect(internals.form.get('max_weight_kg').errors).toEqual({ belowMin: true });
      internals.submit();
      expect(saveFn).not.toHaveBeenCalled();

      internals.form.get('min_weight_kg').setValue('-1');
      expect(internals.form.get('min_weight_kg').errors).toHaveProperty('min');

      internals.form.get('min_weight_kg').setValue('2');
      expect(internals.form.get('max_weight_kg').errors).toBeNull();
      internals.submit();
      expect(saveFn).toHaveBeenCalledWith({ min_weight_kg: '2', max_weight_kg: '5' });
    });

    it('rejects a date before today with notBeforeToday and accepts today', () => {
      const { internals } = setup([rf.date('response_deadline', { notBeforeToday: true })]);
      const pad = (n: number): string => String(n).padStart(2, '0');
      const now = new Date();
      const today = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
      internals.form.get('response_deadline').setValue('2020-01-01');
      expect(internals.form.get('response_deadline').errors).toEqual({ inPast: true });
      internals.form.get('response_deadline').setValue(today);
      expect(internals.form.get('response_deadline').errors).toBeNull();
    });

    it('requires the end time to be after the start time on HH:mm fields', () => {
      const { internals } = setup([rf.time('starts_at'), rf.time('ends_at', { notBefore: 'starts_at', strictlyAfter: true })]);
      internals.form.get('starts_at').setValue('10:00');
      internals.form.get('ends_at').setValue('10:00');
      expect(internals.form.get('ends_at').errors).toEqual({ endsBeforeStart: true });
      internals.form.get('ends_at').setValue('09:30');
      expect(internals.form.get('ends_at').errors).toEqual({ endsBeforeStart: true });
      internals.form.get('ends_at').setValue('10:01');
      expect(internals.form.get('ends_at').errors).toBeNull();
    });

    it('requires a field while a sibling holds the value (required_if) and bounds integers with max', () => {
      const { internals } = setup([
        rf.select('pattern', ['weekday', 'date']),
        rf.integer('weekday', { min: 1, max: 7, requiredIf: { field: 'pattern', value: 'weekday' } }),
      ]);
      internals.form.get('pattern').setValue('weekday');
      expect(internals.form.get('weekday').errors).toEqual({ required: true });
      internals.form.get('weekday').setValue(8);
      expect(internals.form.get('weekday').errors).toHaveProperty('max');
      internals.form.get('weekday').setValue(3);
      expect(internals.form.get('weekday').errors).toBeNull();
      internals.form.get('weekday').setValue(null);
      internals.form.get('pattern').setValue('date');
      expect(internals.form.get('weekday').errors).toBeNull();
    });

    it('forbids a field while the sibling holds the value (prohibited_if)', () => {
      const { internals } = setup([
        rf.select('scheme', ['A', 'B']),
        rf.uuid('cost_center_id', { prohibitedIf: { field: 'scheme', value: 'A' } }),
      ]);
      internals.form.get('cost_center_id').setValue('c');
      internals.form.get('scheme').setValue('A');
      expect(internals.form.get('cost_center_id').errors).toEqual({ prohibited: true });
      internals.form.get('scheme').setValue('B');
      expect(internals.form.get('cost_center_id').errors).toBeNull();
    });

    it('checks the shape of a json field with jsonCheck', () => {
      const { saveFn, internals } = setup([
        rf.json('days', { required: true, jsonCheck: (parsed) => Array.isArray(parsed) }),
      ]);
      internals.form.get('days').setValue('{"mon":1}');
      expect(internals.form.get('days').errors).toEqual({ jsonShape: true });
      internals.submit();
      expect(saveFn).not.toHaveBeenCalled();
      internals.form.get('days').setValue('[1]');
      expect(internals.form.get('days').errors).toBeNull();
    });
  });
});
