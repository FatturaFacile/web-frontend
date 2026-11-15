import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../../testing/component-smoke';
import { DeferredBillingComponent } from './deferred-billing.component';

describe('DeferredBillingComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(DeferredBillingComponent, {});

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
