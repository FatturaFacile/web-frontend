import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  WithholdingRecipientsApiService,
  WrCertificate,
  WrCertificatePayload,
  WrInlFormat,
  WrInlNotification,
  WrInlPayload,
  WrMarkSentPayload,
  WrRecipient,
  WrRecipientPayload,
  WrThreshold,
} from '@core';
import { failureOf, inlFileName, WR_OK, WrOutcome } from './withholding-recipients.util';

export interface RecipientsState {
  recipient: WrRecipient | null;
  thresholds: WrThreshold[];
  loading: boolean;
  saving: boolean;
  error: string | null;
}

const initialState: RecipientsState = {
  recipient: null,
  thresholds: [],
  loading: false,
  saving: false,
  error: null,
};

export interface InlFile extends WrOutcome {
  blob: Blob | null;
  filename: string;
}

/** One recipient with its declarations and INL communications: the state behind the profile drawer. */
export const RecipientsStore = signalStore(
  withState(initialState),
  withComputed(({ recipient }) => ({
    certificates: computed<WrCertificate[]>(() => recipient()?.certificates ?? []),
    inlNotifications: computed<WrInlNotification[]>(() => recipient()?.inl_notifications ?? []),
  })),
  withMethods((store, api = inject(WithholdingRecipientsApiService)) => {
    let sequence = 0;

    const open = async (id: string): Promise<void> => {
      const ticket = ++sequence;
      patchState(store, { loading: true, error: null });
      try {
        const [response, thresholds] = await Promise.all([
          firstValueFrom(api.getRecipient(id)),
          firstValueFrom(api.getThresholds(id)),
        ]);
        if (ticket === sequence) {
          patchState(store, {
            recipient: response.data,
            thresholds: thresholds.data,
            loading: false,
          });
        }
      } catch (error) {
        if (ticket === sequence) {
          patchState(store, { loading: false, error: (await failureOf(error)).errorKey });
        }
      }
    };

    /** Runs a write on the recipient, then reads it again so the declarations and the INL list are current. */
    const mutate = async (id: string, call: () => Promise<unknown>): Promise<WrOutcome> => {
      patchState(store, { saving: true });
      try {
        await call();
        patchState(store, { saving: false });
        await open(id);
        return WR_OK;
      } catch (error) {
        patchState(store, { saving: false });
        return failureOf(error);
      }
    };

    return {
      open,
      reset(): void {
        sequence++;
        patchState(store, { ...initialState });
      },
      /** Creates the recipient (no id) or updates it; answers the saved recipient so the drawer can keep it open. */
      async save(id: string | null, payload: WrRecipientPayload): Promise<WrOutcome> {
        patchState(store, { saving: true });
        try {
          const response = await firstValueFrom(
            id ? api.updateRecipient(id, payload) : api.createRecipient(payload),
          );
          patchState(store, { saving: false });
          await open(response.data.id);
          return WR_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      async remove(id: string): Promise<WrOutcome> {
        patchState(store, { saving: true });
        try {
          await firstValueFrom(api.deleteRecipient(id));
          patchState(store, { saving: false, recipient: null });
          return WR_OK;
        } catch (error) {
          patchState(store, { saving: false });
          return failureOf(error);
        }
      },
      addCertificate: (id: string, payload: WrCertificatePayload): Promise<WrOutcome> =>
        mutate(id, () => firstValueFrom(api.createCertificate(id, payload))),
      removeCertificate: (id: string, certificateId: string): Promise<WrOutcome> =>
        mutate(id, () => firstValueFrom(api.deleteCertificate(certificateId))),
      addInl: (id: string, payload: WrInlPayload): Promise<WrOutcome> =>
        mutate(id, () => firstValueFrom(api.createInlNotification(id, payload))),
      markInlSent: (id: string, noticeId: string, payload: WrMarkSentPayload): Promise<WrOutcome> =>
        mutate(id, () => firstValueFrom(api.markInlSent(noticeId, payload))),
      cancelInl: (id: string, noticeId: string): Promise<WrOutcome> =>
        mutate(id, () => firstValueFrom(api.cancelInl(noticeId))),
      /** The PDF, XML or JSON of a communication, downloaded with the credentials of the session. */
      async downloadInl(noticeId: string, format: WrInlFormat): Promise<InlFile> {
        const filename = inlFileName(noticeId, format);
        try {
          const blob = await firstValueFrom(api.downloadInl(noticeId, format));
          return { ...WR_OK, blob, filename };
        } catch (error) {
          return { ...(await failureOf(error)), blob: null, filename };
        }
      },
      clearError(): void {
        patchState(store, { error: null });
      },
    };
  }),
);
