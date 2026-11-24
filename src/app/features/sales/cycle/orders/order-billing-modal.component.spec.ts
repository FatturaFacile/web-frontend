import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../../testing/component-smoke';
import { OrderBillingModalComponent } from './order-billing-modal.component';

describe('OrderBillingModalComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(OrderBillingModalComponent, { visible: true, mode: 'partial', order: { id: 'o1', order_number: 'ORD-1', contact_id: 'c1', date: '2026-01-01' } });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
