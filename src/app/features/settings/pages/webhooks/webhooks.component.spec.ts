import { TestBed } from '@angular/core/testing';
import { NzModalService } from 'ng-zorro-antd/modal';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PermissionsService, WebhooksApiService } from '@core';
import { HubTab } from '../../../resource-hub/hub.types';
import { WebhooksComponent } from './webhooks.component';

describe('WebhooksComponent', () => {
  const api = {
    getEndpoints: vi.fn(),
    createEndpoint: vi.fn(),
    updateEndpoint: vi.fn(),
    deleteEndpoint: vi.fn(),
    enableEndpoint: vi.fn(),
    disableEndpoint: vi.fn(),
    testEndpoint: vi.fn(),
    rotateEndpointSecret: vi.fn(),
    getDeliveries: vi.fn(),
    redeliver: vi.fn(),
    getEventCatalog: vi.fn(),
  };
  const modal = { info: vi.fn() };

  function tabs(): HubTab[] {
    const fixture = TestBed.createComponent(WebhooksComponent);
    return (fixture.componentInstance as unknown as { tabs(): HubTab[] }).tabs();
  }

  beforeEach(() => {
    vi.clearAllMocks();
    api.createEndpoint.mockReturnValue(of({ data: { id: 'e1', secret: 'whsec_x' } }));
    api.rotateEndpointSecret.mockReturnValue(of({ data: { id: 'e1', secret: 'whsec_y' } }));
    api.getDeliveries.mockReturnValue(of({ data: [] }));
    TestBed.overrideProvider(NzModalService, { useValue: modal }).configureTestingModule({
      imports: [WebhooksComponent],
      providers: [
        { provide: WebhooksApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzModalService, useValue: modal },
      ],
    });
  });

  it('offers endpoints, deliveries, redelivery and the event catalog', () => {
    expect(tabs().map((t) => t.title)).toEqual([
      'WEBHOOKS.TAB_ENDPOINTS',
      'WEBHOOKS.TAB_DELIVERIES',
      'WEBHOOKS.TAB_REDELIVER',
      'WEBHOOKS.TAB_CATALOG',
    ]);
  });

  it('creates an endpoint splitting the events and shows the secret once', () => {
    const tab = tabs()[0];
    if (tab.kind !== 'crud') {
      throw new Error('crud expected');
    }
    tab.config.create?.({ name: 'ERP', url: 'https://x.test', events: 'invoice.issued, quote.sent' }).subscribe();
    expect(api.createEndpoint).toHaveBeenCalledWith({ name: 'ERP', url: 'https://x.test', events: ['invoice.issued', 'quote.sent'] });
    expect(modal.info).toHaveBeenCalled();
  });

  it('passes the filters to the delivery log', () => {
    const tab = tabs()[1];
    if (tab.kind !== 'report') {
      throw new Error('report expected');
    }
    tab.load({ status: 'dead' }).subscribe();
    expect(api.getDeliveries).toHaveBeenCalledWith({ status: 'dead' });
  });

  it('redelivers by id', () => {
    api.redeliver.mockReturnValue(of({ data: {} }));
    const tab = tabs()[2];
    if (tab.kind !== 'form') {
      throw new Error('form expected');
    }
    tab.submit({ id: 'd1' }).subscribe();
    expect(api.redeliver).toHaveBeenCalledWith('d1');
  });
});
