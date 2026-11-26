import { describe, expect, it } from 'vitest';
import { DelegationDraft, delegationPayload, delegationProblem, EMPTY_DELEGATION } from './delegations.util';

function draft(overrides: Partial<DelegationDraft> = {}): DelegationDraft {
  return {
    ...EMPTY_DELEGATION,
    delegateUserId: 'user-2',
    range: [new Date(2026, 11, 1), new Date(2026, 11, 15)],
    ...overrides,
  };
}

describe('delegations util', () => {
  it('accepts a complete delegation', () => {
    expect(delegationProblem(draft(), 'user-1')).toBeNull();
  });

  it('refuses a missing delegate, a self delegation and a missing period', () => {
    expect(delegationProblem(draft({ delegateUserId: null }), 'user-1')).toBe('workflows.delegations.error.delegateRequired');
    expect(delegationProblem(draft({ delegateUserId: 'user-1' }), 'user-1')).toBe('workflows.delegations.error.self');
    expect(delegationProblem(draft({ range: null }), 'user-1')).toBe('workflows.delegations.error.periodRequired');
  });

  it('accepts a one-day period and refuses an end before the start', () => {
    const day = new Date(2026, 11, 1);
    expect(delegationProblem(draft({ range: [day, new Date(2026, 11, 1, 23)] }), 'user-1')).toBeNull();
    expect(delegationProblem(draft({ range: [new Date(2026, 11, 5), day] }), 'user-1')).toBe('workflows.delegations.error.periodOrder');
  });

  it('refuses a cap that is not positive', () => {
    expect(delegationProblem(draft({ amountCap: 0 }), 'user-1')).toBe('workflows.delegations.error.cap');
  });

  it('builds the payload with Y-m-d dates and only the limits that are set', () => {
    expect(delegationPayload(draft())).toEqual({
      delegate_user_id: 'user-2',
      scope: 'all',
      starts_at: '2026-12-01',
      ends_at: '2026-12-15',
    });
    expect(delegationPayload(draft({ documentTypes: ['purchase_order'], amountCap: 5000, reason: ' Holiday ' }))).toMatchObject({
      document_types: ['purchase_order'],
      amount_cap: 5000,
      reason: 'Holiday',
    });
  });
});
