import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import {
  addDays,
  contactName,
  counterPercent,
  counterStatus,
  dosageUnitKey,
  errorKey,
  failureOf,
  isoDay,
  isReEntryActive,
  licenseColor,
  licenseState,
  mondayOf,
  passageLabel,
  polygonFromText,
  polygonToText,
  reEntryUntil,
  svgGeometry,
  toNumber,
  weekDays,
  withholdingPreview,
} from './green-care.util';

const counter = (completed: number, included: number) => ({
  completed,
  included,
  extra: Math.max(0, completed - included),
  is_over_included: completed > included,
  percent: included > 0 ? (completed / included) * 100 : 0,
});

describe('green care util', () => {
  it('builds the error key from the code of the problem and falls back to unknown', () => {
    expect(errorKey('operator_license_expired')).toBe('greenCare.error.operator_license_expired');
    expect(errorKey(null)).toBe('greenCare.error.unknown');
  });

  it('turns a failed call into a translated outcome with the placeholders', () => {
    const outcome = failureOf(
      new HttpErrorResponse({
        status: 422,
        error: { code: 'operator_license_expired', context: { expiry_date: '2026-03-01', note: null } },
      }),
    );

    expect(outcome).toEqual({
      ok: false,
      errorKey: 'greenCare.error.operator_license_expired',
      code: 'operator_license_expired',
      params: { expiry_date: '2026-03-01', note: '' },
    });
    expect(failureOf(new Error('boom')).errorKey).toBe('greenCare.error.unknown');
  });

  it('counts passages: within the contract, at the limit and beyond it (passage 17 of 16)', () => {
    expect(passageLabel(counter(8, 16))).toEqual({
      key: 'greenCare.passage.within',
      params: { current: 8, included: 16, extra: 0 },
    });
    expect(counterStatus(counter(8, 16))).toBe('active');
    expect(counterStatus(counter(16, 16))).toBe('success');
    expect(passageLabel(counter(17, 16)).key).toBe('greenCare.passage.extra');
    expect(passageLabel(counter(17, 16)).params['extra']).toBe(1);
    expect(counterStatus(counter(17, 16))).toBe('exception');
    expect(counterPercent(counter(17, 16))).toBe(100);
    expect(counterPercent(counter(4, 16))).toBe(25);
    expect(counterPercent(counter(0, 0))).toBe(0);
  });

  it('classifies a licence: valid, expiring within 30 days, expired', () => {
    expect(licenseState(200, true)).toBe('valid');
    expect(licenseState(30, true)).toBe('expiring');
    expect(licenseState(-1, true)).toBe('expired');
    expect(licenseState(100, false)).toBe('expired');
    expect([licenseColor('valid'), licenseColor('expiring'), licenseColor('expired')]).toEqual([
      'green',
      'orange',
      'red',
    ]);
  });

  it('computes the 4% condominium withholding of a net taxable base', () => {
    const preview = withholdingPreview(1000, 4);

    expect(preview.base).toBe(1000);
    expect(preview.amount).toBe(40);
    expect(preview.netPayable(220)).toBe(1180);
    expect(withholdingPreview(333.33, 4).amount).toBe(13.33);
  });

  it('works on calendar days: Monday of the week, the seven days, local ISO day', () => {
    const wednesday = new Date(2026, 5, 10);

    expect(isoDay(mondayOf(wednesday))).toBe('2026-06-08');
    expect(isoDay(mondayOf(new Date(2026, 5, 14)))).toBe('2026-06-08');
    expect(weekDays(mondayOf(wednesday))).toHaveLength(7);
    expect(weekDays(mondayOf(wednesday))[6]).toBe('2026-06-14');
    expect(isoDay(addDays(new Date(2026, 11, 31), 1))).toBe('2027-01-01');
  });

  it('works out the re-entry interval of a treatment', () => {
    const until = reEntryUntil('2026-06-10', 48);

    expect(until?.getTime()).toBe(new Date(2026, 5, 12).getTime());
    expect(reEntryUntil('2026-06-10', 0)).toBeNull();
    expect(isReEntryActive('2026-06-10', 48, new Date(2026, 5, 11))).toBe(true);
    expect(isReEntryActive('2026-06-10', 48, new Date(2026, 5, 13))).toBe(false);
  });

  it('projects a polygon into the SVG viewbox and falls back to a centred marker for a point', () => {
    const square = {
      type: 'Polygon' as const,
      coordinates: [
        [
          [8.95, 46.0],
          [8.96, 46.0],
          [8.96, 46.01],
          [8.95, 46.01],
          [8.95, 46.0],
        ],
      ],
    };
    const shape = svgGeometry(square, null, null, 200, 10);

    expect(shape.points.split(' ')).toHaveLength(5);
    expect(shape.marker).not.toBeNull();
    expect(svgGeometry(null, 46, 8.9).marker).toEqual({ x: 100, y: 100 });
    expect(svgGeometry(null, null, null)).toEqual({ points: '', marker: null });
  });

  it('turns typed vertices into a closed GeoJSON ring and back', () => {
    const polygon = polygonFromText('46.0, 8.95\n46.0, 8.96\n46.01, 8.96');

    expect(polygon?.coordinates[0]).toHaveLength(4);
    expect(polygon?.coordinates[0][0]).toEqual([8.95, 46.0]);
    expect(polygonToText(polygon)).toBe('46, 8.95\n46, 8.96\n46.01, 8.96');
    expect(polygonFromText('46.0, 8.95')).toBeNull();
  });

  it('names contacts and converts numbers and units', () => {
    expect(contactName({ company_name: 'Condominio Verdi', first_name: null, last_name: null })).toBe(
      'Condominio Verdi',
    );
    expect(contactName({ company_name: null, first_name: 'Anna', last_name: 'Rossi' })).toBe('Anna Rossi');
    expect(toNumber('12.5')).toBe(12.5);
    expect(toNumber(null)).toBe(0);
    expect(dosageUnitKey('g/100sqm')).toBe('g_100sqm');
  });
});
