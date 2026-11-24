import { describe, expect, it } from 'vitest';
import { GovAction, GovHeatmapCell } from '@core';
import { govActionTargets } from './gov-action-list.component';
import { GOV_APPROVER_ROLES, GOV_MANAGER_ROLES, govHasAbility } from './governance-access.service';
import {
  GOV_ACTION_TRANSITIONS,
  GOV_AUDIT_TRANSITIONS,
  GOV_RISK_TRANSITIONS,
  govHeatmapRows,
  govOptions,
  govRatingColor,
  govRatingOfScore,
  govToday,
} from './governance.shared';
import { govDefaultFrameworks } from './obligations.component';

describe('governance shared helpers', () => {
  it('rates a likelihood x impact score in the bands of the API', () => {
    expect([1, 4, 5, 9, 10, 14, 15, 25].map(govRatingOfScore)).toEqual([
      'low',
      'low',
      'medium',
      'medium',
      'high',
      'high',
      'critical',
      'critical',
    ]);
    expect(govRatingColor('critical')).toBe('red');
    expect(govRatingColor(null)).toBe('default');
  });

  it('lays the heatmap out with likelihood 5 on top and impact 1 to 5 from the left', () => {
    const cells: GovHeatmapCell[] = [];
    for (let likelihood = 1; likelihood <= 5; likelihood++) {
      for (let impact = 5; impact >= 1; impact--) {
        cells.push({ likelihood, impact, score: likelihood * impact, rating: govRatingOfScore(likelihood * impact), count: 0 });
      }
    }

    const rows = govHeatmapRows(cells);

    expect(rows.length).toBe(5);
    expect(rows[0].map((cell) => `${cell.likelihood}-${cell.impact}`)).toEqual(['5-1', '5-2', '5-3', '5-4', '5-5']);
    expect(rows[4][0].likelihood).toBe(1);
  });

  it('builds select options whose labels are translation keys', () => {
    expect(govOptions('GOVERNANCE.SEVERITY', ['low', 'critical'] as const)).toEqual([
      { value: 'low', labelKey: 'GOVERNANCE.SEVERITY.LOW' },
      { value: 'critical', labelKey: 'GOVERNANCE.SEVERITY.CRITICAL' },
    ]);
  });

  it('formats today as the Y-m-d the API expects', () => {
    expect(govToday()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('mirrors the state machines of the API', () => {
    expect(GOV_RISK_TRANSITIONS.assessed).toEqual(['treating', 'accepted', 'closed']);
    expect(GOV_RISK_TRANSITIONS.closed).toEqual(['assessed']);
    expect(GOV_AUDIT_TRANSITIONS.closed).toEqual([]);
    expect(GOV_ACTION_TRANSITIONS.completed).toEqual(['verified', 'in_progress']);
  });

  it('opens an ability from the role or from the granted permission', () => {
    expect(govHasAbility(['accountant'], [], GOV_MANAGER_ROLES, 'manage')).toBe(true);
    expect(govHasAbility(['accountant'], [], GOV_APPROVER_ROLES, 'approve')).toBe(false);
    expect(govHasAbility(['sales'], ['governance.approve'], GOV_APPROVER_ROLES, 'approve')).toBe(true);
    expect(govHasAbility(['sales'], ['governance.manage'], GOV_APPROVER_ROLES, 'approve')).toBe(false);
    expect(govHasAbility(['member'], ['*'], GOV_MANAGER_ROLES, 'manage')).toBe(true);
  });

  it('preselects the frameworks of the jurisdiction for the templates', () => {
    expect(govDefaultFrameworks('CH')).toEqual(['fadp', 'iso_27001']);
    expect(govDefaultFrameworks('IT')).toContain('d_lgs_231');
  });
});

describe('govActionTargets', () => {
  const action = (status: GovAction['status']): GovAction => ({
    id: 'a-1',
    finding_id: 'f-1',
    code: 'ACT-2027-0001',
    title: 'Review accounts',
    owner_id: 'owner-1',
    due_date: '2027-08-01',
    status,
    is_overdue: false,
  });
  const member = { canManage: () => false, canApprove: () => false, userId: () => 'owner-1' };
  const manager = { canManage: () => true, canApprove: () => false, userId: () => 'someone' };
  const approver = { canManage: () => true, canApprove: () => true, userId: () => 'someone' };

  it('lets the owner of the action work on it but not verify it', () => {
    expect(govActionTargets(action('open'), member)).toEqual(['in_progress', 'completed', 'cancelled']);
    expect(govActionTargets(action('completed'), member)).toEqual([]);
  });

  it('keeps verification and rejection for the approvers', () => {
    expect(govActionTargets(action('completed'), manager)).toEqual([]);
    expect(govActionTargets(action('completed'), approver)).toEqual(['verified', 'in_progress']);
  });

  it('gives a stranger without rights nothing', () => {
    const stranger = { canManage: () => false, canApprove: () => false, userId: () => 'other' };

    expect(govActionTargets(action('open'), stranger)).toEqual([]);
    expect(govActionTargets(action('verified'), approver)).toEqual([]);
  });
});
