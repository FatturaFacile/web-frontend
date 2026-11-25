import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CsTemplate, CustomerSatisfactionApiService } from '@core';
import { TemplatesStore } from './templates.store';

const list = (data: unknown[]) => of({ success: true, message: '', data });
const done = of({ success: true, message: '', data: {} });

describe('TemplatesStore', () => {
  const api = {
    listTemplates: vi.fn(),
    createTemplate: vi.fn(),
    updateTemplate: vi.fn(),
    deleteTemplate: vi.fn(),
    installDefaultTemplates: vi.fn(),
    getLookups: vi.fn(),
  };
  let store: InstanceType<typeof TemplatesStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    api.listTemplates.mockReturnValue(
      list([{ id: 't1', code: 'NPS-TICKET-CLOSED', is_active: true }]),
    );
    for (const name of [
      'createTemplate',
      'updateTemplate',
      'deleteTemplate',
      'installDefaultTemplates',
    ]) {
      (api as Record<string, ReturnType<typeof vi.fn>>)[name].mockReturnValue(done);
    }
    TestBed.configureTestingModule({
      providers: [TemplatesStore, { provide: CustomerSatisfactionApiService, useValue: api }],
    });
    store = TestBed.inject(TemplatesStore);
  });

  it('loads the templates', async () => {
    await store.load();

    expect(store.templates()).toHaveLength(1);
    expect(store.loading()).toBe(false);
  });

  it('creates without an id and updates with one, then reloads', async () => {
    const payload = {
      code: 'CES-NEW',
      name: 'CES',
      survey_type: 'ces' as const,
      trigger_event: 'ticket_closed' as const,
      channels: ['email' as const],
      cooldown_days: 60,
    };

    expect((await store.save(payload)).ok).toBe(true);
    expect(api.createTemplate).toHaveBeenCalledWith(payload);
    expect((await store.save(payload, 't1')).ok).toBe(true);
    expect(api.updateTemplate).toHaveBeenCalledWith('t1', payload);
    expect(api.listTemplates).toHaveBeenCalledTimes(2);
  });

  it('switches a template off and on without sending the rest of it', async () => {
    await store.toggleActive({ id: 't1', is_active: true } as CsTemplate);

    expect(api.updateTemplate).toHaveBeenCalledWith('t1', { is_active: false });
  });

  it('removes a template and installs the stock ones', async () => {
    expect((await store.remove('t1')).ok).toBe(true);
    expect(api.deleteTemplate).toHaveBeenCalledWith('t1');

    expect((await store.installDefaults()).ok).toBe(true);
    expect(api.installDefaultTemplates).toHaveBeenCalledTimes(1);
  });
});
