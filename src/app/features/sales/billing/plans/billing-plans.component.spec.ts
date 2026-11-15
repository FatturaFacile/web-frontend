import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../../testing/component-smoke';
import { BillingPlansComponent } from './billing-plans.component';

describe('BillingPlansComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(BillingPlansComponent, {});

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
