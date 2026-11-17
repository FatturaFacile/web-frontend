import { HttpErrorResponse } from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CustomsApiService, CustomsDeclarationResource, CustomsImportBillResource } from '@core';
import { icons } from '../../../icons-provider';
import { DeclarationDetailDrawerComponent } from './declaration-detail-drawer.component';
import { ImportBillsPanelComponent } from './import-bills-panel.component';
import { TradeComplianceComponent } from './trade-compliance.component';

const exportDeclaration: CustomsDeclarationResource = {
  id: 'decl-1',
  declaration_type: 'export',
  status: 'accepted',
  trader_declaration_number: 'DEC-1',
  mrn: null,
  customs_regime: 'edec',
  transit_document_type: 'T1',
  transit_deadline_on: '2020-01-01',
  transit_discharged_at: null,
};

const bill: CustomsImportBillResource = {
  id: 'bill-1',
  bill_number: 'B-1',
  bill_date: '2026-11-17',
  currency: 'CHF',
  customs_value: '1000.00',
  duty_amount: '50.00',
  vat_rate: '8.1',
  import_vat_amount: '85.05',
  status: 'draft',
};

function createApi() {
  return {
    getTradeComplianceDashboard: vi.fn().mockReturnValue(
      of({
        success: true,
        data: {
          by_direction: { export: 3 },
          by_regime: { edec: 3 },
          by_status: { draft: 1 },
          transit_overdue: 2,
          missing_evv: [
            { declaration_id: 'decl-1', trader_declaration_number: 'DEC-1', mrn: null, invoices: [{ id: 'i-1', invoice_number: '2026/1' }] },
          ],
        },
      }),
    ),
    getDeclarations: vi.fn().mockReturnValue(of({ success: true, data: [exportDeclaration], meta: { total: 1 } })),
    getDeclaration: vi.fn().mockReturnValue(of({ success: true, data: exportDeclaration })),
    updateDeclaration: vi.fn().mockReturnValue(of({ success: true, data: exportDeclaration })),
    assignMrn: vi.fn(),
    getDeclarationMessage: vi.fn().mockReturnValue(of('<xml/>')),
    autoLinkInvoices: vi.fn().mockReturnValue(of({ success: true, data: { linked: 2 } })),
    getExportProof: vi.fn().mockReturnValue(of({ success: true, data: { has_proof: false, decision: null } })),
    dischargeTransit: vi.fn().mockReturnValue(of({ success: true, data: exportDeclaration })),
    downloadProForma: vi.fn().mockReturnValue(of(new Blob(['pdf']))),
    downloadTransitSheet: vi.fn().mockReturnValue(of(new Blob(['pdf']))),
    getImportBills: vi.fn().mockReturnValue(of({ success: true, data: [bill], meta: { total: 1 } })),
    createImportBill: vi.fn().mockReturnValue(of({ success: true, data: bill })),
    getImportBillReconciliation: vi.fn().mockReturnValue(
      of({ success: true, data: { bill_total: '1135.05', supplier_total: '1135.05', remainder: '0.00', matches: true } }),
    ),
    postImportBill: vi.fn().mockReturnValue(of({ success: true, data: { ...bill, status: 'posted' } })),
  };
}

function setup(api: ReturnType<typeof createApi>) {
  const message = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
  TestBed.configureTestingModule({
    providers: [
      { provide: CustomsApiService, useValue: api },
      { provide: NzMessageService, useValue: message },
      provideRouter([]),
      provideNzIcons(icons),
    ],
  });
  return message;
}

