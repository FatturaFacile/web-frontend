import { ComponentFixture, TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../../icons-provider';
import { FieldServiceApiService, I18nService, PermissionsService } from '@core';
import { ServiceReportsComponent } from './service-reports.component';

interface ReportsHarness {
  selectedIds(): ReadonlySet<string>;
  canConsolidate(): boolean;
  toggle(id: string, checked: boolean): void;
  consolidate(): void;
  openSign(report: unknown): void;
  sign(result: { signerName: string; signerRole: string; signerEmail: string; signature: string }): void;
  invoice(report: unknown): void;
}

describe('ServiceReportsComponent', () => {
  let fixture: ComponentFixture<ServiceReportsComponent>;
  let harness: ReportsHarness;

  const reports = [
    { id: 'r1', report_number: 'SR-1', report_date: '2026-11-01', is_signed: true, is_invoiced: false, total_gross: '122.00', total_hours: 2 },
    { id: 'r2', report_number: 'SR-2', report_date: '2026-11-02', is_signed: false, is_invoiced: false, total_gross: '50.00', total_hours: 1 },
  ];

  const api = {
    getServiceReports: vi.fn(),
    signServiceReport: vi.fn(),
    generateServiceReportInvoice: vi.fn(),
    generateConsolidatedInvoice: vi.fn(),
    uploadServiceReportPhoto: vi.fn(),
    downloadServiceReportPdf: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const modal = { confirm: vi.fn((options: { nzOnOk: () => void }) => options.nzOnOk()) };

  beforeEach(async () => {
    vi.clearAllMocks();
    api.getServiceReports.mockReturnValue(of({ data: reports, meta: { total: 2 } }));
    api.signServiceReport.mockReturnValue(of({ data: reports[0] }));
    api.generateServiceReportInvoice.mockReturnValue(of({ data: { invoice_number: 'F-1' } }));
    api.generateConsolidatedInvoice.mockReturnValue(of({ data: { invoice_number: 'F-2' } }));

    await TestBed.overrideProvider(NzModalService, { useValue: modal })
      .configureTestingModule({
      imports: [ServiceReportsComponent],
      providers: [
        provideNzIcons(icons),
        { provide: FieldServiceApiService, useValue: api },
        { provide: PermissionsService, useValue: { canWrite: () => true } },
        { provide: I18nService, useValue: { translate: (key: string) => key } },
        { provide: NzMessageService, useValue: message },
        { provide: NzModalService, useValue: modal },
      ],
    }).compileComponents();

    fixture = TestBed.createComponent(ServiceReportsComponent);
    harness = fixture.componentInstance as unknown as ReportsHarness;
    fixture.detectChanges();
    await new Promise((resolve) => setTimeout(resolve, 30));
    fixture.detectChanges();
  });

  it('loads the reports with the paging parameters', () => {
    expect(api.getServiceReports).toHaveBeenCalledWith(expect.objectContaining({ page: 1, per_page: 20 }));
    expect(fixture.nativeElement.textContent).toContain('SR-1');
  });

  it('offers the sign action only for unsigned reports and the invoice action only for signed ones', () => {
    const rows = [...(fixture.nativeElement as HTMLElement).querySelectorAll('tbody tr')].map((row) => row.textContent ?? '');
    const signed = rows.find((text) => text.includes('SR-1')) ?? '';
    const unsigned = rows.find((text) => text.includes('SR-2')) ?? '';
    expect(signed).toContain('SERVICE_REPORTS.INVOICE');
    expect(signed).not.toContain('SERVICE_REPORTS.SIGN ');
    expect(unsigned).toContain('SERVICE_REPORTS.SIGN');
    expect(unsigned).not.toContain('SERVICE_REPORTS.INVOICE');
  });

  it('needs two selected reports before a consolidated invoice and then posts their ids', () => {
    harness.toggle('r1', true);
    expect(harness.canConsolidate()).toBe(false);
    harness.toggle('r3', true);
    expect(harness.canConsolidate()).toBe(true);

    harness.consolidate();

    expect(api.generateConsolidatedInvoice).toHaveBeenCalledWith(['r1', 'r3']);
    expect(harness.selectedIds().size).toBe(0);
    expect(message.success).toHaveBeenCalled();
  });

  it('signs a report with the signer details and the drawn signature', () => {
    harness.openSign(reports[1]);
    harness.sign({ signerName: 'Rossi', signerRole: '', signerEmail: 'r@example.com', signature: 'data:image/png;base64,AAA' });

    expect(api.signServiceReport).toHaveBeenCalledWith('r2', {
      signature_base64: 'data:image/png;base64,AAA',
      signer_name: 'Rossi',
      signer_role: null,
      signer_email: 'r@example.com',
    });
  });

  it('drafts the invoice of a signed report after confirmation', () => {
    harness.invoice(reports[0]);
    expect(api.generateServiceReportInvoice).toHaveBeenCalledWith('r1');
  });
});
