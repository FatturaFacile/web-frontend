import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { handleErrorsLocally } from '../http/error-handling.context';
import {
  ApplicationListParams,
  ApplicationStage,
  CandidateApplication,
  CandidateApplicationCard,
  CloseJobOpeningPayload,
  EmailTemplate,
  EmailTemplateUpdatePayload,
  HirePayload,
  HireResult,
  InterviewScorecard,
  JobOfferLetter,
  JobOpening,
  JobOpeningListParams,
  JobOpeningPayload,
  JobOpeningUpdatePayload,
  ManualApplicationPayload,
  MoveApplicationPayload,
  OfferPayload,
  RecruitingBoard,
  RecruitingEnvelope,
  RecruitingLocale,
  RecruitingPaginated,
  RecruitingPositionOption,
  RecruitingSettings,
  RecruitingSettingsUpdate,
  RetentionMonths,
  ScorecardPayload,
  UpdateApplicationPayload,
} from '../models';

/** Business-rule (409) and validation (422) errors are rendered by the recruiting screens. */
const LOCAL_ERRORS = () => handleErrorsLocally(409, 422);

/**
 * Authenticated Recruiting & ATS endpoints (`{apiBaseUrl}/hr/recruiting`).
 * Contract: FatturaFacile/FatturaFacile#273.
 */
@Service()
export class RecruitingApiService {
  private readonly http = inject(HttpClient);

  private get base(): string {
    return `${environment.apiBaseUrl}/hr/recruiting`;
  }

  // --- Job openings --------------------------------------------------------

  listJobOpenings(params: JobOpeningListParams = {}): Observable<RecruitingPaginated<JobOpening>> {
    return this.http.get<RecruitingPaginated<JobOpening>>(`${this.base}/job-openings`, {
      params: toHttpParams(params),
    });
  }

  getJobOpening(id: string): Observable<RecruitingEnvelope<JobOpening>> {
    return this.http.get<RecruitingEnvelope<JobOpening>>(`${this.base}/job-openings/${id}`);
  }

  createJobOpening(payload: JobOpeningPayload): Observable<RecruitingEnvelope<JobOpening>> {
    return this.http.post<RecruitingEnvelope<JobOpening>>(`${this.base}/job-openings`, payload, {
      context: LOCAL_ERRORS(),
    });
  }

