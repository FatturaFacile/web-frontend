import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { icons } from '../../icons-provider';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ConfiguratorApiService, ConfiguratorConfiguration, ConfiguratorModel, PermissionsService } from '@core';
import { ConfiguratorComponent } from './configurator.component';

describe('ConfiguratorComponent', () => {
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
    status: 'draft',
    version: 1,
    published_at: null,
    created_at: '2027-06-10T08:00:00Z',
  };

  const configuration = {
    id: 'c1',
    model_id: 'm1',
    model: { id: 'm1', code: 'TRK-1', name: 'Electric truck', version: 2 },
    number: 'CFG-2027-0001',
    name: null,
    contact_id: null,
    contact: null,
    price_list_id: null,
    quantity: '1.0000',
    discount_percent: '0.00',
    currency: 'EUR',
    selections: [],
    pricing: null,
    total_net: '937.20',
    total_cost: '848.00',
    margin_percent: '9.52',
    min_margin_percent: '15.00',
    requires_approval: true,
    status: 'validated',
    model_version: 2,
    created_by: null,
    validated_at: null,
    approval_requested_by: null,
    approval_requested_at: null,
    decided_by: null,
    decided_at: null,
    decision_notes: null,
    quote_id: null,
    converted_at: null,
    created_at: '2027-06-10T09:00:00Z',
  } as ConfiguratorConfiguration;

  const apiSpy = {
    getModels: vi.fn(),
    getConfigurations: vi.fn(),
    createModel: vi.fn(),
    archiveModel: vi.fn(),
    deleteModel: vi.fn(),
    deleteConfiguration: vi.fn(),
  };
  const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };

  async function create(): Promise<ConfiguratorComponent> {
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        provideRouter([{ path: 'configurator', component: ConfiguratorComponent }]),
        { provide: ConfiguratorApiService, useValue: apiSpy },
        { provide: NzMessageService, useValue: messageSpy },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
      ],
    });
    const harness = await RouterTestingHarness.create();
    return harness.navigateByUrl('/configurator', ConfiguratorComponent);
  }

  beforeEach(() => {
    vi.clearAllMocks();
    apiSpy.getModels.mockReturnValue(of({ data: [model] }));
    apiSpy.getConfigurations.mockReturnValue(of({ data: [configuration] }));
    apiSpy.createModel.mockReturnValue(of({ data: { ...model, id: 'm2' } }));
    apiSpy.archiveModel.mockReturnValue(of({ data: { ...model, status: 'archived' } }));
    apiSpy.deleteModel.mockReturnValue(of(undefined));
    apiSpy.deleteConfiguration.mockReturnValue(of(undefined));
  });

  it('loads the models and the configurations', async () => {
    const component = await create();

    expect(apiSpy.getModels).toHaveBeenCalled();
    expect(apiSpy.getConfigurations).toHaveBeenCalledWith({ status: undefined });
    expect(component.models()).toEqual([model]);
    expect(component.configurations()).toHaveLength(1);
  });

  it('filters the configurations by status', async () => {
    const component = await create();

    component.setStatusFilter('pending_approval');

    expect(apiSpy.getConfigurations).toHaveBeenLastCalledWith({ status: 'pending_approval' });
  });

  it('refuses a model without code and name, and creates a valid one', async () => {
    const component = await create();
    component.openModelModal();

    component.createModel();
    expect(apiSpy.createModel).not.toHaveBeenCalled();

    component.modelForm.patchValue({ code: 'TRK-2', name: 'Cargo truck', base_price: 2000, base_cost: 1500, currency: 'CHF', min_margin_percent: 20 });
    component.createModel();

    expect(apiSpy.createModel).toHaveBeenCalledWith({
      code: 'TRK-2',
      name: 'Cargo truck',
      base_price: 2000,
      base_cost: 1500,
      currency: 'CHF',
      tax_rate: 22,
      min_margin_percent: 20,
    });
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('rejects a model code with spaces', async () => {
    const component = await create();
    component.openModelModal();

    component.modelForm.patchValue({ code: 'bad code', name: 'Name' });

    expect(component.modelForm.controls.code.hasError('pattern')).toBe(true);
  });

  it('archives and deletes through the API and reloads', async () => {
    const component = await create();

    component.archiveModel(model);
    component.deleteModel(model);
    component.deleteConfiguration(configuration);

    expect(apiSpy.archiveModel).toHaveBeenCalledWith('m1');
    expect(apiSpy.deleteModel).toHaveBeenCalledWith('m1');
    expect(apiSpy.deleteConfiguration).toHaveBeenCalledWith('c1');
    expect(apiSpy.getModels).toHaveBeenCalledTimes(3);
  });

  it('shows the message of the server when an action fails', async () => {
    const component = await create();
    apiSpy.archiveModel.mockReturnValue(throwError(() => ({ error: { message: 'Not allowed' } })));

    component.archiveModel(model);

    expect(messageSpy.error).toHaveBeenCalledWith('Not allowed');
  });
});
