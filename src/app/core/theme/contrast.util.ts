/** WCAG 2.x contrast maths and the tonal palette of a brand colour. Pure functions: no DOM, no Angular. */

export type ThemeMode = 'light' | 'dark';

export interface Rgba {
  readonly r: number;
  readonly g: number;
  readonly b: number;
  readonly a: number;
}

export interface BrandTones {
  /** The brand colour, nudged until it reads as text and as a focus ring on the surface (>= 4.5:1). */
  readonly base: string;
  readonly hover: string;
  readonly active: string;
  /** A soft background tint of the colour. The base colour stays readable on it. */
  readonly subtle: string;
  /** The text colour for content placed on `base`, `hover` and `active` (>= 4.5:1 on each). */
  readonly contrastText: string;
}

/** Minimum contrast of normal text (WCAG 1.4.3). */
export const AA_TEXT_RATIO = 4.5;
/** Minimum contrast of large text and of UI components (WCAG 1.4.3, 1.4.11). */
export const AA_UI_RATIO = 3;

const HEX_COLOR = /^#([0-9a-f]{6})$/i;
const RGBA_COLOR =
  /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*([0-9.]+)\s*)?\)$/i;

export function isHexColor(value: string): boolean {
  return HEX_COLOR.test(value);
}

/** Reads `#rrggbb` or `rgb()/rgba()`. Returns null for anything else. */
export function parseColor(value: string): Rgba | null {
  const text = value.trim();
  const hex = HEX_COLOR.exec(text);
  if (hex) {
    const n = parseInt(hex[1], 16);
    return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255, a: 1 };
  }
  const rgba = RGBA_COLOR.exec(text);
  if (rgba) {
    const [r, g, b] = [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const a = rgba[4] === undefined ? 1 : Number(rgba[4]);
    if (r > 255 || g > 255 || b > 255 || a < 0 || a > 1) {
      return null;
    }
    return { r, g, b, a };
  }
  return null;
}

function channelToHex(value: number): string {
  return Math.round(Math.min(255, Math.max(0, value)))
    .toString(16)
    .padStart(2, '0');
}

export function toHex(color: Pick<Rgba, 'r' | 'g' | 'b'>): string {
  return `#${channelToHex(color.r)}${channelToHex(color.g)}${channelToHex(color.b)}`.toUpperCase();
}

/** Paints `top` (with its alpha) over the opaque `bottom`. */
export function blend(top: Rgba, bottom: Rgba): Rgba {
  const a = top.a;
  return {
    r: top.r * a + bottom.r * (1 - a),
    g: top.g * a + bottom.g * (1 - a),
    b: top.b * a + bottom.b * (1 - a),
    a: 1,
  };
}

