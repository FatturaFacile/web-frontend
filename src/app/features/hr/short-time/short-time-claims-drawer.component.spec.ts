import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { ShortTimeClaimsDrawerComponent } from './short-time-claims-drawer.component';

describe('ShortTimeClaimsDrawerComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(ShortTimeClaimsDrawerComponent, { open: true, caseRecord: null, canWrite: true });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
