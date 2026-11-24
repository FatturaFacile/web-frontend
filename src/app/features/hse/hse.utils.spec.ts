import { describe, expect, it } from 'vitest';
import { MatrixRow } from './hse.models';
import {
  CERTIFICATE_KEYS,
  certificateKey,
  daysUntil,
  isReportable,
  lightColor,
  lightKey,
  ppeColumns,
  reasonKey,
  trainingColumns,
} from './hse.utils';

const row = (overrides: Partial<MatrixRow>): MatrixRow => ({
  employee_id: 'e1',
  employee_name: 'Anna Verdi',
  department_id: null,
  trainings: {},
  medical: { light: 'GREEN', fitness_outcome: null, restrictions_summary: null, next_visit_due_date: null },
  ppe: {},
  overall: 'GREEN',
  is_hard_blocked: false,
  ...overrides,
});

describe('hse.utils', () => {
  it('maps a light to its translation key and tag colour', () => {
    expect(lightKey('YELLOW')).toBe('HSE.LIGHT_YELLOW');
    expect(lightColor('GREEN')).toBe('success');
    expect(lightColor('YELLOW')).toBe('warning');
    expect(lightColor('RED')).toBe('error');
  });

  it('maps a blocking reason code to its translation key', () => {
    expect(
      reasonKey({ code: 'medical_restriction_conflict', subject: 'medical_fitness', expires_at: null, detail: null }),
    ).toBe('HSE.REASON_MEDICAL_RESTRICTION_CONFLICT');
  });

  it('names every certificate type and falls back to the raw code of a custom one', () => {
    expect(Object.keys(CERTIFICATE_KEYS)).toHaveLength(13);
    expect(certificateKey('forklift_patentino_muletto')).toBe('HSE.CERT_FORKLIFT');
    expect(certificateKey('custom_code')).toBe('custom_code');
  });

  it('collects the distinct requirement columns of the rows in a stable order', () => {
    const rows = [
      row({ trainings: { b: { light: 'GREEN', expires_at: null, missing: false } }, ppe: { p2: { light: 'RED', replacement_due_at: null, missing: true } } }),
      row({
        employee_id: 'e2',
        trainings: { a: { light: 'RED', expires_at: null, missing: true }, b: { light: 'GREEN', expires_at: null, missing: false } },
        ppe: { p1: { light: 'GREEN', replacement_due_at: null, missing: false } },
      }),
    ];

    expect(trainingColumns(rows)).toEqual(['a', 'b']);
    expect(ppeColumns(rows)).toEqual(['p1', 'p2']);
  });

  it('counts the whole days to a date, negative once it passed', () => {
    const today = new Date(2027, 2, 1);

    expect(daysUntil('2027-03-31', today)).toBe(30);
    expect(daysUntil('2027-03-01', today)).toBe(0);
    expect(daysUntil('2027-02-27', today)).toBe(-2);
    expect(daysUntil(null, today)).toBeNull();
  });

  it('applies the statutory threshold of the jurisdiction to a first-aid injury', () => {
    expect(isReportable('near_miss', 'IT', 30)).toBe(false);
    expect(isReportable('first_aid_injury', 'IT', 1)).toBe(false);
    expect(isReportable('first_aid_injury', 'IT', 2)).toBe(true);
    expect(isReportable('first_aid_injury', 'CH', 3)).toBe(false);
    expect(isReportable('first_aid_injury', 'CH', 4)).toBe(true);
    expect(isReportable('lost_time_accident_inail_or_suva', 'CH', 0)).toBe(true);
    expect(isReportable('fatal_or_severe', 'IT', 0)).toBe(true);
  });
});
