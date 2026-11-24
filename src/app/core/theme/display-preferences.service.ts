import { DOCUMENT } from '@angular/common';
import { effect, inject, Injectable, signal } from '@angular/core';

export type Density = 'compact' | 'comfortable';
export type BrandAccent = 'teal' | 'indigo' | 'purple' | 'amber';

export const DENSITIES: readonly Density[] = ['compact', 'comfortable'];
export const BRAND_ACCENTS: readonly BrandAccent[] = ['teal', 'indigo', 'purple', 'amber'];

const DENSITY_KEY = 'ff-density';
const BRAND_KEY = 'ff-brand';

function read<T extends string>(key: string, allowed: readonly T[], fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value as T) ? (value as T) : fallback;
  } catch {
    return fallback;
  }
}

function write(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable (private mode): the preference simply lasts for the session.
  }
}

/**
 * Per-user display preferences: interface density and brand accent colour. They are exposed as `data-density` and
 * `data-brand` on <html>; the design tokens (styles/_tokens.scss, styles/_brand.scss) react to those attributes, so
 * every component follows without code changes. The light/dark mode is handled by ThemeService.
 */
@Injectable({ providedIn: 'root' })
export class DisplayPreferencesService {
  private readonly document = inject(DOCUMENT);

  readonly density = signal<Density>(read(DENSITY_KEY, DENSITIES, 'compact'));
  readonly brand = signal<BrandAccent>(read(BRAND_KEY, BRAND_ACCENTS, 'teal'));

  constructor() {
    effect(() => {
      const root = this.document.documentElement;
      root.setAttribute('data-density', this.density());
      root.setAttribute('data-brand', this.brand());
    });
  }

  setDensity(density: Density): void {
    this.density.set(density);
    write(DENSITY_KEY, density);
  }

  setBrand(brand: BrandAccent): void {
    this.brand.set(brand);
    write(BRAND_KEY, brand);
  }

  reset(): void {
    this.setDensity('compact');
    this.setBrand('teal');
  }
}
