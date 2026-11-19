import { describe, expect, it } from 'vitest';
import { VALUATION_COSTING_PAGE } from './valuation-costing.page';

describe('VALUATION_COSTING_PAGE', () => {
  const tabs = VALUATION_COSTING_PAGE.tabs;

  it('has unique tab ids on the inventory module', () => {
    expect(new Set(tabs.map((tab) => tab.id)).size).toBe(tabs.length);
    expect(tabs.every((tab) => tab.module === 'inventory')).toBe(true);
  });

  it('uses API-relative paths', () => {
    const actions = tabs.flatMap((tab) => [tab.create, ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])]).filter((a) => !!a);
    for (const path of [...tabs.map((tab) => tab.list.path), ...actions.map((a) => a.path)]) {
      expect(path.startsWith('/')).toBe(true);
      expect(path.includes('/v1/')).toBe(false);
    }
  });

  it('covers valuation config, cost layers, landed costs, book exports and product charges', () => {
    expect(tabs.map((tab) => tab.list.path)).toEqual([
      '/inventory/valuation/config',
      '/inventory/valuation/cost-layers',
      '/inventory/landed-costs',
      '/inventory/book/exports',
      '/invoicing/product-charges',
    ]);
  });

  it('offers apply on drafts only and reverse on applied landed costs only', () => {
    const landed = tabs.find((tab) => tab.id === 'landed-costs');
    const apply = landed?.rowActions?.find((a) => a.path.endsWith('/apply'));
    const reverse = landed?.rowActions?.find((a) => a.path.endsWith('/reverse'));
    expect(apply?.visible?.({ status: 'draft' })).toBe(true);
    expect(apply?.visible?.({ status: 'applied' })).toBe(false);
    expect(reverse?.visible?.({ status: 'applied' })).toBe(true);
  });
});
