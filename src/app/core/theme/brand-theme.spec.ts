import { describe, expect, it } from 'vitest';
import { BRAND_SURFACES, brandVariables, brandVariablesForBothThemes } from './brand-theme';
import { AA_TEXT_RATIO, contrastRatio } from './contrast.util';

describe('brand-theme', () => {
  it('has no variables without a brand colour', () => {
    expect(
      brandVariables({ brand_primary_color: null, brand_secondary_color: null }, 'light'),
    ).toEqual({});
  });

  it('ignores a value that is not a hex colour', () => {
    expect(
      brandVariables({ brand_primary_color: 'teal', brand_secondary_color: '#12' }, 'dark'),
    ).toEqual({});
  });

  it('describes the primary and the accent family', () => {
    const variables = brandVariables(
      { brand_primary_color: '#1F6FEB', brand_secondary_color: '#F59E0B' },
      'light',
    );
    expect(Object.keys(variables).sort()).toEqual(
      [
        '--ff-color-accent',
        '--ff-color-accent-active',
        '--ff-color-accent-hover',
        '--ff-color-accent-subtle',
        '--ff-color-focus',
        '--ff-color-on-accent',
        '--ff-color-on-primary',
        '--ff-color-primary',
        '--ff-color-primary-active',
        '--ff-color-primary-hover',
        '--ff-color-primary-subtle',
        '--ff-color-text-link',
      ].sort(),
    );
  });

  for (const mode of ['light', 'dark'] as const) {
    it(`keeps text on the brand colours readable (>= 4.5:1) in ${mode} mode`, () => {
      for (const colour of ['#1F6FEB', '#FFEB3B', '#E91E63', '#000000', '#FFFFFF', '#7F7F7F']) {
        const v = brandVariables(
          { brand_primary_color: colour, brand_secondary_color: colour },
          mode,
        );
        for (const family of ['primary', 'accent']) {
          const onColour = v[`--ff-color-on-${family}`];
          for (const state of ['', '-hover', '-active']) {
            expect(
              contrastRatio(onColour, v[`--ff-color-${family}${state}`]),
              `${colour} ${family}${state} (${mode})`,
            ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
          }
          expect(
            contrastRatio(v[`--ff-color-${family}`], BRAND_SURFACES[mode]),
            `${colour} ${family} on surface (${mode})`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        }
      }
    });
  }

  it('computes both themes for the cache', () => {
    const both = brandVariablesForBothThemes({
      brand_primary_color: '#1F6FEB',
      brand_secondary_color: null,
    });
    expect(both.light['--ff-color-primary']).not.toBe(both.dark['--ff-color-primary']);
  });
});