  updateJobOpening(
    id: string,
    payload: JobOpeningUpdatePayload,
  ): Observable<RecruitingEnvelope<JobOpening>> {
    return this.http.put<RecruitingEnvelope<JobOpening>>(
      `${this.base}/job-openings/${id}`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  publishJobOpening(id: string, internalOnly = false): Observable<RecruitingEnvelope<JobOpening>> {
    return this.http.post<RecruitingEnvelope<JobOpening>>(
      `${this.base}/job-openings/${id}/publish`,
      { internal_only: internalOnly },
      { context: LOCAL_ERRORS() },
    );
  }

  closeJobOpening(
    id: string,
    payload: CloseJobOpeningPayload,
  ): Observable<RecruitingEnvelope<JobOpening>> {
    return this.http.post<RecruitingEnvelope<JobOpening>>(
      `${this.base}/job-openings/${id}/close`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  getBoard(jobOpeningId: string, search?: string): Observable<RecruitingEnvelope<RecruitingBoard>> {
    return this.http.get<RecruitingEnvelope<RecruitingBoard>>(
      `${this.base}/job-openings/${jobOpeningId}/board`,
      { params: toHttpParams({ search }) },
    );
  }

  // --- Applications --------------------------------------------------------

  listApplications(
    params: ApplicationListParams = {},
  ): Observable<RecruitingPaginated<CandidateApplicationCard>> {
    return this.http.get<RecruitingPaginated<CandidateApplicationCard>>(
      `${this.base}/applications`,
      { params: toHttpParams(params) },
    );
  }

  /** Manual intake (`multipart/form-data`). */
  createApplication(
    payload: ManualApplicationPayload,
  ): Observable<RecruitingEnvelope<CandidateApplication>> {
    return this.http.post<RecruitingEnvelope<CandidateApplication>>(
      `${this.base}/applications`,
      toManualApplicationFormData(payload),
      { context: LOCAL_ERRORS() },
    );
  }

  getApplication(id: string): Observable<RecruitingEnvelope<CandidateApplication>> {
    return this.http.get<RecruitingEnvelope<CandidateApplication>>(
      `${this.base}/applications/${id}`,
    );
  }

  updateApplication(
    id: string,
    payload: UpdateApplicationPayload,
  ): Observable<RecruitingEnvelope<CandidateApplication>> {
    return this.http.patch<RecruitingEnvelope<CandidateApplication>>(
      `${this.base}/applications/${id}`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  /** Full URL of the authenticated CV download for an application. */
  cvUrl(applicationId: string): string {
    return `${this.base}/applications/${applicationId}/cv`;
  }

  /** CV file as a blob (authenticated). 404 is rendered inline by the viewer. */
  getCv(applicationId: string): Observable<Blob> {
    return this.http.get(this.cvUrl(applicationId), {
      responseType: 'blob',
      context: handleErrorsLocally(404),
    });
  }

  reparseCv(id: string): Observable<RecruitingEnvelope<CandidateApplication>> {
    return this.http.post<RecruitingEnvelope<CandidateApplication>>(
      `${this.base}/applications/${id}/reparse-cv`,
      {},
      { context: LOCAL_ERRORS() },
    );
  }

  moveApplication(
    id: string,
    payload: MoveApplicationPayload,
  ): Observable<RecruitingEnvelope<CandidateApplication>> {
    return this.http.post<RecruitingEnvelope<CandidateApplication>>(
      `${this.base}/applications/${id}/move`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  extendConsent(
    id: string,
    months: RetentionMonths,
  ): Observable<RecruitingEnvelope<CandidateApplication>> {
    return this.http.post<RecruitingEnvelope<CandidateApplication>>(
      `${this.base}/applications/${id}/extend-consent`,
      { months },
      { context: LOCAL_ERRORS() },
    );
  }

  anonymize(id: string): Observable<RecruitingEnvelope<CandidateApplication>> {
    return this.http.post<RecruitingEnvelope<CandidateApplication>>(
      `${this.base}/applications/${id}/anonymize`,
      {},
      { context: LOCAL_ERRORS() },
    );
  }

  // --- Scorecards ----------------------------------------------------------

  listScorecards(applicationId: string): Observable<RecruitingEnvelope<InterviewScorecard[]>> {
    return this.http.get<RecruitingEnvelope<InterviewScorecard[]>>(
      `${this.base}/applications/${applicationId}/scorecards`,
    );
  }

  submitScorecard(
    applicationId: string,
    payload: ScorecardPayload,
  ): Observable<RecruitingEnvelope<InterviewScorecard>> {
    return this.http.post<RecruitingEnvelope<InterviewScorecard>>(
      `${this.base}/applications/${applicationId}/scorecards`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  // --- Offers & hire -------------------------------------------------------

  getOffer(applicationId: string): Observable<RecruitingEnvelope<JobOfferLetter | null>> {
    return this.http.get<RecruitingEnvelope<JobOfferLetter | null>>(
      `${this.base}/applications/${applicationId}/offer`,
    );
  }

  createOffer(
    applicationId: string,
    payload: OfferPayload,
  ): Observable<RecruitingEnvelope<JobOfferLetter>> {
    return this.http.post<RecruitingEnvelope<JobOfferLetter>>(
      `${this.base}/applications/${applicationId}/offer`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  markOfferSigned(
    offerId: string,
    signedAt?: string,
  ): Observable<RecruitingEnvelope<JobOfferLetter>> {
    return this.http.post<RecruitingEnvelope<JobOfferLetter>>(
      `${this.base}/offers/${offerId}/mark-signed`,
      signedAt ? { signed_at: signedAt } : {},
      { context: LOCAL_ERRORS() },
    );
  }

  declineOffer(
    offerId: string,
    note?: string | null,
  ): Observable<RecruitingEnvelope<JobOfferLetter>> {
    return this.http.post<RecruitingEnvelope<JobOfferLetter>>(
      `${this.base}/offers/${offerId}/decline`,
      note ? { note } : {},
      { context: LOCAL_ERRORS() },
    );
  }

  hire(
    applicationId: string,
    payload: HirePayload = {},
  ): Observable<RecruitingEnvelope<HireResult>> {
    return this.http.post<RecruitingEnvelope<HireResult>>(
      `${this.base}/applications/${applicationId}/hire`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  // --- Email templates & settings -----------------------------------------

  listEmailTemplates(
    filter: { stage?: ApplicationStage; locale?: RecruitingLocale } = {},
  ): Observable<RecruitingEnvelope<EmailTemplate[]>> {
    return this.http.get<RecruitingEnvelope<EmailTemplate[]>>(`${this.base}/email-templates`, {
      params: toHttpParams(filter),
    });
  }

  updateEmailTemplate(
    stage: ApplicationStage,
    locale: RecruitingLocale,
    payload: EmailTemplateUpdatePayload,
  ): Observable<RecruitingEnvelope<EmailTemplate>> {
    return this.http.put<RecruitingEnvelope<EmailTemplate>>(
      `${this.base}/email-templates/${stage}/${encodeURIComponent(locale)}`,
      payload,
      { context: LOCAL_ERRORS() },
    );
  }

  getSettings(): Observable<RecruitingEnvelope<RecruitingSettings>> {
    return this.http.get<RecruitingEnvelope<RecruitingSettings>>(`${this.base}/settings`);
  }

  updateSettings(
    payload: RecruitingSettingsUpdate,
  ): Observable<RecruitingEnvelope<RecruitingSettings>> {
    return this.http.put<RecruitingEnvelope<RecruitingSettings>>(`${this.base}/settings`, payload, {
      context: LOCAL_ERRORS(),
    });
  }

  // --- HR lookups ----------------------------------------------------------

  /** Positions offered in the opening editor (`GET {apiBaseUrl}/hr/positions`). */
  listPositions(): Observable<RecruitingEnvelope<RecruitingPositionOption[]>> {
    return this.http.get<RecruitingEnvelope<RecruitingPositionOption[]>>(
      `${environment.apiBaseUrl}/hr/positions`,
      { params: toHttpParams({ per_page: 100 }) },
    );
  }
}

/** Serialises a manual intake payload as `multipart/form-data`. */
export function toManualApplicationFormData(payload: ManualApplicationPayload): FormData {
  const data = new FormData();
  data.append('job_opening_id', payload.job_opening_id);
  data.append('first_name', payload.first_name);
  data.append('last_name', payload.last_name);
  data.append('email', payload.email);
  if (payload.phone) data.append('phone', payload.phone);
  if (payload.cover_letter) data.append('cover_letter', payload.cover_letter);
  if (payload.locale) data.append('locale', payload.locale);
  if (payload.source) data.append('source', payload.source);
  if (payload.retention_months) data.append('retention_months', String(payload.retention_months));
  if (payload.cv) data.append('cv', payload.cv, payload.cv.name);
  return data;
}
