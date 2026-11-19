import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { I18nService, PermissionsService } from '@core';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { beforeEach, describe, expect, it } from 'vitest';
import { icons } from '../../../icons-provider';
import { Customer360Component } from './customer-360.component';

describe('Customer360Component', () => {
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [Customer360Component],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideRouter([]),
        provideNzIcons(icons),
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        // The embedded audit timeline renders only for a member who may read the audit trail.
        { provide: PermissionsService, useValue: { canRead: () => false, canWrite: () => false } },
        { provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'c1' } } } },
      ],
    });
    http = TestBed.inject(HttpTestingController);
  });

  it('shows the customer, its contracts and loads the repair history when an asset is opened', () => {
    const fixture = TestBed.createComponent(Customer360Component);
    fixture.detectChanges();

    http
      .expectOne((r) => r.url.endsWith('/crm/contacts/c1/overview'))
      .flush({ data: { contact: { id: 'c1', name: 'ACME SA', vat_number: 'CHE-1' } } });
    http
      .expectOne(
        (r) => r.url.endsWith('/esm/service-contracts') && r.params.get('customer_id') === 'c1',
      )
      .flush({
        data: [
          {
            id: 'k1',
            customer_id: 'c1',
            contract_number: 'MC-1',
            title: 'Gold',
            status: 'active',
            included_hours: '10',
            remaining_hours: '4',
          },
        ],
      });
    http
      .expectOne(
        (r) => r.url.endsWith('/esm/equipment-passports') && r.params.get('customer_id') === 'c1',
      )
      .flush({
        data: [
          {
            id: 'p1',
            serial_number: 'SN-1',
            installation_site: 'Lugano',
            asset_status: 'active',
            warranty_status: 'in_warranty',
          },
        ],
      });
    fixture.detectChanges();

    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('ACME SA');
    expect(text).toContain('CHE-1');
    expect(text).toContain('MC-1');
    expect(text).toContain('SN-1');

    (
      fixture.componentInstance as unknown as { onOpen: (open: boolean, id: string) => void }
    ).onOpen(true, 'p1');
    http
      .expectOne((r) => r.url.endsWith('/esm/equipment-passports/p1/history'))
      .flush({
        data: {
          timeline: [
            {
              kind: 'work_order',
              reference: 'WO-9',
              status: 'closed',
              occurred_at: '2026-11-01T10:00:00Z',
            },
          ],
        },
      });
    fixture.detectChanges();

    expect((fixture.nativeElement as HTMLElement).textContent).toContain('WO-9');
    http.verify();
  });
});
