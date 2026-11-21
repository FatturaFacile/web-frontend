import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  BoardPackFormat,
  DrillDownResponse,
  DrillTarget,
  DssFilterState,
  DssLegalEntity,
  DssOverviewResponse,
  ProfitabilityDimension,
  ProfitabilityMatrixResponse,
  VarianceBridgeResponse,
  WhatIfScenario,
  WhatIfSimulationResult,
} from './dss.models';
import { filterToBody, filterToParams } from './dss.utils';

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** HTTP access to `/api/v1/analytics/dss` (Issue #214: Executive DSS and strategic analytics). */
@Service()
export class DssApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/analytics/dss`;

  overview(filter: DssFilterState): Observable<Envelope<DssOverviewResponse>> {
    return this.http.get<Envelope<DssOverviewResponse>>(`${this.base}/overview`, {
      params: filterToParams(filter),
    });
  }

  profitabilityMatrix(
    filter: DssFilterState,
    dimension: ProfitabilityDimension,
  ): Observable<Envelope<ProfitabilityMatrixResponse>> {
    return this.http.get<Envelope<ProfitabilityMatrixResponse>>(
      `${this.base}/profitability-matrix`,
      { params: filterToParams(filter).set('dimension', dimension) },
    );
  }

  varianceBridge(filter: DssFilterState): Observable<Envelope<VarianceBridgeResponse>> {
    return this.http.get<Envelope<VarianceBridgeResponse>>(`${this.base}/variance-bridge`, {
      params: filterToParams(filter),
    });
  }

  simulate(
    filter: DssFilterState,
    scenario: WhatIfScenario,
  ): Observable<Envelope<WhatIfSimulationResult>> {
    return this.http.post<Envelope<WhatIfSimulationResult>>(`${this.base}/simulate`, {
      ...filterToBody(filter),
      scenario,
    });
  }

  drillDown(
    filter: DssFilterState,
    target: DrillTarget,
    page: number,
    perPage: number,
  ): Observable<Envelope<DrillDownResponse>> {
    let params: HttpParams = filterToParams(filter)
      .set('metric', target.metric)
      .set('page', String(page))
      .set('per_page', String(perPage));

    if (target.entityType !== null && target.entityId !== null) {
      params = params.set('entity_type', target.entityType).set('entity_id', target.entityId);
    }

    return this.http.get<Envelope<DrillDownResponse>>(`${this.base}/drill-down`, { params });
  }

  legalEntities(): Observable<Envelope<DssLegalEntity[]>> {
    return this.http.get<Envelope<DssLegalEntity[]>>(`${this.base}/legal-entities`);
  }

  /** The board pack file, localized in `locale`. */
  exportBoardPack(
    filter: DssFilterState,
    format: BoardPackFormat,
    locale: string,
  ): Observable<Blob> {
    return this.http.post(
      `${this.base}/export-board-pack`,
      { ...filterToBody(filter), format, locale },
      { responseType: 'blob' },
    );
  }
}