describe('TradeComplianceComponent', () => {
  let api: ReturnType<typeof createApi>;
  let fixture: ComponentFixture<TradeComplianceComponent>;
  let component: TradeComplianceComponent;

  beforeEach(() => {
    api = createApi();
    setup(api);
    fixture = TestBed.createComponent(TradeComplianceComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('loads the dashboard and the declarations', () => {
    expect(api.getTradeComplianceDashboard).toHaveBeenCalled();
    expect(component.transitOverdue()).toBe(2);
    expect(component.missingEvv().length).toBe(1);
    expect(component.directionCounts().find((row) => row.key === 'export')?.count).toBe(3);
    expect(component.declarations().length).toBe(1);
  });

  it('shows the missing eVV alert with the badge count and the invoices', () => {
    const text = (fixture.nativeElement as HTMLElement).textContent ?? '';
    expect(text).toContain('DEC-1');
    expect(text).toContain('2026/1');
    expect((fixture.nativeElement as HTMLElement).querySelector('nz-badge')).not.toBeNull();
  });

  it('sends the direction, regime and status filters to the API', () => {
    component.setDirection('export');
    component.setRegime('passar');
    component.setStatus('draft');
    expect(api.getDeclarations).toHaveBeenLastCalledWith(
      expect.objectContaining({ declaration_type: 'export', customs_regime: 'passar', status: 'draft', page: 1 }),
    );
    // The regime filter narrows the loaded page as well, since the API may ignore it.
    expect(component.visibleDeclarations().length).toBe(0);
    component.setRegime(null);
    expect(component.visibleDeclarations().length).toBe(1);
  });

  it('opens the detail drawer from the alert list', () => {
    component.openDetail('decl-1');
    expect(component.selectedId()).toBe('decl-1');
  });
});

describe('DeclarationDetailDrawerComponent', () => {
  let api: ReturnType<typeof createApi>;
  let message: ReturnType<typeof setup>;
  let fixture: ComponentFixture<DeclarationDetailDrawerComponent>;
  let component: DeclarationDetailDrawerComponent;

  beforeEach(() => {
    api = createApi();
    message = setup(api);
    fixture = TestBed.createComponent(DeclarationDetailDrawerComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('declarationId', 'decl-1');
    fixture.detectChanges();
  });

  it('loads the declaration, fills the form and reads the export proof', () => {
    expect(api.getDeclaration).toHaveBeenCalledWith('decl-1');
    expect(component.regimeForm.getRawValue().transit_document_type).toBe('T1');
    expect(component.hasTransit()).toBe(true);
    expect(api.getExportProof).toHaveBeenCalledWith('decl-1');
    expect(component.proof()?.has_proof).toBe(false);
  });

  it('saves regime and transit data, clearing transit fields when there is no transit', () => {
    component.regimeForm.patchValue({ customs_regime: 'passar', transit_document_type: 'none', border_crossing: 'Chiasso' });
    component.saveRegime();
    expect(api.updateDeclaration).toHaveBeenCalledWith(
      'decl-1',
      expect.objectContaining({ customs_regime: 'passar', transit_document_type: 'none', border_crossing: null, transit_deadline_on: null }),
    );
  });

  it('surfaces the 422 of the MRN as a field error', () => {
    api.assignMrn.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 422,
            error: { message: 'invalid', errors: { mrn: ['The MRN checksum is not valid.'] } },
          }),
      ),
    );
    component.mrnForm.setValue({ mrn: '25it00000000000001' });
    component.assignMrn();
    expect(api.assignMrn).toHaveBeenCalledWith('decl-1', '25IT00000000000001');
    expect(component.mrnForm.controls.mrn.errors?.['serverError']).toBe('The MRN checksum is not valid.');
    expect(component.mrnError()).toBe('The MRN checksum is not valid.');
  });

  it('does not call the API for a malformed MRN', () => {
    component.mrnForm.setValue({ mrn: 'SHORT' });
    expect(component.mrnForm.invalid).toBe(true);
    component.assignMrn();
    expect(api.assignMrn).not.toHaveBeenCalled();
  });

  it('previews the payload, auto-links invoices and discharges the transit', () => {
    component.loadPayload();
    expect(component.payload()).toBe('<xml/>');

    component.autoLink();
    expect(component.linkedCount()).toBe(2);

    component.discharge();
    expect(api.dischargeTransit).toHaveBeenCalledWith('decl-1');
    expect(message.success).toHaveBeenCalled();
  });

  it('downloads the pro-forma in the chosen language and the transit sheet', () => {
    const createUrl = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => undefined);
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    component.language.set('it_de');
    component.downloadProForma();
    expect(api.downloadProForma).toHaveBeenCalledWith('decl-1', 'it_de');
    component.downloadTransitSheet();
    expect(api.downloadTransitSheet).toHaveBeenCalledWith('decl-1', 'it_de');
    expect(createUrl).toHaveBeenCalledTimes(2);
  });
});

describe('ImportBillsPanelComponent', () => {
  let api: ReturnType<typeof createApi>;
  let fixture: ComponentFixture<ImportBillsPanelComponent>;
  let component: ImportBillsPanelComponent;

  beforeEach(() => {
    api = createApi();
    setup(api);
    fixture = TestBed.createComponent(ImportBillsPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('lists the bills', () => {
    expect(api.getImportBills).toHaveBeenCalledWith({ page: 1, per_page: 10 });
    expect(component.bills().length).toBe(1);
  });

  it('previews the import VAT while the form is edited', () => {
    component.openCreate();
    component.form.patchValue({ customs_value: 1000, duty_amount: 50, ancillary_costs: 25, vat_rate: 8.1 });
    expect(component.vatPreview()).toBe(87.08);
  });

  it('creates a bill without sending the computed VAT', () => {
    component.openCreate();
    component.form.patchValue({
      bill_number: 'B-2',
      bill_date: '2026-11-17',
      currency: 'chf',
      customs_value: 1000,
      duty_amount: 50,
      vat_rate: 8.1,
      broker_invoice_reference: 'BRK-9',
    });
    component.submit();
    const payload = api.createImportBill.mock.calls[0][0];
    expect(payload).toEqual(
      expect.objectContaining({ bill_number: 'B-2', currency: 'CHF', vat_rate: 8.1, broker_invoice_reference: 'BRK-9', passive_invoice_id: null }),
    );
    expect(payload).not.toHaveProperty('import_vat_amount');
    expect(component.createVisible()).toBe(false);
  });

  it('rejects a malformed passive invoice id before calling the API', () => {
    component.openCreate();
    component.form.patchValue({ bill_number: 'B-3', bill_date: '2026-11-17', customs_value: 1, vat_rate: 8.1, passive_invoice_id: 'not-a-uuid' });
    component.submit();
    expect(api.createImportBill).not.toHaveBeenCalled();
  });

  it('shows the reconciliation and posts a draft bill', () => {
    component.openReconciliation(bill);
    expect(api.getImportBillReconciliation).toHaveBeenCalledWith('bill-1');
    expect(component.reconciliation()?.matches).toBe(true);

    component.post(bill);
    expect(api.postImportBill).toHaveBeenCalledWith('bill-1');
  });
});
