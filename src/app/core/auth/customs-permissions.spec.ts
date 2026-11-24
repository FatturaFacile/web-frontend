import { describe, expect, it } from 'vitest';
import { canManageCustoms } from './customs-permissions';

describe('canManageCustoms', () => {
  it('always allows owners and admins', () => {
    expect(canManageCustoms(['owner'])).toBe(true);
    expect(canManageCustoms(['Admin'], [])).toBe(true);
  });

  it('allows other roles only with the customs.manage slug or the wildcard', () => {
    expect(canManageCustoms(['accountant'], ['customs.manage'])).toBe(true);
    expect(canManageCustoms(['member'], ['*'])).toBe(true);
    expect(canManageCustoms(['accountant'], ['customs.view'])).toBe(false);
    expect(canManageCustoms(['member'])).toBe(false);
  });
});
