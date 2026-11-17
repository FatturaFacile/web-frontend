import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { handleErrorsLocally } from '../http/error-handling.context';
import {
  PublicApplyPayload,
  PublicApplyResult,
  PublicCareersPage,
  PublicJob,
  PublicJobListParams,
  RecruitingEnvelope,
  RecruitingLocale,
  RecruitingPaginated,
} from '../models';

/**
 * Public careers portal endpoints (`{apiBaseUrl}/public/careers/{slug}`): no auth,
 * no tenant. Every error status is rendered by the portal itself (no global toast,
 * no redirect to `/login`).
 */
const PORTAL_ERRORS = () => handleErrorsLocally(0, 401, 403, 404, 409, 419, 422, 429, 500, 503);

@Service()
export class PublicCareersApiService {
  private readonly http = inject(HttpClient);

  base(slug: string): string {
    return `${environment.apiBaseUrl}/public/careers/${encodeURIComponent(slug)}`;
  }

  getPage(
    slug: string,
    locale?: RecruitingLocale,
  ): Observable<RecruitingEnvelope<PublicCareersPage>> {
    return this.http.get<RecruitingEnvelope<PublicCareersPage>>(this.base(slug), {
      params: toHttpParams({ locale }),
      context: PORTAL_ERRORS(),
    });
  }

  listJobs(
    slug: string,
    params: PublicJobListParams = {},
  ): Observable<RecruitingPaginated<PublicJob>> {
    return this.http.get<RecruitingPaginated<PublicJob>>(`${this.base(slug)}/jobs`, {
      params: toHttpParams(params),
      context: PORTAL_ERRORS(),
    });
  }

  getJob(
    slug: string,
    id: string,
    locale?: RecruitingLocale,
  ): Observable<RecruitingEnvelope<PublicJob>> {
    return this.http.get<RecruitingEnvelope<PublicJob>>(
      `${this.base(slug)}/jobs/${encodeURIComponent(id)}`,
      { params: toHttpParams({ locale }), context: PORTAL_ERRORS() },
    );
  }

  apply(
    slug: string,
    jobId: string,
    payload: PublicApplyPayload,
  ): Observable<RecruitingEnvelope<PublicApplyResult>> {
    return this.http.post<RecruitingEnvelope<PublicApplyResult>>(
      `${this.base(slug)}/jobs/${encodeURIComponent(jobId)}/apply`,
      toPublicApplyFormData(payload),
      { context: PORTAL_ERRORS() },
    );
  }

  feedJsonUrl(slug: string, locale?: RecruitingLocale): string {
    return this.feedUrl(slug, 'feed.json', locale);
  }

  feedRssUrl(slug: string, locale?: RecruitingLocale): string {
    return this.feedUrl(slug, 'feed.rss', locale);
  }

  private feedUrl(slug: string, file: string, locale?: RecruitingLocale): string {
    const url = `${this.base(slug)}/${file}`;
    return locale ? `${url}?locale=${encodeURIComponent(locale)}` : url;
  }
}

/**
 * Serialises a public application as `multipart/form-data`, including the
 * honeypot field `website`, which a human applicant always leaves empty.
 */
export function toPublicApplyFormData(payload: PublicApplyPayload): FormData {
  const data = new FormData();
  data.append('first_name', payload.first_name);
  data.append('last_name', payload.last_name);
  data.append('email', payload.email);
  if (payload.phone) data.append('phone', payload.phone);
  if (payload.cover_letter) data.append('cover_letter', payload.cover_letter);
  data.append('locale', payload.locale);
  data.append('consent_accepted', payload.consent_accepted ? '1' : '0');
  data.append('consent_text_version', payload.consent_text_version);
  data.append('cv', payload.cv, payload.cv.name);
  data.append('website', payload.website ?? '');
  return data;
}
