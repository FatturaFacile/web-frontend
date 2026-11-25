import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ExmApprovePayload,
  ExmLine,
  ExmLinePayload,
  ExmLookups,
  ExmMileagePayload,
  ExmPayout,
  ExmPerDiemPayload,
  ExmReportDetail,
  ExmPayoutChannel,
  ExpenseManagementApiService,
} from '@core';
import {
  canCancel,
  canConfirmReimbursement,
  canDecide,
  canExport,
  canSubmit,
  EXM_OK,
  ExmOutcome,
  failureOf,
  isEditable,
} from './expense-management.util';

export interface ReportDetailState {
  report: ExmReportDetail | null;
  lookups: ExmLookups | null;
  loading: boolean;
  /** A write is running: the action buttons are disabled meanwhile. */
  busy: boolean;
  error: string | null;
}

const initialState: ReportDetailState = {
  report: null,
  lookups: null,
  loading: false,
  busy: false,
  error: null,
};

/** One expense report with its lines, per diems, audit trail and payouts, and every action of its workflow. */
export const ReportDetailStore = signalStore(
  withState(initialState),
  withComputed(({ report, lookups }) => ({
    lines: computed<ExmLine[]>(() => report()?.lines ?? []),
    categories: computed(() => lookups()?.categories ?? []),
    jurisdiction: computed(() => report()?.jurisdiction ?? lookups()?.jurisdiction ?? 'IT'),
    fiscalNoticeCodes: computed(() => lookups()?.fiscal_notice_codes ?? []),
    editable: computed(() => {
      const current = report();
      return current !== null && isEditable(current);
    }),
    canSubmit: computed(() => {
      const current = report();
      return current !== null && canSubmit(current);
    }),
    canDecide: computed(() => {
      const current = report();
      return current !== null && canDecide(current);
    }),
    canExport: computed(() => {
      const current = report();
      return current !== null && canExport(current);
    }),
    canConfirmReimbursement: computed(() => {
      const current = report();
      return current !== null && canConfirmReimbursement(current);
    }),
    canCancel: computed(() => {
      const current = report();
      return current !== null && canCancel(current);
    }),
    blockingCount: computed(
      () =>
        (report()?.lines ?? []).filter((line) =>
          line.policy_violations.some((violation) => violation.severity === 'blocking'),
        ).length,
    ),
  })),
  withMethods((store, api = inject(ExpenseManagementApiService)) => {
    const reload = async (): Promise<void> => {
      const id = store.report()?.id;
      if (id) {
        const response = await firstValueFrom(api.getReport(id));
        patchState(store, { report: response.data });
      }
    };

    /** Runs a write, then re-reads the report so totals, violations, audit trail and abilities are the server's. */
    const write = async (action: () => Promise<unknown>): Promise<ExmOutcome> => {
      patchState(store, { busy: true });
      try {
        await action();
        await reload();
        patchState(store, { busy: false });
        return EXM_OK;
      } catch (error) {
        patchState(store, { busy: false });
        return failureOf(error);
      }
    };

    return {
      async load(id: string): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          const [report, lookups] = await Promise.all([
            firstValueFrom(api.getReport(id)),
            store.lookups() ? Promise.resolve(null) : firstValueFrom(api.getLookups()),
          ]);
          patchState(store, {
            report: report.data,
            lookups: lookups?.data ?? store.lookups(),
            loading: false,
          });
        } catch (error) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      },
      reload,
      saveLine(payload: ExmLinePayload, lineId?: string): Promise<ExmOutcome> {
        const id = store.report()?.id ?? '';
        return write(() =>
          lineId
            ? firstValueFrom(api.updateLine(id, lineId, payload))
            : firstValueFrom(api.addLine(id, payload)),
        );
      },
      removeLine(lineId: string): Promise<ExmOutcome> {
        const id = store.report()?.id ?? '';
        return write(() => firstValueFrom(api.removeLine(id, lineId)));
      },
      addMileage(payload: ExmMileagePayload): Promise<ExmOutcome> {
        const id = store.report()?.id ?? '';
        return write(() => firstValueFrom(api.addMileageClaim(id, payload)));
      },
      addPerDiem(payload: ExmPerDiemPayload): Promise<ExmOutcome> {
        const id = store.report()?.id ?? '';
        return write(() => firstValueFrom(api.addPerDiem(id, payload)));
      },
      removePerDiem(perDiemId: string): Promise<ExmOutcome> {
        const id = store.report()?.id ?? '';
        return write(() => firstValueFrom(api.removePerDiem(id, perDiemId)));
      },
      submit(): Promise<ExmOutcome> {
        return write(() => firstValueFrom(api.submit(store.report()?.id ?? '')));
      },
      approve(payload: ExmApprovePayload = {}): Promise<ExmOutcome> {
        return write(() => firstValueFrom(api.approve(store.report()?.id ?? '', payload)));
      },
      reject(reason: string): Promise<ExmOutcome> {
        return write(() => firstValueFrom(api.reject(store.report()?.id ?? '', reason)));
      },
      exportPayout(channel: ExmPayoutChannel, executionDate?: string): Promise<ExmOutcome> {
        return write(() =>
          firstValueFrom(
            api.exportPayout(store.report()?.id ?? '', {
              channel,
              execution_date: executionDate || null,
            }),
          ),
        );
      },
      confirmReimbursement(): Promise<ExmOutcome> {
        return write(() => firstValueFrom(api.confirmReimbursement(store.report()?.id ?? '')));
      },
      cancel(): Promise<ExmOutcome> {
        return write(() => firstValueFrom(api.cancel(store.report()?.id ?? '')));
      },
      async downloadPayout(payout: ExmPayout): Promise<{ blob: Blob; fileName: string } | null> {
        try {
          const blob = await firstValueFrom(
            api.downloadPayout(store.report()?.id ?? '', payout.id),
          );
          return { blob, fileName: payout.file_name ?? `payout-${payout.id}.xml` };
        } catch (error) {
          patchState(store, { error: (await failureOf(error)).errorKey });
          return null;
        }
      },
    };
  }),
);
