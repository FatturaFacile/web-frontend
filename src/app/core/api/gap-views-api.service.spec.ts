import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { environment } from '@env';
import { beforeEach, describe, expect, it } from 'vitest';
import { ControllingApiService } from './controlling-api.service';
import { GapViewsApiService } from './gap-views-api.service';

describe('GapViewsApiService', () => {
  const base = environment.apiBaseUrl;
  let api: GapViewsApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    api = TestBed.inject(GapViewsApiService);
    http = TestBed.inject(HttpTestingController);
  });

  it('reads and saves the CRM portal settings', () => {
    api.getPortalSettings().subscribe();
    expect(http.expectOne(`${base}/crm/portal-settings`).request.method).toBe('GET');
  });

  it('manages lead webhook endpoints', () => {
    api.listLeadWebhooks().subscribe();
    expect(http.expectOne(`${base}/crm/lead-webhooks`).request.method).toBe('GET');

    api.rotateLeadWebhookSecret('w1').subscribe();
    expect(http.expectOne(`${base}/crm/lead-webhooks/w1/rotate-secret`).request.method).toBe(
      'POST',
    );

    api.deleteLeadWebhook('w1').subscribe();
    expect(http.expectOne(`${base}/crm/lead-webhooks/w1`).request.method).toBe('DELETE');
  });

  it('lists and creates analytical ledger entries', () => {
    const controlling = TestBed.inject(ControllingApiService);
    controlling.getLedgerEntries({ nature_type: 'opex', page: 2 }).subscribe();
    const list = http.expectOne((r) => r.url === `${base}/controlling/analytical-ledger`);
    expect(list.request.params.get('nature_type')).toBe('opex');
    expect(list.request.params.get('page')).toBe('2');

    controlling
      .createLedgerEntry({ posting_date: '2026-11-01', nature_type: 'revenue', amount: 10 })
      .subscribe();
    expect(http.expectOne(`${base}/controlling/analytical-ledger`).request.method).toBe('POST');
  });
});
