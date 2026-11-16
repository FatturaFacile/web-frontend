import { BrandTones, buildBrandTones, isHexColor, ThemeMode } from './contrast.util';
import { TenantBranding } from './ui-preferences.types';

/** Page surfaces the brand colours are drawn on; they are the `surface` tokens of src/design-tokens/ff.tokens.json. */
export const BRAND_SURFACES: Readonly<Record<ThemeMode, string>> = {
  light: '#FFFFFF',
  dark: '#111A2E',
};

/** Where the brand variables are cached for the inline script of index.html. */
export const BRAND_STORAGE_KEY = 'ff_ui_brand';

/** The two brand colours of a tenant. */
export type BrandColours = Pick<TenantBranding, 'brand_primary_color' | 'brand_secondary_color'>;

export type CssVariables = Readonly<Record<string, string>>;

function familyVariables(name: 'primary' | 'accent', tones: BrandTones): Record<string, string> {
  return {
    [`--ff-color-${name}`]: tones.base,
    [`--ff-color-${name}-hover`]: tones.hover,
    [`--ff-color-${name}-active`]: tones.active,
    [`--ff-color-${name}-subtle`]: tones.subtle,
    [`--ff-color-on-${name}`]: tones.contrastText,
  };
}

/**
 * The CSS custom properties that carry the tenant brand in one theme. Empty without a brand colour, so the tokens of
 * the stylesheet apply. Every tone is checked against WCAG AA (>= 4.5:1) by `buildBrandTones`.
 */
export function brandVariables(branding: BrandColours, mode: ThemeMode): CssVariables {
  const variables: Record<string, string> = {};
  const surface = BRAND_SURFACES[mode];

  if (branding.brand_primary_color && isHexColor(branding.brand_primary_color)) {
    const tones = buildBrandTones(branding.brand_primary_color, mode, surface);
    Object.assign(variables, familyVariables('primary', tones), {
      '--ff-color-text-link': tones.base,
      '--ff-color-focus': tones.base,
    });
  }
  if (branding.brand_secondary_color && isHexColor(branding.brand_secondary_color)) {
    Object.assign(
      variables,
      familyVariables('accent', buildBrandTones(branding.brand_secondary_color, mode, surface)),
    );
  }
  return variables;
}

/** Both themes at once: what is cached for the first paint of the next visit. */
export function brandVariablesForBothThemes(
  branding: BrandColours,
): Record<ThemeMode, CssVariables> {
  return { light: brandVariables(branding, 'light'), dark: brandVariables(branding, 'dark') };
}
