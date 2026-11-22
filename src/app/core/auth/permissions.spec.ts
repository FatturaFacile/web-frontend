import { describe, expect, it } from 'vitest';
import { canAccessModule, MODULE_ACCESS } from '@core/auth/permissions';

describe('canAccessModule', () => {
  it('lets every member read modules open to any member', () => {
    expect(canAccessModule('crm', 'read', ['member'])).toBe(true);
    expect(canAccessModule('workspace', 'write', ['whatever'])).toBe(true);
  });

  it('limits writes to the roles listed by the module', () => {
    expect(canAccessModule('crm', 'write', ['sales'])).toBe(true);
    expect(canAccessModule('crm', 'write', ['member'])).toBe(false);
  });

  it('never lets read-only roles write, even where "member" would', () => {
    expect(canAccessModule('treasury', 'read', ['accountant_readonly'])).toBe(true);
    expect(canAccessModule('treasury', 'write', ['accountant_readonly'])).toBe(false);
    expect(canAccessModule('workspace', 'write', ['accountant_readonly'])).toBe(false);
  });

  it('keeps the read-only accountant out of health expenses', () => {
    expect(canAccessModule('health_expenses', 'read', ['accountant_readonly'])).toBe(false);
  });

  it('matches roles case-insensitively', () => {
    expect(canAccessModule('system', 'read', ['ADMIN'])).toBe(true);
  });

  it('opens access through per-user permissions and module grants', () => {
    expect(canAccessModule('hr', 'read', ['member'])).toBe(false);
    expect(canAccessModule('hr', 'read', ['member'], ['hr.read'])).toBe(true);
    expect(canAccessModule('hr', 'write', ['member'], ['hr.read'])).toBe(false);
    expect(canAccessModule('ledger', 'write', ['member'], ['gl.*'])).toBe(true);
    expect(canAccessModule('ledger', 'read', ['member'], ['gl.journals.post'])).toBe(true);
    expect(canAccessModule('ledger', 'write', ['member'], ['gl.journals.post'])).toBe(false);
    expect(canAccessModule('system', 'read', ['member'], ['*'])).toBe(true);
  });

  it('closes a module to a member with a deny permission, whatever the role says', () => {
    expect(canAccessModule('crm', 'read', ['member'], ['deny:crm'])).toBe(false);
    expect(canAccessModule('crm', 'write', ['sales'], ['deny:crm'])).toBe(false);
    expect(canAccessModule('crm', 'read', ['member'], ['*', 'deny:crm'])).toBe(false);
    expect(canAccessModule('invoicing', 'read', ['member'], ['deny:crm'])).toBe(true);
  });

  it('closes only the write access with deny:<module>.write', () => {
    expect(canAccessModule('crm', 'read', ['sales'], ['deny:crm.write'])).toBe(true);
    expect(canAccessModule('crm', 'write', ['sales'], ['deny:crm.write'])).toBe(false);
  });

  it('never locks an owner out with a deny permission', () => {
    expect(canAccessModule('system', 'read', ['owner'], ['deny:system'])).toBe(true);
  });

  it('denies unknown modules', () => {
    expect(canAccessModule('nope', 'read', ['owner'])).toBe(false);
  });

  it('declares both read and write for every module', () => {
    for (const [name, access] of Object.entries(MODULE_ACCESS)) {
      expect(access.read.length, name).toBeGreaterThan(0);
      expect(access.write.length, name).toBeGreaterThan(0);
    }
  });

  it('lets every member read the receivables but only credit managers write them', () => {
    expect(canAccessModule('receivables', 'read', ['sales'])).toBe(true);
    expect(canAccessModule('receivables', 'read', ['accountant_readonly'])).toBe(true);
    for (const role of ['owner', 'admin', 'accountant', 'sales_manager']) {
      expect(canAccessModule('receivables', 'write', [role]), role).toBe(true);
    }
    expect(canAccessModule('receivables', 'write', ['sales'])).toBe(false);
    expect(canAccessModule('receivables', 'write', ['accountant_readonly'])).toBe(false);
    expect(canAccessModule('receivables', 'write', ['warehouse'])).toBe(false);
  });
});
