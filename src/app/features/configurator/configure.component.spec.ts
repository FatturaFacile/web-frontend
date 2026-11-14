import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { icons } from '../../icons-provider';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ConfiguratorApiService,
  ConfiguratorConfiguration,
  ConfiguratorEvaluation,
  ConfiguratorModel,
  ConfiguratorViolation,
  PermissionsService,
} from '@core';
import { ResourceLookupService } from '@shared/ui/resource-panel/resource-lookup.service';
import { ConfigureComponent } from './configure.component';

describe('ConfigureComponent', () => {
  const group = (id: string, code: string, type: 'single' | 'multi' | 'range' | 'boolean', options: string[] = []) => ({
    id,
    model_id: 'm1',
    code,
    name: code,
    type,
    is_required: false,
    min_select: null,
    max_select: null,
    range_min: type === 'range' ? '1.0000' : null,
    range_max: type === 'range' ? '10.0000' : null,
    range_step: null,
    default_value: null,
    unit: type === 'range' ? 'm' : null,
    unit_price_delta: '30.0000',
    unit_cost: '0.0000',
    product_id: null,
    sort_order: 0,
    options: options.map((optionCode, index) => ({
      id: `${id}-${index}`,
      group_id: id,
      code: optionCode,
      name: optionCode,
      description: null,
      price_delta: '100.0000',
      price_multiplier: '1.0000',
      cost: '0.0000',
      product_id: null,
      price_from_product: false,
      is_default: false,
      is_active: true,
      sort_order: index,
    })),
  });

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
    volume_breaks: [],
    status: 'published',
    version: 2,
    published_at: '2027-06-10T08:00:00Z',
    created_at: '2027-06-10T08:00:00Z',
    groups: [group('g1', 'size', 'single', ['S', 'M']), group('g2', 'extras', 'multi', ['GPS']), group('g3', 'length', 'range'), group('g4', 'warranty', 'boolean', ['WARR'])],
  };

  const evaluation: ConfiguratorEvaluation = {
    valid: true,
    violations: [],
    selections: [{ group: 'size', options: ['S'], value: null }],
    applied_defaults: [{ group: 'size', option: 'S', source: 'option_default' }],
    pricing: {
      currency: 'EUR',
      quantity: '1.0000',
      multiplier: '1.0000',
      unit_list_price: '1000.0000',
      unit_net_price: '1000.0000',
      unit_cost: '600.0000',
      subtotal: '1000.00',
      discount_total: '0.00',
      total_net: '1000.00',
      total_tax: '220.00',
      total_gross: '1220.00',
      total_cost: '600.00',
      margin_amount: '400.00',
      margin_percent: '40.00',
      min_margin_percent: '15.00',
      below_minimum_margin: false,
      requires_approval: false,
      volume_discount_percent: '0.00',
      extra_discount_percent: '0.00',
      lines: [],
      applied_rules: [],
    },
  };

  const configuration = {
    id: 'c1',
    model_id: 'm1',
    number: 'CFG-2027-0001',
    name: 'Offer',
    contact_id: 'contact-1',
    price_list_id: null,
    quantity: '2.0000',
    discount_percent: '5.00',
    currency: 'EUR',
    selections: [{ group: 'size', options: ['M'], value: null }],
    pricing: evaluation.pricing,
    total_net: '1900.00',
    total_cost: '1200.00',
    margin_percent: '36.84',
    min_margin_percent: '15.00',
    requires_approval: false,
    status: 'validated',
    model_version: 2,
    quote_id: null,
    created_at: '2027-06-10T09:00:00Z',
  } as unknown as ConfiguratorConfiguration;

  const apiSpy = {
    getModels: vi.fn(),
    getModel: vi.fn(),
    getConfiguration: vi.fn(),
    evaluate: vi.fn(),
    createConfiguration: vi.fn(),
    updateConfiguration: vi.fn(),
    validateConfiguration: vi.fn(),
    requestApproval: vi.fn(),
    approveConfiguration: vi.fn(),
    rejectConfiguration: vi.fn(),
    convertToQuote: vi.fn(),
  };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

  async function create(url: string): Promise<ConfigureComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        provideRouter([{ path: 'configure', component: ConfigureComponent }]),
        { provide: ConfiguratorApiService, useValue: apiSpy },
        { provide: ResourceLookupService, useValue: { options: () => of([{ value: 'contact-1', label: 'Trasporti Bianchi' }]) } },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    return harness.navigateByUrl(url, ConfigureComponent);
  }

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    apiSpy.getModels.mockReturnValue(of({ data: [model] }));
    apiSpy.getModel.mockReturnValue(of({ data: model }));
    apiSpy.getConfiguration.mockReturnValue(of({ data: configuration }));
    apiSpy.evaluate.mockReturnValue(of({ data: evaluation }));
    apiSpy.createConfiguration.mockReturnValue(of({ data: configuration }));
    apiSpy.updateConfiguration.mockReturnValue(of({ data: configuration }));
    apiSpy.validateConfiguration.mockReturnValue(of({ data: evaluation }));
    apiSpy.requestApproval.mockReturnValue(of({ data: { ...configuration, status: 'pending_approval' } }));
    apiSpy.approveConfiguration.mockReturnValue(of({ data: { ...configuration, status: 'approved' } }));
    apiSpy.rejectConfiguration.mockReturnValue(of({ data: { ...configuration, status: 'rejected' } }));
    apiSpy.convertToQuote.mockReturnValue(of({ data: { ...configuration, status: 'converted' } }));
  });

  afterEach(() => vi.useRealTimers());

  it('opens a published model, evaluates it live and shows the defaults the API resolved', async () => {
    const component = await create('/configure?model=m1');
    await vi.advanceTimersByTimeAsync(300);

    expect(apiSpy.getModel).toHaveBeenCalledWith('m1');
    expect(apiSpy.evaluate).toHaveBeenCalledWith('m1', expect.objectContaining({ selections: [], apply_defaults: true, quantity: 1 }));
    expect(component.evaluation()?.pricing.total_net).toBe('1000.00');
    expect(component.singleAnswer(model.groups![0])).toBe('S');
  });

  it('sends only the groups the customer answered and goes back to the default on reset', async () => {
    const component = await create('/configure?model=m1');
    const [size, extras, length, warranty] = model.groups!;

    component.chooseSingle(size, 'M');
    component.chooseMulti(extras, ['GPS']);
    component.chooseRange(length, 4);
    component.chooseBoolean(warranty, 'WARR', true);
    await vi.advanceTimersByTimeAsync(300);

    expect(apiSpy.evaluate).toHaveBeenLastCalledWith(
      'm1',
      expect.objectContaining({
        selections: [
          { group: 'size', options: ['M'] },
          { group: 'extras', options: ['GPS'] },
          { group: 'length', value: 4 },
          { group: 'warranty', options: ['WARR'] },
        ],
      }),
    );

    component.resetGroup(size);
    expect(component.isTouched(size)).toBe(false);
    expect(component.singleAnswer(size)).toBe('S');
  });

  it('turns a violation into a translated message, with the API text as the fallback', async () => {
    const component = await create('/configure?model=m1');
    const violation: ConfiguratorViolation = { code: 'requires', severity: 'error', group: null, option: 'WARR', rule_id: 'r1', message: 'GPS needs the warranty: Warranty is required.', params: { rule: 'GPS needs the warranty', name: 'Warranty' } };

    expect(component.violationText(violation)).toBe('GPS needs the warranty: Warranty is required.');
  });

  it('creates the configuration on the first save and updates it afterwards', async () => {
    const component = await create('/configure?model=m1');
    component.setQuantity(2);
    component.setContact('contact-1');

    component.save();
    expect(apiSpy.createConfiguration).toHaveBeenCalledWith(expect.objectContaining({ model_id: 'm1', quantity: 2, contact_id: 'contact-1', apply_defaults: true }));
    expect(component.configuration()?.number).toBe('CFG-2027-0001');
    expect(component.dirty()).toBe(false);

    component.setDiscount(5);
    component.save();
    expect(apiSpy.updateConfiguration).toHaveBeenCalledWith('c1', expect.objectContaining({ discount_percent: 5 }));
  });

  it('loads a saved configuration with its answers, quantity, discount and customer', async () => {
    const component = await create('/configure?configuration=c1');

    expect(apiSpy.getConfiguration).toHaveBeenCalledWith('c1');
    expect(apiSpy.getModel).toHaveBeenCalledWith('m1');
    expect(component.quantity()).toBe(2);
    expect(component.discountPercent()).toBe(5);
    expect(component.contactId()).toBe('contact-1');
    expect(component.singleAnswer(model.groups![0])).toBe('M');
    expect(component.canConvert()).toBe(true);
  });

  it('validates a changed configuration after saving it', async () => {
    const component = await create('/configure?configuration=c1');
    component.setQuantity(3);

    component.validate();

    expect(apiSpy.updateConfiguration).toHaveBeenCalled();
    expect(apiSpy.validateConfiguration).toHaveBeenCalledWith('c1');
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('does not convert a configuration below the minimum margin until it is approved', async () => {
    apiSpy.getConfiguration.mockReturnValue(of({ data: { ...configuration, requires_approval: true } }));
    const component = await create('/configure?configuration=c1');
    expect(component.canConvert()).toBe(false);

    TestBed.resetTestingModule();
    apiSpy.getConfiguration.mockReturnValue(of({ data: { ...configuration, requires_approval: true, status: 'approved' } }));
    const approved = await create('/configure?configuration=c1');
    expect(approved.canConvert()).toBe(true);
  });

  it('approves and rejects through the decision dialog, a rejection needs a reason', async () => {
    apiSpy.getConfiguration.mockReturnValue(of({ data: { ...configuration, status: 'pending_approval', requires_approval: true } }));
    const component = await create('/configure?configuration=c1');
    expect(component.locked()).toBe(true);

    component.openDecision('approve');
    component.decisionNotes.setValue('Strategic customer');
    component.decide();
    expect(apiSpy.approveConfiguration).toHaveBeenCalledWith('c1', 'Strategic customer');

    component.openDecision('reject');
    component.decisionNotes.setValue('Too low');
    component.decide();
    expect(apiSpy.rejectConfiguration).toHaveBeenCalledWith('c1', 'Too low');
  });

  it('converts a validated configuration into a quote', async () => {
    apiSpy.getConfiguration.mockReturnValue(of({ data: { ...configuration, quote_number: 'Q-2027-0001' } }));
    const component = await create('/configure?configuration=c1');

    component.convert();

    expect(apiSpy.convertToQuote).toHaveBeenCalledWith('c1');
    expect(messageSpy.success).toHaveBeenCalled();
  });
});
