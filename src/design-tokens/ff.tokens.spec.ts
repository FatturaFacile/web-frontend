import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { BRAND_SURFACES } from '../app/core/theme/brand-theme';
import {
  AA_TEXT_RATIO,
  AA_UI_RATIO,
  blend,
  contrastRatio,
  parseColor,
  toHex,
} from '../app/core/theme/contrast.util';

interface TokenLeaf {
  $value: string;
}
type TokenGroup = Record<string, TokenLeaf>;
interface TokenFile {
  color: { light: TokenGroup; dark: TokenGroup };
  density: Record<string, TokenGroup>;
  a11y: TokenGroup;
}

const root = resolve(process.cwd());
const tokens = JSON.parse(
  readFileSync(resolve(root, 'src/design-tokens/ff.tokens.json'), 'utf8'),
) as TokenFile;

function px(value: string): number {
  return Number(value.replace('px', ''));
}

describe('design tokens', () => {
  it('has a generated stylesheet in sync with the JSON source', () => {
    expect(() =>
      execFileSync(
        process.execPath,
        [resolve(root, 'scripts/build-design-tokens.mjs'), '--check'],
        { stdio: 'pipe' },
      ),
    ).not.toThrow();
  });

  it('keeps the brand surfaces of the runtime theming equal to the surface tokens', () => {
    expect(BRAND_SURFACES.light.toLowerCase()).toBe(
      tokens.color.light['surface'].$value.toLowerCase(),
    );
    expect(BRAND_SURFACES.dark.toLowerCase()).toBe(
      tokens.color.dark['surface'].$value.toLowerCase(),
    );
  });

  it('defines the same colour tokens for light and dark', () => {
    expect(Object.keys(tokens.color.dark).sort()).toEqual(Object.keys(tokens.color.light).sort());
  });

  for (const mode of ['light', 'dark'] as const) {
    describe(`${mode} theme contrast (WCAG 1.4.3, 1.4.11)`, () => {
      const c = (name: string): string => tokens.color[mode][name].$value;
      const surfaces = ['bg', 'surface', 'surface-alt', 'surface-raised', 'header'];

      for (const surface of surfaces) {
        it(`text and links are readable on ${surface}`, () => {
          for (const fg of [
            'text',
            'text-secondary',
            'text-muted',
            'text-link',
            'primary',
            'accent',
          ]) {
            // the secondary tones are not used on the page background of the dark theme header, but all must pass anyway
            expect(contrastRatio(c(fg), c(surface)), `${fg} on ${surface}`).toBeGreaterThanOrEqual(
              AA_TEXT_RATIO,
            );
          }
        });

        it(`input borders and the focus ring are visible on ${surface}`, () => {
          expect(
            contrastRatio(c('border-input'), c(surface)),
            `border-input on ${surface}`,
          ).toBeGreaterThanOrEqual(AA_UI_RATIO);
          expect(
            contrastRatio(c('focus'), c(surface)),
            `focus on ${surface}`,
          ).toBeGreaterThanOrEqual(AA_UI_RATIO);
        });
      }

      it('filled buttons keep their label readable in every state', () => {
        for (const state of ['primary', 'primary-hover', 'primary-active']) {
          expect(
            contrastRatio(c('on-primary'), c(state)),
            `on-primary on ${state}`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        }
        for (const state of ['accent', 'accent-hover', 'accent-active']) {
          expect(
            contrastRatio(c('on-accent'), c(state)),
            `on-accent on ${state}`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        }
      });

      it('status colours are readable on their own background and on the card', () => {
        for (const status of ['success', 'warning', 'danger', 'info', 'neutral']) {
          // The tints are translucent: they are composed over the card before the ratio is measured.
          const tint = toHex(blend(parseColor(c(`${status}-bg`))!, parseColor(c('surface'))!));
          expect(contrastRatio(c(status), tint), `${status} on its tint`).toBeGreaterThanOrEqual(
            AA_TEXT_RATIO,
          );
          expect(
            contrastRatio(c(status), c('surface')),
            `${status} on surface`,
          ).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        }
      });

      it('keeps text readable on the primary tint and the selected row', () => {
        expect(contrastRatio(c('text'), c('primary-subtle'))).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        expect(contrastRatio(c('text'), c('selected'))).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
        expect(contrastRatio(c('text'), c('hover'))).toBeGreaterThanOrEqual(AA_TEXT_RATIO);
      });

      it('keeps the sidebar text readable', () => {
        expect(contrastRatio(c('sidebar-text'), c('sidebar'))).toBeGreaterThanOrEqual(
          AA_TEXT_RATIO,
        );
        expect(contrastRatio(c('sidebar-text-active'), c('sidebar'))).toBeGreaterThanOrEqual(
          AA_TEXT_RATIO,
        );
      });
    });
  }

  describe('target size (WCAG 2.5.8)', () => {
    it('sets a minimum target of at least 24px', () => {
      expect(px(tokens.a11y['target-min'].$value)).toBeGreaterThanOrEqual(24);
    });

    for (const density of ['compact', 'comfortable', 'spacious']) {
      it(`${density} controls and rows reach the minimum target`, () => {
        expect(px(tokens.density[density]['control-height'].$value)).toBeGreaterThanOrEqual(
          px(tokens.a11y['target-min'].$value),
        );
        expect(px(tokens.density[density]['row-height'].$value)).toBeGreaterThanOrEqual(
          px(tokens.a11y['target-min'].$value),
        );
      });
    }

    it('grows from compact to spacious', () => {
      const heights = ['compact', 'comfortable', 'spacious'].map((d) =>
        px(tokens.density[d]['control-height'].$value),
      );
      expect(heights).toEqual([...heights].sort((a, b) => a - b));
    });
  });
});
