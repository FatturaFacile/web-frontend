import { HttpErrorResponse } from '@angular/common/http';
import { describe, expect, it } from 'vitest';
import { CsKpis, CsTrendRow } from '@core';
import {
  bandOf,
  errorKey,
  failureOf,
  formatKpi,
  npsColor,
  polyline,
  promptKeyOf,
  reportFilename,
  scaleOf,
  scoreRange,
  slaCountdown,
  trendPoints,
} from './customer-satisfaction.util';

describe('customer satisfaction util', () => {
  it('knows the scale of every instrument', () => {
    expect(scaleOf('nps')).toEqual({ min: 0, max: 10 });
    expect(scaleOf('csat')).toEqual({ min: 1, max: 5 });
    expect(scaleOf('ces')).toEqual({ min: 1, max: 7 });
    expect(scoreRange('nps')).toHaveLength(11);
    expect(scoreRange('csat')).toEqual([1, 2, 3, 4, 5]);
  });

  it('bands scores like the API: promoters 9-10, passives 7-8, detractors 0-6', () => {
    expect(bandOf('nps', 10)).toBe('promoter');
    expect(bandOf('nps', 9)).toBe('promoter');
    expect(bandOf('nps', 8)).toBe('passive');
    expect(bandOf('nps', 7)).toBe('passive');
    expect(bandOf('nps', 6)).toBe('detractor');
    expect(bandOf('nps', 0)).toBe('detractor');
    expect(bandOf('csat', 5)).toBe('satisfied');
    expect(bandOf('csat', 3)).toBe('neutral');
    expect(bandOf('csat', 2)).toBe('dissatisfied');
    expect(bandOf('ces', 2)).toBe('satisfied');
    expect(bandOf('ces', 4)).toBe('neutral');
    expect(bandOf('ces', 6)).toBe('dissatisfied');
  });

  it('picks the follow-up question of a band: the good, the middle or the bad answer', () => {
    expect(promptKeyOf('promoter')).toBe('high');
    expect(promptKeyOf('satisfied')).toBe('high');
    expect(promptKeyOf('passive')).toBe('mid');
    expect(promptKeyOf('neutral')).toBe('mid');
    expect(promptKeyOf('detractor')).toBe('low');
    expect(promptKeyOf('dissatisfied')).toBe('low');
  });

  it('formats KPIs and colours the NPS', () => {
    expect(formatKpi(null)).toBe('—');
    expect(formatKpi(42.456)).toBe('42.5');
    expect(formatKpi(3.5, 2)).toBe('3.50');
    expect(npsColor(null)).toBe('default');
    expect(npsColor(60)).toBe('green');
    expect(npsColor(10)).toBe('gold');
    expect(npsColor(-5)).toBe('red');
  });

  it('turns a problem into the dictionary key of its code and keeps the field errors', () => {
    const error = new HttpErrorResponse({
      status: 422,
      error: {
        code: 'resolution_requires_root_cause',
        detail: 'Root cause needed',
        errors: { root_cause_code: ['Required'] },
        params: { from: 'open', skip: { nested: true } },
      },
    });

    const outcome = failureOf(error);

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('customerSatisfaction.error.resolution_requires_root_cause');
    expect(outcome.detail).toBe('Required');
    expect(outcome.params).toEqual({ from: 'open' });
    expect(failureOf(new Error('boom')).errorKey).toBe(errorKey(null));
  });

  it('counts down the 24 hour SLA of an open case and flags a breach', () => {
    const now = new Date('2026-11-25T12:00:00Z');

    expect(slaCountdown('2026-11-26T08:30:00Z', now, 'open')).toEqual({
      level: 'ok',
      hours: 20,
      minutes: 30,
    });
    expect(slaCountdown('2026-11-25T16:00:00Z', now, 'open')?.level).toBe('warning');
    expect(slaCountdown('2026-11-25T10:15:00Z', now, 'in_progress')).toEqual({
      level: 'breached',
      hours: 1,
      minutes: 45,
    });
    expect(slaCountdown('2026-11-25T10:15:00Z', now, 'resolved')).toBeNull();
    expect(slaCountdown('2026-11-25T10:15:00Z', now, 'open', '2026-11-25T09:00:00Z')).toBeNull();
  });

  it('plots a KPI over time and skips the periods without data', () => {
    const row = (bucket: string, score: number | null) =>
      ({ bucket, nps: { score } }) as unknown as CsTrendRow;
    const rows = [row('2026-09', 20), row('2026-10', null), row('2026-11', 60)];

    const points = trendPoints(rows, (kpis: CsKpis) => kpis.nps.score, -100, 100, 200, 100);

    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ label: '2026-09', x: 0 });
    expect(points[1].x).toBe(200);
    expect(points[0].y).toBeGreaterThan(points[1].y);
    expect(polyline(points)).toMatch(/^0\.0,\d+\.\d \d+\.\d,\d+\.\d$/);
  });

  it('names the exported file after the report', () => {
    expect(reportFilename('Riesame 2026 — Q4', 'csv')).toBe('riesame-2026-q4.csv');
    expect(reportFilename('***', 'html')).toBe('iso-9001-report.html');
  });
});
