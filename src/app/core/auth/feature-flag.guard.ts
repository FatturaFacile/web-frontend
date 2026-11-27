import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

/**
 * Registry of premature / open-issue ERP modules mapped to their tracking GitHub issue numbers.
 * Used to gate unfinished vertical or enterprise modules behind explicit tenant/environment feature flags.
 */
export const PREMATURE_OPEN_ISSUE_MODULES: Readonly<
  Record<string, { issue: number; routePrefix: string }>
> = {
  credit_management: { issue: 253, routePrefix: '/credit-management' },
  supplier_portal: { issue: 254, routePrefix: '/supplier-portal' },
  manufacturing: { issue: 255, routePrefix: '/manufacturing' },
  plm: { issue: 256, routePrefix: '/plm' },
  quality: { issue: 257, routePrefix: '/quality' },
  wms: { issue: 258, routePrefix: '/wms' },
  transportation: { issue: 259, routePrefix: '/transportation' },
  customs: { issue: 260, routePrefix: '/customs' },
  rebates: { issue: 261, routePrefix: '/rebates' },
  configurator: { issue: 262, routePrefix: '/configurator' },
  facility: { issue: 263, routePrefix: '/facility' },
  fleet: { issue: 264, routePrefix: '/fleet' },
  sustainability: { issue: 265, routePrefix: '/sustainability' },
  governance: { issue: 266, routePrefix: '/governance' },
  contract_register: { issue: 267, routePrefix: '/contract-register' },
  talent_learning: { issue: 269, routePrefix: '/talent-learning' },
  business_intelligence: { issue: 270, routePrefix: '/business-intelligence' },
  marketplace: { issue: 272, routePrefix: '/marketplace' },
  document_trust: { issue: 273, routePrefix: '/document-trust' },
  digital_preservation: { issue: 212, routePrefix: '/digital-preservation' },
  forecasting: { issue: 221, routePrefix: '/ai-forecasting' },
  ocr_extraction: { issue: 220, routePrefix: '/ocr-inbox' },
  hse: { issue: 176, routePrefix: '/hse' },
  bi_dss: { issue: 214, routePrefix: '/analytics/executive-dss' },
  data_residency: { issue: 627, routePrefix: '/data-sovereignty' },
  kpi_dashboards: { issue: 217, routePrefix: '/kpi-dashboards' },
  ai_cognitive: { issue: 219, routePrefix: '/ai' },
  leases: { issue: 274, routePrefix: '/leases' },
  retail: { issue: 275, routePrefix: '/retail' },
  hospitality: { issue: 276, routePrefix: '/hospitality' },
  construction: { issue: 277, routePrefix: '/construction' },
  automotive: { issue: 278, routePrefix: '/automotive' },
  professionals: { issue: 279, routePrefix: '/professionals' },
  associations: { issue: 280, routePrefix: '/associations' },
  events: { issue: 282, routePrefix: '/events' },
  childcare: { issue: 283, routePrefix: '/childcare' },
  tessera_sanitaria: { issue: 299, routePrefix: '/tessera-sanitaria' },
  rent: { issue: 325, routePrefix: '/rent' },
  shift_planning: { issue: 173, routePrefix: '/shift-planning' },
  resource_planning: { issue: 188, routePrefix: '/resource-planning' },
  artisanal_gelato: { issue: 644, routePrefix: '/gelato' },
  italian_vat: { issue: 163, routePrefix: '/italian-vat' },
  swiss_vat: { issue: 164, routePrefix: '/swiss-vat' },
  leave_management: { issue: 174, routePrefix: '/leave-management' },
  agent_commissions: { issue: 338, routePrefix: '/agent-commissions' },
  expense_management: { issue: 166, routePrefix: '/expense-management' },
  debt_collection: { issue: 267, routePrefix: '/debt-collection' },
  marketing_automation: { issue: 401, routePrefix: '/marketing-automation' },
  electronic_signature: { issue: 211, routePrefix: '/signatures' },
  tender_management: { issue: 415, routePrefix: '/tender-management' },
  intercompany: { issue: 291, routePrefix: '/intercompany' },
  gdo_trade_terms: { issue: 477, routePrefix: '/gdo-trade-terms' },
  industrial_laundry: { issue: 423, routePrefix: '/industrial-laundry' },
  statutory_financials: { issue: 413, routePrefix: '/statutory-financials' },
  passenger_transport: { issue: 422, routePrefix: '/passenger-transport' },
  van_sales_and_field_force: { issue: 479, routePrefix: '/van-selling' },
  customer_satisfaction: { issue: 491, routePrefix: '/customer-satisfaction' },
  subcontracting: { issue: 270, routePrefix: '/subcontracting' },
  sales_bounded_context: { issue: 139, routePrefix: '/sales/omnichannel-pipeline' },
  franchise_network: { issue: 490, routePrefix: '/franchise-network' },
  corporate_conventions: { issue: 604, routePrefix: '/sales/corporate-conventions' },
  product_catalog: { issue: 248, routePrefix: '/product-catalog' },
  distribution: { issue: 271, routePrefix: '/distribution' },
};

/**
 * Checks whether a specific module feature flag is enabled for the active environment or tenant.
 */
export function isFeatureFlagEnabled(flagKey: string): boolean {
  try {
    const rawFlags =
      typeof localStorage !== 'undefined' ? localStorage.getItem('ff_feature_flags') : null;
    if (rawFlags) {
      const parsed = JSON.parse(rawFlags) as Record<string, boolean>;
      if (typeof parsed[flagKey] === 'boolean') {
        return parsed[flagKey];
      }
      if (typeof parsed['*'] === 'boolean') {
        return parsed['*'];
      }
    }
    const strictRelease =
      typeof localStorage !== 'undefined' &&
      localStorage.getItem('ff_release_strict_flags') === 'true';
    if (strictRelease && flagKey in PREMATURE_OPEN_ISSUE_MODULES) {
      return false;
    }
  } catch {
    // Ignore storage access errors in headless/SSR contexts
  }
  return true;
}

/**
 * Route guard that blocks navigation to premature / feature-flagged modules when disabled.
 */
export function featureFlagGuard(flagKey: string): CanActivateFn {
  return () => {
    if (isFeatureFlagEnabled(flagKey)) {
      return true;
    }
    return inject(Router).parseUrl('/');
  };
}
