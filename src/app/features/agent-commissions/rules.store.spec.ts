import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService, CatalogApiService, CrmApiService } from '@core';
import { agent, rule, wrap, zone } from './agent-commissions.testing';
import { contactName, RulesStore } from './rules.store';

const contact = (id: string, company: string | null, first = '', last = '') => ({
  id,
  company_name: company,
  first_name: first,
  last_name: last,
});

describe('RulesStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let crm: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof RulesStore>;

  beforeEach(() => {
    api = {
      listRules: vi.fn(() =>
        of(
          wrap([
            rule('r-1', { priority: 200, name: 'B rule', customer_id: 'c-1' }),
            rule('r-2', { priority: 10, name: 'A rule', zone_id: 'z-1', agent_profile_id: 'a-1' }),
          ]),
        ),
      ),
      listAgents: vi.fn(() => of(wrap([agent('a-1')]))),
      listZones: vi.fn(() => of(wrap([zone('z-1')]))),
      createRule: vi.fn(() => of(wrap(rule('r-3')))),
      updateRule: vi.fn(() => of(wrap(rule('r-1')))),
      deleteRule: vi.fn(() => of(wrap(null))),
      resolveRule: vi.fn(() =>
        of(wrap({ rule: rule('r-2'), fallback_rate: null, zone_ids: ['z-1'] })),
      ),
    };
    crm = {
      getContactById: vi.fn((id: string) => of(wrap(contact(id, 'Acme Spa')))),
      getClients: vi.fn(() =>
        of({ data: [contact('c-7', null, 'Mario', 'Rossi'), contact('c-8', 'Beta Srl')] }),
      ),
    };
    TestBed.configureTestingModule({
      providers: [
        RulesStore,
        { provide: AgentCommissionsApiService, useValue: api },
        {
          provide: CatalogApiService,
          useValue: { getCategories: vi.fn(() => of(wrap([{ id: 'p-1', name: 'Wine' }]))) },
        },
        { provide: CrmApiService, useValue: crm },
      ],
    });
    store = TestBed.inject(RulesStore);
  });

  it('names a contact by company, or by first and last name', () => {
    expect(contactName(contact('c', 'Acme Spa') as never)).toBe('Acme Spa');
    expect(contactName(contact('c', null, 'Mario', 'Rossi') as never)).toBe('Mario Rossi');
  });

  it('loads the rules with what the form picks from, ordered by priority', async () => {
    await store.init();

    expect(store.sortedRules().map((entry) => entry.id)).toEqual(['r-2', 'r-1']);
    expect(store.agentNames().get('a-1')).toBe('Agent a-1');
    expect(store.zoneNames().get('z-1')).toBe('Zz-1 Zone z-1');
    expect(store.categoryNames().get('p-1')).toBe('Wine');
    expect(store.loading()).toBe(false);
  });

  it('reads the names of the customers the rules point to', async () => {
    await store.init();

    await vi.waitFor(() => expect(store.customerNames().get('c-1')).toBe('Acme Spa'));
    expect(crm['getContactById']).toHaveBeenCalledWith('c-1');
  });

  it('still lists the rules when the product lines cannot be read', async () => {
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        RulesStore,
        { provide: AgentCommissionsApiService, useValue: api },
        {
          provide: CatalogApiService,
          useValue: { getCategories: vi.fn(() => throwError(() => new Error('down'))) },
        },
        { provide: CrmApiService, useValue: crm },
      ],
    });
    const degraded = TestBed.inject(RulesStore);

    await degraded.init();

    expect(degraded.rules()).toHaveLength(2);
    expect(degraded.categories()).toEqual([]);
  });

  it('creates or updates a rule and reads the list again', async () => {
    const payload = { name: 'Wine', rate_type: 'percentage' as const, rate: 5 };

    expect((await store.save(null, payload)).ok).toBe(true);
    expect(api['createRule']).toHaveBeenCalledWith(payload);

    expect((await store.save('r-1', { priority: 5 })).ok).toBe(true);
    expect(api['updateRule']).toHaveBeenCalledWith('r-1', { priority: 5 });
    expect(api['listRules']).toHaveBeenCalledTimes(2);
  });

  it('answers the refusal of an invalid rule with the translated key', async () => {
    api['createRule'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'invalid_tiers' } })),
    );

    const outcome = await store.save(null, { name: 'x' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('agentCommissions.error.invalid_tiers');
    expect(store.saving()).toBe(false);
  });

  it('removes a rule from the list', async () => {
    await store.init();

    expect((await store.remove('r-1')).ok).toBe(true);
    expect(store.rules().map((entry) => entry.id)).toEqual(['r-2']);
  });

  it('searches the customers and remembers their names', async () => {
    await store.searchCustomers(' ro ');

    expect(crm['getClients']).toHaveBeenCalledWith({ search: 'ro', per_page: 20 });
    expect(store.customerOptions()).toEqual([
      { id: 'c-7', name: 'Mario Rossi' },
      { id: 'c-8', name: 'Beta Srl' },
    ]);
    expect(store.customerNames().get('c-7')).toBe('Mario Rossi');
  });

  it('simulates the precedence and keeps the winner or the failure', async () => {
    await store.resolve({ agent_profile_id: 'a-1', customer_id: 'c-1' });

    expect(api['resolveRule']).toHaveBeenCalledWith({
      agent_profile_id: 'a-1',
      customer_id: 'c-1',
    });
    expect(store.resolved()?.rule?.id).toBe('r-2');
    expect(store.resolving()).toBe(false);

    api['resolveRule'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: {} })),
    );
    await store.resolve({ agent_profile_id: 'a-x' });
    expect(store.resolved()).toBeNull();
    expect(store.resolveError()).toBe('agentCommissions.error.generic');

    store.clearResolved();
    expect(store.resolveError()).toBeNull();
  });
});
