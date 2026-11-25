import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  ElectronicSignatureApiService,
  EsigChallenge,
  EsigPortalContext,
  EsigSignPayload,
  EsigSignResult,
} from '@core';
import { downloadName, ESIG_OK, EsigOutcome, failureOf, saveBlob } from './e-signature.util';

export interface PublicSigningState {
  token: string | null;
  context: EsigPortalContext | null;
  document: Blob | null;
  loading: boolean;
  /** Translation key of why the link cannot be used. */
  blocked: string | null;
  challenge: EsigChallenge | null;
  challenging: boolean;
  submitting: boolean;
  result: EsigSignResult | null;
  declined: boolean;
}

const initialState: PublicSigningState = {
  token: null,
  context: null,
  document: null,
  loading: false,
  blocked: null,
  challenge: null,
  challenging: false,
  submitting: false,
  result: null,
  declined: false,
};

/** The public signing page of one recipient: the document, the identity challenge, the signature and the decision to decline. */
export const PublicSigningStore = signalStore(
  withState(initialState),
  withComputed(({ context, result, declined }) => ({
    /** The recipient has signed (now or before), so the page shows the confirmation instead of the form. */
    signed: computed(
      () => result()?.status === 'signed' || context()?.recipient.status === 'signed',
    ),
    /** The signature is waiting for the confirmation at the provider (phone, national identity scheme). */
    pending: computed(
      () => result()?.status === 'pending' || context()?.recipient.status === 'signing',
    ),
    canSign: computed(
      () => context()?.recipient.can_sign === true && result() === null && !declined(),
    ),
  })),
  withMethods((store, api = inject(ElectronicSignatureApiService)) => ({
    async load(token: string): Promise<void> {
      patchState(store, { ...initialState, token, loading: true });
      try {
        const context = (await firstValueFrom(api.getPortal(token))).data;
        patchState(store, { context });
        try {
          patchState(store, { document: await firstValueFrom(api.getPortalDocument(token)) });
        } catch {
          // The page still works without the preview: the signer is told the document could not be shown.
          patchState(store, { document: null });
        }
        patchState(store, { loading: false });
      } catch (error) {
        patchState(store, { loading: false, blocked: (await failureOf(error)).errorKey });
      }
    },
    async requestChallenge(): Promise<EsigOutcome> {
      const token = store.token();
      if (token === null) {
        return ESIG_OK;
      }
      patchState(store, { challenging: true });
      try {
        patchState(store, {
          challenge: (await firstValueFrom(api.startChallenge(token))).data,
          challenging: false,
        });
        return ESIG_OK;
      } catch (error) {
        patchState(store, { challenging: false });
        return failureOf(error);
      }
    },
    async sign(payload: EsigSignPayload): Promise<EsigOutcome> {
      const token = store.token();
      if (token === null) {
        return ESIG_OK;
      }
      patchState(store, { submitting: true });
      try {
        const result = (await firstValueFrom(api.sign(token, payload))).data;
        patchState(store, { result, submitting: false });
        if (result.status === 'signed') {
          // Once everybody has signed the same link serves the signed copy.
          void this.refreshAfterSigning(token);
        }
        return ESIG_OK;
      } catch (error) {
        patchState(store, { submitting: false });
        return failureOf(error);
      }
    },
    async refreshAfterSigning(token: string): Promise<void> {
      try {
        patchState(store, { context: (await firstValueFrom(api.getPortal(token))).data });
      } catch {
        // The confirmation is already on screen.
      }
    },
    async decline(reason: string): Promise<EsigOutcome> {
      const token = store.token();
      if (token === null) {
        return ESIG_OK;
      }
      patchState(store, { submitting: true });
      try {
        await firstValueFrom(api.decline(token, reason));
        patchState(store, { declined: true, submitting: false });
        return ESIG_OK;
      } catch (error) {
        patchState(store, { submitting: false });
        return failureOf(error);
      }
    },
    async downloadSigned(): Promise<EsigOutcome> {
      const token = store.token();
      const context = store.context();
      if (token === null || context === null) {
        return ESIG_OK;
      }
      try {
        const blob = await firstValueFrom(api.getPortalDocument(token));
        const extension =
          context.envelope.document_format === 'pades'
            ? 'pdf'
            : context.envelope.document_format === 'xades'
              ? 'xml'
              : 'p7m';
        saveBlob(blob, downloadName({ title: context.envelope.title }, `-signed.${extension}`));
        return ESIG_OK;
      } catch (error) {
        return failureOf(error);
      }
    },
  })),
);
