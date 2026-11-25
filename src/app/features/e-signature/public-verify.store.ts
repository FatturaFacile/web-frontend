import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { ElectronicSignatureApiService, EsigVerifyResult } from '@core';
import { ESIG_OK, EsigOutcome, failureOf, sha256Hex } from './e-signature.util';

export interface PublicVerifyState {
  result: EsigVerifyResult | null;
  loading: boolean;
  error: string | null;
  file: File | null;
  /** SHA-256 of the dropped file, computed in the browser. */
  fileHash: string | null;
}

const initialState: PublicVerifyState = {
  result: null,
  loading: false,
  error: null,
  file: null,
  fileHash: null,
};

/** Public verification of a signed document by its code, by the hash of a file (which never leaves the browser) or by the file. */
export const PublicVerifyStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(ElectronicSignatureApiService)) => {
    const run = async (call: () => Promise<EsigVerifyResult>): Promise<EsigOutcome> => {
      patchState(store, { loading: true, error: null, result: null });
      try {
        patchState(store, { result: await call(), loading: false });
        return ESIG_OK;
      } catch (error) {
        const outcome = await failureOf(error);
        patchState(store, { loading: false, error: outcome.errorKey });
        return outcome;
      }
    };

    return {
      verifyCode(code: string): Promise<EsigOutcome> {
        return run(async () => (await firstValueFrom(api.verifyByCode(code.trim()))).data);
      },
      /** Reads the file in the browser and keeps its hash; nothing is sent. */
      async chooseFile(file: File | null): Promise<void> {
        patchState(store, { file, fileHash: null, result: null, error: null });
        if (file !== null) {
          patchState(store, { fileHash: await sha256Hex(file) });
        }
      },
      verifyHash(): Promise<EsigOutcome> {
        const hash = store.fileHash();
        return hash === null
          ? Promise.resolve(ESIG_OK)
          : run(async () => (await firstValueFrom(api.verifyByHash(hash))).data);
      },
      /** Uploads the file so the signatures embedded in it are checked as well. */
      verifyFile(): Promise<EsigOutcome> {
        const file = store.file();
        return file === null
          ? Promise.resolve(ESIG_OK)
          : run(async () => (await firstValueFrom(api.verifyFile(file))).data);
      },
    };
  }),
);
