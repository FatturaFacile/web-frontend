import { describe, expect, it } from 'vitest';
import { MoneyPipe } from './money.pipe';

describe('MoneyPipe', () => {
  const pipe = new MoneyPipe();

  it('formats number to EUR in it-IT locale', () => {
    const formatted = pipe.transform(1234.5, 'EUR', 'it-IT');
    expect(formatted).toContain('1234,50');
    expect(formatted).toContain('€');
  });

  it('formats decimal string to EUR in it-IT locale without float calculations', () => {
    const formatted = pipe.transform('1234.50', 'EUR', 'it-IT');
    expect(formatted).toContain('1234,50');
    expect(formatted).toContain('€');
  });

  it('formats decimal string to CHF in de-CH locale', () => {
    const formatted = pipe.transform('99.90', 'CHF', 'de-CH');
    expect(formatted).toContain('99.90');
    expect(formatted).toContain('CHF');
  });

  it('returns empty string for null, undefined, empty string or invalid value', () => {
    expect(pipe.transform(null)).toBe('');
    expect(pipe.transform(undefined)).toBe('');
    expect(pipe.transform('')).toBe('');
    expect(pipe.transform('invalid')).toBe('');
  });
});
