import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ComportoOrCurtailmentEvaluationData,
  DepartmentGanttResponse,
  DepartmentResource,
  DepartmentStaffingThresholdRecord,
  EmployeeLeaveAccrualLedgerRecord,
  EmployeeResource,
  HolidayCalendarRecord,
  HolidayCatalogResponse,
  HrApiService,
  HrEmployeeApiService,
  LeaveCountryCode,
  LeaveEntitlementPolicyRecord,
  LeaveManagementApiService,
  Mod074LeaveRequestRecord,
  PayrollAbsenceSummaryRow,
  RegisterSickLeaveInpsPayload,
  SaveHolidayCalendarPayload,
  SaveLeaveEntitlementPolicyPayload,
  SubmitMod074LeaveRequestPayload,
  UpsertStaffingThresholdPayload,
} from '@core';

export interface LeaveManagementState {
  employees: EmployeeResource[];
  departments: DepartmentResource[];
  holidayCatalog: HolidayCatalogResponse | null;
  holidayCalendars: HolidayCalendarRecord[];
  policies: LeaveEntitlementPolicyRecord[];
  ledgers: EmployeeLeaveAccrualLedgerRecord[];
  requests: Mod074LeaveRequestRecord[];
  gantt: DepartmentGanttResponse | null;
  thresholds: DepartmentStaffingThresholdRecord[];
  comportoEvaluation: ComportoOrCurtailmentEvaluationData | null;
  payrollSummary: PayrollAbsenceSummaryRow[];
  loading: boolean;
  saving: boolean;
  error: unknown;
}

const initialState: LeaveManagementState = {
  employees: [],
  departments: [],
  holidayCatalog: null,
  holidayCalendars: [],
  policies: [],
  ledgers: [],
  requests: [],
  gantt: null,
  thresholds: [],
  comportoEvaluation: null,
  payrollSummary: [],
  loading: false,
  saving: false,
  error: null,
};

