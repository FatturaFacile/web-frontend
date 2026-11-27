import { HttpErrorResponse } from '@angular/common/http';
import {
  ContactResource,
  GcBillingStatus,
  GcContractStatus,
  GcGeoPolygon,
  GcPassageCounter,
  GcProblem,
  GcRouteStatus,
  GcWeatherAlert,
} from '@core';

/** Module key of the access map (`MODULE_ACCESS`). */
export const GREEN_CARE_MODULE = 'green_care';

/** What a store write answers: the screens show the translated error. */
export interface GcOutcome {
  ok: boolean;
  /** Translation key of the refusal (`greenCare.error.<code>`), null on success. */
  errorKey: string | null;
  code: string | null;
  params: Record<string, string>;
}

export const GC_OK: GcOutcome = { ok: true, errorKey: null, code: null, params: {} };

export function errorKey(code: string | null | undefined): string {
  return `greenCare.error.${code ? code : 'unknown'}`;
}

export function problemOf(error: unknown): GcProblem | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }
  const body: unknown = error.error;
  return body !== null && typeof body === 'object' ? (body as GcProblem) : null;
}

/** The outcome of a failed call: the `code` of the problem picks the key, its context fills the placeholders. */
export function failureOf(error: unknown): GcOutcome {
  const problem = problemOf(error);
  const params: Record<string, string> = {};
  for (const [key, value] of Object.entries(problem?.context ?? {})) {
    params[key] = value === null || value === undefined ? '' : String(value);
  }
  return { ok: false, errorKey: errorKey(problem?.code), code: problem?.code ?? null, params };
}

