import { describe, expect, it } from 'vitest';
import { isUrlOfEnabledMenuRoute } from './menu-enabled.guard';

describe('isUrlOfEnabledMenuRoute', () => {
  const enabled = ['/sales/invoices', '/crm/clients'];

  it('always allows the home page', () => {
    expect(isUrlOfEnabledMenuRoute('/dashboard', [])).toBe(true);
  });

  it('blocks every page when no menu entry is enabled', () => {
    expect(isUrlOfEnabledMenuRoute('/sales/invoices', [])).toBe(false);
  });

  it('allows an enabled route and its sub pages, ignoring query string and fragment', () => {
    expect(isUrlOfEnabledMenuRoute('/sales/invoices', enabled)).toBe(true);
    expect(isUrlOfEnabledMenuRoute('/sales/invoices/123?tab=1#top', enabled)).toBe(true);
  });

  it('blocks the routes of disabled entries, also with a shared prefix', () => {
    expect(isUrlOfEnabledMenuRoute('/sales/quotes', enabled)).toBe(false);
    expect(isUrlOfEnabledMenuRoute('/sales/invoices-archive', enabled)).toBe(false);
    expect(isUrlOfEnabledMenuRoute('/crm/suppliers', enabled)).toBe(false);
  });
});
