import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../icons-provider';
import { CommercialDocumentResource, DailyCorrispettivoResource, RetailApiService } from '@core';
import { RetailComponent } from './retail.component';

describe('RetailComponent', () => {
  let component: RetailComponent;
  let fixture: ComponentFixture<RetailComponent>;
  let apiService: any;
  let messageService: any;

  const mockDoc: CommercialDocumentResource = {
    id: 'doc-1',
    document_number: 'DOC-001',
    issued_at: '2026-04-10T12:00:00Z',
    payment_method: 'card',
    total_amount: 50,
    status: 'issued',
  };

  const mockDaily: DailyCorrispettivoResource = {
    date: '2026-04-10',
    device_serial: 'RT-001',
    total_sales: 1500,
    total_vat: 330,
    transactions_count: 35,
    status: 'transmitted',
  };

  beforeEach(async () => {
    apiService = {
      getCommercialDocuments: vi.fn().mockReturnValue(of({ data: [mockDoc], meta: { total: 1 } })),
      createCommercialDocument: vi.fn().mockReturnValue(of({ data: mockDoc })),
      voidCommercialDocument: vi.fn().mockReturnValue(of({ data: { ...mockDoc, status: 'voided' } })),
      getDailyCorrispettivi: vi.fn().mockReturnValue(of({ data: mockDaily })),
    };

    messageService = {
      success: vi.fn(),
      error: vi.fn(),
      warning: vi.fn(),
      info: vi.fn(),
    };

    await TestBed.configureTestingModule({
      imports: [RetailComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: RetailApiService, useValue: apiService },
        { provide: NzMessageService, useValue: messageService },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(RetailComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as any).modal, 'confirm').mockImplementation((config: any) => {
      if (config.nzOnOk) config.nzOnOk();
      return {} as any;
    });
    fixture.detectChanges();
  });

  it('initializes and loads commercial documents and daily corrispettivi', () => {
    expect(component).toBeTruthy();
    expect(component.documents().length).toBe(1);
    expect(component.dailyCorrispettivo()).toEqual(mockDaily);
    expect(component.kpiTotalDocs()).toBe(1);
    expect(component.kpiIssuedDocs()).toBe(1);
  });

  it('submits a new commercial document', () => {
    component.openCreateModal();
    expect(component.isCreateModalVisible()).toBe(true);

    component.docForm.patchValue({
      payment_method: 'electronic',
      cashier_name: 'Cassa 2',
    });
    component.linesArray.at(0).patchValue({
      description: 'Caffè e Cornetto',
      quantity: 2,
      unit_price: 2.5,
      vat_rate: 10,
    });

    component.submitDocument();
    expect(apiService.createCommercialDocument).toHaveBeenCalled();
    expect(component.isCreateModalVisible()).toBe(false);
  });

  it('voids an issued commercial document', () => {
    component.voidDocument(mockDoc);
    expect(apiService.voidCommercialDocument).toHaveBeenCalledWith('doc-1');
  });
});
