import {
  HttpErrorResponse,
  HttpEvent,
  HttpEventType,
  HttpResponse,
  provideHttpClient,
} from '@angular/common/http';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { InboxOutline } from '@ant-design/icons-angular/icons';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { Subject, of, throwError } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CedoliniImportResult, ItalianPayrollApiService, ItalianPayrollPeriod } from '@core';
import { AccountingReconcilerComponent } from './accounting-reconciler.component';
import { CedoliniSplitterComponent, isAcceptableBundle } from './cedolini-splitter.component';
import { ItalianPayrollClosingHubComponent } from './italian-payroll-closing-hub.component';

const saveBlob = vi.hoisted(() => vi.fn());

vi.mock('../shared/hr-http.util', async (original) => ({
  ...(await original<typeof import('../shared/hr-http.util')>()),
  saveBlob,
}));

const ID_A = '0191a7e0-5b7c-7c2e-8f5b-3b1a2c4d5e6f';
const ID_B = '0191a7e0-5b7c-7c2e-8f5b-3b1a2c4d5e70';

const period = (over: Partial<ItalianPayrollPeriod> = {}): ItalianPayrollPeriod => ({
  id: 'p1',
  legal_entity_id: null,
  year: 2027,
  month: 3,
  include_tredicesima: false,
  include_quattordicesima: false,
  status: 'attendance_open',
  export_format: null,
  validated_at: null,
  exported_at: null,
  paid_at: null,
  validation_report: null,
  accounting_imported: false,
  ...over,
});

async function configure(providers: unknown[]): Promise<void> {
  TestBed.resetTestingModule();
  await TestBed.configureTestingModule({
    providers: [
      provideHttpClient(),
      provideRouter([]),
      provideNzIcons([InboxOutline]),
      ...(providers as never[]),
    ],
  }).compileComponents();
}

function type(fixture: ComponentFixture<unknown>, selector: string, value: string): void {
  const element = fixture.nativeElement.querySelector(selector) as
    HTMLInputElement | HTMLTextAreaElement;
  element.value = value;
  element.dispatchEvent(new Event('input'));
  fixture.detectChanges();
}

const query = <T extends Element>(fixture: ComponentFixture<unknown>, selector: string): T | null =>
  fixture.nativeElement.querySelector(selector);

afterEach(() => saveBlob.mockReset());

