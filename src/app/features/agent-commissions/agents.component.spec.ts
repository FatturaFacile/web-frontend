import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AgentCommissionsApiService, PermissionsService, TranslateService } from '@core';
import { icons } from '../../icons-provider';
import { agent, translateSpy, wrap } from './agent-commissions.testing';
import { AgentFormDrawerComponent } from './agent-form-drawer.component';
import { AgentsComponent } from './agents.component';
import { AgentsStore } from './agents.store';
import { AGENT_COMMISSIONS_MODULE } from './agent-commissions.util';

const messageSpy = { success: vi.fn(), error: vi.fn() };
const representative = {
  id: 'r-9',
  rep_code: 'R9',
  name: 'Free Rep',
  email: null,
  default_commission_rate: '4.5000',
};

describe('AgentsComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;
  let canWrite: boolean;
  let writeChecks: string[];

  beforeEach(() => {
    vi.clearAllMocks();
    canWrite = true;
    writeChecks = [];
    api = {
      listAgents: vi.fn(() =>
        of(
          wrap([
            agent('a-1'),
            agent('a-2', {
              agent_type: 'sub_agent',
              parent_agent_profile_id: 'a-1',
              parent_name: 'Agent a-1',
              fiscal_regime: 'swiss_direct',
              enasarco_mandate: null,
              settlement_channel: 'salary',
              accrual_basis: 'invoiced',
              is_active: false,
            }),
          ]),
        ),
      ),
      getAvailableRepresentatives: vi.fn(() => of(wrap([representative]))),
      createAgent: vi.fn(() => of(wrap(agent('a-3')))),
      updateAgent: vi.fn(() => of(wrap(agent('a-1')))),
      deleteAgent: vi.fn(() => of(wrap(null))),
    };
    TestBed.configureTestingModule({
      providers: [
        { provide: AgentCommissionsApiService, useValue: api },
        {
          provide: PermissionsService,
          useValue: {
            canWrite: (module: string) => {
              writeChecks.push(module);
              return canWrite;
            },
          },
        },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render() {
    const fixture = TestBed.createComponent(AgentsComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const rows = (root: HTMLElement) =>
    Array.from(root.querySelectorAll('tbody tr')).filter((row) => row.querySelector('td'));

  it('lists the agents with type, regime, accrual basis, rate and channel', async () => {
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body).toHaveLength(2);
    expect(body[0].textContent).toContain('Agent a-1');
    expect(body[0].textContent).toContain('agentCommissions.agentType.multi_mandate');
    expect(body[0].textContent).toContain('agentCommissions.fiscalRegime.enasarco');
    expect(body[0].textContent).toContain('agentCommissions.enasarcoMandate.multi');
    expect(body[0].textContent).toContain('agentCommissions.accrualBasis.collected');
    expect(body[0].textContent).toContain('6.5%');
    expect(body[0].textContent).toContain('agentCommissions.settlementChannel.invoice');
    expect(body[0].textContent).toContain('agentCommissions.action.yes');
  });

  it('shows the parent of a sub-agent, the Swiss regime without a mandate and the inactive state', async () => {
    const fixture = await render();
    const second = rows(fixture.nativeElement as HTMLElement)[1];

    expect(second.textContent).toContain('agentCommissions.agentType.sub_agent');
    expect(second.textContent).toContain('agentCommissions.field.parentAgent');
    expect(second.textContent).toContain('Agent a-1');
    expect(second.textContent).toContain('agentCommissions.fiscalRegime.swiss_direct');
    expect(second.textContent).not.toContain('agentCommissions.enasarcoMandate');
    expect(second.textContent).toContain('agentCommissions.settlementChannel.salary');
    expect(second.textContent).toContain('agentCommissions.action.no');
  });

  it('shows the empty state when no agent is configured', async () => {
    api['listAgents'].mockReturnValue(of(wrap([])));

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.agents.empty',
    );
  });

  it('shows the load failure with its translation key', async () => {
    api['listAgents'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 500, error: { code: 'generic' } })),
    );

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.error.generic',
    );
  });

  it('gates the actions with the module of the commissions', async () => {
    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(writeChecks).toContain(AGENT_COMMISSIONS_MODULE);
    expect(text).toContain('agentCommissions.action.new');
    expect(text).toContain('agentCommissions.action.edit');
    expect(text).toContain('agentCommissions.action.delete');
  });

  it('hides create, edit and delete from a read-only member', async () => {
    canWrite = false;

    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).not.toContain('agentCommissions.action.new');
    expect(text).not.toContain('agentCommissions.action.edit');
    expect(text).not.toContain('agentCommissions.action.delete');
    expect(rows(fixture.nativeElement as HTMLElement)).toHaveLength(2);
  });

  it('opens the drawer empty for a new agent and filled for an existing one', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    component.openNew();
    expect(component.drawerOpen()).toBe(true);
    expect(component.editing()).toBeNull();

    component.closeDrawer();
    expect(component.drawerOpen()).toBe(false);

    component.openEdit(component.store.agents()[0]);
    expect(component.drawerOpen()).toBe(true);
    expect(component.editing()?.id).toBe('a-1');
  });

  it('deletes an agent and reports it', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;

    await component.remove(component.store.agents()[0]);

    expect(api['deleteAgent']).toHaveBeenCalledWith('a-1');
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.deleted');
    expect(component.store.agents().map((entry) => entry.id)).toEqual(['a-2']);
  });

  it('shows the refusal of a delete', async () => {
    api['deleteAgent'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'generic' } })),
    );
    const fixture = await render();
    const component = fixture.componentInstance;

    await component.remove(component.store.agents()[0]);
    fixture.detectChanges();

    expect(component.actionError()).toBe('agentCommissions.error.generic');
    expect(messageSpy.success).not.toHaveBeenCalled();
    expect(component.store.agents()).toHaveLength(2);
  });
});

