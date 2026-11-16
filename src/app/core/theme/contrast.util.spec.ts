import { describe, expect, it } from 'vitest';
import {
  AA_TEXT_RATIO,
  blend,
  buildBrandTones,
  contrastRatio,
  ensureContrast,
  isHexColor,
  parseColor,
  pickContrastText,
  toHex,
} from './contrast.util';

describe('contrast.util', () => {
  it('computes the reference WCAG ratios', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeGreaterThan(4.5);
    expect(contrastRatio('#777777', '#FFFFFF')).toBeLessThan(4.5);
  });

  it('parses hex and rgba colours and rejects the rest', () => {
    expect(parseColor('#0f766e')).toEqual({ r: 15, g: 118, b: 110, a: 1 });
    expect(parseColor('rgba(16, 185, 129, 0.16)')).toEqual({ r: 16, g: 185, b: 129, a: 0.16 });
    expect(parseColor('red')).toBeNull();
    expect(parseColor('rgb(300, 0, 0)')).toBeNull();
    expect(isHexColor('#12ab9F')).toBe(true);
    expect(isHexColor('#FFF')).toBe(false);
  });

  it('composes a translucent foreground over the background', () => {
    const over = blend({ r: 255, g: 255, b: 255, a: 0.5 }, { r: 0, g: 0, b: 0, a: 1 });
    expect(toHex(over)).toBe('#808080');
    expect(contrastRatio('rgba(255,255,255,0.5)', '#000000')).toBeCloseTo(
      contrastRatio('#808080', '#000000'),
      1,
    );
  });

  it('darkens or lightens a colour until it reaches the ratio', () => {
    const darker = ensureContrast('#7DD3FC', '#FFFFFF', AA_TEXT_RATIO, 'darker');
    expect(contrastRatio(darker, '#FFFFFF')).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
    const lighter = ensureContrast('#1E3A8A', '#0B1120', AA_TEXT_RATIO, 'lighter');
    expect(contrastRatio(lighter, '#0B1120')).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
    expect(ensureContrast('#0F766E', '#FFFFFF', AA_TEXT_RATIO, 'darker')).toBe('#0F766E');
  });

  it('picks a text colour readable on any background', () => {
    for (const background of [
      '#FFFFFF',
      '#000000',
      '#767676',
      '#808080',
      '#FFEB3B',
      '#E91E63',
      '#2196F3',
    ]) {
      expect(contrastRatio(pickContrastText(background), background)).toBeGreaterThanOrEqual(
        AA_TEXT_RATIO,
      );
    }
  });

  describe('buildBrandTones', () => {
    const brands = [
      '#0F766E',
      '#FFEB3B',
      '#E91E63',
      '#2196F3',
      '#FF9800',
      '#00BCD4',
      '#9C27B0',
      '#000000',
      '#FFFFFF',
      '#7F7F7F',
    ];
    const surfaces = { light: '#FFFFFF', dark: '#111A2E' } as const;

    for (const mode of ['light', 'dark'] as const) {
      it(`keeps every pair at 4.5:1 in ${mode} mode for any brand colour`, () => {
        for (const brand of brands) {
          const tones = buildBrandTones(brand, mode, surfaces[mode]);
          const label = `${brand} (${mode})`;
          expect(
            contrastRatio(tones.base, surfaces[mode]),
            `${label} base on surface`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
          expect(
            contrastRatio(tones.base, tones.subtle),
            `${label} base on subtle`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
          expect(
            contrastRatio(tones.contrastText, tones.base),
            `${label} text on base`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
          expect(
            contrastRatio(tones.contrastText, tones.hover),
            `${label} text on hover`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
          expect(
            contrastRatio(tones.contrastText, tones.active),
            `${label} text on active`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        }
      });
    }

    it('keeps a colour that already passes', () => {
      expect(buildBrandTones('#0F766E', 'light', '#FFFFFF').base).toBe('#0F766E');
    });

    it('rejects an invalid colour', () => {
      expect(() => buildBrandTones('teal', 'light', '#FFFFFF')).toThrow();
    });
  });
});
