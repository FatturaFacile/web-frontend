import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { HrTimeApiService } from '@core';
import { icons } from '../../../icons-provider';
import { CrudConfig } from '../shared/crud/crud.types';
import { TimeClosingsComponent } from './time-closings.component';
import { TimeMealsComponent } from './time-meals.component';
import { TimePayrollViewComponent } from './time-payroll-view.component';
import { TimePresenceComponent } from './time-presence.component';
import { TimePunchImportComponent } from './time-punch-import.component';
import { TimeScheduleGroupsComponent } from './time-schedule-groups.component';

type Row = { id: string } & Record<string, unknown>;
interface Submittable { submit(p: object): { subscribe(o?: object): void } }
const ok = (data: unknown) => of({ success: true, message: '', data });

describe('Working time extras', () => {
  const api = {
    getTimeClosings: vi.fn(),
    closeMonth: vi.fn(),
    reopenMonth: vi.fn(),
    transferToPayroll: vi.fn(),
    getScheduleGroups: vi.fn(),
    createScheduleGroup: vi.fn(),
    addScheduleGroupRules: vi.fn(),
    addScheduleGroupMember: vi.fn(),
    registerBadge: vi.fn(),
    getPresence: vi.fn(),
    getPayrollView: vi.fn(),
    importPunches: vi.fn(),
    getMealBookings: vi.fn(),
    bookMeal: vi.fn(),
    getNightWorkBalances: vi.fn(),
  };
  const message = { success: vi.fn(), error: vi.fn() };

  beforeEach(() => {
    vi.clearAllMocks();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [
        provideNzIcons(icons),
        { provide: HrTimeApiService, useValue: api },
        { provide: NzMessageService, useValue: message },
      ],
    });
  });

  describe('closings', () => {
    it('transfers a closed month to payroll and shows what was carried over', () => {
      api.getTimeClosings.mockReturnValue(
        ok([
          {
            id: 'c1',
            year: 2026,
            month: 3,
            status: 'Closed',
            closed_at: null,
            reopen_count: 0,
            reopen_reason: null,
          },
          {
            id: 'c2',
            year: 2026,
            month: 4,
            status: 'Open',
            closed_at: null,
            reopen_count: 0,
            reopen_reason: null,
          },
        ]),
      );
      api.transferToPayroll.mockReturnValue(
        ok({
          year: 2026,
          month: 3,
          employees_processed: 5,
          inputs_upserted: 12,
          night_time_bank_credits: 1,
          items: [],
        }),
      );
      const fixture = TestBed.createComponent(TimeClosingsComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.detectChanges();
      const component = fixture.componentInstance as unknown as {
        canTransfer(r: { status: string }): boolean;
        transferToPayroll(r: { year: number; month: number }): void;
        transfer(): { employees_processed: number } | null;
      };
      expect(component.canTransfer({ status: 'Closed' })).toBe(true);
      expect(component.canTransfer({ status: 'Approved' })).toBe(true);
      expect(component.canTransfer({ status: 'Open' })).toBe(false);
      component.transferToPayroll({ year: 2026, month: 3 });
      expect(api.transferToPayroll).toHaveBeenCalledWith(2026, 3);
      expect(component.transfer()?.employees_processed).toBe(5);
    });

    it('shows the 409 message when the period cannot be transferred', () => {
      api.getTimeClosings.mockReturnValue(ok([]));
      api.transferToPayroll.mockReturnValue(
        new (class {
          subscribe(o: { error(e: unknown): void }): void {
            o.error(new HttpErrorResponse({ status: 409, error: { detail: 'Period not closed' } }));
          }
        })(),
      );
      const fixture = TestBed.createComponent(TimeClosingsComponent);
      fixture.detectChanges();
      (
        fixture.componentInstance as unknown as { transferToPayroll(r: object): void }
      ).transferToPayroll({ year: 2026, month: 5 });
      expect(message.error).toHaveBeenCalledWith('Period not closed');
    });
  });

  it('shows who is in now', () => {
    api.getPresence.mockReturnValue(
      ok([
        {
          employee_id: 'e1',
          employee_name: 'Mario Rossi',
          state: 'in',
          since: '2026-03-01T08:00:00Z',
          source: 'badge',
        },
      ]),
    );
    const fixture = TestBed.createComponent(TimePresenceComponent);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Mario Rossi');
  });

  describe('payroll view', () => {
    it('loads the payroll view of an employee and period', () => {
      api.getPayrollView.mockReturnValue(
        ok({
          employee_id: 'e1',
          from: '2026-03-01',
          to: '2026-03-31',
          days: [],
          totals: {
            recorded_minutes: 100,
            payroll_minutes: 105,
            night_minutes: 0,
            night_allowance_minutes: 0,
            sunday_allowance_minutes: 0,
            holiday_allowance_minutes: 0,
            daily_allowance_amount: '12.50',
            ytd_night_shifts: 3,
            is_regular_night_worker: false,
            night_compensation_mode: 'none',
            night_time_compensation_minutes: 0,
            night_cash_supplement_minutes: 0,
          },
        }),
      );
      const fixture = TestBed.createComponent(TimePayrollViewComponent);
      fixture.detectChanges();
      const view = fixture.componentInstance as unknown as {
        employeeId: { set(v: string): void };
        from: { set(v: string): void };
        to: { set(v: string): void };
        loadView(): void;
      };
      view.employeeId.set('e1');
      view.from.set('2026-03-01');
      view.to.set('2026-03-31');
      view.loadView();
      fixture.detectChanges();
      expect(api.getPayrollView).toHaveBeenCalledWith({
        employee_id: 'e1',
        from: '2026-03-01',
        to: '2026-03-31',
      });
      expect(fixture.nativeElement.textContent).toContain('105 min');
    });

    it('lists the night work balances of a year with the employee name', () => {
      api.getNightWorkBalances.mockReturnValue(
        ok([
          {
            id: 'b1',
            user_id: 'u1',
            employee_id: 'e1',
            year: 2026,
            ytd_night_shifts: 30,
            is_regular_night_worker: true,
            total_night_minutes: 100,
            accrued_rest_minutes: 60,
            taken_rest_minutes: 10,
            remaining_rest_minutes: 50,
            cash_supplement_minutes: 0,
            compensation_mode: 'time',
          },
        ]),
      );
      const fixture = TestBed.createComponent(TimePayrollViewComponent);
      fixture.componentRef.setInput('employees', [{ value: 'e1', label: 'E-1 - Mario Rossi' }]);
      fixture.detectChanges();
      const view = fixture.componentInstance as unknown as {
        year: { set(v: number): void };
        loadBalances(): void;
      };
      view.year.set(2026);
      view.loadBalances();
      fixture.detectChanges();
      expect(api.getNightWorkBalances).toHaveBeenCalledWith({ year: 2026 });
      expect(fixture.nativeElement.textContent).toContain('Mario Rossi');
    });
  });

  describe('schedule groups', () => {
    function setup() {
      api.getScheduleGroups.mockReturnValue(ok([{ id: 'g1', name: 'Turni', is_active: true }]));
      const fixture = TestBed.createComponent(TimeScheduleGroupsComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.componentRef.setInput('employees', [{ value: 'e1', label: 'E-1 - Mario Rossi' }]);
      fixture.detectChanges();
      return fixture.componentInstance as unknown as {
        groupsConfig(): CrudConfig<Row>;
        rulesConfig(): Submittable;
        memberConfig(): Submittable;
        badgeConfig(): Submittable;
        rulesOpen(): boolean;
        memberOpen(): boolean;
      };
    }

    it('creates a group and opens the rule and member dialogs from the row actions', () => {
      api.createScheduleGroup.mockReturnValue(ok({}));
      const component = setup();
      const config = component.groupsConfig();
      config.create?.({ name: 'Notte', is_active: true }).subscribe();
      expect(api.createScheduleGroup).toHaveBeenCalledWith({ name: 'Notte', is_active: true });
      config.rowActions?.[0].run({ id: 'g1' });
      expect(component.rulesOpen()).toBe(true);
      config.rowActions?.[1].run({ id: 'g1' });
      expect(component.memberOpen()).toBe(true);
    });

    it('adds the rules and the member to the selected group and registers a badge', () => {
      api.addScheduleGroupRules.mockReturnValue(ok({}));
      api.addScheduleGroupMember.mockReturnValue(ok({}));
      api.registerBadge.mockReturnValue(ok({}));
      const component = setup();
      component.groupsConfig().rowActions?.[0].run({ id: 'g1' });
      const rules = {
        valid_from: '2026-01-01',
        rounding_mode: 'nearest',
        night_allowance_percent: '25',
      };
      component.rulesConfig().submit(rules).subscribe();
      expect(api.addScheduleGroupRules).toHaveBeenCalledWith('g1', rules);
      const member = { employee_id: 'e1', valid_from: '2026-01-01', valid_to: null };
      component.memberConfig().submit(member).subscribe();
      expect(api.addScheduleGroupMember).toHaveBeenCalledWith('g1', member);
      component
        .badgeConfig()
        .submit({ employee_id: 'e1', badge_code: 'B-1', is_active: true })
        .subscribe();
      expect(api.registerBadge).toHaveBeenCalledWith({
        employee_id: 'e1',
        badge_code: 'B-1',
        is_active: true,
      });
    });
  });

  describe('punch import', () => {
    function setup() {
      api.importPunches.mockReturnValue(
        ok({
          accepted: 2,
          duplicates: 1,
          rejected: [{ external_id: 'x3', reason: 'Unknown badge' }],
        }),
      );
      const fixture = TestBed.createComponent(TimePunchImportComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.detectChanges();
      return {
        fixture,
        config: (fixture.componentInstance as unknown as { config: Submittable }).config,
      };
    }

    it('turns the lines into punches and shows accepted, duplicates and rejected', () => {
      const { fixture, config } = setup();
      config
        .submit({
          reader_id: 'R1',
          source: 'terminal',
          punches: 'x1;B-1;2026-03-01T08:00:00Z;In\nx2,B-1,2026-03-01T12:00:00Z,Meal,lunch\n',
        })
        .subscribe();
      expect(api.importPunches).toHaveBeenCalledWith({
        reader_id: 'R1',
        source: 'terminal',
        punches: [
          {
            external_id: 'x1',
            badge_code: 'B-1',
            occurred_at: '2026-03-01T08:00:00Z',
            punch_type: 'In',
          },
          {
            external_id: 'x2',
            badge_code: 'B-1',
            occurred_at: '2026-03-01T12:00:00Z',
            punch_type: 'Meal',
            meal_type: 'lunch',
          },
        ],
      });
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Unknown badge');
    });

    it('rejects a line with an unknown punch type without calling the API', () => {
      const { config } = setup();
      const errors: HttpErrorResponse[] = [];
      config
        .submit({ reader_id: 'R1', punches: 'x1;B-1;2026-03-01T08:00:00Z;Lunch' })
        .subscribe({ error: (e: HttpErrorResponse) => errors.push(e) });
      expect(api.importPunches).not.toHaveBeenCalled();
      expect(errors[0].status).toBe(422);
    });
  });

  describe('meals', () => {
    it('books a meal and reloads the period when one is selected', async () => {
      api.bookMeal.mockReturnValue(ok({}));
      api.getMealBookings.mockReturnValue(
        ok([
          {
            user_id: 'e1',
            meal_type: 'lunch',
            occurred_at: '2026-03-01T12:00:00Z',
            source: 'web',
          },
        ]),
      );
      const fixture = TestBed.createComponent(TimeMealsComponent);
      fixture.componentRef.setInput('canWrite', true);
      fixture.componentRef.setInput('employees', [{ value: 'e1', label: 'E-1 - Mario Rossi' }]);
      fixture.detectChanges();
      const meals = fixture.componentInstance as unknown as {
        bookConfig(): Submittable;
        from: { set(v: string): void };
        to: { set(v: string): void };
        load(): void;
      };
      meals.from.set('2026-03-01');
      meals.to.set('2026-03-31');
      meals.bookConfig().submit({ meal_type: 'lunch', source: 'web' }).subscribe();
      expect(api.bookMeal).toHaveBeenCalledWith({ meal_type: 'lunch', source: 'web' });
      fixture.detectChanges();
      // the meal grid loads the period after its first debounce tick
      await new Promise((resolve) => setTimeout(resolve, 450));
      expect(api.getMealBookings).toHaveBeenCalledWith(
        expect.objectContaining({ employee_id: null, from: '2026-03-01', to: '2026-03-31' }),
      );
      fixture.detectChanges();
      expect(fixture.nativeElement.textContent).toContain('Mario Rossi');
    });
  });
});
