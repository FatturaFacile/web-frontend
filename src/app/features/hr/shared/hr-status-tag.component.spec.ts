import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { HrStatusTagComponent } from './hr-status-tag.component';

describe('HrStatusTagComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(HrStatusTagComponent, { value: 'active' });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('active');
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
