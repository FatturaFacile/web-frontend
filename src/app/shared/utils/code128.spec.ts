import { describe, expect, it } from 'vitest';
import { CODE128_PATTERNS, code128BGeometry, code128BValues, code128BWidths } from './code128';

describe('code128', () => {
  it('has 107 symbols of 11 modules (stop: 13)', () => {
    expect(CODE128_PATTERNS).toHaveLength(107);
    CODE128_PATTERNS.forEach((pattern, value) => {
      const sum = Array.from(pattern, Number).reduce((a, b) => a + b, 0);
      expect(sum).toBe(value === 106 ? 13 : 11);
    });
  });

  it('encodes start B, data, mod-103 checksum and stop', () => {
    // "PJJ123C": values 48,42,42,17,18,19,35; (104 + 48*1 + 42*2 + 42*3 + 17*4 + 18*5 + 19*6 + 35*7) % 103 = 55
    expect(code128BValues('PJJ123C')).toEqual([104, 48, 42, 42, 17, 18, 19, 35, 55, 106]);
  });

  it('produces widths matching the symbol count', () => {
    const text = 'RMA-2026-000123';
    const widths = code128BWidths(text);
    const modules = widths.reduce((a, b) => a + b, 0);
    expect(modules).toBe(11 * (text.length + 2) + 13);
    expect(widths.length).toBe(6 * (text.length + 2) + 7);
  });

  it('positions bars with quiet zones', () => {
    const geometry = code128BGeometry('A', 10);
    expect(geometry.bars[0]).toEqual({ x: 10, width: 2 });
    expect(geometry.width).toBe(10 + 11 * 3 + 13 + 10);
  });

  it('rejects non printable characters and empty payloads', () => {
    expect(() => code128BValues('')).toThrow();
    expect(() => code128BValues('é')).toThrow();
  });
});
