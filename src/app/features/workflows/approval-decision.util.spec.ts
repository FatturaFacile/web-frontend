import { describe, expect, it } from 'vitest';
import { decisionInputError, decisionRequiresComment, slaColor, slaStateOf } from './approval-decision.util';

describe('approval decision util', () => {
  it('requires a comment for reject and request changes only', () => {
    expect(decisionRequiresComment('rejected')).toBe(true);
    expect(decisionRequiresComment('request_changes')).toBe(true);
    expect(decisionRequiresComment('approved')).toBe(false);
    expect(decisionRequiresComment('reassign')).toBe(false);
  });

  it('reports the validation error key of the dialog', () => {
    expect(decisionInputError('rejected', '  ', null)).toBe('workflows.decision.error.commentRequired');
    expect(decisionInputError('rejected', 'Over budget', null)).toBeNull();
    expect(decisionInputError('reassign', '', null)).toBe('workflows.decision.error.reassignRequired');
    expect(decisionInputError('reassign', '', 'u-2')).toBeNull();
    expect(decisionInputError('approved', '', null)).toBeNull();
  });

  it('derives the SLA state of a task', () => {
    expect(slaStateOf({ due_at: null, is_overdue: false, hours_remaining: null })).toBe('none');
    expect(slaStateOf({ due_at: '2026-12-01T10:00:00Z', is_overdue: true, hours_remaining: '-3' })).toBe('overdue');
    expect(slaStateOf({ due_at: '2026-12-01T10:00:00Z', is_overdue: false, hours_remaining: '4.5' })).toBe('due_soon');
    expect(slaStateOf({ due_at: '2026-12-01T10:00:00Z', is_overdue: false, hours_remaining: '40' })).toBe('on_track');
    expect(slaColor('overdue')).toBe('red');
  });
});
