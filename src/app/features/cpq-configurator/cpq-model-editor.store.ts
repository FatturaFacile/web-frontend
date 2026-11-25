import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom, Observable } from 'rxjs';
import {
  CpqChildKind,
  CpqConfiguratorApiService,
  CpqDiagnostics,
  CpqModelRecord,
  CpqRecordPayload,
} from '@core';
import { CpqFailure, failureOf } from './cpq-format';

export interface CpqModelEditorState {
  model: CpqModelRecord | null;
  loading: boolean;
  saving: boolean;
  diagnostics: CpqDiagnostics | null;
  failure: CpqFailure | null;
}

const initialState: CpqModelEditorState = {
  model: null,
  loading: false,
  saving: false,
  diagnostics: null,
  failure: null,
};

/** What a write answers: the screen closes the drawer on success and shows the field errors of a 422 otherwise. */
export interface CpqWriteOutcome {
  ok: boolean;
  failure: CpqFailure | null;
}

/**
 * State of the model editor: the model with everything it owns, the writes of its definition (each one reads the model
 * again, because a change of a published model raises its version), the static check and the publication.
 */
export const CpqModelEditorStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(CpqConfiguratorApiService)) => {
    const load = async (id: string): Promise<void> => {
      patchState(store, { loading: true, failure: null });
      try {
        const response = await firstValueFrom(api.getModel(id));
        patchState(store, { model: response.data, loading: false });
      } catch (error) {
        patchState(store, { loading: false, failure: failureOf(error) });
      }
    };

    /** Runs a write, then reads the model again; the diagnostics of the previous state are no longer valid. */
    const write = async (operation: () => Observable<unknown>): Promise<CpqWriteOutcome> => {
      patchState(store, { saving: true, failure: null });
      try {
        await firstValueFrom(operation());
        patchState(store, { saving: false, diagnostics: null });
        const id = store.model()?.id;
        if (id) {
          await load(id);
        }

        return { ok: true, failure: null };
      } catch (error) {
        const failure = failureOf(error);
        patchState(store, { saving: false, failure });

        return { ok: false, failure };
      }
    };

    return {
      load,
      saveModel: (payload: CpqRecordPayload): Promise<CpqWriteOutcome> =>
        write(() => api.updateModel(store.model()?.id ?? '', payload)),
      saveCharacteristic: (
        id: string | null,
        payload: CpqRecordPayload,
      ): Promise<CpqWriteOutcome> =>
        write(() =>
          id
            ? api.updateCharacteristic(id, payload)
            : api.createCharacteristic(store.model()?.id ?? '', payload),
        ),
      removeCharacteristic: (id: string): Promise<CpqWriteOutcome> =>
        write(() => api.deleteCharacteristic(id)),
      saveOption: (
        characteristicId: string,
        id: string | null,
        payload: CpqRecordPayload,
      ): Promise<CpqWriteOutcome> =>
        write(() =>
          id ? api.updateOption(id, payload) : api.createOption(characteristicId, payload),
        ),
      removeOption: (id: string): Promise<CpqWriteOutcome> => write(() => api.deleteOption(id)),
      saveChild: (
        kind: CpqChildKind,
        id: string | null,
        payload: CpqRecordPayload,
      ): Promise<CpqWriteOutcome> =>
        write(() =>
          id
            ? api.updateChild(kind, id, payload)
            : api.createChild(kind, store.model()?.id ?? '', payload),
        ),
      removeChild: (kind: CpqChildKind, id: string): Promise<CpqWriteOutcome> =>
        write(() => api.deleteChild(kind, id)),
      publish: (): Promise<CpqWriteOutcome> =>
        write(() => api.publishModel(store.model()?.id ?? '')),
      archive: (): Promise<CpqWriteOutcome> =>
        write(() => api.archiveModel(store.model()?.id ?? '')),
      async runDiagnostics(): Promise<void> {
        const id = store.model()?.id;
        if (!id) {
          return;
        }
        patchState(store, { saving: true, failure: null });
        try {
          const response = await firstValueFrom(api.getDiagnostics(id));
          patchState(store, { saving: false, diagnostics: response.data });
        } catch (error) {
          patchState(store, { saving: false, failure: failureOf(error) });
        }
      },
      clearFailure(): void {
        patchState(store, { failure: null });
      },
    };
  }),
);
