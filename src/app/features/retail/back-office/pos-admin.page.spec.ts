import { ResourceAction, ResourceField } from '@shared';
import { describe, expect, it } from 'vitest';
import { RETAIL_POS_ADMIN_PAGE } from './pos-admin.page';

const allActions = (): ResourceAction[] =>
  RETAIL_POS_ADMIN_PAGE.tabs.flatMap((tab) => [...(tab.create ? [tab.create] : []), ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])]);

const endpoints = (): string[] => [
  ...RETAIL_POS_ADMIN_PAGE.tabs.map((tab) => `GET ${tab.list.path}`),
  ...allActions().map((action) => `${action.method} ${action.path}`),
];

const fieldsOf = (method: string, path: string): readonly ResourceField[] => {
  const action = allActions().find((candidate) => candidate.method === method && candidate.path === path);
  expect(action, `${method} ${path}`).toBeDefined();
  return action?.fields ?? [];
};

describe('POS back office page', () => {
  it('keeps the tabs of the fiscal documents and adds the full till', () => {
    const ids = RETAIL_POS_ADMIN_PAGE.tabs.map((tab) => tab.id);

    expect(ids).toEqual(['sessions', 'terminals', 'documents', 'tickets', 'promotions', 'returns', 'z-reports', 'corrispettivi']);
  });

  it('reaches every POS endpoint of the Fiscal Retail API', () => {
    const reached = endpoints();

    for (const expected of [
      'GET /fiscal-retail/pos/promotions',
      'POST /fiscal-retail/pos/promotions',
      'PUT /fiscal-retail/pos/promotions/{id}',
      'DELETE /fiscal-retail/pos/promotions/{id}',
      'POST /fiscal-retail/pos/promotions/preview',
      'POST /fiscal-retail/pos/tickets',
      'GET /fiscal-retail/pos/tickets/{saleId}',
      'GET /fiscal-retail/pos/sessions/{id}/cash-movements',
      'POST /fiscal-retail/pos/sessions/{id}/cash-movements',
      'GET /fiscal-retail/pos/sessions/{id}/x-report',
      'GET /fiscal-retail/pos/sessions/{id}/z-report',
      'GET /fiscal-retail/pos/z-reports',
      'POST /fiscal-retail/pos/sales/{saleId}/returns',
      'GET /fiscal-retail/pos/returns',
    ]) {
      expect(reached, expected).toContain(expected);
    }
  });

  it('sends the fields of the promotion form request', () => {
    const keys = fieldsOf('POST', '/fiscal-retail/pos/promotions').map((field) => field.key);

    expect(keys).toEqual([
      'code', 'name', 'type', 'value', 'product_id', 'buy_quantity', 'get_quantity', 'min_subtotal', 'starts_at', 'ends_at',
      'weekdays', 'time_from', 'time_to', 'priority', 'is_stackable', 'is_active',
    ]);
    expect(fieldsOf('POST', '/fiscal-retail/pos/promotions').find((field) => field.key === 'type')?.options).toEqual(['percentage', 'fixed', 'buy_x_get_y']);
  });

  it('sends the lines and the split payments of a ticket as the API expects', () => {
    const ticket = fieldsOf('POST', '/fiscal-retail/pos/tickets');
    const payments = ticket.find((field) => field.key === 'payments');

    expect(ticket.map((field) => field.key)).toEqual(['pos_session_id', 'contact_id', 'items', 'payments']);
    expect(ticket.find((field) => field.key === 'items')?.fields?.map((field) => field.key)).toEqual(['product_id', 'description', 'quantity', 'unit_price', 'tax_rate']);
    expect(payments?.fields?.map((field) => field.key)).toEqual(['method', 'amount', 'reference']);
    expect(payments?.fields?.find((field) => field.key === 'method')?.options).toEqual(['cash', 'card', 'voucher', 'bank_transfer', 'mobile', 'other']);
  });

  it('requires a reason for a pay out only through the movement type options of the API', () => {
    const movement = fieldsOf('POST', '/fiscal-retail/pos/sessions/{id}/cash-movements');

    expect(movement.find((field) => field.key === 'type')?.options).toEqual(['pay_in', 'pay_out', 'safe_drop']);
    expect(movement.find((field) => field.key === 'reason')?.requiredIf).toEqual({ field: 'type', value: 'pay_out' });
  });

  it('sends a return with its lines, refund method and optional exchange', () => {
    const keys = fieldsOf('POST', '/fiscal-retail/pos/sales/{saleId}/returns').map((field) => field.key);

    expect(keys).toEqual(['saleId', 'pos_session_id', 'lines', 'refund_method', 'reason', 'exchange']);
  });

  it('offers the X report on open sessions and the Z report on closed ones', () => {
    const sessions = RETAIL_POS_ADMIN_PAGE.tabs.find((tab) => tab.id === 'sessions');
    const x = sessions?.rowActions?.find((action) => action.path.endsWith('/x-report'));
    const z = sessions?.rowActions?.find((action) => action.path.endsWith('/z-report'));

    expect(x?.visible?.({ status: 'open' })).toBe(true);
    expect(x?.visible?.({ status: 'closed' })).toBe(false);
    expect(z?.visible?.({ status: 'closed' })).toBe(true);
    expect(z?.visible?.({ status: 'open' })).toBe(false);
  });
});
