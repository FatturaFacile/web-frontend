import { describe, expect, it } from 'vitest';
import { addPieces, applyKey, isPositiveQuantity } from './mes-keypad.utils';

describe('applyKey', () => {
  it('appends digits and replaces a lone zero', () => {
    expect(applyKey('0', '7')).toBe('7');
    expect(applyKey('7', '5')).toBe('75');
    expect(applyKey('0', '0')).toBe('0');
  });

  it('takes one decimal point and at most four decimals', () => {
    expect(applyKey('12', '.')).toBe('12.');
    expect(applyKey('12.', '.')).toBe('12.');
    expect(applyKey('12.5', '2')).toBe('12.52');
    expect(applyKey('1.2345', '6')).toBe('1.2345');
  });

  it('limits the integer digits', () => {
    expect(applyKey('123456789', '1')).toBe('123456789');
  });

  it('removes the last character and resets to zero', () => {
    expect(applyKey('125', 'back')).toBe('12');
    expect(applyKey('5', 'back')).toBe('0');
    expect(applyKey('0', 'back')).toBe('0');
    expect(applyKey('125.5', 'clear')).toBe('0');
  });

  it('ignores anything that is not a key of the pad', () => {
    expect(applyKey('12', 'x')).toBe('12');
    expect(applyKey('12', '-')).toBe('12');
  });
});

describe('addPieces and isPositiveQuantity', () => {
  it('adds quick increments exactly', () => {
    expect(addPieces('0', 5)).toBe('5');
    expect(addPieces('2.5', 10)).toBe('12.5');
    expect(addPieces('0.1', 1)).toBe('1.1');
  });

  it('accepts only numbers above zero', () => {
    expect(isPositiveQuantity('0')).toBe(false);
    expect(isPositiveQuantity('0.')).toBe(false);
    expect(isPositiveQuantity('')).toBe(false);
    expect(isPositiveQuantity('0.0001')).toBe(true);
    expect(isPositiveQuantity('12.')).toBe(true);
  });
});
