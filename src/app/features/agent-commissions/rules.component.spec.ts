import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  AgentCommissionsApiService,
  CatalogApiService,
  CrmApiService,
  PermissionsService,
  TranslateService,
} from '@core';
import { icons } from '../../icons-provider';
import { agent, rule, translateSpy, wrap, zone } from './agent-commissions.testing';
import { RuleFormDrawerComponent } from './rule-form-drawer.component';
import { resolveParamsOf, RuleSimulatorComponent } from './rule-simulator.component';
import { RulesComponent } from './rules.component';
import { RulesStore } from './rules.store';

const messageSpy = { success: vi.fn(), error: vi.fn() };
const rows = (root: HTMLElement) =>
  Array.from(root.querySelectorAll('tbody tr')).filter((row) => row.querySelector('td'));

function setup(options: { canWrite?: boolean; withStore?: boolean } = {}) {
  const api: Record<string, ReturnType<typeof vi.fn>> = {
    listRules: vi.fn(() =>
      of(
        wrap([
          rule('r-1', {
            name: 'Wine',
            priority: 10,
            agent_profile_id: 'a-1',
            product_category_id: 'p-1',
          }),
          rule('r-2', {
            name: 'Volume',
            priority: 50,
            zone_id: 'z-1',
            zone: { id: 'z-1', code: 'Zz-1', name: 'Zone z-1' },
            tiers: [
              { threshold_from: '0.00', threshold_to: '1000.00', rate: '2.0000' },
              { threshold_from: '1000.00', threshold_to: null, rate: '4.0000' },
            ],
          }),
          rule('r-3', {
            name: 'Flat',
            priority: 90,
            rate_type: 'fixed',
            fixed_amount: '25.00',
            accrual_basis: 'collected',
            is_active: false,
          }),
        ]),
      ),
    ),
    listAgents: vi.fn(() => of(wrap([agent('a-1'), agent('a-2')]))),
    listZones: vi.fn(() => of(wrap([zone('z-1')]))),
    createRule: vi.fn(() => of(wrap(rule('r-9')))),
    updateRule: vi.fn(() => of(wrap(rule('r-1')))),
    deleteRule: vi.fn(() => of(wrap(null))),
    resolveRule: vi.fn(() =>
      of(wrap({ rule: rule('r-1', { name: 'Wine' }), fallback_rate: null, zone_ids: [] })),
    ),
  };
  TestBed.configureTestingModule({
    providers: [
      ...(options.withStore ? [RulesStore] : []),
      { provide: AgentCommissionsApiService, useValue: api },
      {
        provide: CatalogApiService,
        useValue: { getCategories: vi.fn(() => of(wrap([{ id: 'p-1', name: 'Wine' }]))) },
      },
      {
        provide: CrmApiService,
        useValue: {
          getContactById: vi.fn(() =>
            of(wrap({ id: 'c-1', company_name: 'Acme', first_name: null, last_name: null })),
          ),
          getClients: vi.fn(() => of({ data: [] })),
        },
      },
      { provide: PermissionsService, useValue: { canWrite: () => options.canWrite ?? true } },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy() },
      provideNzIcons(icons),
    ],
  });
  return api;
}

describe('RulesComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  async function render() {
    const fixture = TestBed.createComponent(RulesComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('lists the rules by priority with the names of what they apply to', async () => {
    api = setup();
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body).toHaveLength(3);
    expect(body[0].textContent).toContain('Wine');
    expect(body[0].textContent).toContain('Agent a-1');
    expect(body[1].textContent).toContain('Volume');
    expect(body[2].textContent).toContain('Flat');
  });

  it('leaves the open dimensions as "any" and the agent of a general rule as "all agents"', async () => {
    api = setup();
    const fixture = await render();
    const volume = rows(fixture.nativeElement as HTMLElement)[1];

    expect(volume.textContent).toContain('agentCommissions.rules.generalRule');
    expect(volume.textContent).toContain('agentCommissions.rules.anyValue');
    expect(volume.textContent).toContain('Zz-1 Zone z-1');
  });

  it('shows the rate, the tiers or the fixed amount, and the accrual basis override', async () => {
    api = setup();
    const fixture = await render();
    const body = rows(fixture.nativeElement as HTMLElement);

    expect(body[0].textContent).toContain('7%');
    expect(body[0].textContent).toContain('agentCommissions.rateType.percentage');
    expect(body[1].textContent).toContain('agentCommissions.field.tiers');
    expect(body[1].textContent).toContain('(2)');
    expect(body[2].textContent).toContain('25.00');
    expect(body[2].textContent).toContain('agentCommissions.rateType.fixed');
    expect(body[2].textContent).toContain('agentCommissions.accrualBasis.collected');
    expect(body[2].textContent).toContain('agentCommissions.action.no');
  });

  it('shows the empty state', async () => {
    api = setup();
    api['listRules'].mockReturnValue(of(wrap([])));

    const fixture = await render();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.rules.empty',
    );
  });

  it('hides create, edit and delete from a read-only member but still shows the simulator', async () => {
    api = setup({ canWrite: false });

    const fixture = await render();
    const text = (fixture.nativeElement as HTMLElement).textContent as string;

    expect(text).not.toContain('agentCommissions.action.new');
    expect(text).not.toContain('agentCommissions.action.edit');
    expect(text).toContain('agentCommissions.rules.simulatorTitle');
  });

  it('opens the drawer to create and to edit', async () => {
    api = setup();
    const fixture = await render();
    const component = fixture.componentInstance;

    component.openNew();
    expect(component.drawerOpen()).toBe(true);
    expect(component.editing()).toBeNull();

    component.openEdit(component.store.rules()[0]);
    expect(component.editing()?.id).toBe('r-1');

    component.closeDrawer();
    expect(component.drawerOpen()).toBe(false);
  });

  it('deletes a rule, or shows the refusal', async () => {
    api = setup();
    const fixture = await render();
    const component = fixture.componentInstance;

    await component.remove(component.store.rules()[0]);
    expect(api['deleteRule']).toHaveBeenCalledWith('r-1');
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.deleted');

    api['deleteRule'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 409, error: { code: 'generic' } })),
    );
    await component.remove(component.store.rules()[0]);
    expect(component.actionError()).toBe('agentCommissions.error.generic');
  });
});

