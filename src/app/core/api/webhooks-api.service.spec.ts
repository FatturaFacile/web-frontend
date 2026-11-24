import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { WebhooksApiService } from './webhooks-api.service';

describe('WebhooksApiService', () => {
  let service: WebhooksApiService;
  let httpTesting: HttpTestingController;
  const base = `${environment.apiBaseUrl}/integrations`;
  const ok = { success: true, message: '', data: { id: 'e1' } };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [WebhooksApiService, provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(WebhooksApiService);
    httpTesting = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpTesting.verify();
  });

  it('loads the event catalog and the endpoints', () => {
    service.getEventCatalog().subscribe();
    httpTesting.expectOne(`${base}/webhook-events`).flush(ok);

    service.getEndpoints().subscribe();
    httpTesting.expectOne(`${base}/webhook-endpoints`).flush({ ...ok, data: [], meta: {} });

    service.getEndpoint('e1').subscribe();
    httpTesting.expectOne(`${base}/webhook-endpoints/e1`).flush(ok);
  });

  it('creates, updates, toggles, tests and deletes an endpoint', () => {
    service.createEndpoint({ name: 'ERP', url: 'https://example.com/hook', events: ['invoice.issued'] }).subscribe();
    const create = httpTesting.expectOne(`${base}/webhook-endpoints`);
    expect(create.request.method).toBe('POST');
    create.flush(ok);

    service.updateEndpoint('e1', { name: 'ERP 2' }).subscribe();
    const update = httpTesting.expectOne(`${base}/webhook-endpoints/e1`);
    expect(update.request.method).toBe('PUT');
    update.flush(ok);

    service.rotateEndpointSecret('e1', 24).subscribe();
    const rotate = httpTesting.expectOne(`${base}/webhook-endpoints/e1/rotate-secret`);
    expect(rotate.request.body).toEqual({ overlap_hours: 24 });
    rotate.flush(ok);

    service.disableEndpoint('e1').subscribe();
    httpTesting.expectOne(`${base}/webhook-endpoints/e1/disable`).flush(ok);
    service.enableEndpoint('e1').subscribe();
    httpTesting.expectOne(`${base}/webhook-endpoints/e1/enable`).flush(ok);
    service.testEndpoint('e1').subscribe();
    httpTesting.expectOne(`${base}/webhook-endpoints/e1/test`).flush(ok);

    service.deleteEndpoint('e1').subscribe();
    const del = httpTesting.expectOne(`${base}/webhook-endpoints/e1`);
    expect(del.request.method).toBe('DELETE');
    del.flush(null);
  });

  it('lists and redelivers deliveries', () => {
    service.getDeliveries({ status: 'dead', endpoint_id: 'e1' }).subscribe();
    const list = httpTesting.expectOne((r) => r.url === `${base}/webhook-deliveries`);
    expect(list.request.params.get('status')).toBe('dead');
    list.flush({ ...ok, data: [], meta: {} });

    service.getDelivery('d1').subscribe();
    httpTesting.expectOne(`${base}/webhook-deliveries/d1`).flush(ok);

    service.redeliver('d1').subscribe();
    const redeliver = httpTesting.expectOne(`${base}/webhook-deliveries/d1/redeliver`);
    expect(redeliver.request.method).toBe('POST');
    redeliver.flush(ok);
  });
});
