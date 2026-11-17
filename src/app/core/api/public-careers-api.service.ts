import { HttpClient, HttpContext } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { HANDLED_ERROR_STATUSES } from '../interceptors/error.interceptor';

/** Public careers answers: records are loosely typed objects, the shape is owned by the API. */
export interface PublicCareersResponse<T> {
  data: T;
}

export type PublicCareersRecord = Record<string, unknown>;

export interface PublicCareersJobFilters {
  department_id?: string;
  employment_type?: string;
  location_site?: string;
  search?: string;
  locale?: string;
  page?: number;
  per_page?: number;
}

/** Fields of the multipart body of `POST /public/careers/{slug}/jobs/{id}/apply` (PublicApplyRequest). */
export interface PublicCareersApplyPayload {
  first_name: string;
  last_name: string;
  email: string;
  phone?: string | null;
  cover_letter?: string | null;
  locale: string;
  consent_accepted: boolean;
  consent_text_version: string;
  cv: File;
}

/**
 * Public careers page of a company (`/public/careers/{slug}`, no session). The tenant is resolved from the careers slug.
 * The JSON and RSS job feeds (`feed.json`, `feed.rss`) are for job boards and crawlers, not for the app, and are not wrapped here.
 */
@Service()
export class PublicCareersApiService {
  private readonly http = inject(HttpClient);
  private readonly root = `${environment.apiBaseUrl}/public/careers`;

  /** Unknown slugs and closed openings answer 404: the page renders that state itself. */
  private readonly context = () => new HttpContext().set(HANDLED_ERROR_STATUSES, [404]);

  private base(slug: string): string {
    return `${this.root}/${encodeURIComponent(slug)}`;
  }

  getCareersPage(slug: string, locale?: string): Observable<PublicCareersResponse<PublicCareersRecord>> {
    return this.http.get<PublicCareersResponse<PublicCareersRecord>>(this.base(slug), {
      params: toHttpParams({ locale }),
      context: this.context(),
    });
  }

  getJobs(slug: string, filters: PublicCareersJobFilters = {}): Observable<PublicCareersResponse<PublicCareersRecord[]>> {
    return this.http.get<PublicCareersResponse<PublicCareersRecord[]>>(`${this.base(slug)}/jobs`, {
      params: toHttpParams(filters),
      context: this.context(),
    });
  }

  getJob(slug: string, id: string, locale?: string): Observable<PublicCareersResponse<PublicCareersRecord>> {
    return this.http.get<PublicCareersResponse<PublicCareersRecord>>(`${this.base(slug)}/jobs/${id}`, {
      params: toHttpParams({ locale }),
      context: this.context(),
    });
  }

  apply(slug: string, id: string, payload: PublicCareersApplyPayload): Observable<PublicCareersResponse<PublicCareersRecord>> {
    const form = new FormData();
    form.append('first_name', payload.first_name);
    form.append('last_name', payload.last_name);
    form.append('email', payload.email);
    form.append('locale', payload.locale);
    form.append('consent_accepted', payload.consent_accepted ? '1' : '0');
    form.append('consent_text_version', payload.consent_text_version);
    form.append('cv', payload.cv);
    if (payload.phone) {
      form.append('phone', payload.phone);
    }
    if (payload.cover_letter) {
      form.append('cover_letter', payload.cover_letter);
    }
    return this.http.post<PublicCareersResponse<PublicCareersRecord>>(`${this.base(slug)}/jobs/${id}/apply`, form);
  }
}
