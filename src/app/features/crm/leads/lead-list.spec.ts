import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LeadApiService, PaginatedResponse, Lead } from '@core';
import { leadFiltersFromQueryParams, leadFiltersToQueryParams } from './lead-filters';
import { LeadFacade } from './lead.facade';
import { httpError } from './lead-test.utils';

function page(data: Partial<Lead>[], total = data.length): PaginatedResponse<Lead> {
  return {
    success: true,
    message: '',
    data: data as Lead[],
    meta: { current_page: 1, from: null, to: null, last_page: 1, per_page: 10, total },
  };
}

describe('lead filters <-> query params', () => {
  it('reads valid filters and drops invalid ones', () => {
    expect(
      leadFiltersFromQueryParams({
        rating: 'hot',
        min_score: '60',
        sort: '-score',
        assigned_user_id: 'u1',
        source: 's1',
      }),
    ).toEqual({
      rating: 'hot',
      min_score: 60,
      sort: '-score',
      assigned_user_id: 'u1',
      source: 's1',
    });

    expect(
      leadFiltersFromQueryParams({ rating: 'boiling', min_score: 'abc', sort: 'name' }),
    ).toEqual({});
    expect(leadFiltersFromQueryParams({ min_score: '250' })).toEqual({ min_score: 100 });
  });

  it('writes cleared filters as null so the router removes them', () => {
    expect(leadFiltersToQueryParams({ rating: 'warm', min_score: 0 })).toEqual({
      rating: 'warm',
      assigned_user_id: null,
      source: null,
      min_score: 0,
      sort: null,
    });
  });

  it('round-trips', () => {
    const f = { rating: 'cold' as const, min_score: 30, sort: 'score' as const, source: 'web' };
    const q = Object.fromEntries(
      Object.entries(leadFiltersToQueryParams(f))
        .filter(([, v]) => v !== null)
        .map(([k, v]) => [k, String(v)]),
    );
    expect(leadFiltersFromQueryParams(q)).toEqual(f);
  });
});

describe('LeadFacade', () => {
  let api: { listLeads: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.useFakeTimers();
    api = {
      listLeads: vi.fn().mockReturnValue(of(page([{ id: 'l1', score: 80, rating: 'hot' }], 1))),
    };
    TestBed.configureTestingModule({
      providers: [LeadFacade, { provide: LeadApiService, useValue: api }],
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  async function settle(): Promise<void> {
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(500);
    TestBed.tick();
  }

  it('sends rating and min_score to the API and exposes rows', async () => {
    const facade = TestBed.inject(LeadFacade);
    facade.replaceFilters({ rating: 'hot', min_score: 50 });
    await settle();

    const params = api.listLeads.mock.calls.at(-1)?.[0];
    expect(params).toMatchObject({ rating: 'hot', min_score: 50, page: 1, per_page: 10 });
    expect(facade.items()).toEqual([{ id: 'l1', score: 80, rating: 'hot' }]);
    expect(facade.totalCount()).toBe(1);
    expect(facade.error()).toBe(false);
  });

  it('flags errors so the page can offer a retry', async () => {
    api.listLeads.mockReturnValue(throwError(() => httpError(500)));
    const facade = TestBed.inject(LeadFacade);
    await settle();
    expect(facade.error()).toBe(true);
    expect(facade.loading()).toBe(false);

    api.listLeads.mockReturnValue(of(page([])));
    facade.reload();
    await settle();
    expect(facade.error()).toBe(false);
    expect(facade.items()).toEqual([]);
  });
});
