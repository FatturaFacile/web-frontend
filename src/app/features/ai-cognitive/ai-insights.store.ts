import { computed, inject, Service, signal } from '@angular/core';
import { finalize, map, Observable, tap } from 'rxjs';
import { AiCognitiveApiService } from './ai-cognitive-api.service';
import { AiSuggestion, PredictiveDashboard } from './ai-cognitive.models';

/**
 * Signal state of the Predictive Insights and Anomaly Center: the cash flow projection, the customers by payment risk and the
 * open recommendations and anomaly alerts. A recommendation can be acknowledged or dismissed in one click; it then leaves the
 * lists.
 */
@Service()
export class AiInsightsStore {
  private readonly api = inject(AiCognitiveApiService);

  readonly dashboard = signal<PredictiveDashboard | null>(null);
  readonly horizonDays = signal<number | null>(null);
  readonly loading = signal(false);
  readonly generating = signal(false);
  readonly busyId = signal<string | null>(null);

  readonly cashFlow = computed(() => this.dashboard()?.cash_flow ?? null);
  readonly recommendations = computed(() => this.dashboard()?.recommendations ?? []);
  readonly anomalies = computed(() => this.dashboard()?.anomalies ?? []);
  readonly paymentRisk = computed(() => this.dashboard()?.payment_risk ?? []);
  readonly criticalCount = computed(
    () =>
      [...this.recommendations(), ...this.anomalies()].filter((item) => item.priority === 'high')
        .length,
  );
  /** The lowest expected (p50) balance of the projection, or null when there is no projection. */
  readonly lowestBalance = computed<number | null>(() => {
    const flow = this.cashFlow();

    return flow === null || flow.p50.length === 0 ? null : Math.min(...flow.p50);
  });
  /** The first day the pessimistic (p10) balance is negative, or null when it never is. */
  readonly firstNegativeDate = computed<string | null>(() => {
    const flow = this.cashFlow();
    const index = flow === null ? -1 : flow.p10.findIndex((balance) => balance < 0);

    return flow === null || index < 0 ? null : (flow.dates[index] ?? null);
  });

  load(): Observable<unknown> {
    this.loading.set(true);

    return this.api.dashboard(this.horizonDays()).pipe(
      tap((res) => this.dashboard.set(res.data)),
      finalize(() => this.loading.set(false)),
    );
  }

  setHorizon(days: number | null): void {
    this.horizonDays.set(days);
  }

  /** Runs the predictive scoring and the anomaly scan now, then reloads the lists. */
  generate(): Observable<Record<string, number>> {
    this.generating.set(true);

    return this.api.generateInsights().pipe(
      map((res) => res.data),
      tap(() => this.load().subscribe({ error: () => undefined })),
      finalize(() => this.generating.set(false)),
    );
  }

  /** One-click acknowledgement of an alert or recommendation. */
  acknowledge(item: AiSuggestion): Observable<AiSuggestion> {
    return this.decide(item, this.api.approve(item.id, null, null));
  }

  /** One-click dismissal with a reason (a false positive, already handled). */
  dismiss(item: AiSuggestion, reason: string): Observable<AiSuggestion> {
    return this.decide(item, this.api.reject(item.id, reason));
  }

  private decide(
    item: AiSuggestion,
    call: Observable<{ data: AiSuggestion }>,
  ): Observable<AiSuggestion> {
    this.busyId.set(item.id);

    return call.pipe(
      map((res) => res.data),
      tap(() =>
        this.dashboard.update((dashboard) =>
          dashboard === null
            ? dashboard
            : {
                ...dashboard,
                recommendations: dashboard.recommendations.filter((row) => row.id !== item.id),
                anomalies: dashboard.anomalies.filter((row) => row.id !== item.id),
              },
        ),
      ),
      finalize(() => this.busyId.set(null)),
    );
  }
}
