import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ObsConnector,
  ObsConnectorHistory,
  ObsConnectorStatusSummary,
  ObsEnvelope,
  ObsNoisyNeighbor,
  ObsProfilerSettings,
  ObsSlowEndpoint,
  ObsSlowQuery,
  ObsStatements,
} from '../models/observability.model';

type Envelope<T> = Observable<ObsEnvelope<T>>;

/** Endpoints of the observability module (issue #448): profiler and connector admin (platform admin) and the tenant-facing status. */
@Service()
export class ObservabilityApiService {
  private readonly http = inject(HttpClient);
  private readonly admin = `${environment.apiBaseUrl}/admin/observability`;

  slowQueries(hours = 24, limit = 20): Envelope<ObsSlowQuery[]> {
    return this.http.get<ObsEnvelope<ObsSlowQuery[]>>(`${this.admin}/profiler/slow-queries`, {
      params: { hours, limit },
    });
  }

  slowEndpoints(hours = 24, limit = 20): Envelope<ObsSlowEndpoint[]> {
    return this.http.get<ObsEnvelope<ObsSlowEndpoint[]>>(`${this.admin}/profiler/slow-endpoints`, {
      params: { hours, limit },
    });
  }

  statements(): Envelope<ObsStatements> {
    return this.http.get<ObsEnvelope<ObsStatements>>(`${this.admin}/profiler/statements`);
  }

  noisyNeighbors(hours = 1): Envelope<ObsNoisyNeighbor[]> {
    return this.http.get<ObsEnvelope<ObsNoisyNeighbor[]>>(`${this.admin}/profiler/noisy-neighbors`, {
      params: { hours },
    });
  }

  getSettings(): Envelope<ObsProfilerSettings> {
    return this.http.get<ObsEnvelope<ObsProfilerSettings>>(`${this.admin}/profiler/settings`);
  }

  saveSettings(settings: ObsProfilerSettings): Envelope<ObsProfilerSettings> {
    return this.http.put<ObsEnvelope<ObsProfilerSettings>>(`${this.admin}/profiler/settings`, settings);
  }

  connectors(): Envelope<ObsConnector[]> {
    return this.http.get<ObsEnvelope<ObsConnector[]>>(`${this.admin}/connectors`);
  }

  connectorHistory(key: string, hours = 24): Envelope<ObsConnectorHistory> {
    return this.http.get<ObsEnvelope<ObsConnectorHistory>>(`${this.admin}/connectors/${key}/history`, {
      params: { hours },
    });
  }

  probe(key?: string): Envelope<ObsConnector[]> {
    return this.http.post<ObsEnvelope<ObsConnector[]>>(`${this.admin}/connectors/probe`, key ? { key } : {});
  }

  setMaintenance(key: string, maintenance: boolean, message?: string): Envelope<ObsConnector> {
    return this.http.put<ObsEnvelope<ObsConnector>>(`${this.admin}/connectors/${key}/maintenance`, {
      maintenance,
      ...(message ? { message } : {}),
    });
  }

  /** The status every member of a company sees (no internal detail). */
  connectorStatus(): Envelope<ObsConnectorStatusSummary> {
    return this.http.get<ObsEnvelope<ObsConnectorStatusSummary>>(
      `${environment.apiBaseUrl}/system/connector-status`,
    );
  }
}
