import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  PassengerTransportApiService,
  PtrBooking,
  PtrGenerateSheetPayload,
  PtrServiceSheet,
  PtrServiceSheetPayload,
  PtrWelcomeSign,
} from '@core';
import { failureOf, PTR_OK, PtrOutcome } from './passenger-transport.util';

export interface ServiceSheetState {
  booking: PtrBooking | null;
  sheets: PtrServiceSheet[];
  sign: PtrWelcomeSign | null;
  invoiceNumber: string | null;
  loading: boolean;
  saving: boolean;
  error: string | null;
}

/** The service sheet (FDSE) and Interbus waybill of one booking, and its meet and greet welcome sign. */
export const ServiceSheetStore = signalStore(
  withState<ServiceSheetState>({
    booking: null,
    sheets: [],
    sign: null,
    invoiceNumber: null,
    loading: false,
    saving: false,
    error: null,
  }),
  withComputed(({ sheets }) => ({
    /** The sheet being compiled: the open one, else the latest. */
    current: computed(
      () => sheets().find((sheet) => sheet.status === 'open') ?? sheets().at(-1) ?? null,
    ),
    hasOpenSheet: computed(() => sheets().some((sheet) => sheet.status === 'open')),
  })),
  withMethods((store, api = inject(PassengerTransportApiService)) => {
    const load = async (id: string): Promise<void> => {
      patchState(store, { loading: true, error: null });
      try {
        const [booking, sheets, sign] = await Promise.all([
          firstValueFrom(api.getBooking(id)),
          firstValueFrom(api.listSheets(id)),
          firstValueFrom(api.getWelcomeSign(id)),
        ]);
        patchState(store, {
          booking: booking.data,
          sheets: sheets.data,
          sign: sign.data,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    };

    const write = async (id: string, call: () => Promise<unknown>): Promise<PtrOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await load(id);
        return PTR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      load,
      open: (id: string, payload: PtrServiceSheetPayload = {}): Promise<PtrOutcome> =>
        write(id, () => firstValueFrom(api.openSheet(id, payload))),
      save: (id: string, sheetId: string, payload: PtrServiceSheetPayload): Promise<PtrOutcome> =>
        write(id, () => firstValueFrom(api.updateSheet(sheetId, payload))),
      close: (id: string, sheetId: string): Promise<PtrOutcome> =>
        write(id, () => firstValueFrom(api.closeSheet(sheetId))),
      transmit: (id: string, sheetId: string): Promise<PtrOutcome> =>
        write(id, () => firstValueFrom(api.transmitSheet(sheetId))),
      async generate(id: string, payload: PtrGenerateSheetPayload): Promise<PtrOutcome> {
        patchState(store, { invoiceNumber: null });

        return write(id, async () => {
          const response = await firstValueFrom(api.generateSheet(id, payload));
          patchState(store, { invoiceNumber: response.data.invoice?.invoice_number ?? null });
        });
      },
      trackFlight: (id: string): Promise<PtrOutcome> =>
        write(id, () => firstValueFrom(api.trackFlight(id))),
      uploadLogo: (id: string, logo: File, text?: string): Promise<PtrOutcome> =>
        write(id, () => firstValueFrom(api.uploadWelcomeLogo(id, logo, text))),
      sheetPdf: (sheetId: string) => firstValueFrom(api.downloadSheetPdf(sheetId)),
      interbusPdf: (sheetId: string) => firstValueFrom(api.downloadInterbusPdf(sheetId)),
      signPdf: (id: string) => firstValueFrom(api.downloadWelcomeSignPdf(id)),
    };
  }),
);