describe('AgentFormDrawerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = {
      listAgents: vi.fn(() =>
        of(wrap([agent('a-1'), agent('a-2', { parent_agent_profile_id: 'a-1' })])),
      ),
      getAvailableRepresentatives: vi.fn(() => of(wrap([representative]))),
      createAgent: vi.fn(() => of(wrap(agent('a-3')))),
      updateAgent: vi.fn(() => of(wrap(agent('a-1')))),
    };
    TestBed.configureTestingModule({
      providers: [
        AgentsStore,
        { provide: AgentCommissionsApiService, useValue: api },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: TranslateService, useValue: translateSpy() },
        provideNzIcons(icons),
      ],
    });
  });

  async function render(agentToEdit: ReturnType<typeof agent> | null = null) {
    const fixture = TestBed.createComponent(AgentFormDrawerComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('agent', agentToEdit);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('loads the representatives without a profile when a new agent is opened', async () => {
    await render();

    expect(api['getAvailableRepresentatives']).toHaveBeenCalledTimes(1);
  });

  it('does not load them to edit an existing agent', async () => {
    const fixture = await render(agent('a-1'));

    expect(api['getAvailableRepresentatives']).not.toHaveBeenCalled();
    expect(fixture.componentInstance.editing()).toBe(true);
    expect(fixture.componentInstance.form().default_rate).toBe(6.5);
  });

  it('cannot save a new agent before a representative is picked', async () => {
    const fixture = await render();
    const drawer = fixture.componentInstance;

    expect(drawer.valid()).toBe(false);
    await drawer.save();
    expect(api['createAgent']).not.toHaveBeenCalled();
  });

  it('proposes the default rate of the representative and creates the profile', async () => {
    const fixture = await render();
    const drawer = fixture.componentInstance;
    const saved = vi.fn();
    drawer.saved.subscribe(saved);
    await drawer.store.loadRepresentatives();

    drawer.pickRepresentative('r-9');
    expect(drawer.form().default_rate).toBe(4.5);
    drawer.patch({ accrual_basis: 'collected', fiscal_regime: 'aec', enasarco_mandate: 'multi' });
    await drawer.save();

    expect(api['createAgent']).toHaveBeenCalledWith(
      expect.objectContaining({
        sales_representative_id: 'r-9',
        accrual_basis: 'collected',
        fiscal_regime: 'aec',
        enasarco_mandate: 'multi',
        default_rate: 4.5,
      }),
    );
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.saved');
    expect(saved).toHaveBeenCalled();
  });

  it('keeps the rate the user typed when a representative is picked', async () => {
    const fixture = await render();
    const drawer = fixture.componentInstance;
    await drawer.store.loadRepresentatives();
    drawer.patch({ default_rate: 9 });

    drawer.pickRepresentative('r-9');

    expect(drawer.form().default_rate).toBe(9);
  });

  it('updates an existing agent without sending the representative', async () => {
    const fixture = await render(agent('a-1'));
    const drawer = fixture.componentInstance;
    drawer.patch({ default_rate: 8, settlement_channel: 'salary' });

    await drawer.save();

    expect(api['updateAgent']).toHaveBeenCalledTimes(1);
    const [id, payload] = api['updateAgent'].mock.calls[0] as [string, Record<string, unknown>];
    expect(id).toBe('a-1');
    expect(payload).not.toHaveProperty('sales_representative_id');
    expect(payload).toMatchObject({ default_rate: 8, settlement_channel: 'salary' });
  });

  it('shows the fields of the regime and the sub-agent only when they apply', async () => {
    const fixture = await render(agent('a-1'));
    const drawer = fixture.componentInstance;

    expect(drawer.italian()).toBe(true);
    expect(drawer.subAgent()).toBe(false);

    drawer.patch({ fiscal_regime: 'swiss_direct', agent_type: 'sub_agent' });
    expect(drawer.italian()).toBe(false);
    expect(drawer.subAgent()).toBe(true);
  });

  it('offers as parent the agents that are not sub-agents themselves, never the edited one', async () => {
    const fixture = await render(agent('a-2'));
    await fixture.componentInstance.store.load();

    expect(fixture.componentInstance.parents().map((entry) => entry.id)).toEqual(['a-1']);
  });

  it('keeps the drawer open and shows the refusal of the API', async () => {
    api['updateAgent'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'invalid_parent' } })),
    );
    const fixture = await render(agent('a-1'));
    const drawer = fixture.componentInstance;
    const saved = vi.fn();
    drawer.saved.subscribe(saved);

    await drawer.save();

    expect(drawer.error()?.errorKey).toBe('agentCommissions.error.invalid_parent');
    expect(saved).not.toHaveBeenCalled();
    expect(messageSpy.success).not.toHaveBeenCalled();
  });
});
