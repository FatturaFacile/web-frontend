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
  const queryParams = new BehaviorSubject<Record<string, string>>({ rating: 'hot', min_score: '50' });

  const mockLeads: LeadResource[] = [
    {
      id: 'lead-1',
      first_name: 'Alice',
      last_name: 'Smith',
      full_name: 'Alice Smith',
      company_name: 'Alpha SA',
      title: 'Sales Director',
      email: 'alice@alpha.ch',
      phone: '+41919998877',
      website: 'https://alpha.ch',
      country: 'CH',
      status: 'new',
      score: 75,
      rating: 'warm',
      rating_label: 'Tiepido',
      score_breakdown: { budget: 40 },
      assigned_user_id: null,
      assigned_at: null,
      product_line: null,
      company_size: null,
      estimated_revenue: null,
      estimated_budget: '25000',
      email_opens: 0,
      catalog_downloads: 0,
      site_visits: 0,
      converted_account_id: null,
      converted_contact_id: null,
      converted_opportunity_id: null,
      tags: null,
      duplicate_of_id: null,
      vat_number: 'CHE123456789',
      industry: 'Tech',
      region: 'Ticino',
      created_at: '2026-11-08',
      updated_at: '2026-11-08',
    },
  ];

  const mockLeadApi = {
    list: vi.fn().mockReturnValue(
      of({
        data: mockLeads,
        meta: { current_page: 1, total: 1, last_page: 1, per_page: 15 },
      }),
    ),
    create: vi.fn().mockReturnValue(
      of({
        lead: mockLeads[0],
        duplicate_ids: [],
        merged: false,
      }),
    ),
    get: vi.fn().mockReturnValue(of(mockLeads[0])),
    update: vi.fn().mockReturnValue(of(mockLeads[0])),
    qualify: vi.fn().mockReturnValue(of({ ...mockLeads[0], status: 'qualified' })),
    disqualify: vi.fn().mockReturnValue(of({ ...mockLeads[0], status: 'disqualified' })),
    merge: vi.fn().mockReturnValue(of(mockLeads[0])),
    convert: vi.fn().mockReturnValue(
      of({
        account: { id: 'acc-1', name: 'Alpha SA' },
        contact: { id: 'con-1', name: 'Alice Smith' },
        opportunity: { id: 'opp-1', name: 'Alpha Deal' },
      }),
    ),
    remove: vi.fn().mockReturnValue(of(undefined)),
    detectDuplicates: vi.fn().mockReturnValue(of([])),
    recordBehavior: vi.fn().mockReturnValue(of(mockLeads[0])),
  };

  const mockI18n = {
    translate: vi.fn((k: string) => k),
    currentLanguage: signal('it'),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    info: vi.fn(),
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    api = {
      listLeads: vi.fn().mockReturnValue(
        of({ success: true, message: '', data: ROWS, meta: { total: 2, current_page: 1, per_page: 10 } }),
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
    expect(api.listLeads).toHaveBeenLastCalledWith(expect.objectContaining({ rating: 'hot', min_score: 50 }));

    const el = fixture.nativeElement as HTMLElement;
    const badges = Array.from(el.querySelectorAll('app-lead-score-badge')).map((b) => b.textContent?.trim());
    const tags = Array.from(el.querySelectorAll('app-lead-rating-tag')).map((t) => t.textContent?.trim());
    expect(badges).toEqual(['82', '45']);
    expect(tags).toEqual(['Hot', 'Warm']);
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
