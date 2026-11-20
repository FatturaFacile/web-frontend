import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../core/http/laravel-http.utils';
import {
  Accuracy,
  AppliedReorderRule,
  ConfidenceBands,
  DemandFilters,
  LiquidityHorizonDays,
  LiquidityRun,
  PaymentBehavior,
  SkuForecast,
  TrainResult,
  WhatIfParameters,
} from './ai-forecasting.models';

export interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

/** HTTP access to `/api/v1/forecasting` (Issue #221: AI cash flow and demand forecasting). */
@Service()
export class AiForecastingApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/forecasting`;

  paymentModels(): Observable<Envelope<PaymentBehavior[]>> {
    return this.http.get<Envelope<PaymentBehavior[]>>(`${this.base}/payment-models`);
  }

  trainPaymentModels(): Observable<Envelope<TrainResult>> {
    return this.http.post<Envelope<TrainResult>>(`${this.base}/payment-models/train`, {});
  }

  confidenceBands(horizonDays: LiquidityHorizonDays): Observable<Envelope<ConfidenceBands>> {
    return this.http.get<Envelope<ConfidenceBands>>(`${this.base}/liquidity/confidence-bands`, {
      params: toHttpParams({ horizon_days: horizonDays }),
    });
  }

  /** A preview is computed but not stored, so the what-if sliders can call it freely. */
  simulate(
    horizonDays: LiquidityHorizonDays,
    whatIf: WhatIfParameters | null,
    preview: boolean,
  ): Observable<Envelope<LiquidityRun>> {
    return this.http.post<Envelope<LiquidityRun>>(`${this.base}/liquidity/simulate`, {
      horizon_days: horizonDays,
      preview,
      ...(whatIf === null ? {} : { what_if: whatIf }),
    });
  }

  demandForecasts(filters: DemandFilters): Observable<Envelope<SkuForecast[]>> {
    return this.http.get<Envelope<SkuForecast[]>>(`${this.base}/demand/forecasts`, {
      params: toHttpParams({ ...filters }),
    });
  }

  generateDemand(periodsAhead: number): Observable<Envelope<unknown[]>> {
    return this.http.post<Envelope<unknown[]>>(`${this.base}/demand/generate`, {
      periods_ahead: periodsAhead,
    });
  }

  accuracy(): Observable<Envelope<Accuracy>> {
    return this.http.get<Envelope<Accuracy>>(`${this.base}/demand/accuracy`);
  }

  applyReorderRules(forecastIds: string[]): Observable<Envelope<AppliedReorderRule[]>> {
    return this.http.post<Envelope<AppliedReorderRule[]>>(
      `${this.base}/demand/apply-reorder-rules`,
      {
        forecast_ids: forecastIds,
      },
    );
  }
}
