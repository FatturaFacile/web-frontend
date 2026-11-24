import { HttpErrorResponse } from '@angular/common/http';
import { GelatoIndicator, GelatoLocale, GelatoLocalizedName, GelatoStatus } from '@core';

/** Traffic-light colour of a gauge status: green, yellow, red. */
export function statusColor(status: GelatoStatus): 'green' | 'gold' | 'red' {
  return status === 'OPTIMAL' ? 'green' : status === 'WARNING' ? 'gold' : 'red';
}

/**
 * Position of a value on a gauge as a percentage: the optimal band sits in the middle third, so a value at the
 * band minimum is at 33 % and at the band maximum at 67 %; the result is clamped to 0-100.
 */
export function gaugePercent(indicator: Pick<GelatoIndicator, 'value' | 'min' | 'max'>): number {
  const span = indicator.max - indicator.min || 1;
  const raw = ((indicator.value - indicator.min) / span) * (100 / 3) + 100 / 3;
  return Math.max(0, Math.min(100, Math.round(raw * 10) / 10));
}

/** Name in the language, falling back to English and then to any available one. */
export function localizedName(name: GelatoLocalizedName | null | undefined, locale: GelatoLocale): string {
  if (!name) return '';
  return name[locale] || name.en || Object.values(name)[0] || '';
}

/** Message of a problem-details error, or the fallback. */
export function gelatoProblem(error: unknown, fallback: string): string {
  if (error instanceof HttpErrorResponse) {
    const detail = (error.error as { detail?: string } | null)?.detail;
    if (detail) return detail;
  }
  return fallback;
}

/** Sum of the grams of the lines that have an ingredient. */
export function totalGrams(lines: readonly { grams: number }[]): number {
  return Math.round(lines.reduce((sum, line) => sum + (Number(line.grams) || 0), 0) * 1000) / 1000;
}

/** The lines of a recipe scaled to a new batch weight (grams rounded to 0.01). */
export function scaleLines<T extends { grams: number }>(lines: readonly T[], batchWeight: number): T[] {
  const total = totalGrams(lines);
  if (total <= 0 || batchWeight <= 0) return [...lines];
  const factor = batchWeight / total;
  return lines.map((line) => ({ ...line, grams: Math.round(line.grams * factor * 100) / 100 }));
}

/** Points of the freezing curve as an SVG polyline (width x height box, ice share on the vertical axis). */
export function curvePolyline(
  curve: readonly { temperature_celsius: number; ice_fraction_of_freezable_water: number }[],
  width: number,
  height: number,
): string {
  if (curve.length < 2) return '';
  const sorted = [...curve].sort((a, b) => b.temperature_celsius - a.temperature_celsius);
  const step = width / (sorted.length - 1);
  return sorted
    .map((p, i) => `${Math.round(i * step * 10) / 10},${Math.round((1 - p.ice_fraction_of_freezable_water) * height * 10) / 10}`)
    .join(' ');
}

/** URL of the public QR menu of a location (the book of one language). */
export function qrMenuUrl(origin: string, locationKey: string, locale: GelatoLocale): string {
  return `${origin}/gelato/showcase?location=${encodeURIComponent(locationKey)}&locale=${locale}`;
}
