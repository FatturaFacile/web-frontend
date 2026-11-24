import { FormControl } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import {
  inpsPucValidator,
  isDateInAbsenceSpan,
  isValidInpsPuc,
  LEAVE_TYPE_OPTIONS,
  SWISS_CANTONS,
} from './leave-management.util';

describe('leave-management.util', () => {
  it('validates 9-character INPS PUC protocol numbers', () => {
    expect(isValidInpsPuc('PUC123456')).toBe(true);
    expect(isValidInpsPuc(' ab12345cd ')).toBe(true);
    expect(isValidInpsPuc('SHORT')).toBe(false);
    expect(isValidInpsPuc('PUC-12345')).toBe(false);

    const validator = inpsPucValidator();
    expect(validator(new FormControl('PUC123456'))).toBeNull();
    expect(validator(new FormControl('BAD'))).toEqual({ invalidInpsPuc: true });
  });

  it('contains all 26 Swiss cantons and all 10 leave types', () => {
    expect(SWISS_CANTONS).toHaveLength(26);
    expect(SWISS_CANTONS).toContain('TI');
    expect(SWISS_CANTONS).toContain('ZH');
    expect(SWISS_CANTONS).toContain('GE');
    expect(SWISS_CANTONS).toContain('VD');
    expect(LEAVE_TYPE_OPTIONS).toHaveLength(10);
  });

  it('checks date membership within an absence span', () => {
    expect(isDateInAbsenceSpan('2026-06-15', '2026-06-10', '2026-06-20')).toBe(true);
    expect(isDateInAbsenceSpan('2026-06-21', '2026-06-10', '2026-06-20')).toBe(false);
  });
});
