import type { CopilotContext } from './copilot.models';

const ID_SEGMENT = /^(?:\d+|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[0-9A-Z]{26})$/i;

/** Singularizes a route collection segment (`invoices` -> `invoice`, `companies` -> `company`). */
function singular(segment: string): string {
  if (segment.endsWith('ies')) return `${segment.slice(0, -3)}y`;
  if (segment.endsWith('ses')) return segment.slice(0, -2);
  if (segment.endsWith('s') && !segment.endsWith('ss')) return segment.slice(0, -1);

  return segment;
}

/** Derives the route and the viewed entity (`/sales/invoices/42` -> `invoice` `42`) from a router URL. */
export function contextFromUrl(url: string): CopilotContext {
  const path = url.split(/[?#]/)[0] || '/';
  const segments = path.split('/').filter(Boolean);
  const last = segments.at(-1);
  const previous = segments.at(-2);

  if (last !== undefined && previous !== undefined && ID_SEGMENT.test(last) && !ID_SEGMENT.test(previous)) {
    return { route: path, entity_type: singular(previous.toLowerCase()).replace(/-/g, '_'), entity_id: last };
  }

  return { route: path, entity_type: null, entity_id: null };
}

/** Starter prompt translation keys for the area of the current route. */
export function starterPromptKeys(route: string, role: string | null | undefined): string[] {
  const area = route.split('/').filter(Boolean)[0] ?? 'dashboard';
  const base: Record<string, string[]> = {
    sales: ['COPILOT.STARTER.SALES_OVERDUE', 'COPILOT.STARTER.SALES_TOP_CUSTOMERS'],
    accounting: ['COPILOT.STARTER.ACCOUNTING_VAT', 'COPILOT.STARTER.REGULATORY_INVOICE'],
    treasury: ['COPILOT.STARTER.TREASURY_LIQUIDITY'],
    crm: ['COPILOT.STARTER.CRM_OPEN_DEALS'],
    inventory: ['COPILOT.STARTER.INVENTORY_LOW_STOCK'],
    purchases: ['COPILOT.STARTER.PURCHASES_OPEN_ORDERS'],
  };
  const keys = [...(base[area] ?? ['COPILOT.STARTER.GENERIC_SUMMARY'])];
  const normalizedRole = (role ?? '').toLowerCase();

  if (/account|admin|finance|cfo/.test(normalizedRole)) {
    keys.push('COPILOT.STARTER.ROLE_ACCOUNTANT');
  } else if (/sales|crm|commercial/.test(normalizedRole)) {
    keys.push('COPILOT.STARTER.ROLE_SALES');
  }
  keys.push('COPILOT.STARTER.REGULATORY_VAT_CH');

  return [...new Set(keys)].slice(0, 4);
}
