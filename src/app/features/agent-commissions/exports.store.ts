import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { AgentCommissionsApiService } from '@core';
import {
  AGC_OK,
  AgcOutcome,
  cuFileName,
  enasarcoFileName,
  failureOf,
} from './agent-commissions.util';

export type ExportKind = 'cu' | 'enasarco';

export interface ExportsState {
  year: number;
  /** `null` is every quarter of the year. */
  quarter: number | null;
  /** The export being prepared, for the loading state of the buttons. */
  exporting: ExportKind | null;
  error: string | null;
}

const initialState: ExportsState = {
  year: new Date().getFullYear(),
  quarter: null,
  exporting: null,
  error: null,
};

export interface ExportFile extends AgcOutcome {
  blob: Blob | null;
  filename: string;
}

/** The CU data and the Enasarco payment trace, downloaded as CSV with the credentials of the session. */
export const ExportsStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(AgentCommissionsApiService)) => {
    const run = async (
      kind: ExportKind,
      filename: string,
      call: () => Promise<Blob>,
    ): Promise<ExportFile> => {
      patchState(store, { exporting: kind, error: null });
      try {
        const blob = await call();
        patchState(store, { exporting: null });
        return { ...AGC_OK, blob, filename };
      } catch (error) {
        const outcome = await failureOf(error);
        patchState(store, { exporting: null, error: outcome.errorKey });
        return { ...outcome, blob: null, filename };
      }
    };

    return {
      setYear(year: number): void {
        patchState(store, { year });
      },
      setQuarter(quarter: number | null): void {
        patchState(store, { quarter });
      },
      exportCu: (): Promise<ExportFile> =>
        run('cu', cuFileName(store.year()), () => firstValueFrom(api.exportCu(store.year()))),
      exportEnasarco: (): Promise<ExportFile> =>
        run('enasarco', enasarcoFileName(store.year(), store.quarter()), () =>
          firstValueFrom(api.exportEnasarco(store.year(), store.quarter())),
        ),
    };
  }),
);
