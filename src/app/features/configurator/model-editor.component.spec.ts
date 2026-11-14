import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfiguratorApiService, ConfiguratorModel, InventoryApiService, PermissionsService } from '@core';
import { ModelEditorComponent } from './model-editor.component';

describe('ModelEditorComponent', () => {
  const model: ConfiguratorModel = {
    id: 'm1',
    code: 'TRK-1',
    name: 'Electric truck',
    description: null,
    base_product_id: null,
    base_price_from_product: false,
    base_price: '1000.0000',
    base_cost: '600.0000',
    currency: 'EUR',
    tax_rate: '22.00',
    min_margin_percent: '15.00',
    volume_breaks: [{ min_quantity: '10.0000', discount_percent: '5.00' }],
    status: 'draft',
    version: 1,
    published_at: null,
    created_at: '2027-06-10T08:00:00Z',
    groups: [
      {
        id: 'g1',
        model_id: 'm1',
        code: 'size',
        name: 'Size',
        type: 'single',
        is_required: true,
        min_select: null,
        max_select: null,
        range_min: null,
        range_max: null,
        range_step: null,
        default_value: null,
        unit: null,
        unit_price_delta: '0.0000',
        unit_cost: '0.0000',
        product_id: null,
        sort_order: 0,
        options: [
          { id: 'o1', group_id: 'g1', code: 'S', name: 'Small', description: null, price_delta: '0.0000', price_multiplier: '1.0000', cost: '0.0000', product_id: null, price_from_product: false, is_default: true, is_active: true, sort_order: 0 },
          { id: 'o2', group_id: 'g1', code: 'M', name: 'Medium', description: null, price_delta: '100.0000', price_multiplier: '1.0000', cost: '60.0000', product_id: null, price_from_product: false, is_default: false, is_active: true, sort_order: 1 },
        ],
      },
    ],
    rules: [
      {
        id: 'r1',
        model_id: 'm1',
        name: 'Medium needs small support',
        type: 'requires',
        match: 'all',
        conditions: [{ type: 'option', option: 'M', negate: false }],
        target_options: ['S'],
        price_effect_type: null,
        price_effect_value: null,
        message: null,
        priority: 100,
        is_active: true,
      },
    ],
  };

  const apiSpy = {
    getModel: vi.fn(),
    updateModel: vi.fn(),
    publishModel: vi.fn(),
    checkRules: vi.fn(),
    createGroup: vi.fn(),
    updateGroup: vi.fn(),
    deleteGroup: vi.fn(),
    createOption: vi.fn(),
    updateOption: vi.fn(),
    deleteOption: vi.fn(),
    createRule: vi.fn(),
    updateRule: vi.fn(),
    deleteRule: vi.fn(),
  };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

  async function create(): Promise<ModelEditorComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        provideRouter([{ path: 'models/:id', component: ModelEditorComponent }]),
        { provide: ConfiguratorApiService, useValue: apiSpy },
        { provide: InventoryApiService, useValue: { getProducts: () => of({ data: [] }) } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    return harness.navigateByUrl('/models/m1', ModelEditorComponent);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    apiSpy.getModel.mockReturnValue(of({ data: model }));
    for (const name of ['updateModel', 'publishModel', 'createGroup', 'updateGroup', 'createOption', 'updateOption', 'createRule', 'updateRule']) {
      (apiSpy as Record<string, ReturnType<typeof vi.fn>>)[name].mockReturnValue(of({ data: model }));
    }
    for (const name of ['deleteGroup', 'deleteOption', 'deleteRule']) {
      (apiSpy as Record<string, ReturnType<typeof vi.fn>>)[name].mockReturnValue(of(undefined));
    }
    apiSpy.checkRules.mockReturnValue(of({ data: { valid: false, problems: [{ code: 'requires_cycle', message: 'cycle', rule_ids: ['r1'] }] } }));
  });

  it('loads the model of the route with its groups, options and rules', async () => {
    const component = await create();

    expect(apiSpy.getModel).toHaveBeenCalledWith('m1');
    expect(component.groups()).toHaveLength(1);
    expect(component.rules()).toHaveLength(1);
    expect(component.optionChoices().map((choice) => choice.code)).toEqual(['S', 'M']);
    expect(component.modelForm.getRawValue().base_price).toBe(1000);
    expect(component.breaks.length).toBe(1);
  });

  it('saves the header with the quantity breaks', async () => {
    const component = await create();
    component.addBreak(50, 8);

    component.saveModel();

    const payload = apiSpy.updateModel.mock.calls[0][1];
    expect(apiSpy.updateModel.mock.calls[0][0]).toBe('m1');
    expect(payload.volume_breaks).toEqual([
      { min_quantity: 10, discount_percent: 5 },
      { min_quantity: 50, discount_percent: 8 },
    ]);
    expect(payload.min_margin_percent).toBe(15);
  });

  it('sends only the fields of the type of a group', async () => {
    const component = await create();
    component.openGroupModal();
    component.groupForm.patchValue({ code: 'length', name: 'Length', type: 'range', range_min: 1, range_max: 10, range_step: 0.5, unit: 'm', unit_price_delta: 30, unit_cost: 12, min_select: 2 });

    component.saveGroup();

    expect(apiSpy.createGroup).toHaveBeenCalledWith('m1', {
      code: 'length',
      name: 'Length',
      type: 'range',
      is_required: false,
      min_select: null,
      max_select: null,
      range_min: 1,
      range_max: 10,
      range_step: 0.5,
      default_value: null,
      unit: 'm',
      unit_price_delta: 30,
      unit_cost: 12,
      product_id: null,
    });
  });

  it('creates an option in its group and updates an existing one', async () => {
    const component = await create();
    const group = component.groups()[0];

    component.openOptionModal(group);
    component.optionForm.patchValue({ code: 'L', name: 'Large', price_delta: 250, cost: 150 });
    component.saveOption();
    expect(apiSpy.createOption).toHaveBeenCalledWith('g1', expect.objectContaining({ code: 'L', price_delta: 250, cost: 150, is_active: true }));

    component.openOptionModal(group, group.options![1]);
    component.optionForm.patchValue({ price_delta: 120 });
    component.saveOption();
    expect(apiSpy.updateOption).toHaveBeenCalledWith('o2', expect.objectContaining({ code: 'M', price_delta: 120 }));
  });

  it('builds option and range conditions of a rule, and a price rule has no targets', async () => {
    const component = await create();
    component.openRuleModal();
    component.ruleForm.patchValue({ name: 'Bundle discount', type: 'price_rule', price_effect_type: 'amount', price_effect_value: -50 });
    component.addCondition({ type: 'option', option: 'M', negate: false });
    component.addCondition({ type: 'range', group: 'length', operator: 'gt', value: 3 });

    component.saveRule();

    expect(apiSpy.createRule).toHaveBeenCalledWith('m1', {
      name: 'Bundle discount',
      type: 'price_rule',
      match: 'all',
      conditions: [
        { type: 'option', option: 'M', negate: false },
        { type: 'range', group: 'length', operator: 'gt', value: 3 },
      ],
      target_options: null,
      price_effect_type: 'amount',
      price_effect_value: -50,
      message: null,
      priority: 100,
      is_active: true,
    });
  });

  it('describes the conditions and the effect of a rule', async () => {
    const component = await create();
    const rule = component.rules()[0];

    expect(component.describeConditions(rule)).toBe('M');
    expect(component.describeEffect(rule)).toBe('S');
  });

  it('publishes the model and shows the problems found by the rule check', async () => {
    const component = await create();

    component.checkRules();
    expect(component.ruleCheck()?.valid).toBe(false);
    expect(component.ruleCheck()?.problems[0].code).toBe('requires_cycle');

    component.publish();
    expect(apiSpy.publishModel).toHaveBeenCalledWith('m1');
    expect(component.ruleCheck()).toBeNull();
  });
});
