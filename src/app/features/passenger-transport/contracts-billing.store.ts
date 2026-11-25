import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  PassengerTransportApiService,
  PtrBillingPreviewRow,
  PtrBooking,
  PtrConciergeBookingPayload,
  PtrExchangeAction,
  PtrHotelContract,
  PtrHotelContractPayload,
  PtrInvoiceResult,
  PtrLedger,
  PtrPersonRef,
  PtrSchoolContract,
  PtrSchoolContractPayload,
} from '@core';
import { failureOf, PTR_OK, PtrOutcome, toPeriod } from './passenger-transport.util';

export interface ContractsBillingState {
  hotelContracts: PtrHotelContract[];
  schoolContracts: PtrSchoolContract[];
  contacts: PtrPersonRef[];
  /** The concierge booking just made, so the screen can show its fare and commission. */
  lastBooking: PtrBooking | null;
  ledger: PtrLedger | null;
  ledgerPeriod: string;
  /** Bookings that can be ceded to or acquired from a partner carrier. */
  exchangeable: PtrBooking[];
  period: string;
  preview: PtrBillingPreviewRow[];
  issued: PtrInvoiceResult[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The B2B workspace: concierge contracts and bookings, school bus contracts, the service exchange ledger and the month-end invoicing. */
export const ContractsBillingStore = signalStore(
  withState<ContractsBillingState>({
    hotelContracts: [],
    schoolContracts: [],
    contacts: [],
    lastBooking: null,
    ledger: null,
    ledgerPeriod: toPeriod(new Date()),
    exchangeable: [],
    period: toPeriod(new Date()),
    preview: [],
    issued: [],
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ preview }) => ({
    previewTotal: computed(() =>
      preview().reduce((sum, row) => sum + Number.parseFloat(row.total_gross), 0),
    ),
    previewBookings: computed(() => preview().reduce((sum, row) => sum + row.bookings_count, 0)),
  })),
  withMethods((store, api = inject(PassengerTransportApiService)) => {
    const loadContracts = async (): Promise<void> => {
      const [hotels, schools] = await Promise.all([
        firstValueFrom(api.listHotelContracts()),
        firstValueFrom(api.listSchoolContracts()),
      ]);
      patchState(store, { hotelContracts: hotels.data, schoolContracts: schools.data });
    };

    const loadLedger = async (): Promise<void> => {
      const [ledger, bookings] = await Promise.all([
        firstValueFrom(api.getLedger(store.ledgerPeriod())),
        firstValueFrom(api.listBookings({ per_page: 100 })),
      ]);
      patchState(store, {
        ledger: ledger.data,
        exchangeable: bookings.data.filter((booking) => booking.editable),
      });
    };

    const loadPreview = async (): Promise<void> => {
      const response = await firstValueFrom(api.previewMonth(store.period()));
      patchState(store, { preview: response.data });
    };

    const guarded = async (call: () => Promise<unknown>, saving = true): Promise<PtrOutcome> => {
      patchState(store, saving ? { saving: true } : { loading: true });
      try {
        await call();
        patchState(store, { saving: false, loading: false });
        return PTR_OK;
      } catch (error) {
        patchState(store, { saving: false, loading: false });
        return failureOf(error);
      }
    };

    return {
      async init(): Promise<void> {
        patchState(store, { loading: true, error: null });
        try {
          await Promise.all([loadContracts(), loadLedger(), loadPreview()]);
          patchState(store, { loading: false });
        } catch (error) {
          patchState(store, { loading: false, error: failureOf(error).errorKey });
        }
      },
      async searchContacts(q: string): Promise<void> {
        const response = await firstValueFrom(api.searchContacts(q)).catch(() => null);
        patchState(store, { contacts: response?.data ?? [] });
      },

      // Concierge contracts and bookings
      saveHotelContract: (payload: PtrHotelContractPayload, id?: string): Promise<PtrOutcome> =>
        guarded(async () => {
          await firstValueFrom(
            id ? api.updateHotelContract(id, payload) : api.createHotelContract(payload),
          );
          await loadContracts();
        }),
      removeHotelContract: (id: string): Promise<PtrOutcome> =>
        guarded(async () => {
          await firstValueFrom(api.deleteHotelContract(id));
          await loadContracts();
        }),
      bookConcierge: (
        contractId: string,
        payload: PtrConciergeBookingPayload,
      ): Promise<PtrOutcome> =>
        guarded(async () => {
          const response = await firstValueFrom(api.conciergeBooking(contractId, payload));
          patchState(store, { lastBooking: response.data });
          await loadLedger();
        }),

      // School bus contracts
      saveSchoolContract: (payload: PtrSchoolContractPayload, id?: string): Promise<PtrOutcome> =>
        guarded(async () => {
          await firstValueFrom(
            id ? api.updateSchoolContract(id, payload) : api.createSchoolContract(payload),
          );
          await Promise.all([loadContracts(), loadPreview()]);
        }),
      removeSchoolContract: (id: string): Promise<PtrOutcome> =>
        guarded(async () => {
          await firstValueFrom(api.deleteSchoolContract(id));
          await Promise.all([loadContracts(), loadPreview()]);
        }),

      // Service exchange
      async setLedgerPeriod(period: string): Promise<void> {
        patchState(store, { ledgerPeriod: period });
        await loadLedger().catch((error: unknown) =>
          patchState(store, { error: failureOf(error).errorKey }),
        );
      },
      exchange: (
        bookingId: string,
        action: PtrExchangeAction,
        carrierId?: string,
        amount?: string,
      ): Promise<PtrOutcome> =>
        guarded(async () => {
          await firstValueFrom(api.subcontractBooking(bookingId, action, carrierId, amount));
          await loadLedger();
        }),

      // Month-end invoicing
      async setPeriod(period: string): Promise<void> {
        patchState(store, { period, issued: [] });
        await loadPreview().catch((error: unknown) =>
          patchState(store, { error: failureOf(error).errorKey }),
        );
      },
      issue: (contactIds: string[]): Promise<PtrOutcome> =>
        guarded(async () => {
          const response = await firstValueFrom(api.invoiceMonth(store.period(), contactIds));
          patchState(store, { issued: response.data });
          await Promise.all([loadPreview(), loadLedger()]);
        }),
    };
  }),
);
