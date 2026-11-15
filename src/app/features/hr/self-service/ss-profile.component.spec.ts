import { describe, expect, it } from 'vitest';
import { renderPageWithEmptyBackend } from '../../../../testing/component-smoke';
import { SsProfileComponent } from './ss-profile.component';

describe('SsProfileComponent', () => {
  it('renders its template against an empty backend and answers every request', async () => {
    const { fixture, requests } = await renderPageWithEmptyBackend(SsProfileComponent, { profile: { id: 'e1', employee_number: 'EMP-001', full_name: 'Mario Rossi', work_email: 'mario@example.com', department_id: null, position_id: null, manager_id: null, employment_status: 'active', employment_type: 'full_time', hire_date: '2026-01-01', fte_ratio: '1.0000' } });

    expect(fixture.nativeElement).toBeInstanceOf(HTMLElement);
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Mario Rossi');
    expect(text).toContain('EMP-001');
    expect(text).toContain('mario@example.com');
    expect(requests.every((request) => request.startsWith('GET ') || request.startsWith('POST '))).toBe(true);
  });
});
