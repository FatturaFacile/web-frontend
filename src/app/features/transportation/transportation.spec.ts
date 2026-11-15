import { describe, expect, it } from 'vitest';
import { TMS_AUDIT_PAGE, TMS_CARRIERS_PAGE, TMS_ORDERS_PAGE, TMS_QUOTES_PAGE, TMS_TRIPS_PAGE } from './transportation.pages';
import { TRANSPORTATION_ROUTES } from './transportation.routes';

const PAGES = [TMS_CARRIERS_PAGE, TMS_ORDERS_PAGE, TMS_TRIPS_PAGE, TMS_QUOTES_PAGE, TMS_AUDIT_PAGE];

describe('Transportation screens', () => {
  it('every panel works inside the transportation API under the transportation module', () => {
    for (const page of PAGES) {
      for (const tab of page.tabs) {
        expect(tab.module).toBe('transportation');
        expect(tab.list.path === '' || tab.list.path.startsWith('/transportation/')).toBe(true);
        for (const action of [tab.create, ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])]) {
          if (action) {
            expect(action.path.startsWith('/transportation/')).toBe(true);
          }
        }
      }
    }
  });

  it('sends the payload fields the API FormRequests validate', () => {
    const keys = (fields?: readonly { key: string }[]) => fields?.map((field) => field.key);
    expect(keys(TMS_CARRIERS_PAGE.tabs[0].create?.fields)).toEqual(['code', 'name', 'mode', 'service_level', 'currency', 'is_active', 'notes']);
    expect(keys(TMS_AUDIT_PAGE.tabs[0].create?.fields)).toEqual(['carrier_id', 'invoice_number', 'invoice_date', 'currency', 'notes', 'lines']);
    const lines = TMS_AUDIT_PAGE.tabs[0].create?.fields?.find((field) => field.key === 'lines');
    expect(keys(lines?.fields)).toEqual(['transport_order_id', 'description', 'billed_amount']);
  });

  it('offers the dispute only for an audited invoice that is contested, and the resolution only while it is open', () => {
    const actions = TMS_AUDIT_PAGE.tabs[0].rowActions ?? [];
    const dispute = actions.find((action) => action.path.endsWith('/dispute'));
    const resolve = actions.find((action) => action.path.endsWith('/resolve-dispute'));
    expect(dispute?.visible?.({ dispute_status: 'none', audit_status: 'over_billed' })).toBe(true);
    expect(dispute?.visible?.({ dispute_status: 'none', audit_status: 'matched' })).toBe(false);
    expect(dispute?.visible?.({ dispute_status: 'open', audit_status: 'over_billed' })).toBe(false);
    expect(resolve?.visible?.({ dispute_status: 'open' })).toBe(true);
    expect(resolve?.visible?.({ dispute_status: 'none' })).toBe(false);
  });

  it('lazy routes cover the dashboard and the five pages', () => {
    expect(TRANSPORTATION_ROUTES.filter((route) => !route.path?.includes(':')).map((route) => route.path)).toEqual(['', 'carriers', 'orders', 'trips', 'quotes', 'audit']);
  });
});
