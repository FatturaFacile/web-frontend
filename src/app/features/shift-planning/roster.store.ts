import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  AssignShiftPayload,
  ComplianceIssue,
  GenerateRosterPayload,
  RosterGroupBy,
  RosterMatrix,
  RosterPeriod,
  RosterPeriodType,
  ShiftAssignment,
  ShiftPlanningApiService,
  ShiftSwapRequest,
  ShiftTemplate,
  SwapDecisionPayload,
} from '@core';
import {
  dayCoverage,
  issuesOfError,
  periodStart,
  problemDetail,
  shiftAnchor,
} from './shift-planning.util';

export interface RosterState {
  periodType: RosterPeriodType;
  /** Any date inside the period on screen. */
  anchor: string;
  groupBy: RosterGroupBy;
  matrix: RosterMatrix | null;
  templates: ShiftTemplate[];
  swaps: ShiftSwapRequest[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  /** Findings of the last rejected change, shown next to the grid. */
  lastIssues: ComplianceIssue[];
  /** The shift whose change was rejected: its card is highlighted. */
  rejectedAssignmentId: string | null;
}

/** What a drag and drop or a publish answered: the findings are blocking when `ok` is false. */
export interface MutationOutcome {
  ok: boolean;
  issues: ComplianceIssue[];
  message: string | null;
}

export interface ShiftTarget {
  date: string;
  employeeId: string | null;
  templateId: string;
  skillId?: string | null;
}

const initialState: RosterState = {
  periodType: 'weekly',
  anchor: new Date().toISOString().slice(0, 10),
  groupBy: 'employee',
  matrix: null,
  templates: [],
  swaps: [],
  loading: false,
  saving: false,
  error: null,
  lastIssues: [],
  rejectedAssignmentId: null,
};

const OK: MutationOutcome = { ok: true, issues: [], message: null };

export const RosterStore = signalStore(
  withState(initialState),
  withComputed(({ matrix, templates, swaps, anchor, periodType }) => ({
    period: computed<RosterPeriod | null>(() => matrix()?.period ?? null),
    days: computed(() => matrix()?.days ?? []),
    rows: computed(() => matrix()?.rows ?? []),
    openShifts: computed<ShiftAssignment[]>(() => matrix()?.open_shifts ?? []),
    coverage: computed(() => matrix()?.coverage ?? []),
    totals: computed(() => matrix()?.totals ?? null),
    isEditable: computed(() => matrix() !== null && matrix()?.period.status !== 'locked'),
    activeTemplates: computed(() => templates().filter((template) => template.is_active)),
    laborCost: computed(() => Number(matrix()?.totals.labor_cost ?? 0)),
    /** Per day: the worst coverage level and the number of open shifts (the heatmap of the header). */
    coverageByDay: computed(() => {
      const cells = matrix()?.coverage ?? [];
      return Object.fromEntries(
        (matrix()?.days ?? []).map((day) => [day, dayCoverage(cells, day)]),
      );
    }),
    understaffedSlots: computed(
      () => (matrix()?.coverage ?? []).filter((cell) => cell.level !== 'ok').length,
    ),
    pendingSwaps: computed(() =>
      swaps().filter((swap) => swap.status === 'pending_manager_approval'),
    ),
    viewStart: computed(() => periodStart(anchor(), periodType())),
  })),
  withMethods((store, api = inject(ShiftPlanningApiService)) => {
    let sequence = 0;

    const fail = (error: unknown, fallback: string): MutationOutcome => {
      const issues = issuesOfError(error);
      return { ok: false, issues, message: problemDetail(error) ?? fallback };
    };

    const reload = async (): Promise<void> => {
      const period = store.period();
      if (period) {
        await loadMatrix(period.id);
      }
    };

    const loadMatrix = async (periodId: string): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getMatrix(periodId, store.groupBy()));
        if (ticket === sequence) {
          patchState(store, { matrix: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, {
            loading: false,
            error: problemDetail(error) ?? 'SHIFT_PLANNING.LOAD_ERROR',
          });
        }
      }
    };

    /** Finds the period of the type that contains the anchor and loads its matrix; a missing period is an empty view. */
    const loadView = async (): Promise<void> => {
      const ticket = ++sequence;
      const start = store.viewStart();
      patchState(store, { loading: true, error: null, lastIssues: [], rejectedAssignmentId: null });
      try {
        const periods = await firstValueFrom(api.getPeriods(store.periodType(), start, start));
        // The API returns only the periods that overlap the first day of the view, newest first.
        const found = periods.data[0] ?? null;
        if (ticket !== sequence) {
          return;
        }
        if (found === null) {
          patchState(store, { matrix: null, loading: false });
          return;
        }
        const response = await firstValueFrom(api.getMatrix(found.id, store.groupBy()));
        if (ticket === sequence) {
          patchState(store, { matrix: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, {
            matrix: null,
            loading: false,
            error: problemDetail(error) ?? 'SHIFT_PLANNING.LOAD_ERROR',
          });
        }
      }
    };

    const mutate = async (
      call: () => Promise<unknown>,
      rejected: string | null,
    ): Promise<MutationOutcome> => {
      patchState(store, { saving: true, error: null, lastIssues: [], rejectedAssignmentId: null });
      try {
        await call();
        await reload();
        patchState(store, { saving: false });
        return OK;
      } catch (error) {
        const outcome = fail(error, 'SHIFT_PLANNING.SAVE_ERROR');
        patchState(store, {
          saving: false,
          lastIssues: outcome.issues,
          rejectedAssignmentId: rejected,
          error: outcome.issues.length === 0 ? outcome.message : null,
        });
        return outcome;
      }
    };

    const payload = (target: ShiftTarget, periodId?: string): AssignShiftPayload => ({
      ...(periodId ? { roster_schedule_period_id: periodId } : {}),
      shift_date: target.date,
      shift_template_id: target.templateId,
      employee_id: target.employeeId,
      required_role_or_skill_id: target.skillId ?? null,
    });

    return {
      async init(): Promise<void> {
        const templates = await firstValueFrom(api.getTemplates()).catch(() => null);
        patchState(store, { templates: templates?.data ?? [] });
        await loadView();
      },
      async setPeriodType(periodType: RosterPeriodType): Promise<void> {
        patchState(store, { periodType });
        await loadView();
      },
      async setGroupBy(groupBy: RosterGroupBy): Promise<void> {
        patchState(store, { groupBy });
        await reload();
      },
      async navigate(direction: -1 | 1): Promise<void> {
        patchState(store, { anchor: shiftAnchor(store.anchor(), store.periodType(), direction) });
        await loadView();
      },
      async goTo(anchor: string): Promise<void> {
        patchState(store, { anchor });
        await loadView();
      },
      reload,
      loadView,
      clearIssues(): void {
        patchState(store, { lastIssues: [], rejectedAssignmentId: null, error: null });
      },
      /** Drag and drop of an existing shift to another employee or day. */
      moveShift(assignment: ShiftAssignment, target: ShiftTarget): Promise<MutationOutcome> {
        return mutate(
          () => firstValueFrom(api.moveAssignment(assignment.id, payload(target))),
          assignment.id,
        );
      },
      /** A template dropped from the palette creates a shift (open when the employee is null). */
      createShift(target: ShiftTarget): Promise<MutationOutcome> {
        const periodId = store.period()?.id;
        return periodId
          ? mutate(() => firstValueFrom(api.createAssignment(payload(target, periodId))), null)
          : Promise.resolve({ ok: false, issues: [], message: 'SHIFT_PLANNING.NO_PERIOD' });
      },
      async generate(
        request: GenerateRosterPayload,
      ): Promise<MutationOutcome & { period: RosterPeriod | null }> {
        patchState(store, { saving: true, error: null });
        try {
          const response = await firstValueFrom(api.generatePeriod(request));
          patchState(store, { saving: false, anchor: response.data.period.start_date });
          await loadView();
          return { ...OK, period: response.data.period };
        } catch (error) {
          patchState(store, { saving: false });
          return { ...fail(error, 'SHIFT_PLANNING.SAVE_ERROR'), period: null };
        }
      },
      publish(): Promise<MutationOutcome> {
        const periodId = store.period()?.id;
        return periodId
          ? mutate(() => firstValueFrom(api.publishPeriod(periodId)), null)
          : Promise.resolve({ ok: false, issues: [], message: 'SHIFT_PLANNING.NO_PERIOD' });
      },
      lock(): Promise<MutationOutcome> {
        const periodId = store.period()?.id;
        return periodId
          ? mutate(() => firstValueFrom(api.lockPeriod(periodId)), null)
          : Promise.resolve({ ok: false, issues: [], message: 'SHIFT_PLANNING.NO_PERIOD' });
      },
      async loadSwaps(): Promise<void> {
        const response = await firstValueFrom(api.getSwaps()).catch(() => null);
        patchState(store, { swaps: response?.data ?? [] });
      },
      async decideSwap(
        swap: ShiftSwapRequest,
        decision: SwapDecisionPayload,
      ): Promise<MutationOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.decideSwap(swap.id, decision));
          const response = await firstValueFrom(api.getSwaps());
          patchState(store, { swaps: response.data, saving: false });
          await reload();
          return OK;
        } catch (error) {
          patchState(store, { saving: false });
          return fail(error, 'SHIFT_PLANNING.SAVE_ERROR');
        }
      },
    };
  }),
);
