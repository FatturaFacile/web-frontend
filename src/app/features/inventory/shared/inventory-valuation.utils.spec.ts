import { HttpErrorResponse } from '@angular/common/http';
import { FormControl, FormGroup } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  bindServerErrors,
  inventoryErrorKey,
  isPositiveAmount,
  isZeroAmount,
  serverMessage,
  toIsoDate,
  validationMessages,
} from './inventory-valuation.utils';

const httpError = (status: number, error: unknown = null) => new HttpErrorResponse({ status, error });

describe('inventory valuation utils', () => {
  it('detects zero amounts on decimal strings without float maths', () => {
    expect(isZeroAmount('0.00')).toBe(true);
    expect(isZeroAmount('-0.0000')).toBe(true);
    expect(isZeroAmount('')).toBe(true);
    expect(isZeroAmount('0.01')).toBe(false);
    expect(isZeroAmount('-12.50')).toBe(false);
  });

  it('accepts only positive amounts with up to two decimals', () => {
    expect(isPositiveAmount('300')).toBe(true);
    expect(isPositiveAmount('0.01')).toBe(true);
    expect(isPositiveAmount('0.00')).toBe(false);
    expect(isPositiveAmount('-5')).toBe(false);
    expect(isPositiveAmount('1.234')).toBe(false);
    expect(isPositiveAmount('abc')).toBe(false);
  });

  it('formats local dates as YYYY-MM-DD', () => {
    expect(toIsoDate(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(toIsoDate(null)).toBeUndefined();
  });

  it('maps HTTP statuses to translated error keys', () => {
    expect(inventoryErrorKey(httpError(401))).toBe('ERRORS.SESSION_EXPIRED');
    expect(inventoryErrorKey(httpError(403))).toBe('INVENTORY.ERRORS.FORBIDDEN');
    expect(inventoryErrorKey(httpError(404))).toBe('INVENTORY.ERRORS.NOT_FOUND');
    expect(inventoryErrorKey(httpError(409))).toBe('INVENTORY.ERRORS.CONFLICT');
    expect(inventoryErrorKey(httpError(422))).toBe('INVENTORY.ERRORS.VALIDATION');
    expect(inventoryErrorKey(httpError(500))).toBe('INVENTORY.ERRORS.GENERIC');
    expect(inventoryErrorKey(new Error('boom'))).toBe('INVENTORY.ERRORS.GENERIC');
  });

  it('extracts Laravel messages and flattened validation errors', () => {
    const err = httpError(422, {
      message: 'The given data was invalid.',
      errors: { receipt_ids: ['Item SKU-1 has no weight_kg'], total_amount: ['Too small'] },
    });
    expect(serverMessage(err)).toBe('The given data was invalid.');
    expect(validationMessages(err)).toEqual(['Item SKU-1 has no weight_kg', 'Too small']);
    expect(validationMessages(httpError(422, { message: 'Period closed' }))).toEqual(['Period closed']);
    expect(validationMessages(httpError(500, new Blob()))).toEqual([]);
  });

  it('binds 422 field errors and returns unmapped or bare messages', () => {
    const form = new FormGroup({ total_amount: new FormControl('') });
    const unmapped = bindServerErrors(
      form,
      httpError(422, { message: 'x', errors: { total_amount: ['Too small'], 'receipt_ids.0': ['Unknown'] } }),
    );
    expect(form.controls.total_amount.errors).toEqual({ serverError: 'Too small' });
    expect(unmapped).toEqual(['Unknown']);
    expect(bindServerErrors(form, httpError(422, { message: 'Period closed' }))).toEqual(['Period closed']);
    expect(bindServerErrors(form, httpError(500, { message: 'x' }))).toEqual([]);
  });
});
