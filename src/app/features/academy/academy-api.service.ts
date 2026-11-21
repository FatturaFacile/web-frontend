import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AcademyEnvelope,
  AcademyProgress,
  CertificateVerification,
  ClassroomDashboard,
  Cohort,
  ContextualHelp,
  CreateCohortPayload,
  Mission,
  Track,
  VerifyStepResult,
} from './academy.models';

type Id = number | string;

/** HTTP access to `/api/v1/academy` (Mod 112: contextual help, tracks and missions, certificates, classroom). */
@Service()
export class AcademyApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/academy`;

  contextualHelp(route: string, locale: string): Observable<AcademyEnvelope<ContextualHelp>> {
    return this.http.get<AcademyEnvelope<ContextualHelp>>(`${this.base}/contextual-help`, {
      params: { route, locale },
    });
  }

  tracks(): Observable<AcademyEnvelope<Track[]>> {
    return this.http.get<AcademyEnvelope<Track[]>>(`${this.base}/tracks`);
  }

  track(id: Id): Observable<AcademyEnvelope<Track>> {
    return this.http.get<AcademyEnvelope<Track>>(`${this.base}/tracks/${id}`);
  }

  progress(): Observable<AcademyEnvelope<AcademyProgress>> {
    return this.http.get<AcademyEnvelope<AcademyProgress>>(`${this.base}/progress`);
  }

  startMission(id: Id): Observable<AcademyEnvelope<Mission>> {
    return this.http.post<AcademyEnvelope<Mission>>(`${this.base}/missions/${id}/start`, {});
  }

  verifyStep(id: Id): Observable<AcademyEnvelope<VerifyStepResult>> {
    return this.http.post<AcademyEnvelope<VerifyStepResult>>(
      `${this.base}/missions/${id}/verify-step`,
      {},
    );
  }

  certificate(trackId: Id, locale: string): Observable<Blob> {
    return this.http.get(`${this.base}/tracks/${trackId}/certificate`, {
      params: { locale },
      responseType: 'blob',
    });
  }

  verifyCertificate(code: string): Observable<AcademyEnvelope<CertificateVerification>> {
    return this.http.get<AcademyEnvelope<CertificateVerification>>(
      `${this.base}/certificates/verify/${encodeURIComponent(code)}`,
    );
  }

  createCohort(payload: CreateCohortPayload): Observable<AcademyEnvelope<Cohort>> {
    return this.http.post<AcademyEnvelope<Cohort>>(`${this.base}/classroom/cohorts`, payload);
  }

  joinCohort(joinCode: string): Observable<AcademyEnvelope<Cohort>> {
    return this.http.post<AcademyEnvelope<Cohort>>(`${this.base}/classroom/join`, {
      join_code: joinCode,
    });
  }

  cohortDashboard(id: Id): Observable<AcademyEnvelope<ClassroomDashboard>> {
    return this.http.get<AcademyEnvelope<ClassroomDashboard>>(
      `${this.base}/classroom/cohorts/${id}/dashboard`,
    );
  }
}
