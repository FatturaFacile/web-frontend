import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { I18nService, TIMELINE_TYPES } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it } from 'vitest';
import { icons } from '../../../../icons-provider';
import { Customer360LifecycleComponent } from './customer-360-lifecycle.component';

const kpis = {
  lifetime_value: '1000.00',
  open_pipeline_value: '500.00',
  open_opportunities: 1,
  overdue_receivable_amount: '0.00',
  open_tickets: 2,
  sla_breach_rate: 10,
  mttr_hours: 4.5,
  active_contracts: 1,
  contract_coverage: 'covered',
  contract_hours_remaining: '8.00',
  contracts_expiring_soon: 0,
  interventions_scheduled: 1,
  interventions_completed: 3,
};

describe('Customer360LifecycleComponent', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  const create = () => {
    const fixture = TestBed.createComponent(Customer360LifecycleComponent);
    fixture.componentRef.setInput('contactId', 'c1');
    fixture.detectChanges();
    return fixture;
  };

  it('resolves the account of the contact, then loads the summary and the timeline', () => {
    const fixture = create();
    const accounts = http.expectOne((r) => r.url.endsWith('/crm/accounts'));
    expect(accounts.request.params.get('contact_id')).toBe('c1');
    accounts.flush({ data: [{ id: 'a1' }] });

    http
      .expectOne((r) => r.url.endsWith('/crm/customers/a1/360'))
      .flush({
        data: {
          account: { id: 'a1', contact_id: 'c1', name: 'Rossi SA', tier: null, status: 'active' },
          health: { health_index: 70, churn_risk: 'medium', last_interaction_at: null },
          kpis,
        },
      });
    http.expectOne((r) => r.url.endsWith('/crm/customers/a1/timeline')).flush({
      data: [
        {
          type: 'ticket',
          id: 't1',
          occurred_at: '2026-03-01T10:00:00Z',
          title: 'Chiller offline',
          status: 'open',
          amount: null,
          reference: 'T-1',
          label: 'Ticket',
        },
      ],
    });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('Chiller offline');
    expect(text).toContain('CRM.CUSTOMER360.LC_COVERAGE_COVERED');
  });

  it('reloads the timeline with the selected types', () => {
    const fixture = create();
    http.expectOne((r) => r.url.endsWith('/crm/accounts')).flush({ data: { data: [{ id: 'a1' }] } });
    http.expectOne((r) => r.url.endsWith('/360')).flush({
      data: {
        account: { id: 'a1', contact_id: 'c1', name: 'Rossi SA', tier: null, status: 'active' },
        health: { health_index: 70, churn_risk: 'low', last_interaction_at: null },
        kpis,
      },
    });
    http.expectOne((r) => r.url.endsWith('/timeline')).flush({ data: [] });

    (fixture.componentInstance as unknown as { applyFilter(types: string[]): void }).applyFilter(['ticket', 'invoice']);
    const filtered = http.expectOne((r) => r.url.endsWith('/timeline'));
    expect(filtered.request.params.getAll('types[]')).toEqual(['ticket', 'invoice']);
    filtered.flush({ data: [] });
  });

  it('shows the empty state when the contact has no CRM account', () => {
    const fixture = create();
    http.expectOne((r) => r.url.endsWith('/crm/accounts')).flush({ data: [] });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('CRM.CUSTOMER360.LC_NO_ACCOUNT');
    http.expectNone((r) => r.url.endsWith('/360'));
  });

  it('exposes every backend timeline type', () => {
    expect([...TIMELINE_TYPES]).toEqual(['activity', 'opportunity', 'invoice', 'ticket', 'work_order', 'contract', 'lead']);
  });
});
