import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  curvePolyline,
  gaugePercent,
  gelatoProblem,
  localizedName,
  qrMenuUrl,
  scaleLines,
  statusColor,
  totalGrams,
} from './gelato.util';

describe('gelato.util', () => {
  it('maps the status to a traffic light colour', () => {
    expect(statusColor('OPTIMAL')).toBe('green');
    expect(statusColor('WARNING')).toBe('gold');
    expect(statusColor('OUT_OF_RANGE')).toBe('red');
  });

  it('places the optimal band in the middle third of the gauge', () => {
    expect(gaugePercent({ value: 160, min: 160, max: 220 })).toBeCloseTo(33.3, 1);
    expect(gaugePercent({ value: 220, min: 160, max: 220 })).toBeCloseTo(66.7, 1);
    expect(gaugePercent({ value: 1000, min: 160, max: 220 })).toBe(100);
    expect(gaugePercent({ value: -500, min: 160, max: 220 })).toBe(0);
  });

  it('falls back to English and to any language for names', () => {
    const name = { it: '', en: 'Milk', de: 'Milch', fr: '' };
    expect(localizedName(name, 'de')).toBe('Milch');
    expect(localizedName(name, 'it')).toBe('Milk');
    expect(localizedName(null, 'fr')).toBe('');
  });

  it('reads the detail of a problem-details error', () => {
    const error = new HttpErrorResponse({ status: 422, error: { detail: 'HACCP must pass' } });
    expect(gelatoProblem(error, 'x')).toBe('HACCP must pass');
    expect(gelatoProblem(new Error('boom'), 'fallback')).toBe('fallback');
  });

  it('sums and scales the lines to a batch weight', () => {
    const lines = [{ grams: 600 }, { grams: 400 }];
    expect(totalGrams(lines)).toBe(1000);
    expect(scaleLines(lines, 3500).map((l) => l.grams)).toEqual([2100, 1400]);
    expect(scaleLines(lines, 0)).toEqual(lines);
  });

  it('draws the freezing curve from the warmest to the coldest point', () => {
    const polyline = curvePolyline(
      [
        { temperature_celsius: -18, ice_fraction_of_freezable_water: 0.9 },
        { temperature_celsius: -10, ice_fraction_of_freezable_water: 0.7 },
      ],
      100,
      50,
    );
    expect(polyline).toBe('0,15 100,5');
  });

  it('builds the QR menu url', () => {
    expect(qrMenuUrl('https://erp.test', 'main shop', 'de')).toBe(
      'https://erp.test/gelato/showcase?location=main%20shop&locale=de',
    );
  });
});