describe('CedoliniSplitterComponent', () => {
  const result: CedoliniImportResult = {
    matched: [{ employee_id: ID_A, tax_code_suffix: '562S', pages: '1-2' }],
    unmatched: [{ tax_code_suffix: null, pages: '4' }],
    status: 'cedolini_imported',
  };

  it('accepts only a PDF within 50 MB', () => {
    expect(isAcceptableBundle({ name: 'cedolini.PDF', size: 1000 })).toBe(true);
    expect(isAcceptableBundle({ name: 'cedolini.xml', size: 1000 })).toBe(false);
    expect(isAcceptableBundle({ name: 'cedolini.pdf', size: 0 })).toBe(false);
    expect(isAcceptableBundle({ name: 'cedolini.pdf', size: 51 * 1024 * 1024 })).toBe(false);
  });

  it('rejects another file type without calling the API', async () => {
    const importCedolini = vi.fn();
    await configure([{ provide: ItalianPayrollApiService, useValue: { importCedolini } }]);
    const fixture = TestBed.createComponent(CedoliniSplitterComponent);
    fixture.componentRef.setInput('periodId', 'p1');
    fixture.detectChanges();

    fixture.componentInstance.handle(new File(['x'], 'cedolini.txt'));
    fixture.detectChanges();

    expect(importCedolini).not.toHaveBeenCalled();
    expect(query(fixture, '[data-testid=splitter-error]')).not.toBeNull();
  });

  it('shows the upload progress, then the split result with the pages that matched nobody', async () => {
    const events = new Subject<HttpEvent<unknown>>();
    const importCedolini = vi.fn().mockReturnValue(events);
    await configure([{ provide: ItalianPayrollApiService, useValue: { importCedolini } }]);
    const fixture = TestBed.createComponent(CedoliniSplitterComponent);
    fixture.componentRef.setInput('periodId', 'p1');
    const imported = vi.fn();
    fixture.componentInstance.imported.subscribe(imported);
    fixture.detectChanges();

    fixture.componentInstance.handle(
      new File(['%PDF'], 'cedolini.pdf', { type: 'application/pdf' }),
    );
    events.next({ type: HttpEventType.UploadProgress, loaded: 4, total: 10 });
    fixture.detectChanges();
    expect(importCedolini).toHaveBeenCalledWith('p1', expect.any(File));
    expect(query(fixture, '[data-testid=phase-upload] nz-progress')).not.toBeNull();

    events.next({ type: HttpEventType.UploadProgress, loaded: 10, total: 10 });
    fixture.detectChanges();
    expect(query(fixture, '[data-testid=phase-upload] nz-progress')).toBeNull();
    expect(query(fixture, '[data-testid=splitter-result]')).toBeNull();

    events.next(new HttpResponse({ body: { success: true, message: '', data: result } }));
    fixture.detectChanges();

    expect(imported).toHaveBeenCalledWith(result);
    expect(query(fixture, '[data-testid=splitter-result]')?.textContent).toContain('1-2');
    expect(query(fixture, '[data-testid=splitter-unmatched]')?.textContent).toContain('4');
  });

  it('shows the message of the server when the bundle is refused', async () => {
    const failure = new HttpErrorResponse({
      status: 422,
      error: { detail: "I cedolini si importano dopo l'esportazione." },
    });
    await configure([
      {
        provide: ItalianPayrollApiService,
        useValue: { importCedolini: vi.fn().mockReturnValue(throwError(() => failure)) },
      },
    ]);
    const fixture = TestBed.createComponent(CedoliniSplitterComponent);
    fixture.componentRef.setInput('periodId', 'p1');
    fixture.detectChanges();

    fixture.componentInstance.handle(new File(['%PDF'], 'cedolini.pdf'));
    fixture.detectChanges();

    expect(query(fixture, '[data-testid=splitter-error]')?.textContent).toContain(
      "dopo l'esportazione",
    );
  });
});

describe('AccountingReconcilerComponent', () => {
  const fill = (fixture: ComponentFixture<unknown>, net: string): void => {
    const amounts: Record<string, string> = {
      total_gross_wages: '5000',
      inps_employee_withholding: '459.5',
      inps_employer_contribution: '1500',
      irpef_withholding: '700',
      regional_municipal_addizionali: '60',
      tfr_monthly_accrual: '345.37',
      tfr_fondo_tesoreria_or_previdenza: '345.37',
      net_payable: net,
    };

    for (const [key, value] of Object.entries(amounts)) {
      type(fixture, `#amount-${key}`, value);
    }

    type(fixture, '#employee-nets', `${ID_A};2000\n${ID_B};1780,50`);
  };

  it('opens the import only when every equation balances, and emits the payload in euro', async () => {
    await configure([]);
    const fixture = TestBed.createComponent(AccountingReconcilerComponent);
    const submitted = vi.fn();
    fixture.componentInstance.submitted.subscribe(submitted);
    fixture.detectChanges();

    const button = (): HTMLButtonElement =>
      query<HTMLButtonElement>(fixture, '[data-testid=import-accounting]')!;
    expect(button().disabled).toBe(true);
    expect(query(fixture, '[data-testid=missing-amounts]')).not.toBeNull();

    fill(fixture, '3780.5');
    expect(button().disabled).toBe(false);
    // The two pasted nets add up to the net payable.
    expect(query(fixture, '[data-testid=nets-summary]')?.textContent).toContain('3,780.50');

    button().click();
    expect(submitted).toHaveBeenCalledWith(
      expect.objectContaining({
        total_gross_wages: 5000,
        net_payable: 3780.5,
        employee_nets: [
          { employee_id: ID_A, net_amount: 2000 },
          { employee_id: ID_B, net_amount: 1780.5 },
        ],
      }),
    );
  });

  it('closes the import and flags the equation when the net does not reconcile', async () => {
    await configure([]);
    const fixture = TestBed.createComponent(AccountingReconcilerComponent);
    fixture.detectChanges();

    fill(fixture, '3000');

    expect(query<HTMLButtonElement>(fixture, '[data-testid=import-accounting]')?.disabled).toBe(
      true,
    );
    expect(query(fixture, '[data-testid=check-net]')?.textContent).toContain(
      'itPayroll.reconciler.mismatch',
    );
    expect(query(fixture, '[data-testid=check-employee_nets]')?.textContent).toContain(
      'itPayroll.reconciler.mismatch',
    );
  });

  it('closes the import while a pasted line is not understood, and says which one', async () => {
    await configure([]);
    const fixture = TestBed.createComponent(AccountingReconcilerComponent);
    fixture.detectChanges();

    fill(fixture, '3780.5');
    type(fixture, '#employee-nets', `${ID_A};2000\nnot-an-id;1780,50`);

    expect(query<HTMLButtonElement>(fixture, '[data-testid=import-accounting]')?.disabled).toBe(
      true,
    );
    expect(fixture.nativeElement.textContent).toContain('itPayroll.reconciler.netsError.employee');
  });
});