describe('RuleFormDrawerComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = setup({ withStore: true });
  });

  async function render(ruleToEdit: ReturnType<typeof rule> | null = null) {
    const fixture = TestBed.createComponent(RuleFormDrawerComponent);
    fixture.componentRef.setInput('visible', true);
    fixture.componentRef.setInput('rule', ruleToEdit);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('cannot save without a name and a rate', async () => {
    const drawer = (await render()).componentInstance;

    expect(drawer.valid()).toBe(false);
    await drawer.save();
    expect(api['createRule']).not.toHaveBeenCalled();
  });

  it('creates a percentage rule with its dimensions, validity and priority', async () => {
    const drawer = (await render()).componentInstance;
    const saved = vi.fn();
    drawer.saved.subscribe(saved);
    drawer.patch({
      name: 'Wine north',
      rate: 6,
      product_category_id: 'p-1',
      zone_id: 'z-1',
      customer_id: 'c-1',
      agent_profile_id: 'a-1',
      accrual_basis: 'collected',
      priority: 20,
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
    });

    await drawer.save();

    expect(api['createRule']).toHaveBeenCalledWith({
      name: 'Wine north',
      agent_profile_id: 'a-1',
      product_category_id: 'p-1',
      customer_id: 'c-1',
      zone_id: 'z-1',
      rate_type: 'percentage',
      rate: 6,
      fixed_amount: null,
      accrual_basis: 'collected',
      priority: 20,
      valid_from: '2026-01-01',
      valid_to: '2026-12-31',
      is_active: true,
      tiers: [],
    });
    expect(messageSpy.success).toHaveBeenCalledWith('agentCommissions.message.saved');
    expect(saved).toHaveBeenCalled();
  });

  it('sends the tiers of a progressive rule in place of the rate', async () => {
    const drawer = (await render()).componentInstance;
    drawer.patch({ name: 'Progressive' });
    drawer.addTier();
    drawer.patchTier(0, { to: 1000, rate: 2 });
    drawer.addTier();
    drawer.patchTier(1, { rate: 4 });

    expect(drawer.tiers()).toEqual([
      { from: 0, to: 1000, rate: 2 },
      { from: 1000, to: null, rate: 4 },
    ]);
    expect(drawer.valid()).toBe(true);

    await drawer.save();

    expect(api['createRule'].mock.calls[0][0].tiers).toEqual([
      { threshold_from: 0, threshold_to: 1000, rate: 2 },
      { threshold_from: 1000, threshold_to: null, rate: 4 },
    ]);
  });

  it('blocks tiers with a gap and removes a tier', async () => {
    const drawer = (await render()).componentInstance;
    drawer.patch({ name: 'Gap' });
    drawer.addTier();
    drawer.patchTier(0, { to: 1000, rate: 2 });
    drawer.addTier();
    drawer.patchTier(1, { from: 1500, rate: 4 });

    expect(drawer.tiersValid()).toBe(false);
    expect(drawer.valid()).toBe(false);

    drawer.removeTier(1);
    expect(drawer.tiers()).toHaveLength(1);
  });

  it('needs the amount of a fixed rule and ignores the tiers', async () => {
    const drawer = (await render()).componentInstance;
    drawer.patch({ name: 'Flat', rate_type: 'fixed' });
    drawer.addTier();

    expect(drawer.fixed()).toBe(true);
    expect(drawer.valid()).toBe(false);

    drawer.patch({ fixed_amount: 30 });
    await drawer.save();

    expect(api['createRule']).toHaveBeenCalledWith(
      expect.objectContaining({ rate_type: 'fixed', fixed_amount: 30, tiers: [] }),
    );
  });

  it('starts from the rule when editing, tiers included', async () => {
    const drawer = (
      await render(
        rule('r-2', {
          name: 'Volume',
          tiers: [{ threshold_from: '0.00', threshold_to: null, rate: '3.0000' }],
        }),
      )
    ).componentInstance;

    expect(drawer.editing()).toBe(true);
    expect(drawer.form().name).toBe('Volume');
    expect(drawer.tiers()).toEqual([{ from: 0, to: null, rate: 3 }]);

    drawer.patch({ priority: 5 });
    await drawer.save();
    expect(api['updateRule']).toHaveBeenCalledWith('r-2', expect.objectContaining({ priority: 5 }));
  });

  it('keeps the drawer open and shows the refusal of the API', async () => {
    api['createRule'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'rate_required' } })),
    );
    const drawer = (await render()).componentInstance;
    const saved = vi.fn();
    drawer.saved.subscribe(saved);
    drawer.patch({ name: 'x', rate: 5 });

    await drawer.save();

    expect(drawer.error()?.errorKey).toBe('agentCommissions.error.rate_required');
    expect(saved).not.toHaveBeenCalled();
  });

  it('keeps the customer already picked among the choices before any search', async () => {
    const drawer = (await render(rule('r-1', { customer_id: 'c-1' }))).componentInstance;

    expect(drawer.customerChoices().map((option) => option.id)).toEqual(['c-1']);
  });
});

