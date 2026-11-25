import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { PassengerTransportApiService, PtrTimeline } from '@core';
import { failureOf, toDateString } from './passenger-transport.util';

export interface DispatchState {
  /** The day shown, `YYYY-MM-DD` in the local time zone. */
  day: string;
  timeline: PtrTimeline | null;
  loading: boolean;
  error: string | null;
}

function shift(day: string, days: number): string {
  const date = new Date(`${day}T00:00:00`);
  date.setDate(date.getDate() + days);
  return toDateString(date);
}

/** The dispatch board of one day: vehicles and drivers against time, with the flight status and the driving-time gauges. */
export const DispatchStore = signalStore(
  withState<DispatchState>({
    day: toDateString(new Date()),
    timeline: null,
    loading: false,
    error: null,
  }),
  withComputed(({ day, timeline }) => ({
    windowStart: computed(() => new Date(`${day()}T00:00:00`)),
    windowEnd: computed(() => new Date(`${shift(day(), 1)}T00:00:00`)),
    vehicles: computed(() => timeline()?.vehicles ?? []),
    drivers: computed(() => timeline()?.drivers ?? []),
    unassigned: computed(() => timeline()?.unassigned ?? []),
    subcontracted: computed(() => timeline()?.subcontracted ?? []),
    delayedFlights: computed(() => {
      const view = timeline();
      const all = [
        ...(view?.unassigned ?? []),
        ...(view?.vehicles.flatMap((vehicle) => vehicle.bookings) ?? []),
      ];
      return all.filter(
        (booking) => booking.flight_status === 'delayed' || booking.flight_status === 'cancelled',
      );
    }),
  })),
  withMethods((store, api = inject(PassengerTransportApiService)) => {
    let sequence = 0;

    const load = async (day: string): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { day, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getTimeline(day, shift(day, 1)));
        if (ticket === sequence) {
          patchState(store, { timeline: response.data, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    return {
      load,
      refresh: (): Promise<void> => load(store.day()),
      setDay: (day: string): Promise<void> => load(day),
      shiftDay: (days: number): Promise<void> => load(shift(store.day(), days)),
    };
  }),
);
