import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../../testing/component-smoke';
import { InvoiceApprovalsComponent } from './invoice-approvals.component';

describe('InvoiceApprovalsComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(InvoiceApprovalsComponent, {});

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