export function relativeLuminance(color: Rgba): number {
  const linear = (channel: number): number => {
    const c = channel / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * linear(color.r) + 0.7152 * linear(color.g) + 0.0722 * linear(color.b);
}

/** Contrast ratio 1..21. A translucent foreground is composed over `background` first. */
export function contrastRatio(foreground: string, background: string): number {
  const bg = parseColor(background);
  const fg = parseColor(foreground);
  if (!bg || !fg) {
    throw new Error(`Cannot compute the contrast of "${foreground}" on "${background}"`);
  }
  const fgOpaque = fg.a < 1 ? blend(fg, bg) : fg;
  const l1 = relativeLuminance(fgOpaque);
  const l2 = relativeLuminance(bg);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

interface Hsl {
  h: number;
  s: number;
  l: number;
}

function toHsl({ r, g, b }: Rgba): Hsl {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) {
    return { h: 0, s: 0, l };
  }
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h: number;
  if (max === rn) {
    h = (gn - bn) / d + (gn < bn ? 6 : 0);
  } else if (max === gn) {
    h = (bn - rn) / d + 2;
  } else {
    h = (rn - gn) / d + 4;
  }
  return { h: h * 60, s, l };
}

function fromHsl({ h, s, l }: Hsl): string {
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60
      ? [c, x, 0]
      : h < 120
        ? [x, c, 0]
        : h < 180
          ? [0, c, x]
          : h < 240
            ? [0, x, c]
            : h < 300
              ? [x, 0, c]
              : [c, 0, x];
  return toHex({ r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 });
}

/**
 * Moves the lightness of `color` in the given direction, in 1% steps, until it reaches `minRatio` on `background`.
 * Falls back to black or white (the extreme of that direction) when the hue cannot get there.
 */
export function ensureContrast(
  color: string,
  background: string,
  minRatio: number,
  direction: 'darker' | 'lighter',
): string {
  const rgba = parseColor(color);
  if (!rgba) {
    throw new Error(`Invalid colour "${color}"`);
  }
  let current = toHex(rgba);
  if (contrastRatio(current, background) >= minRatio) {
    return current;
  }
  const hsl = toHsl(rgba);
  const step = direction === 'darker' ? -0.01 : 0.01;
  for (let l = hsl.l + step; l >= 0 && l <= 1; l += step) {
    current = fromHsl({ ...hsl, l });
    if (contrastRatio(current, background) >= minRatio) {
      return current;
    }
  }
  return direction === 'darker' ? '#000000' : '#FFFFFF';
}

/** The text colour (near-black or white) that reads better on `background`; always >= 4.5:1 for any opaque colour. */
export function pickContrastText(background: string, dark = '#0B1120', light = '#FFFFFF'): string {
  const candidates = [light, dark, '#000000'];
  let best = candidates[0];
  for (const candidate of candidates) {
    if (contrastRatio(candidate, background) > contrastRatio(best, background)) {
      best = candidate;
    }
    if (contrastRatio(candidate, background) >= AA_TEXT_RATIO && candidate !== '#000000') {
      return candidate;
    }
  }
  return best;
}

function shiftLightness(color: string, delta: number): string {
  const rgba = parseColor(color);
  if (!rgba) {
    throw new Error(`Invalid colour "${color}"`);
  }
  const hsl = toHsl(rgba);
  return fromHsl({ ...hsl, l: Math.min(1, Math.max(0, hsl.l + delta)) });
}

/**
 * Computes hover, active, subtle and contrast-text tones of a brand colour for one theme. `surface` is the page
 * surface the colour is drawn on. Every pair of the result is checked against WCAG 2.2 AA (1.4.3 and 1.4.11).
 */
export function buildBrandTones(brand: string, mode: ThemeMode, surface: string): BrandTones {
  const parsed = parseColor(brand);
  if (!parsed || parsed.a !== 1) {
    throw new Error(`Invalid brand colour "${brand}"`);
  }
  const direction = mode === 'light' ? 'darker' : 'lighter';
  const sign = mode === 'light' ? -1 : 1;
  const surfaceRgba = parseColor(surface) as Rgba;

  // The base is used as link text and as outline: it must reach 4.5:1 on the surface.
  let base = ensureContrast(toHex(parsed), surface, AA_TEXT_RATIO, direction);

  // Subtle: 12% (light) / 22% (dark) of the base over the surface; the base must stay readable on it.
  const subtleOf = (color: string): string =>
    toHex(
      blend({ ...(parseColor(color) as Rgba), a: mode === 'light' ? 0.12 : 0.22 }, surfaceRgba),
    );
  // The subtle tint depends on the base, so the base moves away from the surface until the pair settles.
  for (let i = 0; i < 60 && contrastRatio(base, subtleOf(base)) < AA_TEXT_RATIO; i++) {
    base = shiftLightness(base, sign * 0.01);
  }
  const subtle = subtleOf(base);

  // Filled controls: one text colour for base, hover and active. Hover and active keep it readable (>= 4.5:1).
  const contrastText = pickContrastText(base);
  const tone = (delta: number): string => {
    const shifted = shiftLightness(base, sign * delta);
    return contrastRatio(contrastText, shifted) >= AA_TEXT_RATIO ? shifted : base;
  };

  return { base, hover: tone(0.07), active: tone(0.13), subtle, contrastText };
}
