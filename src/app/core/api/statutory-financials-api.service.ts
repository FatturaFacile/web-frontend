import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  SfArtifact,
  SfCashFlowMethod,
  SfDossier,
  SfDossierPayload,
  SfDossierSummary,
  SfEligibility,
  SfEnvelope,
  SfFilters,
  SfIndicatorsResult,
  SfLocale,
  SfLookups,
  SfNotes,
  SfNotesPayload,
  SfPackage,
  SfPackageBundle,
  SfPage,
  SfPdfaPayload,
  SfPreview,
  SfStandard,
  SfTransitionTarget,
  SfWhatIf,
} from '../models';

type Envelope<T> = Observable<SfEnvelope<T>>;

/** Endpoints of the statutory financial statements module (Mod 167). */
@Service()
export class StatutoryFinancialsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/statutory-financials`;

  getLookups(locale?: SfLocale): Envelope<SfLookups> {
    return this.http.get<SfEnvelope<SfLookups>>(`${this.base}/lookups`, {
      params: toHttpParams({ locale }),
    });
  }

  // --- Dossiers ---

  listDossiers(filters: SfFilters = {}): Observable<SfPage<SfDossierSummary>> {
    return this.http.get<SfPage<SfDossierSummary>>(`${this.base}/dossiers`, {
      params: toHttpParams(filters),
    });
  }

  getDossier(id: string): Envelope<SfDossier> {
    return this.http.get<SfEnvelope<SfDossier>>(`${this.base}/dossiers/${id}`);
  }

  createDossier(payload: SfDossierPayload): Envelope<SfDossierSummary> {
    return this.http.post<SfEnvelope<SfDossierSummary>>(`${this.base}/dossiers`, payload);
  }

  updateDossier(id: string, payload: SfDossierPayload): Envelope<SfDossierSummary> {
    return this.http.put<SfEnvelope<SfDossierSummary>>(`${this.base}/dossiers/${id}`, payload);
  }

  deleteDossier(id: string): Envelope<null> {
    return this.http.delete<SfEnvelope<null>>(`${this.base}/dossiers/${id}`);
  }

  transitionDossier(
    id: string,
    target: SfTransitionTarget,
    reference?: string,
  ): Envelope<SfDossierSummary> {
    const body: { target: SfTransitionTarget; reference?: string } = { target };
    if (reference !== undefined && reference !== '') {
      body.reference = reference;
    }
    return this.http.post<SfEnvelope<SfDossierSummary>>(
      `${this.base}/dossiers/${id}/transition`,
      body,
    );
  }

  getEligibility(id: string, standard?: SfStandard): Envelope<SfEligibility> {
    return this.http.get<SfEnvelope<SfEligibility>>(`${this.base}/dossiers/${id}/eligibility`, {
      params: toHttpParams({ standard }),
    });
  }

  // --- Statements ---

  generate(id: string): Envelope<SfDossier> {
    return this.http.post<SfEnvelope<SfDossier>>(`${this.base}/dossiers/${id}/generate`, {});
  }

  generateCashFlow(id: string, method?: SfCashFlowMethod): Envelope<SfDossier> {
    return this.http.post<SfEnvelope<SfDossier>>(
      `${this.base}/dossiers/${id}/cash-flow`,
      method ? { method } : {},
    );
  }

  getPreview(id: string): Envelope<SfPreview> {
    return this.http.get<SfEnvelope<SfPreview>>(`${this.base}/dossiers/${id}/preview`);
  }

  // --- Notes ---

  getNotes(id: string): Envelope<SfNotes | null> {
    return this.http.get<SfEnvelope<SfNotes | null>>(`${this.base}/dossiers/${id}/notes`);
  }

  populateNotes(id: string, overwriteNarrative = false): Envelope<SfNotes> {
    return this.http.post<SfEnvelope<SfNotes>>(`${this.base}/dossiers/${id}/notes/populate`, {
      overwrite_narrative: overwriteNarrative,
    });
  }

  updateNotes(id: string, payload: SfNotesPayload): Envelope<SfNotes> {
    return this.http.put<SfEnvelope<SfNotes>>(`${this.base}/dossiers/${id}/notes`, payload);
  }

  // --- Indicators ---

  getIndicators(id: string): Envelope<SfIndicatorsResult> {
    return this.http.get<SfEnvelope<SfIndicatorsResult>>(`${this.base}/dossiers/${id}/indicators`);
  }

  simulateIndicators(id: string, whatIf: SfWhatIf): Envelope<SfIndicatorsResult> {
    return this.http.post<SfEnvelope<SfIndicatorsResult>>(
      `${this.base}/dossiers/${id}/indicators/simulate`,
      { what_if: whatIf },
    );
  }

  saveIndicators(id: string, whatIf: SfWhatIf = {}): Envelope<SfIndicatorsResult> {
    return this.http.post<SfEnvelope<SfIndicatorsResult>>(
      `${this.base}/dossiers/${id}/indicators`,
      { what_if: whatIf },
    );
  }

  // --- Deposit package ---

  getPackage(id: string): Envelope<SfPackageBundle> {
    return this.http.get<SfEnvelope<SfPackageBundle>>(`${this.base}/dossiers/${id}/package`);
  }

  exportXbrl(id: string): Envelope<SfPackage> {
    return this.http.post<SfEnvelope<SfPackage>>(`${this.base}/dossiers/${id}/xbrl/export`, {});
  }

  generatePdfa(id: string, payload: SfPdfaPayload): Envelope<SfPackageBundle> {
    return this.http.post<SfEnvelope<SfPackageBundle>>(`${this.base}/dossiers/${id}/pdfa`, payload);
  }

  verifyArtifact(id: string, artifactId: string): Envelope<SfArtifact> {
    return this.http.post<SfEnvelope<SfArtifact>>(
      `${this.base}/dossiers/${id}/artifacts/${artifactId}/verify`,
      {},
    );
  }

  downloadArtifact(id: string, artifactId: string): Observable<Blob> {
    return this.http.get(`${this.base}/dossiers/${id}/artifacts/${artifactId}/download`, {
      responseType: 'blob',
    });
  }
}
