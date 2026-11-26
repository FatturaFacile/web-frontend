import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  PassengerTransportApiService,
  PtrBooking,
  PtrBookingAction,
  PtrBookingFilters,
  PtrBookingPayload,
  PtrLookups,
  PtrPageMeta,
  PtrQuote,
} from '@core';
import { failureOf, PTR_OK, PtrOutcome } from './passenger-transport.util';

export interface BookingsState {
  filters: PtrBookingFilters;
  bookings: PtrBooking[];
  meta: PtrPageMeta | null;
  lookups: PtrLookups | null;
  quote: PtrQuote | null;
  loading: boolean;
  saving: boolean;
  quoting: boolean;
  error: string | null;
}

const PAGE_SIZE = 25;

/** The bookings: filters, paging, creation with the cross-border quote, lifecycle actions and invoicing. */
export const BookingsStore = signalStore(
  withState<BookingsState>({
    filters: { per_page: PAGE_SIZE, page: 1 },
    bookings: [],
    meta: null,
    lookups: null,
    quote: null,
    loading: false,
    saving: false,
    quoting: false,
    error: null,
  }),
  withComputed(({ meta, lookups }) => ({
    total: computed(() => meta()?.total ?? 0),
    page: computed(() => meta()?.current_page ?? 1),
    pageSize: computed(() => meta()?.per_page ?? PAGE_SIZE),
    jurisdiction: computed(() => lookups()?.jurisdiction ?? 'IT'),
    airports: computed(() => lookups()?.airports ?? []),
    crossings: computed(() => lookups()?.border_crossings ?? []),
    currencies: computed(() => lookups()?.currencies ?? ['CHF', 'EUR']),
  })),
  withMethods((store, api = inject(PassengerTransportApiService)) => {
    let sequence = 0;
    let quoteSequence = 0;

    const load = async (filters: PtrBookingFilters): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { filters, loading: true, error: null });
      try {
        const response = await firstValueFrom(api.listBookings(filters));
        if (ticket === sequence) {
          patchState(store, { bookings: response.data, meta: response.meta, loading: false });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      }
    };

    const write = async (call: () => Promise<unknown>): Promise<PtrOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load(store.filters());
        return PTR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        const lookups = await firstValueFrom(api.getLookups()).catch(() => null);
        patchState(store, { lookups: lookups?.data ?? null });
        await load(store.filters());
      },
      load: (filters: PtrBookingFilters = store.filters()): Promise<void> => load(filters),
      /** Applies filters from the first page. */
      setFilters(patch: Partial<PtrBookingFilters>): Promise<void> {
        return load({ ...store.filters(), ...patch, page: 1 });
      },
      setPage(page: number): Promise<void> {
        return load({ ...store.filters(), page });
      },
      /** Prices a trip without saving it (kilometres by country and VAT split). Not named `quote`: that is the state key. */
      async requestQuote(payload: PtrBookingPayload): Promise<PtrOutcome> {
        const ticket = ++quoteSequence;
        patchState(store, { quoting: true });
        try {
          const response = await firstValueFrom(api.quoteBooking(payload));
          if (ticket === quoteSequence) {
            patchState(store, { quote: response.data, quoting: false });
          }
          return PTR_OK;
        } catch (error) {
          if (ticket === quoteSequence) {
            patchState(store, { quote: null, quoting: false });
          }
          return failureOf(error);
        }
      },
      clearQuote(): void {
        quoteSequence++;
        patchState(store, { quote: null, quoting: false });
      },
      create: (payload: PtrBookingPayload): Promise<PtrOutcome> =>
        write(() => firstValueFrom(api.createBooking(payload))),
      update: (id: string, payload: Partial<PtrBookingPayload>): Promise<PtrOutcome> =>
        write(() => firstValueFrom(api.updateBooking(id, payload))),
      transition: (id: string, action: PtrBookingAction): Promise<PtrOutcome> =>
        write(() => firstValueFrom(api.transitionBooking(id, action))),
      remove: (id: string): Promise<PtrOutcome> =>
        write(() => firstValueFrom(api.deleteBooking(id))),
      invoice: (id: string): Promise<PtrOutcome> =>
        write(() => firstValueFrom(api.invoiceBooking(id))),
    };
  }),
);