/** NgRx SignalStore for Mod 074 Leave, Permits & Absences Management. */
export const LeaveManagementStore = signalStore(
  withState(initialState),
  withComputed((store) => ({
    pendingRequestsCount: computed(
      () => store.requests().filter((r) => r.status === 'pending_approval').length,
    ),
    expiringLedgersCount: computed(
      () =>
        store
          .ledgers()
          .filter(
            (l) =>
              l.deadline_alert_level === 'warning' ||
              l.deadline_alert_level === 'critical' ||
              l.deadline_alert_level === 'expired',
          ).length,
    ),
    staffingBreachedDaysCount: computed(
      () => (store.gantt()?.days ?? []).filter((d) => d.threshold_breached).length,
    ),
  })),
  withMethods((store) => {
    const api = inject(LeaveManagementApiService);
    const hrApi = inject(HrApiService);
    const hrEmpApi = inject(HrEmployeeApiService);

    async function runLoad<T>(fn: () => Promise<T>, onSuccess: (value: T) => void): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const res = await fn();
        onSuccess(res);
        patchState(store, { loading: false });
      } catch (err) {
        patchState(store, { loading: false, error: err });
        throw err;
      }
    }

    async function runSave<T>(fn: () => Promise<T>, onSuccess: (value: T) => void): Promise<T> {
      patchState(store, { saving: true, error: null });
      try {
        const res = await fn();
        onSuccess(res);
        patchState(store, { saving: false });
        return res;
      } catch (err) {
        patchState(store, { saving: false, error: err });
        throw err;
      }
    }

    return {
      loadDirectory: async (): Promise<void> => {
        if (store.employees().length > 0 && store.departments().length > 0) {
          return;
        }
        await runLoad(
          async () => {
            const [emps, depts] = await Promise.all([
              firstValueFrom(hrApi.getEmployees({ per_page: 200 })),
              firstValueFrom(hrEmpApi.getDepartments({ per_page: 200 })),
            ]);
            return { emps: emps.data ?? [], depts: depts.data ?? [] };
          },
          ({ emps, depts }) => patchState(store, { employees: emps, departments: depts }),
        );
      },

      loadGantt: async (params: {
        from: string;
        to: string;
        department_id?: string;
        country?: LeaveCountryCode;
        canton_or_province_code?: string;
      }): Promise<void> => {
        await runLoad(
          async () => {
            const [ganttRes, thresholdsRes] = await Promise.all([
              firstValueFrom(api.getDepartmentCalendar(params)),
              firstValueFrom(api.getStaffingThresholds()),
            ]);
            return { gantt: ganttRes.data, thresholds: thresholdsRes.data };
          },
          ({ gantt, thresholds }) => patchState(store, { gantt, thresholds }),
        );
      },

      upsertStaffingThreshold: async (
        departmentId: string,
        payload: UpsertStaffingThresholdPayload,
      ): Promise<DepartmentStaffingThresholdRecord> => {
        const res = await runSave(
          () => firstValueFrom(api.upsertStaffingThreshold(departmentId, payload)),
          (saved) => {
            const existing = store.thresholds();
            const idx = existing.findIndex((t) => t.department_id === saved.data.department_id);
            patchState(store, {
              thresholds:
                idx >= 0
                  ? existing.map((t, i) => (i === idx ? saved.data : t))
                  : [...existing, saved.data],
            });
          },
        );
        return res.data;
      },

      loadLedgers: async (params?: {
        employee_id?: string;
        fiscal_year?: number;
        country?: LeaveCountryCode;
      }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getLedgers(params)),
          (res) => patchState(store, { ledgers: res.data }),
        );
      },

      calculateMonthlyAccruals: async (payload: {
        fiscal_year: number;
        month: number;
        employee_id?: string;
        country?: LeaveCountryCode;
      }): Promise<number> => {
        const res = await runSave(
          () => firstValueFrom(api.calculateMonthlyAccruals(payload)),
          (out) => {
            if (out.data.ledgers.length > 0) {
              patchState(store, { ledgers: out.data.ledgers });
            }
          },
        );
        return res.data.processed_ledgers;
      },

      loadRequests: async (params?: {
        country?: LeaveCountryCode;
        leave_type?: string;
        status?: string;
        employee_id?: string;
      }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getRequests(params)),
          (res) => patchState(store, { requests: res.data }),
        );
      },

      submitRequest: async (
        payload: SubmitMod074LeaveRequestPayload,
      ): Promise<Mod074LeaveRequestRecord> => {
        const res = await runSave(
          () => firstValueFrom(api.submitRequest(payload)),
          (created) => patchState(store, { requests: [created.data, ...store.requests()] }),
        );
        return res.data;
      },

      registerSickInps: async (
        payload: RegisterSickLeaveInpsPayload,
      ): Promise<Mod074LeaveRequestRecord> => {
        const res = await runSave(
          () => firstValueFrom(api.registerSickInps(payload)),
          (created) => patchState(store, { requests: [created.data, ...store.requests()] }),
        );
        return res.data;
      },

      decideRequest: async (
        id: string,
        action: 'approve' | 'reject' | 'cancel',
        reason?: string,
      ): Promise<Mod074LeaveRequestRecord> => {
        const obs =
          action === 'approve'
            ? api.approveRequest(id)
            : action === 'reject'
              ? api.rejectRequest(id, reason ?? 'Rejected')
              : api.cancelRequest(id, reason ?? 'Cancelled');
        const res = await runSave(
          () => firstValueFrom(obs),
          (updated) =>
            patchState(store, {
              requests: store.requests().map((r) => (r.id === updated.data.id ? updated.data : r)),
            }),
        );
        return res.data;
      },

      evaluateComporto: async (params: {
        employee_id: string;
        fiscal_year: number;
        country?: LeaveCountryCode;
        apply_curtailment?: boolean;
      }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.evaluateComportoOrCurtailment(params)),
          (res) => patchState(store, { comportoEvaluation: res.data }),
        );
      },

      loadPayrollSummary: async (params: {
        year: number;
        month: number;
        country?: LeaveCountryCode;
      }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getPayrollSummary(params)),
          (res) => patchState(store, { payrollSummary: res.data }),
        );
      },

      loadHolidayCalendars: async (params?: {
        country?: LeaveCountryCode;
        year?: number;
      }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getHolidayCalendars(params)),
          (res) => patchState(store, { holidayCalendars: res.data }),
        );
      },

      previewHolidayCatalog: async (params: {
        country: LeaveCountryCode;
        year: number;
        canton_or_province_code?: string;
        municipality_name?: string;
        municipality_patron_saint_date?: string;
      }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getHolidayCatalog(params)),
          (res) => patchState(store, { holidayCatalog: res.data }),
        );
      },

      createHolidayCalendar: async (
        payload: SaveHolidayCalendarPayload,
      ): Promise<HolidayCalendarRecord> => {
        const res = await runSave(
          () => firstValueFrom(api.createHolidayCalendar(payload)),
          (created) =>
            patchState(store, { holidayCalendars: [...store.holidayCalendars(), created.data] }),
        );
        return res.data;
      },

      deleteHolidayCalendar: async (id: string): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.deleteHolidayCalendar(id)),
          () =>
            patchState(store, {
              holidayCalendars: store.holidayCalendars().filter((c) => c.id !== id),
            }),
        );
      },

      loadPolicies: async (params?: { country?: LeaveCountryCode }): Promise<void> => {
        await runLoad(
          () => firstValueFrom(api.getPolicies(params)),
          (res) => patchState(store, { policies: res.data }),
        );
      },

      createPolicy: async (
        payload: SaveLeaveEntitlementPolicyPayload,
      ): Promise<LeaveEntitlementPolicyRecord> => {
        const res = await runSave(
          () => firstValueFrom(api.createPolicy(payload)),
          (created) => patchState(store, { policies: [...store.policies(), created.data] }),
        );
        return res.data;
      },

      deletePolicy: async (id: string): Promise<void> => {
        await runSave(
          () => firstValueFrom(api.deletePolicy(id)),
          () => patchState(store, { policies: store.policies().filter((p) => p.id !== id) }),
        );
      },
    };
  }),
);
