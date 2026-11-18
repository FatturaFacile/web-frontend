import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { GeneralLedgerFiscalApiService, PermissionsService, VatSettlementCalculation } from '@core';
import { GlVatSettlementComponent } from './gl-vat-settlement.component';

const line = {
  journal_entry_id: 'je-1',
  entry_number: 'JE-1',
  posting_date: '2026-04-10',
  document_number: 'INV-1',
  source_document_type: 'invoice',
  partner_id: 'p-1',
  taxable: '1000.00',
  rate: '8.10',
  tax: '81.00',
  treatment: 'standard',
};

const swiss: VatSettlementCalculation = {
  jurisdiction: 'CH',
  period: { type: 'quarterly', year: 2026, number: 2, label: 'Q2 2026', from: '2026-04-01', to: '2026-06-30' },
  regime: 'effective',
  basis: 'agreed',
  totals: { turnover: '1000.00', taxable_turnover: '1000.00', output_vat: '81.00', input_vat: '10.00', previous_credit: '0.00', previous_debit: '0.00', interest: '0.00', payable: '71.00' },
  payable_amount: '71.00',
  warnings: ['Missing UID on one supplier'],
  drilldown: { sales: [line], purchases: [] },
  swiss_boxes: { '200': '1000.00', '303': { base: '1000.00', rate: '8.1', tax: '81.00' }, '399': '71.00' },
};

const italian: VatSettlementCalculation = {
  ...swiss,
  jurisdiction: 'IT',
  warnings: [],
  swiss_boxes: undefined,
  lipe_boxes: { VP2: '1000.00', VP14_payable: '71.00' },
};

describe('GlVatSettlementComponent', () => {
  const api = {
    previewVatSettlement: vi.fn(),
    lockVatSettlement: vi.fn(),
    getVatSettlements: vi.fn(),
    exportVatSettlementXml: vi.fn(),
    exportVatSettlementPdf: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    api.getVatSettlements.mockReturnValue(
      of({
        data: [
          { id: 's-1', jurisdiction: 'CH', period_type: 'quarterly', period_from: '2026-01-01', period_to: '2026-03-31', regime: 'effective', basis: 'agreed', payable_amount: '10.00', status: 'CLOSED', locked_at: null, filed_at: null },
        ],
      }),
    );
    await TestBed.configureTestingModule({
      imports: [GlVatSettlementComponent],
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: GeneralLedgerFiscalApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();
  });

  function create() {
    const fixture = TestBed.createComponent(GlVatSettlementComponent);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, component: fixture.componentInstance as unknown as { preview(): void; lock(): void } };
  }

  it('lists the locked periods with XML and PDF exports', () => {
    const { el } = create();
    expect(el.querySelectorAll('[data-testid="settlements"] tbody tr')).toHaveLength(1);
    expect(el.querySelector('[data-testid="export-xml"]')).not.toBeNull();
    expect(el.querySelector('[data-testid="export-pdf"]')).not.toBeNull();
  });

  it('previews a Swiss period and renders the AFC Ziffern, warnings and drill-down', () => {
    api.previewVatSettlement.mockReturnValue(of({ data: swiss }));
    const { fixture, el, component } = create();
    component.preview();
    fixture.detectChanges();

    expect(api.previewVatSettlement).toHaveBeenCalledWith(expect.objectContaining({ period_type: 'quarterly' }));
    const boxes = Array.from(el.querySelectorAll('[data-testid="boxes"] tbody tr')).map((tr) => tr.getAttribute('data-box'));
    expect(boxes).toContain('200');
    expect(boxes).toContain('510');
    expect(boxes).not.toContain('VP2');
    expect(el.querySelector('[data-testid="warning"]')).not.toBeNull();
    expect(el.querySelectorAll('[data-testid="sales-lines"] tbody tr')).toHaveLength(1);
  });

  it('previews an Italian period and renders the LIPE boxes instead', () => {
    api.previewVatSettlement.mockReturnValue(of({ data: italian }));
    const { fixture, el, component } = create();
    component.preview();
    fixture.detectChanges();

    const boxes = Array.from(el.querySelectorAll('[data-testid="boxes"] tbody tr')).map((tr) => tr.getAttribute('data-box'));
    expect(boxes).toContain('VP2');
    expect(boxes).toContain('VP14_payable');
    expect(boxes).not.toContain('200');
    expect(el.querySelector('[data-testid="warning"]')).toBeNull();
  });

  it('locks the period, shows the status and reloads the list', () => {
    api.previewVatSettlement.mockReturnValue(of({ data: swiss }));
    api.lockVatSettlement.mockReturnValue(
      of({ data: { id: 's-2', jurisdiction: 'CH', period_type: 'quarterly', period_from: '2026-04-01', period_to: '2026-06-30', regime: 'effective', basis: 'agreed', payable_amount: '71.00', status: 'CLOSED', locked_at: '2026-07-01', filed_at: null, calculation: swiss } }),
    );
    const { fixture, el, component } = create();
    component.preview();
    fixture.detectChanges();
    component.lock();
    fixture.detectChanges();

    expect(api.lockVatSettlement).toHaveBeenCalledTimes(1);
    expect(el.querySelector('[data-testid="locked-banner"]')).not.toBeNull();
    expect(message.success).toHaveBeenCalled();
    expect(api.getVatSettlements).toHaveBeenCalledTimes(2);
  });
});
