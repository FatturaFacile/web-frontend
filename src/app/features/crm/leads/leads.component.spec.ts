import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter, Router } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { BehaviorSubject, of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Lead, LeadApiService, SettingsApiService } from '@core';
import { icons } from '../../../icons-provider';
import { LeadsComponent } from './leads.component';
import { i18nStub } from './lead-test.utils';

const ROWS: Partial<Lead>[] = [
  { id: 'l1', first_name: 'Anna', last_name: 'Rossi', score: 82, rating: 'hot', status: 'new' },
  { id: 'l2', company_name: 'Bianchi SA', score: 45, rating: 'warm', status: 'new' },
];

describe('LeadsComponent', () => {
  let api: { listLeads: ReturnType<typeof vi.fn>; listSources: ReturnType<typeof vi.fn> };
  const queryParams = new BehaviorSubject<Record<string, string>>({
    rating: 'hot',
    min_score: '50',
  });

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    api = {
      listLeads: vi
        .fn()
        .mockReturnValue(
          of({
            success: true,
            message: '',
            data: ROWS,
            meta: { total: 2, current_page: 1, per_page: 10 },
          }),
        ),
      listSources: vi.fn().mockReturnValue(of([{ id: 's1', name: 'Website', type: 'web_form' }])),
    };

    await TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        i18nStub(),
        { provide: ActivatedRoute, useValue: { queryParams, snapshot: {} } },
        { provide: LeadApiService, useValue: api },
        { provide: SettingsApiService, useValue: { getTenantUsers: () => of({ data: [] }) } },
      ],
    });
  });

  afterEach(() => vi.useRealTimers());

  async function render() {
    const fixture = TestBed.createComponent(LeadsComponent);
    fixture.detectChanges();
    await vi.advanceTimersByTimeAsync(500);
    fixture.detectChanges();
    return fixture;
  }

  it('requests rating/min_score from the URL and shows badge and text tag per row', async () => {
    const fixture = await render();
    expect(api.listLeads).toHaveBeenLastCalledWith(
      expect.objectContaining({ rating: 'hot', min_score: 50 }),
    );

    const el = fixture.nativeElement as HTMLElement;
    const badges = Array.from(el.querySelectorAll('app-lead-score-badge')).map((b) =>
      b.textContent?.trim(),
    );
    const tags = Array.from(el.querySelectorAll('app-lead-rating-tag')).map((t) =>
      t.textContent?.trim(),
    );
    expect(badges).toEqual(['82', '45']);
    expect(tags).toEqual(['CRM.LEADS.RATING.HOT', 'CRM.LEADS.RATING.WARM']);
  });

  it('writes filter changes to the URL query params', async () => {
    const fixture = await render();
    const router = TestBed.inject(Router);
    const nav = vi.spyOn(router, 'navigate').mockResolvedValue(true);
    fixture.componentInstance['setFilter']({ rating: 'cold' });
    expect(nav).toHaveBeenCalledWith(
      [],
      expect.objectContaining({
        queryParams: expect.objectContaining({ rating: 'cold', min_score: 50 }),
        queryParamsHandling: 'merge',
      }),
    );
  });
});
