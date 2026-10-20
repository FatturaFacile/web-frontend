import { computed, inject } from '@angular/core';
import { catchError, of, pipe, switchMap, tap } from 'rxjs';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { TimeAttendanceData } from '@domain/models/time-attendance.model';
import { TIME_ATTENDANCE_REPOSITORY } from '@domain/repositories/time-attendance.repository';

export interface TimeAttendanceState {
  data: TimeAttendanceData | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: TimeAttendanceState = {
  data: null,
  isLoading: false,
  error: null,
};

export const TimeAttendanceStore = signalStore(
  withState(initialState),
  withComputed(({ data }) => ({
    isClockedIn: computed(() => data()?.todaySession.isClockedIn ?? false),
    weeklyWorked: computed(() => data()?.summary.weeklyHoursWorked ?? 0),
    weeklyLimit: computed(() => data()?.summary.weeklyLimitHours ?? 45),
    weeklyPercent: computed(() => {
      const worked = data()?.summary.weeklyHoursWorked ?? 0;
      const limit = data()?.summary.weeklyLimitHours ?? 45;
      return Math.min(100, Math.round((worked / limit) * 100));
    }),
    records: computed(() => data()?.records ?? []),
    vacations: computed(() => data()?.vacations ?? null),
    summary: computed(() => data()?.summary ?? null),
  })),
  withMethods((store, repository = inject(TIME_ATTENDANCE_REPOSITORY)) => ({
    loadData: rxMethod<void>(
      pipe(
        tap(() => patchState(store, { isLoading: true, error: null })),
        switchMap(() =>
          repository.getData().pipe(
            tap((data) => patchState(store, { data, isLoading: false })),
            catchError((err: Error) => {
              patchState(store, { error: err.message, isLoading: false });
              return of(null as unknown as TimeAttendanceData);
            })
          )
        )
      )
    ),
    toggleClock(): void {
      const current = store.data();
      if (!current) return;

      const newClockState = !current.todaySession.isClockedIn;
      patchState(store, {
        data: {
          ...current,
          todaySession: {
            ...current.todaySession,
            isClockedIn: newClockState,
            clockInTime: newClockState
              ? new Date().toTimeString().substring(0, 5)
              : current.todaySession.clockInTime,
          },
        },
      });
    },
  }))
);
