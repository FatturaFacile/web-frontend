import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { I18nService, LeadApiService, LeadResource } from '@core';
import { LeadsComponent } from './leads.component';

describe('LeadsComponent', () => {
  let fixture: ComponentFixture<LeadsComponent>;
  let component: LeadsComponent;

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

    await TestBed.configureTestingModule({
      imports: [LeadsComponent],
      providers: [
        provideRouter([]),
        provideNzIcons(icons),
        { provide: LeadApiService, useValue: mockLeadApi },
        { provide: I18nService, useValue: mockI18n },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(LeadsComponent);
    component = fixture.componentInstance;
  });

  it('loads leads on initialization', () => {
    fixture.detectChanges();
    expect(component).toBeTruthy();
    expect(mockLeadApi.list).toHaveBeenCalled();
    expect(component['leads']()).toEqual(mockLeads);
    expect(component['loading']()).toBe(false);
  });

  it('filters leads by rating and status', () => {
    fixture.detectChanges();
    component['setRating']('hot');
    expect(mockLeadApi.list).toHaveBeenCalledWith({ rating: 'hot', status: undefined });

    component['setStatus']('qualified');
    expect(mockLeadApi.list).toHaveBeenCalledWith({ rating: 'hot', status: 'qualified' });
  });

  it('opens create modal and saves new lead', () => {
    fixture.detectChanges();
    component['openCreate']();
    expect(component['modalOpen']()).toBe(true);

    component['patchForm']({ company_name: 'Gamma GmbH', email: 'gamma@example.com' });
    component['save']();

    expect(mockLeadApi.create).toHaveBeenCalledWith(
      expect.objectContaining({ company_name: 'Gamma GmbH', email: 'gamma@example.com' }),
    );
    expect(mockMessage.success).toHaveBeenCalled();
    expect(component['modalOpen']()).toBe(false);
  });

  it('qualifies a lead', () => {
    fixture.detectChanges();
    component['qualify'](mockLeads[0]);

    expect(mockLeadApi.qualify).toHaveBeenCalledWith('lead-1');
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('converts a lead', () => {
    fixture.detectChanges();
    component['convert'](mockLeads[0]);

    expect(mockLeadApi.convert).toHaveBeenCalledWith('lead-1');
    expect(mockMessage.success).toHaveBeenCalled();
  });

  it('disqualifies a lead with reason', () => {
    fixture.detectChanges();
    component['disqualifying'].set(mockLeads[0]);
    component['disqualifyReason'].set('Not interested in ERP');
    component['confirmDisqualify']();

    expect(mockLeadApi.disqualify).toHaveBeenCalledWith('lead-1', 'Not interested in ERP');
    expect(mockMessage.success).toHaveBeenCalled();
    expect(component['disqualifying']()).toBeNull();
  });

  it('opens detail and detects duplicates', () => {
    fixture.detectChanges();
    component['openDetail'](mockLeads[0]);

    expect(mockLeadApi.get).toHaveBeenCalledWith('lead-1');
    expect(mockLeadApi.detectDuplicates).toHaveBeenCalled();
    expect(component['detail']()).toEqual(mockLeads[0]);
  });

  it('deletes a lead', () => {
    fixture.detectChanges();
    component['remove'](mockLeads[0]);

    expect(mockLeadApi.remove).toHaveBeenCalledWith('lead-1');
    expect(mockMessage.success).toHaveBeenCalled();
  });
});