export function toNumber(value: number | string | null | undefined): number {
  const parsed = typeof value === 'number' ? value : Number.parseFloat(String(value ?? ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

/** `YYYY-MM-DD` of a date in local time (the API stores calendar days, not instants). */
export function isoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function parseDay(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month ?? 1) - 1, day ?? 1);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  copy.setDate(copy.getDate() + days);
  return copy;
}

/** Monday of the week of a date. */
export function mondayOf(date: Date): Date {
  const offset = (date.getDay() + 6) % 7;
  return addDays(date, -offset);
}

/** The seven days (Monday to Sunday) of the week that starts on `monday`. */
export function weekDays(monday: Date): string[] {
  return Array.from({ length: 7 }, (_, index) => isoDay(addDays(monday, index)));
}

/** Passage counter of a contract: "Passage 8 of 16", and "17 of 16 - extra to invoice" beyond the included passages. */
export function passageLabel(counter: GcPassageCounter): { key: string; params: Record<string, number> } {
  const params = { current: counter.completed, included: counter.included, extra: counter.extra };
  return { key: counter.is_over_included ? 'greenCare.passage.extra' : 'greenCare.passage.within', params };
}

/** Progress bar status of the passage counter: red beyond the included passages, green when done, else active. */
export function counterStatus(counter: GcPassageCounter): 'exception' | 'success' | 'active' {
  if (counter.is_over_included) {
    return 'exception';
  }
  return counter.included > 0 && counter.completed >= counter.included ? 'success' : 'active';
}

/** Percent of the bar, never above 100. */
export function counterPercent(counter: GcPassageCounter): number {
  if (counter.included <= 0) {
    return counter.completed > 0 ? 100 : 0;
  }
  return Math.min(100, Math.round((counter.completed / counter.included) * 100));
}

export function contractStatusColor(status: GcContractStatus | null | undefined): string {
  switch (status) {
    case 'active':
      return 'green';
    case 'suspended':
      return 'orange';
    case 'expired':
      return 'red';
    case 'renewed':
      return 'cyan';
    default:
      return 'default';
  }
}

export function weatherColor(alert: GcWeatherAlert | null | undefined): string {
  switch (alert) {
    case 'rain_warning':
      return 'blue';
    case 'frost_alert':
      return 'geekblue';
    case 'rescheduled_due_to_weather':
      return 'orange';
    default:
      return 'green';
  }
}

export function routeStatusColor(status: GcRouteStatus | null | undefined): string {
  switch (status) {
    case 'completed':
      return 'green';
    case 'in_progress':
      return 'blue';
    case 'postponed':
      return 'orange';
    default:
      return 'default';
  }
}

export function billingStatusColor(status: GcBillingStatus | null | undefined): string {
  switch (status) {
    case 'ready_to_invoice':
      return 'gold';
    case 'invoiced':
      return 'green';
    case 'included_in_contract':
      return 'cyan';
    default:
      return 'default';
  }
}

export type LicenseState = 'valid' | 'expiring' | 'expired';

/** A licence expiring within 30 days is flagged, an expired one blocks the treatment. */
export function licenseState(daysToExpiry: number | null | undefined, valid: boolean): LicenseState {
  const known = daysToExpiry !== null && daysToExpiry !== undefined;
  if (!valid || (known && daysToExpiry < 0)) {
    return 'expired';
  }
  return known && daysToExpiry <= 30 ? 'expiring' : 'valid';
}

export function licenseColor(state: LicenseState): string {
  return state === 'valid' ? 'green' : state === 'expiring' ? 'orange' : 'red';
}

/** Instant until which the treated surface must not be entered. */
export function reEntryUntil(treatmentDate: string, hours: number | null | undefined): Date | null {
  if (hours === null || hours === undefined || hours <= 0 || treatmentDate === '') {
    return null;
  }
  const start = parseDay(treatmentDate);
  return new Date(start.getTime() + hours * 3_600_000);
}

export function isReEntryActive(
  treatmentDate: string,
  hours: number | null | undefined,
  now: Date = new Date(),
): boolean {
  const until = reEntryUntil(treatmentDate, hours);
  return until !== null && until.getTime() > now.getTime();
}

const round2 = (value: number): number => Math.round((value + Number.EPSILON) * 100) / 100;

/** Withholding preview of the invoice: percent of the net taxable base (Art. 25-ter DPR 600/73 for condominiums). */
export function withholdingPreview(
  net: number,
  percent: number,
): { base: number; amount: number; netPayable: (vat: number) => number } {
  const base = round2(net);
  const amount = round2((base * percent) / 100);
  return { base, amount, netPayable: (vat: number) => round2(base + vat - amount) };
}

export function contactName(contact: Pick<ContactResource, 'company_name' | 'first_name' | 'last_name'>): string {
  const company = (contact.company_name ?? '').trim();
  if (company !== '') {
    return company;
  }
  return `${contact.first_name ?? ''} ${contact.last_name ?? ''}`.trim() || '-';
}

export interface SvgGeometry {
  /** SVG `points` of the polygon ring, empty without a polygon. */
  points: string;
  /** Position of the site centre in the viewbox, null without any coordinate. */
  marker: { x: number; y: number } | null;
}

/**
 * Projects the polygon (GeoJSON `[lng, lat]`) or the single point of a site into a square SVG viewbox with an equirectangular
 * projection (longitude scaled by cos(lat)); enough for a site-sized preview without a map library.
 */
export function svgGeometry(
  polygon: GcGeoPolygon | null,
  latitude: number | null,
  longitude: number | null,
  size = 200,
  padding = 12,
): SvgGeometry {
  const ring = polygon?.coordinates?.[0] ?? [];
  const hasPolygon = ring.length >= 3;

  if (!hasPolygon) {
    return { points: '', marker: latitude !== null && longitude !== null ? { x: size / 2, y: size / 2 } : null };
  }

  const meanLat = ring.reduce((sum, [, lat]) => sum + lat, 0) / ring.length;
  const scaleX = Math.cos((meanLat * Math.PI) / 180);
  const projected = ring.map(([lng, lat]) => ({ x: lng * scaleX, y: -lat }));
  const xs = projected.map((p) => p.x);
  const ys = projected.map((p) => p.y);
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  const width = Math.max(...xs) - minX;
  const height = Math.max(...ys) - minY;
  const inner = size - padding * 2;
  const scale = inner / Math.max(width, height, 1e-9);
  const placed = projected.map((p) => ({
    x: round2(padding + (p.x - minX) * scale + (inner - width * scale) / 2),
    y: round2(padding + (p.y - minY) * scale + (inner - height * scale) / 2),
  }));

  return {
    points: placed.map((p) => `${p.x},${p.y}`).join(' '),
    marker: {
      x: round2(placed.reduce((sum, p) => sum + p.x, 0) / placed.length),
      y: round2(placed.reduce((sum, p) => sum + p.y, 0) / placed.length),
    },
  };
}

/** Builds a closed GeoJSON polygon from `lat, lng` lines typed by the user (one vertex per line). */
export function polygonFromText(text: string): GcGeoPolygon | null {
  const vertices = text
    .split(/\r?\n/)
    .map((line) =>
      line
        .split(/[;,\s]+/)
        .filter((part) => part !== '')
        .map(Number),
    )
    .filter((parts) => parts.length === 2 && parts.every(Number.isFinite))
    .map(([lat, lng]) => [lng, lat]);

  if (vertices.length < 3) {
    return null;
  }
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  return {
    type: 'Polygon',
    coordinates: [first[0] === last[0] && first[1] === last[1] ? vertices : [...vertices, first]],
  };
}

export function polygonToText(polygon: GcGeoPolygon | null): string {
  const ring = polygon?.coordinates?.[0] ?? [];
  const closed = ring.length > 1 && ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1];
  return (closed ? ring.slice(0, -1) : ring).map(([lng, lat]) => `${lat}, ${lng}`).join('\n');
}

/** Saves a downloaded file through the browser (PDF export). */
export function saveBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function dosageUnitKey(unit: string): string {
  return unit.replace(/\//g, '_');
}
