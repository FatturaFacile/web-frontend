import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { PayrollSettingsComponent } from './payroll-settings.component';

describe('PayrollSettingsComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(PayrollSettingsComponent, { country: 'swiss', canWrite: true });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
