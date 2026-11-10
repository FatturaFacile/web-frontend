import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrApiService, PayrollComplianceApiService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { CrudConfig } from '../shared/crud/crud.types';
import { FrontierPanelComponent } from './frontier-panel.component';
import { HiringSimulationPanelComponent } from './hiring-simulation-panel.component';
import { LabourCostPanelComponent } from './labour-cost-panel.component';
import { LegalTablesComponent } from './legal-tables.component';
import { PayrollComplianceComponent } from './payroll-compliance.component';
import { SwissdecPanelComponent } from './swissdec-panel.component';
import { TariffsPanelComponent } from './tariffs-panel.component';
import { WithholdingStatementsPanelComponent } from './withholding-statements-panel.component';

type Row = { id: string } & Record<string, unknown>;
const ok = (data: unknown) => of({ success: true, message: '', data });

describe('Payroll compliance page', () => {
  const api = {
    getLegalParameters: vi.fn(),
    saveLegalParameters: vi.fn(),
    getAnnualParameters: vi.fn(),
    saveAnnualParameters: vi.fn(),
    getWithholdingTaxTariffs: vi.fn(),
    importWithholdingTaxTariffs: vi.fn(),
    getWithholdingStatements: vi.fn(),
    closeWithholdingStatement: vi.fn(),
    saveFrontierNights: vi.fn(),
    getSwissdecStatus: vi.fn(),
    getSwissdecDeclaration: vi.fn(),
    getSwissdecReadiness: vi.fn(),
    transmitSwissdec: vi.fn(),
    getLabourCostReport: vi.fn(),
    getChildAllowances: vi.fn(),
    simulateHiring: vi.fn(),
  };
  const hrApi = {
    getEmployees: vi.fn(),
    getCrossBorderEmployees: vi.fn(),
    getWithholdingTaxParameters: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };
  const permissions = {
    canWrite: vi.fn().mockReturnValue(true),
    canRead: vi.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getSwissdecStatus.mockReturnValue(
      ok({
        is_certified: false,
        structure_basis: 'ELM 5.0',
        schema_namespace: 'ns',
        schema_validated: true,
        current_certification_basis: 'none',
        domains_built: [],
        domains_not_built: ['AHV'],
        missing_for_certification: [1],
      }),
    );
    api.getWithholdingTaxTariffs.mockReturnValue(ok([{ canton: 'TI', tariff: 'A0N', rows: 12 }]));
    api.getLegalParameters.mockReturnValue(
      ok([{ id: 'l1', topic: 'bad_weather', year: 2026, source: 'Law', parameters: { rate: 80 } }]),
    );
    api.getAnnualParameters.mockReturnValue(
      ok([
        { id: 'a1', country: 'CH', year: 2026, legal_reference: null, parameters: { ahv: 5.3 } },
      ]),
    );
    hrApi.getEmployees.mockReturnValue(
      ok([{ id: 'e1', employee_number: 'E-1', full_name: 'Mario Rossi' }]),
    );
    hrApi.getCrossBorderEmployees.mockReturnValue(
      ok([{ id: 'f1', name: 'Luca Bianchi', email: 'l@x.test', job_title: null, hire_date: null }]),
    );
    hrApi.getWithholdingTaxParameters.mockReturnValue(
      ok({ canton: 'TI', agreement: 'IT-CH 2024' }),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: PayrollComplianceApiService, useValue: api },
        { provide: HrApiService, useValue: hrApi },
        { provide: NzMessageService, useValue: message },
        { provide: PermissionsService, useValue: permissions },
      ],
    });
  });

  it('renders the page with the tabs and loads the employees once', async () => {
    const fixture = TestBed.createComponent(PayrollComplianceComponent);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelectorAll('.ant-tabs-tab').length).toBe(7);
    expect(hrApi.getEmployees).toHaveBeenCalledTimes(1);
  });

  describe('legal tables', () => {
    function config(kind: 'legalConfig' | 'annualConfig'): CrudConfig<Row> {
      const fixture = TestBed.createComponent(LegalTablesComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.detectChanges();
      return (fixture.componentInstance as unknown as Record<string, () => CrudConfig<Row>>)[
        kind
      ]();
    }

    it('saves the legal parameters of a new topic and year with the JSON object parsed', () => {
      api.saveLegalParameters.mockReturnValue(ok({}));
      config('legalConfig')
        .create?.({
          topic: 'bad_weather',
          year: 2026,
          source: 'Law 2026',
          parameters: '{"rate":80}',
        })
        .subscribe();
      expect(api.saveLegalParameters).toHaveBeenCalledWith('bad_weather', 2026, {
        parameters: { rate: 80 },
        source: 'Law 2026',
      });
    });

    it('updates the row by its topic and year, not by the row id', async () => {
      api.saveLegalParameters.mockReturnValue(ok({}));
      const legal = config('legalConfig');
      await new Promise<void>((resolve) => legal.list().subscribe(() => resolve()));
      legal.update?.('l1', { source: 'New source', parameters: '{"rate":70}' }).subscribe();
      expect(api.saveLegalParameters).toHaveBeenCalledWith('bad_weather', 2026, {
        parameters: { rate: 70 },
        source: 'New source',
      });
    });

    it('reports a text that is not a JSON object as a 422 without calling the API', () => {
      const errors: unknown[] = [];
      config('annualConfig')
        .create?.({ country: 'CH', year: 2026, parameters: '[1,2]' })
        .subscribe({ error: (e) => errors.push(e) });
      expect(api.saveAnnualParameters).not.toHaveBeenCalled();
      expect((errors[0] as HttpErrorResponse).status).toBe(422);
    });

    it('shows the parameters of the listed rows as JSON text for editing', async () => {
      const rows = await new Promise<Row[]>((resolve) =>
        config('annualConfig').list().subscribe(resolve),
      );
      expect(rows[0]['parameters']).toBe('{"ahv":5.3}');
    });
  });

  describe('Swissdec panel', () => {
    it('shows the certification status and the readiness issues of the year', async () => {
      api.getSwissdecReadiness.mockReturnValue(
        ok({
          company: [],
          persons: [{ employee_id: 'e1', employee_name: 'Mario Rossi', issues: [1, 2] }],
          is_complete: false,
        }),
      );
      const fixture = TestBed.createComponent(SwissdecPanelComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('ELM 5.0');
      (fixture.componentInstance as unknown as { loadReadiness(): void }).loadReadiness();
      fixture.detectChanges();
      expect(api.getSwissdecReadiness).toHaveBeenCalledWith(new Date().getFullYear(), '5.0');
      expect(fixture.nativeElement.textContent).toContain('Mario Rossi');
    });

    it('shows the server reason when the transmission is not available', () => {
      api.transmitSwissdec.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 422, error: { detail: 'Not available yet' } }),
        ),
      );
      const fixture = TestBed.createComponent(SwissdecPanelComponent);
      fixture.detectChanges();
      (fixture.componentInstance as unknown as { transmit(): void }).transmit();
      expect(message.error).toHaveBeenCalledWith('Not available yet');
    });
  });

  describe('withholding statements', () => {
    it('previews the statement of the period and closes it', () => {
      api.getWithholdingStatements.mockReturnValue(
        ok({
          year: 2026,
          period_type: 'monthly',
          period: 1,
          format_status: 'x',
          statements: [],
          warnings: [],
        }),
      );
      api.closeWithholdingStatement.mockReturnValue(ok({}));
      const fixture = TestBed.createComponent(WithholdingStatementsPanelComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.detectChanges();
      const panel = fixture.componentInstance as unknown as {
        load(): void;
        closeStatement(): void;
      };
      panel.load();
      expect(api.getWithholdingStatements).toHaveBeenCalledWith({
        year: new Date().getFullYear(),
        period_type: 'monthly',
        period: 1,
        canton: null,
      });
      panel.closeStatement();
      expect(api.closeWithholdingStatement).toHaveBeenCalledTimes(1);
    });

    it('shows the 409/422 message of a statement that cannot be closed', () => {
      api.closeWithholdingStatement.mockReturnValue(
        throwError(() => new HttpErrorResponse({ status: 422, error: { detail: 'Data missing' } })),
      );
      const fixture = TestBed.createComponent(WithholdingStatementsPanelComponent);
      fixture.detectChanges();
      (fixture.componentInstance as unknown as { closeStatement(): void }).closeStatement();
      expect(message.error).toHaveBeenCalledWith('Data missing');
    });
  });

  it('lists the tariffs and imports a pasted text, then reloads', () => {
    api.importWithholdingTaxTariffs.mockReturnValue(ok({ imported: 4 }));
    const fixture = TestBed.createComponent(TariffsPanelComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('A0N');
    const panel = fixture.componentInstance as unknown as {
      content: { set(v: string): void };
      importContent(): void;
    };
    panel.content.set('02 TI A0N');
    panel.importContent();
    expect(api.importWithholdingTaxTariffs).toHaveBeenCalledWith({ content: '02 TI A0N' });
    expect(api.getWithholdingTaxTariffs).toHaveBeenCalledTimes(2);
  });

  it('records the nights away of a frontier worker and shows the commuters', () => {
    api.saveFrontierNights.mockReturnValue(ok({}));
    const fixture = TestBed.createComponent(FrontierPanelComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.componentRef.setInput('employees', [{ value: 'e1', label: 'E-1 - Mario Rossi' }]);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Luca Bianchi');
    expect(fixture.nativeElement.textContent).toContain('IT-CH 2024');
    const nights = (
      fixture.componentInstance as unknown as {
        nightsConfig(): { submit(p: object): { subscribe(): void } };
      }
    ).nightsConfig();
    nights.submit({ employee_id: 'e1', year: '2026', nights_away: 14 }).subscribe();
    expect(api.saveFrontierNights).toHaveBeenCalledWith('e1', { year: 2026, nights_away: 14 });
  });

  it('runs the labour cost report and the child allowances with their filters', () => {
    api.getLabourCostReport.mockReturnValue(
      ok({ year: 2026, month: 5, group_by: 'department', rows: [], employees_without_hours: 2 }),
    );
    api.getChildAllowances.mockReturnValue(ok([]));
    const fixture = TestBed.createComponent(LabourCostPanelComponent);
    fixture.detectChanges();
    const panel = fixture.componentInstance as unknown as {
      loadCost(): void;
      loadChildren(): void;
      employeeId: { set(v: string): void };
      year: { set(v: number): void };
      month: { set(v: number): void };
    };
    panel.year.set(2026);
    panel.month.set(5);
    panel.loadCost();
    expect(api.getLabourCostReport).toHaveBeenCalledWith({
      year: 2026,
      month: 5,
      group_by: 'department',
    });
    panel.employeeId.set('e1');
    panel.loadChildren();
    expect(api.getChildAllowances).toHaveBeenCalledWith({
      year: 2026,
      month: 5,
      employee_id: 'e1',
    });
  });

  it('simulates a hiring and shows the monthly net', () => {
    api.simulateHiring.mockReturnValue(
      ok({
        direction: 'gross_to_net',
        currency: 'CHF',
        annual_gross: '90000.00',
        monthly_gross: '7500.00',
        total_deductions: '1700.00',
        monthly_net: '5800.00',
        target_net_monthly: null,
        is_exact: true,
        employer_total_cost: '100000.00',
        deductions: { 'AVS/AI/IPG': '400.00' },
        notes: 'Estimate',
      }),
    );
    const fixture = TestBed.createComponent(HiringSimulationPanelComponent);
    fixture.detectChanges();
    const panel = fixture.componentInstance as unknown as {
      config: { submit(p: object): { subscribe(): void } };
    };
    panel.config.submit({ year: 2026, annual_gross: '90000' }).subscribe();
    fixture.detectChanges();
    expect(api.simulateHiring).toHaveBeenCalledWith({ year: 2026, annual_gross: '90000' });
    expect(fixture.nativeElement.textContent).toContain('AVS/AI/IPG');
    expect(fixture.nativeElement.textContent).toContain('Estimate');
  });
});