describe('RuleSimulatorComponent', () => {
  let api: Record<string, ReturnType<typeof vi.fn>>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = setup({ withStore: true });
  });

  async function render() {
    const fixture = TestBed.createComponent(RuleSimulatorComponent);
    const store = TestBed.inject(RulesStore);
    await store.init();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  it('builds the request from the agent and the optional customer, product line and date', () => {
    expect(
      resolveParamsOf({ agentId: null, customerId: null, categoryId: null, date: '' }),
    ).toBeNull();
    expect(
      resolveParamsOf({ agentId: 'a-1', customerId: null, categoryId: null, date: '' }),
    ).toEqual({
      agent_profile_id: 'a-1',
    });
    expect(
      resolveParamsOf({ agentId: 'a-1', customerId: 'c-1', categoryId: 'p-1', date: '2026-03-10' }),
    ).toEqual({
      agent_profile_id: 'a-1',
      customer_id: 'c-1',
      product_category_id: 'p-1',
      date: '2026-03-10',
    });
  });

  it('cannot simulate before an agent is picked', async () => {
    const component = (await render()).componentInstance;

    expect(component.params()).toBeNull();
    await component.simulate();
    expect(api['resolveRule']).not.toHaveBeenCalled();
  });

  it('shows the winning rule', async () => {
    const fixture = await render();
    const component = fixture.componentInstance;
    component.agentId.set('a-1');
    component.customerId.set('c-1');
    component.date.set('2026-03-10');

    await component.simulate();
    fixture.detectChanges();

    expect(api['resolveRule']).toHaveBeenCalledWith({
      agent_profile_id: 'a-1',
      customer_id: 'c-1',
      date: '2026-03-10',
    });
    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('agentCommissions.rules.simulatorWinner');
    expect(text).toContain('Wine');
    expect(text).toContain('7%');
  });

  it('shows the default rate when no rule applies', async () => {
    api['resolveRule'].mockReturnValue(
      of(wrap({ rule: null, fallback_rate: '5.5000', zone_ids: [] })),
    );
    const fixture = await render();
    const component = fixture.componentInstance;
    component.agentId.set('a-1');

    await component.simulate();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('agentCommissions.rules.simulatorFallback');
    expect(text).toContain('5.5%');
  });

  it('shows the tiers of a progressive winner', async () => {
    api['resolveRule'].mockReturnValue(
      of(
        wrap({
          rule: rule('r-2', {
            name: 'Volume',
            tiers: [
              { threshold_from: '0.00', threshold_to: '1000.00', rate: '2.0000' },
              { threshold_from: '1000.00', threshold_to: null, rate: '4.0000' },
            ],
          }),
          fallback_rate: null,
          zone_ids: [],
        }),
      ),
    );
    const fixture = await render();
    fixture.componentInstance.agentId.set('a-1');

    await fixture.componentInstance.simulate();
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent as string;
    expect(text).toContain('Volume');
    expect(text).toContain('2%');
    expect(text).toContain('4%');
  });

  it('shows the error of a failed simulation', async () => {
    api['resolveRule'].mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 404, error: {} })),
    );
    const fixture = await render();
    fixture.componentInstance.agentId.set('a-1');

    await fixture.componentInstance.simulate();
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain(
      'agentCommissions.error.generic',
    );
  });
});
