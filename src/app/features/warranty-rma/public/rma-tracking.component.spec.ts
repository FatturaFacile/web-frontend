import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { I18nService, PublicRmaApiService } from '@core';
import { httpError, i18nStub } from '../testing/rma-fixtures';
import { RmaTrackingComponent } from './rma-tracking.component';

describe('RmaTrackingComponent (public)', () => {
  let api: { getTracking: ReturnType<typeof vi.fn> };

  async function setup(query: Record<string, string>) {
    await TestBed.configureTestingModule({
      imports: [RmaTrackingComponent],
      providers: [
        { provide: PublicRmaApiService, useValue: api },
        { provide: I18nService, useValue: i18nStub() },
        {
          provide: ActivatedRoute,
          useValue: { snapshot: { queryParamMap: convertToParamMap(query) } },
        },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(RmaTrackingComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  beforeEach(() => {
    api = {
      getTracking: vi.fn().mockReturnValue(
        of({
          data: {
            rma_number: 'RMA-2026-000123',
            status: 'awaiting_estimate_approval',
            status_label: 'Attesa approvazione preventivo',
            steps: [
              {
                status: 'awaiting_arrival',
                label: 'a',
                reached_at: '2026-11-01T00:00:00Z',
                current: false,
              },
              {
                status: 'awaiting_estimate_approval',
                label: 'b',
                reached_at: '2026-11-03T00:00:00Z',
                current: true,
              },
            ],
            estimate_pending: true,
            estimate_url: 'https://app.test/rma-estimate/raw',
            updated_at: '2026-11-03T00:00:00Z',
          },
        }),
      ),
    };
  });

  it('shows the status steps and a link to the pending estimate', async () => {
    const fixture = await setup({ rma: 'RMA-2026-000123', token: 'raw' });
    expect(api.getTracking).toHaveBeenCalledWith('RMA-2026-000123', 'raw');
    expect(fixture.componentInstance.currentIndex()).toBe(1);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('RMA-2026-000123');
    expect(el.querySelector('a[href="https://app.test/rma-estimate/raw"]')).not.toBeNull();
  });

  it('shows the neutral page without calling the API when parameters are missing', async () => {
    const fixture = await setup({ rma: 'RMA-2026-000123' });
    expect(api.getTracking).not.toHaveBeenCalled();
    expect(fixture.componentInstance.state()).toBe('invalid');
  });

  it('shows the neutral page on 404', async () => {
    api.getTracking.mockReturnValue(httpError(404));
    const fixture = await setup({ rma: 'X', token: 'bad' });
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('RMA.PUBLIC.INVALID_LINK');
  });
});
