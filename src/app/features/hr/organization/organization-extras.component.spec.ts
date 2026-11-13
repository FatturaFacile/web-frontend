import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrApiService, HrEmployeeApiService, PermissionsService } from '@core';
import { icons } from '../../../icons-provider';
import { CrudConfig } from '../shared/crud/crud.types';
import { OrganizationComponent } from './organization.component';
import { PayrollForecastComponent } from './payroll-forecast.component';
import { PositionSuccessorDialogComponent } from './position-successor-dialog.component';

type Row = { id: string } & Record<string, unknown>;
interface Submittable { submit(p: object): { subscribe(o?: object): void } }
const ok = (data: unknown) => of({ success: true, message: '', data });

describe('Organization: successor and payroll forecast', () => {
  const orgApi = {
    getDepartments: vi.fn(),
    getPositions: vi.fn(),
    createDepartment: vi.fn(),
    updateDepartment: vi.fn(),
    createPosition: vi.fn(),
    updatePosition: vi.fn(),
    assignPositionSuccessor: vi.fn(),
    generatePayrollForecast: vi.fn(),
  };
  const position = {
    id: 'p1',
    code: 'CFO',
    title: 'CFO',
    department_id: null,
    headcount_budget: 1,
    is_critical_role: true,
    successor_employee_id: null,
    readiness_level: null,
    is_active: true,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    orgApi.getDepartments.mockReturnValue(ok([]));
    orgApi.getPositions.mockReturnValue(ok([position]));
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: HrEmployeeApiService, useValue: orgApi },
        {
          provide: HrApiService,
          useValue: {
            getEmployees: () => ok([{ id: 'e2', employee_number: 'E-2', full_name: 'Anna Verdi' }]),
          },
        },
        { provide: PermissionsService, useValue: { canWrite: () => true, canRead: () => true } },
        { provide: NzMessageService, useValue: { success: vi.fn(), error: vi.fn() } },
      ],
    });
  });

  it('opens the successor dialog from the position row action and reloads the positions after the assignment', async () => {
    const fixture = TestBed.createComponent(OrganizationComponent);
    fixture.detectChanges();
    const page = fixture.componentInstance as unknown as {
      positionsConfig(): CrudConfig<Row>;
      successorOpen(): boolean;
      successorPosition(): { id: string } | null;
      positionsVersion: { update(fn: (v: number) => number): void };
    };
    const first = page.positionsConfig();
    await new Promise<void>((resolve) => first.gridList?.({ page: 1 }).subscribe(() => resolve()));
    first.rowActions?.[0].run({ id: 'p1' });
    expect(page.successorOpen()).toBe(true);
    expect(page.successorPosition()?.id).toBe('p1');
    page.positionsVersion.update((v) => v + 1);
    expect(page.positionsConfig()).not.toBe(first);
  });

  it('assigns the successor with the readiness level and emits the saved position', () => {
    orgApi.assignPositionSuccessor.mockReturnValue(
      ok({ ...position, successor_employee_id: 'e2', readiness_level: 'ready_now' }),
    );
    const fixture = TestBed.createComponent(PositionSuccessorDialogComponent);
    fixture.componentRef.setInput('positionId', 'p1');
    fixture.componentRef.setInput('open', true);
    fixture.componentRef.setInput('employees', [{ value: 'e2', label: 'E-2 - Anna Verdi' }]);
    fixture.detectChanges();
    const assigned = vi.fn();
    fixture.componentInstance.assigned.subscribe(assigned);
    const dialog = fixture.componentInstance as unknown as { config(): Submittable };
    dialog
      .config()
      .submit({ successor_employee_id: 'e2', readiness_level: 'ready_now' })
      .subscribe();
    expect(orgApi.assignPositionSuccessor).toHaveBeenCalledWith('p1', {
      successor_employee_id: 'e2',
      readiness_level: 'ready_now',
    });
    expect(assigned).toHaveBeenCalledWith(expect.objectContaining({ successor_employee_id: 'e2' }));
    expect(fixture.componentInstance.open()).toBe(false);
  });

  it('generates the payroll forecast of a period and shows the result', () => {
    orgApi.generatePayrollForecast.mockReturnValue(
      ok({
        period_code: '2026-11',
        active_headcount: 12,
        estimated_payroll_outflow: 85000,
        accrual_amount: 1200,
      }),
    );
    const fixture = TestBed.createComponent(PayrollForecastComponent);
    fixture.componentRef.setInput('canWrite', true);
    fixture.detectChanges();
    const forecast = fixture.componentInstance as unknown as { config: Submittable };
    forecast.config.submit({ period_code: '2026-11' }).subscribe();
    fixture.detectChanges();
    expect(orgApi.generatePayrollForecast).toHaveBeenCalledWith('2026-11');
    expect(fixture.nativeElement.textContent).toContain('2026-11');
    expect(fixture.nativeElement.textContent).toContain('12');
  });
});
