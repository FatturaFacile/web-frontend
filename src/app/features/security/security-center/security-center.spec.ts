import { describe, expect, it } from 'vitest';
import { PgRetentionRule } from '@core';
import { nearestDsarDays, readinessLevel } from './posture-dashboard.component';
import { buildRetentionMatrix, retentionVerdict } from './retention-matrix.component';
import { SECURITY_CENTER_ROLES } from './security-center.model';

describe('posture helpers', () => {
  it('bands the readiness score', () => {
    expect(readinessLevel(90)).toBe('good');
    expect(readinessLevel(60)).toBe('fair');
    expect(readinessLevel(59)).toBe('poor');
  });

  it('counts the days to the nearest DSAR deadline, negative when overdue, null without one', () => {
    const now = new Date('2027-01-10T00:00:00Z').getTime();
    const posture = (due: string | null) => ({ active_dsar: { count: 1, nearest_due_at: due } });
    expect(nearestDsarDays(posture('2027-01-15T00:00:00Z'), now)).toBe(5);
    expect(nearestDsarDays(posture('2027-01-08T00:00:00Z'), now)).toBe(-2);
    expect(nearestDsarDays(posture(null), now)).toBeNull();
  });
});

describe('retention matrix', () => {
  const rule = (entity_class: string, retention_days: number): PgRetentionRule =>
    ({ entity_class, retention_days }) as PgRetentionRule;

  it('flags a rule that deletes earlier than the statutory period', () => {
    expect(retentionVerdict(3650, 10)).toBe('compliant');
    expect(retentionVerdict(1000, 10)).toBe('too_short');
    expect(retentionVerdict(null, 10)).toBe('not_configured');
    expect(retentionVerdict(30, null)).toBe('no_fixed_period');
  });

  it('joins the configured rules to the CH and IT statutory classes', () => {
    const rows = buildRetentionMatrix([rule('accounting_records', 1000)]);
    const accounting = rows.find((row) => row.entry.recordClass === 'accounting_records');
    expect(accounting).toMatchObject({ configuredDays: 1000, ch: 'too_short', it: 'too_short' });
    expect(rows.find((row) => row.entry.recordClass === 'vat_documents')?.ch).toBe(
      'not_configured',
    );
  });
});

describe('Security Center access', () => {
  it('admits the security roles', () => {
    expect(SECURITY_CENTER_ROLES).toEqual(
      expect.arrayContaining(['SecurityOfficer', 'DPO', 'TenantAdmin']),
    );
  });
});
