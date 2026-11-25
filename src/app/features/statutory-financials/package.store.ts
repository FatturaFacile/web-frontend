import { computed, inject } from '@angular/core';
import { patchState, signalStore, withComputed, withMethods, withState } from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import {
  SfArtifact,
  SfPackage,
  SfPdfaPayload,
  SfValidationReport,
  StatutoryFinancialsApiService,
} from '@core';
import { failureOf, SF_OK, SfOutcome } from './statutory-financials.util';

export interface PackageState {
  package: SfPackage | null;
  artifacts: SfArtifact[];
  loading: boolean;
  exporting: boolean;
  generating: boolean;
  /** Id of the artifact being verified or downloaded. */
  working: string | null;
  error: string | null;
}

/** The deposit package: XBRL export with its validation report, PDF/A documents and their verification. */
export const PackageStore = signalStore(
  withState<PackageState>({
    package: null,
    artifacts: [],
    loading: false,
    exporting: false,
    generating: false,
    working: null,
    error: null,
  }),
  withComputed(({ package: pack, artifacts }) => ({
    report: computed<SfValidationReport | null>(() => pack()?.tebeni_validation_report ?? null),
    xbrlArtifact: computed(
      () => artifacts().find((artifact) => artifact.kind === 'xbrl_instance') ?? null,
    ),
    pdfaArtifacts: computed(() =>
      artifacts().filter((artifact) => artifact.kind !== 'xbrl_instance'),
    ),
  })),
  withMethods((store, api = inject(StatutoryFinancialsApiService)) => ({
    async load(id: string): Promise<void> {
      patchState(store, { loading: true, error: null });
      try {
        const response = await firstValueFrom(api.getPackage(id));
        patchState(store, {
          package: response.data.package,
          artifacts: response.data.artifacts,
          loading: false,
        });
      } catch (error) {
        patchState(store, { loading: false, error: failureOf(error).errorKey });
      }
    },
    /** Validates the dossier against the taxonomy and exports the XBRL instance. */
    async exportXbrl(id: string): Promise<SfOutcome> {
      patchState(store, { exporting: true });
      try {
        const response = await firstValueFrom(api.exportXbrl(id));
        patchState(store, { package: response.data, exporting: false });
        const bundle = await firstValueFrom(api.getPackage(id));
        patchState(store, { package: bundle.data.package, artifacts: bundle.data.artifacts });
        return SF_OK;
      } catch (error) {
        patchState(store, { exporting: false });
        return failureOf(error);
      }
    },
    async generatePdfa(id: string, payload: SfPdfaPayload): Promise<SfOutcome> {
      patchState(store, { generating: true });
      try {
        const response = await firstValueFrom(api.generatePdfa(id, payload));
        patchState(store, {
          package: response.data.package,
          artifacts: response.data.artifacts,
          generating: false,
        });
        return SF_OK;
      } catch (error) {
        patchState(store, { generating: false });
        return failureOf(error);
      }
    },
    /** Checks a stored artifact against its PDF/A profile and replaces it in the list. */
    async verify(id: string, artifactId: string): Promise<SfOutcome> {
      patchState(store, { working: artifactId });
      try {
        const response = await firstValueFrom(api.verifyArtifact(id, artifactId));
        patchState(store, {
          working: null,
          artifacts: store
            .artifacts()
            .map((artifact) => (artifact.id === artifactId ? response.data : artifact)),
        });
        return SF_OK;
      } catch (error) {
        patchState(store, { working: null });
        return failureOf(error);
      }
    },
    /** The file of an artifact, for the browser download. */
    async download(
      id: string,
      artifactId: string,
    ): Promise<{ outcome: SfOutcome; blob: Blob | null }> {
      patchState(store, { working: artifactId });
      try {
        const blob = await firstValueFrom(api.downloadArtifact(id, artifactId));
        patchState(store, { working: null });
        return { outcome: SF_OK, blob };
      } catch (error) {
        patchState(store, { working: null });
        return { outcome: failureOf(error), blob: null };
      }
    },
  })),
);
