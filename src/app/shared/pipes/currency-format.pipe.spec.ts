import { describe, it, expect } from 'vitest';
import { CurrencyFormatPipe } from './currency-format.pipe';

describe('CurrencyFormatPipe', () => {
  const pipe = new CurrencyFormatPipe();

  it('should format number to EUR currency format for it-IT', () => {
    const formatted = pipe.transform(100.5, 'EUR', 'it-IT');
    // Normalized check for non-breaking space / currency sign
    expect(formatted).toContain('100,50');
    expect(formatted).toContain('€');
  });

  it('should return empty string for null, undefined, or NaN', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform(NaN)).toBe('');
  });
});
