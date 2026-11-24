import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrApiService, HrEmployeeApiService, PermissionsService, ShortTimeApiService } from '@core';
import { icons } from '../../../icons-provider';
import { CrudConfig } from '../shared/crud/crud.types';
import { ConstructionPanelComponent } from './construction-panel.component';
import { ShortTimeClaimModalComponent } from './short-time-claim-modal.component';
import { ShortTimeClaimsDrawerComponent } from './short-time-claims-drawer.component';
import { ShortTimeComponent } from './short-time.component';

type Row = { id: string } & Record<string, unknown>;
const ok = (data: unknown) => of({ success: true, message: '', data });

const claim = (status: string) => ({
  id: 'cl1',
  status,
  loss_percent: '42.50',
  meets_minimum_loss: true,
  total_compensation: '1234.50',
  claim_due_on: '2026-03-31',
  warnings: ['Consent missing'],
  lines: [],
});

describe('Short-time work', () => {
  const api = {
    getCases: vi.fn(),
    createCase: vi.fn(),
    calculateClaim: vi.fn(),
    getClaim: vi.fn(),
    submitClaim: vi.fn(),
    applyClaim: vi.fn(),
    recordReimbursement: vi.fn(),
    downloadClaim: vi.fn(),
    addConstructionParameters: vi.fn(),
    saveConstructionCalendar: vi.fn(),
    getConstructionHours: vi.fn(),
    getJointCommissionReport: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getCases.mockReturnValue(
      ok([
        {
          id: 'c1',
          kind: 'bad_weather',
          cause: 'Snow',
          starts_on: '2026-01-10',
          claims_count: 1,
          claims: [
            { id: 'cl1', year: 2026, month: 1, status: 'draft', total_compensation: '100.00' },
          ],
        },
      ]),
    );
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: ShortTimeApiService, useValue: api },
        {
          provide: HrApiService,
          useValue: {
            getEmployees: () =>
              ok([{ id: 'e1', employee_number: 'E-1', full_name: 'Mario Rossi' }]),
          },
        },
        {
          provide: HrEmployeeApiService,
          useValue: { getDepartments: () => ok([{ id: 'd1', code: 'BUILD', name: 'Building' }]) },
        },
        { provide: PermissionsService, useValue: { canWrite: () => true, canRead: () => true } },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  it('lists the cases with the number of claims and creates a case', async () => {
    api.createCase.mockReturnValue(ok({}));
    const fixture = TestBed.createComponent(ShortTimeComponent);
    fixture.detectChanges();
    const config = (
      fixture.componentInstance as unknown as { casesConfig(): CrudConfig<Row> }
    ).casesConfig();
    const page = await new Promise<{ data: Row[] }>((resolve) => config.gridList?.({ page: 1 }).subscribe(resolve));
    expect(api.getCases).toHaveBeenCalledWith({ page: 1 });
    expect(page.data[0]['claims_count']).toBe(1);
    config.create?.({ kind: 'short_time', cause: 'Orders', starts_on: '2026-02-01' }).subscribe();
    expect(api.createCase).toHaveBeenCalledWith({
      kind: 'short_time',
      cause: 'Orders',
      starts_on: '2026-02-01',
    });
  });

  it('opens the claim calculation of a case from its row action', async () => {
    const fixture = TestBed.createComponent(ShortTimeComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      casesConfig(): CrudConfig<Row>;
      claimModalOpen(): boolean;
      selected(): { id: string } | null;
    };
    const config = page.casesConfig();
    await new Promise<void>((resolve) => config.gridList?.({ page: 1 }).subscribe(() => resolve()));
    config.rowActions?.[0].run({ id: 'c1' });
    expect(page.claimModalOpen()).toBe(true);
    expect(page.selected()?.id).toBe('c1');
  });

  describe('claim modal', () => {
    interface Modal {
      addRow(): void;
      submit(): void;
      rows: { at(i: number): { patchValue(v: object): void } };
      form: { patchValue(v: object): void };
    }

    it('calculates the claim sending the typed decimals and leaving the empty hours out', () => {
      api.calculateClaim.mockReturnValue(ok(claim('draft')));
      const fixture = TestBed.createComponent(ShortTimeClaimModalComponent);
      fixture.componentRef.setInput('caseId', 'c1');
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      const modal = fixture.componentInstance as unknown as Modal;
      const calculated = vi.fn();
      fixture.componentInstance.calculated.subscribe(calculated);
      modal.form.patchValue({ year: '2026', month: '1' });
      modal.addRow();
      modal.rows.at(0).patchValue({ employee_id: 'e1', worked_hours: '80.5', consented: true });
      modal.submit();
      expect(api.calculateClaim).toHaveBeenCalledWith('c1', {
        year: 2026,
        month: 1,
        employees: [{ employee_id: 'e1', consented: true, worked_hours: '80.5' }],
      });
      expect(calculated).toHaveBeenCalledWith(expect.objectContaining({ id: 'cl1' }));
    });

    it('does not call the API for a month out of range or a missing employee', () => {
      const fixture = TestBed.createComponent(ShortTimeClaimModalComponent);
      fixture.componentRef.setInput('caseId', 'c1');
      fixture.detectChanges();
      const modal = fixture.componentInstance as unknown as Modal;
      modal.form.patchValue({ month: '13' });
      modal.addRow();
      modal.submit();
      expect(api.calculateClaim).not.toHaveBeenCalled();
    });

    it('shows the 422 message of the server', () => {
      api.calculateClaim.mockReturnValue(
        throwError(
          () => new HttpErrorResponse({ status: 422, error: { detail: 'Swiss companies only' } }),
        ),
      );
      const fixture = TestBed.createComponent(ShortTimeClaimModalComponent);
      fixture.componentRef.setInput('caseId', 'c1');
      fixture.detectChanges();
      const modal = fixture.componentInstance as unknown as Modal;
      modal.addRow();
      modal.rows.at(0).patchValue({ employee_id: 'e1' });
      modal.submit();
      expect(message.error).toHaveBeenCalledWith('Swiss companies only');
    });
  });

  describe('claims drawer', () => {
    function drawer(status: string) {
      const fixture = TestBed.createComponent(ShortTimeClaimsDrawerComponent);
      fixture.componentRef.setInput('caseRecord', { id: 'c1', claims: [{ id: 'cl1', status }] });
      fixture.componentRef.setInput('canWrite', true);
      fixture.componentRef.setInput('focusClaim', claim(status));
      fixture.componentRef.setInput('open', true);
      fixture.detectChanges();
      return fixture.componentInstance as unknown as {
        run(request: unknown, key: string): void;
        select(id: string): void;
        exportCsv(c: { id: string }): void;
        claim(): { status: string } | null;
        reimbursementConfig(): { submit(p: object): { subscribe(): void } };
      };
    }

    it('shows the claim handed over by the page and marks it as sent', () => {
      api.submitClaim.mockReturnValue(ok(claim('submitted')));
      const component = drawer('draft');
      expect(component.claim()?.status).toBe('draft');
      component.run(api.submitClaim('cl1'), 'hrmShortTime.claims.submitted');
      expect(component.claim()?.status).toBe('submitted');
      expect(message.success).toHaveBeenCalled();
    });

    it('loads a claim from the list and records the reimbursement with the decimal as typed', () => {
      api.getClaim.mockReturnValue(ok(claim('submitted')));
      api.recordReimbursement.mockReturnValue(ok(claim('reimbursed')));
      const component = drawer('submitted');
      component.select('cl1');
      expect(api.getClaim).toHaveBeenCalledWith('cl1');
      component
        .reimbursementConfig()
        .submit({ amount: '1234.50', paid_on: '2026-04-01' })
        .subscribe();
      expect(api.recordReimbursement).toHaveBeenCalledWith('cl1', {
        amount: '1234.50',
        paid_on: '2026-04-01',
      });
      expect(component.claim()?.status).toBe('reimbursed');
    });

    it('downloads the figures of the claim', () => {
      api.downloadClaim.mockReturnValue(of(new Blob(['a;b'])));
      const createObjectURL = vi.fn().mockReturnValue('blob:x');
      Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
      drawer('draft').exportCsv({ id: 'cl1' });
      expect(api.downloadClaim).toHaveBeenCalledWith('cl1');
      expect(createObjectURL).toHaveBeenCalled();
    });
  });

  describe('construction panel', () => {
    it('saves the calendar as one entry per filled month', () => {
      api.saveConstructionCalendar.mockReturnValue(ok({ saved: 2 }));
      const fixture = TestBed.createComponent(ConstructionPanelComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.detectChanges();
      const panel = fixture.componentInstance as unknown as {
        calendarConfig: { submit(p: object): { subscribe(): void } };
      };
      panel.calendarConfig
        .submit({ agreement_code: 'CCL', year: 2026, m1: '176', m3: '184' })
        .subscribe();
      expect(api.saveConstructionCalendar).toHaveBeenCalledWith({
        agreement_code: 'CCL',
        months: [
          { year: 2026, month: 1, planned_hours: '176' },
          { year: 2026, month: 3, planned_hours: '184' },
        ],
      });
    });

    it('parses the minimum wages JSON for a new version of the parameters and rejects a broken one', () => {
      api.addConstructionParameters.mockReturnValue(ok({}));
      const fixture = TestBed.createComponent(ConstructionPanelComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.detectChanges();
      const panel = fixture.componentInstance as unknown as {
        parametersConfig: { submit(p: object): { subscribe(o: object): void } };
      };
      panel.parametersConfig
        .submit({
          agreement_code: 'CCL',
          minimum_wages: '{"A":{"Z1":{"monthly":6000,"hourly":30}}}',
        })
        .subscribe({});
      expect(api.addConstructionParameters).toHaveBeenCalledWith({
        agreement_code: 'CCL',
        minimum_wages: { A: { Z1: { monthly: 6000, hourly: 30 } } },
      });
      const errors: HttpErrorResponse[] = [];
      panel.parametersConfig
        .submit({ agreement_code: 'CCL', minimum_wages: 'nope' })
        .subscribe({ error: (e: HttpErrorResponse) => errors.push(e) });
      expect(api.addConstructionParameters).toHaveBeenCalledTimes(1);
      expect(errors[0].status).toBe(422);
    });

    it('loads the hours and the joint commission report of an agreement and year', () => {
      api.getConstructionHours.mockReturnValue(
        ok({
          agreement_code: 'CCL',
          accounting_year: 2026,
          months: [],
          balance_hours: '12.00',
          hourly_wage: '30.00',
          constant_monthly_wage: '5000.00',
        }),
      );
      api.getJointCommissionReport.mockReturnValue(
        ok({
          agreement_code: 'CCL',
          accounting_year: 2026,
          parameters_valid_from: '2026-01-01',
          annual_hours: '2112',
          source: 'CCL 2026',
          rows: [],
        }),
      );
      const fixture = TestBed.createComponent(ConstructionPanelComponent);
      fixture.detectChanges();
      const panel = fixture.componentInstance as unknown as {
        agreementCode: { set(v: string): void };
        accountingYear: { set(v: number): void };
        employeeId: { set(v: string): void };
        loadHours(): void;
        loadReport(): void;
      };
      panel.agreementCode.set('CCL');
      panel.accountingYear.set(2026);
      panel.employeeId.set('e1');
      panel.loadHours();
      panel.loadReport();
      expect(api.getConstructionHours).toHaveBeenCalledWith({
        agreement_code: 'CCL',
        accounting_year: 2026,
        employee_id: 'e1',
      });
      expect(api.getJointCommissionReport).toHaveBeenCalledWith({
        agreement_code: 'CCL',
        accounting_year: 2026,
        employee_id: 'e1',
      });
    });
  });
});