describe('ItalianPayrollClosingHubComponent', () => {
  function api(
    overrides: Record<string, unknown> = {},
    periods: ItalianPayrollPeriod[] = [period()],
  ): Record<string, ReturnType<typeof vi.fn>> {
    return {
      getPeriods: vi.fn().mockReturnValue(of({ success: true, message: '', data: periods })),
      getPeriod: vi
        .fn()
        .mockImplementation((id: string) =>
          of({ success: true, message: '', data: periods.find((item) => item.id === id) }),
        ),
      getF24: vi
        .fn()
        .mockReturnValue(
          of({
            success: true,
            message: '',
            data: { period_id: 'p1', due_date: '2027-04-16', lines: [], total: '0.00' },
          }),
        ),
      createPeriod: vi.fn(),
      validateAttendance: vi.fn(),
      exportAttendance: vi.fn(),
      importAccounting: vi.fn(),
      generateSepa: vi.fn(),
      markPaid: vi.fn(),
      ...overrides,
    } as Record<string, ReturnType<typeof vi.fn>>;
  }

  async function render(
    stub: Record<string, unknown>,
  ): Promise<ComponentFixture<ItalianPayrollClosingHubComponent>> {
    await configure([{ provide: ItalianPayrollApiService, useValue: stub }]);
    const fixture = TestBed.createComponent(ItalianPayrollClosingHubComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    return fixture;
  }

  it('says so when there is no period yet', async () => {
    const fixture = await render(api({}, []));

    expect(query(fixture, '[data-testid=no-period]')).not.toBeNull();
    expect(query(fixture, '[data-testid=closing-stepper]')).toBeNull();
  });

  it('shows the stepper and the stage cards of the selected period, and only the validation button while open', async () => {
    const fixture = await render(api());

    expect(query(fixture, '[data-testid=closing-stepper]')).not.toBeNull();
    expect(fixture.nativeElement.querySelectorAll('nz-step')).toHaveLength(5);
    expect(query(fixture, '[data-testid=period-status]')?.textContent).toContain(
      'itPayroll.status.attendance_open',
    );
    expect(query<HTMLButtonElement>(fixture, '[data-testid=validate]')).not.toBeNull();
    expect(query<HTMLButtonElement>(fixture, '[data-testid=export]')?.disabled).toBe(true);
    expect(query<HTMLButtonElement>(fixture, '[data-testid=sepa]')?.disabled).toBe(true);
    expect(query<HTMLButtonElement>(fixture, '[data-testid=mark-paid]')?.disabled).toBe(true);
    expect(query<HTMLButtonElement>(fixture, '[data-testid=import-accounting]')?.disabled).toBe(
      true,
    );
  });

  it('validates the attendance and lists the errors that keep the month open', async () => {
    const result = {
      period_id: 'p1',
      status: 'attendance_open',
      validated: false,
      line_count: 3,
      errors: [
        {
          employee_id: ID_A,
          code: 'missing_inps_protocol',
          message: 'Malattia senza protocollo INPS.',
        },
      ],
      warnings: [
        {
          employee_id: ID_B,
          code: 'missing_clock_in',
          message: 'Nessuna timbratura il 2027-03-05.',
        },
      ],
    };
    const stub = api({
      validateAttendance: vi.fn().mockReturnValue(of({ success: true, message: '', data: result })),
    });
    const fixture = await render(stub);

    query<HTMLButtonElement>(fixture, '[data-testid=validate]')!.click();
    fixture.detectChanges();

    expect(stub['validateAttendance']).toHaveBeenCalledWith('p1', []);
    expect(query(fixture, '[data-testid=validation-errors]')?.textContent).toContain(
      'protocollo INPS',
    );
    expect(query(fixture, '[data-testid=validation-warnings]')?.textContent).toContain(
      'timbratura',
    );
  });

  it('refuses a malformed fringe benefit line before calling the API', async () => {
    const stub = api();
    const fixture = await render(stub);

    type(fixture, '#ipp-fringe', 'not-an-id;50');
    query<HTMLButtonElement>(fixture, '[data-testid=validate]')!.click();

    expect(stub['validateAttendance']).not.toHaveBeenCalled();
  });

  it('exports the validated month in the chosen layout once a company code is given', async () => {
    const exportAttendance = vi.fn().mockReturnValue(of(new Blob(['x'])));
    const stub = api({ exportAttendance }, [period({ status: 'validated' })]);
    const fixture = await render(stub);

    const button = (): HTMLButtonElement =>
      query<HTMLButtonElement>(fixture, '[data-testid=export]')!;
    expect(button().disabled).toBe(true);

    type(fixture, '#ipp-company', 'acme');
    expect(button().disabled).toBe(false);

    button().click();

    expect(exportAttendance).toHaveBeenCalledWith('p1', 'zucchetti', 'ACME');
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'ZUCCHETTI_ACME_202703.txt');
    expect(stub['getPeriod']).toHaveBeenCalledWith('p1');
  });

  it('opens the salary file and the payment only after the payslips and the accounting are in', async () => {
    const generateSepa = vi.fn().mockReturnValue(of(new Blob(['<xml/>'])));
    const ready = period({ status: 'cedolini_imported', accounting_imported: true });
    const stub = api({ generateSepa }, [ready]);
    const fixture = await render(stub);

    expect(stub['getF24']).toHaveBeenCalledWith('p1');
    expect(query<HTMLButtonElement>(fixture, '[data-testid=mark-paid]')?.disabled).toBe(false);
    expect(query<HTMLButtonElement>(fixture, '[data-testid=sepa]')?.disabled).toBe(true);

    type(fixture, '#ipp-debtor', 'Acme Srl');
    type(fixture, '#ipp-iban', 'IT60 X054 2811 1010 0000 0123 456');
    query<HTMLButtonElement>(fixture, '[data-testid=sepa]')!.click();

    expect(generateSepa).toHaveBeenCalledWith(
      'p1',
      expect.objectContaining({
        debtor_name: 'Acme Srl',
        debtor_iban: 'IT60X0542811101000000123456',
        debtor_bic: null,
      }),
    );
    expect(saveBlob).toHaveBeenCalledWith(expect.any(Blob), 'SALARI_202703.xml');
  });

  it('shows the paid banner and closes every action once the month is paid', async () => {
    const fixture = await render(api({}, [period({ status: 'paid', accounting_imported: true })]));

    expect(query(fixture, '[data-testid=paid-banner]')).not.toBeNull();
    expect(query<HTMLButtonElement>(fixture, '[data-testid=sepa]')?.disabled).toBe(true);
    expect(query<HTMLButtonElement>(fixture, '[data-testid=mark-paid]')?.disabled).toBe(true);
  });
});
