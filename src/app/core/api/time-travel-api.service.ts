import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  TtAggregateType,
  TtCheckpointResult,
  TtCutOffDiff,
  TtDiffQuery,
  TtEnvelope,
  TtIntegrityReport,
  TtState,
  TtStateMeta,
  TtStateQuery,
  TtWhatIfRequest,
  TtWhatIfResult,
} from '../models/time-travel.model';

/** Drops the empty values so that only the filters the user chose reach the query string. */
function toParams(query: object): HttpParams {
  let params = new HttpParams();
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      params = params.set(key, String(value));
    }
  }
  return params;
}

/** Endpoints of the bi-temporal time-travel engine (Mod 354, issue #600). */
@Service()
export class TimeTravelApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/time-travel`;

  state(query: TtStateQuery): Observable<TtEnvelope<TtState, TtStateMeta>> {
    return this.http.get<TtEnvelope<TtState, TtStateMeta>>(`${this.base}/state`, { params: toParams(query) });
  }

  cutOffDiff(query: TtDiffQuery): Observable<TtEnvelope<TtCutOffDiff>> {
    return this.http.get<TtEnvelope<TtCutOffDiff>>(`${this.base}/cut-off-diff`, { params: toParams(query) });
  }

  whatIfReplay(request: TtWhatIfRequest): Observable<TtEnvelope<TtWhatIfResult>> {
    return this.http.post<TtEnvelope<TtWhatIfResult>>(`${this.base}/what-if-replay`, request);
  }

  auditIntegrity(fromDate: string, toDate: string): Observable<TtEnvelope<TtIntegrityReport>> {
    return this.http.get<TtEnvelope<TtIntegrityReport>>(`${this.base}/audit-integrity`, {
      params: toParams({ from_date: fromDate, to_date: toDate }),
    });
  }

  generateCheckpoints(aggregateType?: TtAggregateType): Observable<TtEnvelope<TtCheckpointResult>> {
    return this.http.post<TtEnvelope<TtCheckpointResult>>(
      `${this.base}/checkpoints/generate`,
      aggregateType ? { aggregate_type: aggregateType } : {},
    );
  }
}
