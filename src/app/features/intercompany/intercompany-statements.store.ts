import { inject } from '@angular/core';
import { patchState, signalStore, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  IcNciSchedule,
  IcPackage,
  IcPackageFormat,
  IcShareholdings,
  IcStandard,
  IcStatements,
  IntercompanyApiService,
} from '@core';
import { attempt, IcOutcome, packageFileName, saveBlob } from './intercompany.util';

export type IcStatementTab = 'balance_sheet' | 'income_statement' | 'cash_flow';

export interface IntercompanyStatementsState {
  standard: IcStandard;
  tab: IcStatementTab;
  statements: IcStatements | null;
  shareholdings: IcShareholdings | null;
  nci: IcNciSchedule | null;
  packages: IcPackage[];
  loading: boolean;
  generating: boolean;
  error: string | null;
}

const initialState: IntercompanyStatementsState = {
  standard: 'fer30',
  tab: 'balance_sheet',
  statements: null,
  shareholdings: null,
  nci: null,
  packages: [],
  loading: false,
  generating: false,
  error: null,
};

/** Consolidated statements of a run under one accounting standard, the shareholdings and NCI schedules, and the package. */
export const IntercompanyStatementsStore = signalStore(
  withState(initialState),
  withMethods((store, api = inject(IntercompanyApiService)) => {
    const loadStatements = async (runId: string, standard: IcStandard): Promise<void> => {
      patchState(store, { loading: true, error: null, standard });
      const { outcome, value } = await attempt(() => firstValueFrom(api.getStatements(runId, standard)));
      patchState(store, { statements: value?.data ?? null, loading: false, error: outcome.errorKey });
    };

    return {
      loadStatements,
      async load(runId: string, standard: IcStandard = store.standard()): Promise<void> {
        patchState(store, { statements: null, shareholdings: null, nci: null, packages: [] });
        await loadStatements(runId, standard);
        const { value } = await attempt(async () => {
          const [shareholdings, nci, packages] = await Promise.all([
            firstValueFrom(api.getShareholdings(runId)),
            firstValueFrom(api.getNciSchedule(runId)),
            firstValueFrom(api.getPackages(runId)),
          ]);
          return { shareholdings: shareholdings.data, nci: nci.data, packages: packages.data ?? [] };
        });
        patchState(store, value ?? {});
      },
      selectTab(tab: IcStatementTab): void {
        patchState(store, { tab });
      },
      async generate(runId: string): Promise<IcOutcome & { package: IcPackage | null }> {
        patchState(store, { generating: true });
        const { outcome, value } = await attempt(() => firstValueFrom(api.createPackage(runId, store.standard())));
        patchState(store, {
          generating: false,
          packages: value === null ? store.packages() : [value.data, ...store.packages()],
          error: outcome.errorKey,
        });
        return { ...outcome, package: value?.data ?? null };
      },
      async download(item: IcPackage, format: IcPackageFormat): Promise<IcOutcome> {
        const { outcome, value } = await attempt(() => firstValueFrom(api.downloadPackage(item.id, format)));
        if (value !== null) {
          saveBlob(value, packageFileName(item.standard, item.run_id, format));
        }
        return outcome;
      },
    };
  }),
);
