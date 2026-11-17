import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthStore, LogisticsApiService } from '@core';
import { icons } from '../../../../icons-provider';
import { ConsignmentDeclarationsComponent } from './consignment-declarations.component';

describe('ConsignmentDeclarationsComponent', () => {
  const api = {
    listDeclarations: vi.fn(),
    warehouses: vi.fn(),
    receiveVendorConsignment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.listDeclarations.mockReturnValue(
      of({ data: [{ id: 'd1', warehouse_id: 'w1', direction: 'sell', status: 'posted', generated_document_type: 'sales_invoice', generated_document_id: 'i1', total_amount: 10 }] }),
    );
    api.warehouses.mockReturnValue(of({ data: [{ id: 'w1', code: 'V1', name: 'Vendor', warehouse_type: 'vendor_consignment' }] }));
    api.receiveVendorConsignment.mockReturnValue(of({ data: {} }));
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzI18n(en_US),
        provideNzIcons(icons),
        { provide: LogisticsApiService, useValue: api },
        { provide: AuthStore, useValue: { can: () => true } },
      ],
    });
  });

  it('loads the declarations history', () => {
    const fixture = TestBed.createComponent(ConsignmentDeclarationsComponent);
    fixture.detectChanges();
    expect(api.listDeclarations).toHaveBeenCalled();
    expect(fixture.componentInstance['declarations']()).toHaveLength(1);
  });

  it('books a vendor receipt with the API payload and refuses an empty form', () => {
    const fixture = TestBed.createComponent(ConsignmentDeclarationsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component['openReceipt']();
    component['saveReceipt']();
    expect(api.receiveVendorConsignment).not.toHaveBeenCalled();

    component['receiptForm'].patchValue({ warehouse_id: 'w1' });
    component['lines'].at(0).patchValue({ product_id: 'p1', quantity: 4 });
    component['saveReceipt']();
    expect(api.receiveVendorConsignment).toHaveBeenCalledWith({ warehouse_id: 'w1', lines: [{ product_id: 'p1', quantity: 4 }] });
    expect(component['receiptOpen']()).toBe(false);
  });
});
