import { TestBed, ComponentFixture } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import { I18nService, TicketApiService, TicketResource, TranslateService } from '@core';
import { FieldServiceComponent } from './field-service.component';

describe('FieldServiceComponent', () => {
  let fixture: ComponentFixture<FieldServiceComponent>;
  let component: FieldServiceComponent;

  const mockTickets: TicketResource[] = [
    {
      id: 'tk-101',
      tenant_id: 't-1',
      ticket_number: '101',
      type: 'incident',
      subject: 'Problema Stampante',
      title: 'Problema Stampante',
      description: 'Non stampa',
      customer_id: 'c-1',
      contact_id: null,
      contact_email: 'tech@example.com',
      contact_phone: '+3902123456',
      priority: 'high',
      status: 'open',
      source: 'portal',
      channel: 'portal',
      category_id: null,
      service_category_id: null,
      service_contract_id: null,
      sla_policy_id: null,
      assigned_technician_id: null,
      assigned_to_id: 'u-1',
      assigned_team_id: null,
      service_team_id: null,
      requester_user_id: null,
      asset_id: null,
      response_due_at: null,
      resolution_due_at: '2026-11-10T12:00:00Z',
      resolved_at: null,
      closed_at: null,
      is_sla_breached: false,
      is_escalated: false,
      escalation_level: 0,
      is_locked: false,
      impact: 'medium',
      urgency: 'high',
      tags: [],
      first_responded_at: null,
      merged_into_ticket_id: null,
      split_from_ticket_id: null,
      reopened_count: 0,
      status_changed_at: null,
      sla_paused_at: null,
      sla_state: 'ok',
      created_at: '2026-11-08T10:00:00Z',
      updated_at: '2026-11-08T10:00:00Z',
    },
  ];

  const mockTicketApi = {
    getTickets: vi.fn().mockReturnValue(of({ data: mockTickets, meta: { current_page: 1, total: 1 } })),
    getTicket: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    createTicket: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    updateTicket: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    changeTicketStatus: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    assignTicket: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    resolveTicket: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    closeTicket: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    reopenTicket: vi.fn().mockReturnValue(of({ data: mockTickets[0] })),
    getTicketMessages: vi.fn().mockReturnValue(of({ data: [], meta: { unread: 0 } })),
    addTicketMessage: vi.fn().mockReturnValue(of({ data: {} })),
    getTicketActivities: vi.fn().mockReturnValue(of({ data: [] })),
  };

  const mockTranslate = {
    instant: vi.fn((key: string) => key),
    translate: vi.fn((key: string) => key),
  };

  const mockMessage = {
    success: vi.fn(),
    error: vi.fn(),
    warning: vi.fn(),
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FieldServiceComponent],
      providers: [
        provideNzIcons(icons),
        { provide: TicketApiService, useValue: mockTicketApi },
        { provide: TranslateService, useValue: mockTranslate },
        { provide: I18nService, useValue: mockTranslate },
        { provide: NzMessageService, useValue: mockMessage },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(FieldServiceComponent);
    component = fixture.componentInstance;
  });

  it('creates the component and loads tickets on init', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
    expect(component).toBeTruthy();
    expect(mockTicketApi.getTickets).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 10 }));
    expect(component.grid.items().length).toBe(1);
    expect(component.grid.totalCount()).toBe(1);
  });

  it('maps the server columns of the computed ticket fields', () => {
    const columns = component.columns();
    expect(columns.find((column) => column.key === 'title')?.serverKey).toBe('subject');
    expect(columns.find((column) => column.key === 'channel')?.serverKey).toBe('source');
    expect(columns.some((column) => column.key === 'sla_state')).toBe(true);
  });

  it('updates filters and triggers reload on search', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
    mockTicketApi.getTickets.mockClear();

    component.searchQuery.set('Stampante');
    component.filterStatus.set('open');
    component.filterPriority.set('high');
    component.filterSlaState.set('ok');
    component.onSearch();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(mockTicketApi.getTickets).toHaveBeenCalledWith(
      expect.objectContaining({
        q: 'Stampante',
        status: 'open',
        priority: 'high',
        sla_state: 'ok',
        page: 1,
      }),
    );
  });

  it('resets filters properly', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
    mockTicketApi.getTickets.mockClear();

    component.searchQuery.set('test');
    component.filterStatus.set('closed');
    component.resetFilters();

    expect(component.searchQuery()).toBe('');
    expect(component.filterStatus()).toBe('');
    expect(component.grid.pageIndex()).toBe(1);
    expect(component.grid.filterParams().status).toBeUndefined();
  });

  it('opens detail drawer with ticket id', () => {
    component.openDetail('tk-101');
    expect(component.selectedTicketId()).toBe('tk-101');
    expect(component.detailDrawerOpen()).toBe(true);
  });

  it('opens create drawer', () => {
    component.openCreate();
    expect(component.createDrawerOpen()).toBe(true);
  });

  it('reports a load error', async () => {
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 20));
    mockTicketApi.getTickets.mockReturnValueOnce(throwError(() => ({ message: 'Network error' })));
    component.grid.reload();
    await new Promise((resolve) => setTimeout(resolve, 400));

    expect(mockMessage.error).toHaveBeenCalledWith('Network error');
  });
});
