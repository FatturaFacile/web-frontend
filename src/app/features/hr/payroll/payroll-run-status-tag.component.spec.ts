import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { PayrollRunStatusTagComponent } from './payroll-run-status-tag.component';

describe('PayrollRunStatusTagComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(PayrollRunStatusTagComponent, { status: 'Draft' });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect((fixture.nativeElement as HTMLElement).textContent?.trim()).toBe('Draft');
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
