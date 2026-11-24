import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService } from '@core';
import { agent, wrap } from './agent-commissions.testing';
import { AgentsStore } from './agents.store';

const problem = (code: string, status = 422) =>
  throwError(() => new HttpErrorResponse({ status, error: { code, detail: code } }));

describe('AgentsStore', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let store: InstanceType<typeof AgentsStore>;

  beforeEach(() => {
    api = {
      listAgents: vi.fn(() => of(wrap([agent('a-1'), agent('a-2', { is_active: false })]))),
      getAvailableRepresentatives: vi.fn(() =>
        of(
          wrap([
            {
              id: 'r-9',
              rep_code: 'R9',
              name: 'Free Rep',
              email: null,
              default_commission_rate: '4.0000',
            },
          ]),
        ),
      ),
      createAgent: vi.fn(() => of(wrap(agent('a-3')))),
      updateAgent: vi.fn(() => of(wrap(agent('a-1')))),
      deleteAgent: vi.fn(() => of(wrap(null))),
    };
    TestBed.configureTestingModule({
      providers: [AgentsStore, { provide: AgentCommissionsApiService, useValue: api }],
    });
    store = TestBed.inject(AgentsStore);
  });

  it('loads the agents and counts the active ones', async () => {
    await store.load();

    expect(store.agents()).toHaveLength(2);
    expect(store.activeCount()).toBe(1);
    expect(store.loading()).toBe(false);
    expect(store.error()).toBeNull();
  });

  it('reports a failed load with the key of the problem code', async () => {
    api['listAgents'].mockReturnValue(problem('generic', 500));

    await store.load();

    expect(store.error()).toBe('agentCommissions.error.generic');
    expect(store.loading()).toBe(false);
  });

  it('loads the representatives an agent can be created from', async () => {
    await store.loadRepresentatives();

    expect(store.representatives().map((rep) => rep.id)).toEqual(['r-9']);
  });

  it('creates the profile of a representative and reads the list again', async () => {
    const outcome = await store.save(null, {
      sales_representative_id: 'r-9',
      agent_type: 'direct',
    });

    expect(outcome.ok).toBe(true);
    expect(api['createAgent']).toHaveBeenCalledWith({
      sales_representative_id: 'r-9',
      agent_type: 'direct',
    });
    expect(api['updateAgent']).not.toHaveBeenCalled();
    expect(api['listAgents']).toHaveBeenCalledTimes(1);
    expect(store.saving()).toBe(false);
  });

  it('updates the conditions of an existing agent', async () => {
    const outcome = await store.save('a-1', { default_rate: 7 });

    expect(outcome.ok).toBe(true);
    expect(api['updateAgent']).toHaveBeenCalledWith('a-1', { default_rate: 7 });
    expect(api['createAgent']).not.toHaveBeenCalled();
  });

  it('answers a refusal with the translated key and does not throw', async () => {
    api['createAgent'].mockReturnValue(problem('invalid_parent'));

    const outcome = await store.save(null, { sales_representative_id: 'r-9' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('agentCommissions.error.invalid_parent');
    expect(store.saving()).toBe(false);
    expect(api['listAgents']).not.toHaveBeenCalled();
  });

  it('deletes an agent from the list, or reports the refusal', async () => {
    await store.load();

    expect((await store.remove('a-2')).ok).toBe(true);
    expect(store.agents().map((entry) => entry.id)).toEqual(['a-1']);

    api['deleteAgent'].mockReturnValue(problem('generic', 409));
    const failure = await store.remove('a-1');
    expect(failure.ok).toBe(false);
    expect(store.agents()).toHaveLength(1);
  });
});
