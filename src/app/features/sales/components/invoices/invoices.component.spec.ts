import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalRef } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { en_US, provideNzI18n } from 'ng-zorro-antd/i18n';
import { provideNzDateFnsAdapter } from 'ng-zorro-antd/core/time';
import { icons } from '../../../../icons-provider';
import {
  ClientApiService,
  InvoiceApiService,
  InvoiceResource,
  ContactResource,
  SwissQrBillData,
  SdiLogsData,
  InvoiceInstallment,
  CreditNoteResource,
} from '@core';
import { InvoicesComponent } from './invoices.component';
import { InvoiceFacade } from '../../services/invoice.facade';

describe('InvoicesComponent', () => {
  let fixture: ComponentFixture<InvoicesComponent>;
  let component: InvoicesComponent;
  let apiMock: Partial<InvoiceApiService>;
  let facadeMock: Record<string, unknown>;
  let messageMock: Partial<NzMessageService>;
  let clientApiMock: Partial<ClientApiService>;

  const mockInvoiceIT: InvoiceResource = {
    id: 'inv-it-1',
    invoice_number: 'FT-2026-0001',
    invoice_type: 'standard',
    issue_date: '2026-11-09',
    due_date: '2026-12-09',
    currency: 'EUR',
    subtotal: 1000,
    tax_amount: 220,
    total: 1220,
    status: 'issued',
    payment_status: 'unpaid',
    jurisdiction: 'IT',
    has_swiss_qr: false,
    client: { id: 'cl-1', name: 'Mario Rossi SRL' } as unknown as ContactResource,
  };

  const mockInvoiceCH: InvoiceResource = {
    id: 'inv-ch-1',
    invoice_number: 'FT-2026-CH01',
    invoice_type: 'standard',
    issue_date: '2026-11-09',
    due_date: '2026-12-09',
    currency: 'CHF',
    subtotal: 2000,
    tax_amount: 162,
    total: 2162,
    status: 'issued',
    payment_status: 'unpaid',
    jurisdiction: 'CH',
    has_swiss_qr: true,
    client: { id: 'cl-2', name: 'Swiss AG' } as unknown as ContactResource,
  };

  const mockQrBill: SwissQrBillData = {
    iban: 'CH4431999123000889012',
    reference_type: 'NON',
    reference: 'REF-2026-001',
    amount: 2162,
    currency: 'CHF',
    payload: 'SPC\n0200\n1\nCH4431999123000889012\n...',
  };

  const mockSdiLogs: SdiLogsData = {
    outbound: [
      {
        id: 'out-1',
        action: 'Invio SdI FatturaPA',
        transmitted_at: '2026-11-09T10:00:00Z',
        status: 'delivered',
        details: 'SDI-998877',
      },
    ],
    inbound: [
      {
        id: 'in-1',
        action: 'Ricevuta Consegna (RC)',
        transmitted_at: '2026-11-09T10:05:00Z',
        status: 'accepted',
        receipt_code: 'RC-12345',
      },
    ],
  };

  const mockInstallments: InvoiceInstallment[] = [
    {
      id: 'inst-1',
      installment_number: 1,
      due_date: '2026-11-30',
      amount: 610,
      status: 'unpaid',
    },
    {
      id: 'inst-2',
      installment_number: 2,
      due_date: '2026-12-31',
      amount: 610,
      status: 'unpaid',
    },
  ];

  beforeEach(() => {
    clientApiMock = {
      list: vi.fn().mockReturnValue(of({ data: [], meta: { total: 0 } })),
    };

    apiMock = {
      get: vi.fn().mockReturnValue(of({ data: mockInvoiceIT })),
      getQrBill: vi.fn().mockReturnValue(of({ data: mockQrBill })),
      generateQrBill: vi.fn().mockReturnValue(of({ data: mockQrBill })),
      downloadQrBill: vi.fn().mockReturnValue(of(new Blob(['pdf content'], { type: 'application/pdf' }))),
      generateSdiXml: vi.fn().mockReturnValue(of({ data: { invoice_id: 'inv-it-1', xml_content: '<xml/>', filename: 'test.xml', status: 'generated' } })),
      sendToSdi: vi.fn().mockReturnValue(of({ data: { invoice_id: 'inv-it-1', sdi_status: 'sent', transmission_id: 't-1' } })),
      sendSdiBulk: vi.fn().mockReturnValue(of({ data: { sent: 1, failed: 0, results: [{ invoice_id: 'inv-it-1', success: true }] } })),
      getSdiLogs: vi.fn().mockReturnValue(of({ data: mockSdiLogs })),
      getInstallments: vi.fn().mockReturnValue(of({ data: mockInstallments })),
      createCreditNote: vi.fn().mockReturnValue(of({
        data: {
          id: 'cn-1',
          credit_note_number: 'NC-2026-0001',
          original_invoice_id: 'inv-it-1',
          contact_id: 'cl-1',
          total_net: 100,
          total_tax: 22,
          total_gross: 122,
          currency: 'EUR',
          status: 'issued',
          date: '2026-11-09',
        } as CreditNoteResource,
      })),
      downloadPdf: vi.fn().mockReturnValue(of(new Blob(['pdf'], { type: 'application/pdf' }))),
      sendByEmail: vi.fn().mockReturnValue(of(void 0)),
      convertProforma: vi.fn().mockReturnValue(of({ data: mockInvoiceIT })),
    };

    facadeMock = {
      items: vi.fn().mockReturnValue([mockInvoiceIT, mockInvoiceCH]),
      loading: vi.fn().mockReturnValue(false),
      totalCount: vi.fn().mockReturnValue(2),
      pageIndex: vi.fn().mockReturnValue(1),
      pageSize: vi.fn().mockReturnValue(15),
      filterParams: vi.fn().mockReturnValue({ search: '' }),
      setPage: vi.fn(),
      setPageSize: vi.fn(),
      setFilter: vi.fn(),
      reload: vi.fn(),
    };

    messageMock = {
      success: vi.fn(),
      error: vi.fn(),
      info: vi.fn(),
    };

    TestBed.configureTestingModule({
      imports: [InvoicesComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        provideNzIcons(icons),
        provideNzI18n(en_US),
        provideNzDateFnsAdapter(),
        { provide: ClientApiService, useValue: clientApiMock },
        { provide: InvoiceApiService, useValue: apiMock },
        { provide: InvoiceFacade, useValue: facadeMock },
        { provide: NzMessageService, useValue: messageMock },
      ],
    });

    fixture = TestBed.createComponent(InvoicesComponent);
    component = fixture.componentInstance;
    vi.spyOn((component as unknown as { modal: { confirm: (opts: { nzOnOk?: () => void }) => NzModalRef } }).modal, 'confirm').mockImplementation(config => {
      config.nzOnOk?.();
      return {} as NzModalRef;
    });
    fixture.detectChanges();
  });

  it('creates the component successfully', () => {
    expect(component).toBeTruthy();
  });

  it('opens the read-only detail of an invoice', () => {
    component['showDetails'](mockInvoiceIT);

    expect(apiMock.get).toHaveBeenCalledWith('inv-it-1');
    expect(component['detailOpen']()).toBe(true);
    expect(component['detailInvoice']()?.id).toBe('inv-it-1');
  });

  it('loads Swiss QR-bill and opens QR modal', () => {
    component.viewQrBill(mockInvoiceCH);

    expect(apiMock.getQrBill).toHaveBeenCalledWith('inv-ch-1');
    expect(component.qrModalVisible()).toBe(true);
    expect(component.currentQrBill()).toEqual(mockQrBill);
  });

  it('loads SDI logs and opens modal', () => {
    component.viewSdiLogs(mockInvoiceIT);

    expect(apiMock.getSdiLogs).toHaveBeenCalledWith('inv-it-1');
    expect(component.sdiLogsModalVisible()).toBe(true);
    expect(component.currentSdiLogs()).toEqual(mockSdiLogs);
  });

  it('fetches installments and opens installments modal', () => {
    component.viewInstallments(mockInvoiceIT);

    expect(apiMock.getInstallments).toHaveBeenCalledWith('inv-it-1');
    expect(component.installmentsModalVisible()).toBe(true);
    expect(component.currentInstallments()).toHaveLength(2);
  });

  it('pre-fills and opens credit note modal for an invoice', () => {
    component.openCreditNoteModal(mockInvoiceIT);

    expect(component.creditNoteModalVisible()).toBe(true);
    expect(component.creditNoteForm.get('original_invoice_id')?.value).toBe('inv-it-1');
    expect(component.creditNoteForm.get('unit_price')?.value).toBe(1220);
  });

  it('submits credit note form successfully', () => {
    component.openCreditNoteModal(mockInvoiceIT);
    component.submitCreditNote();

    expect(apiMock.createCreditNote).toHaveBeenCalled();
    expect(component.creditNoteModalVisible()).toBe(false);
    expect(messageMock.success).toHaveBeenCalled();
    expect(facadeMock['reload']).toHaveBeenCalled();
  });

  it('executes bulk SDI transmission for Italian invoices', () => {
    component.sendBulkSdi();

    expect(apiMock.sendSdiBulk).toHaveBeenCalledWith(['inv-it-1']);
    expect(messageMock.success).toHaveBeenCalled();
  });

  it('generates FatturaPA XML for Italian invoice', () => {
    component.generateSdiXml(mockInvoiceIT);

    expect(apiMock.generateSdiXml).toHaveBeenCalledWith('inv-it-1');
    expect(messageMock.success).toHaveBeenCalled();
    expect(facadeMock['reload']).toHaveBeenCalled();
  });
});
