import { inject, InjectionToken, Service, signal } from '@angular/core';
import { NavigationCancel, NavigationEnd, NavigationError, NavigationStart, Router } from '@angular/router';
import { Observable } from 'rxjs';
import { describeError, scrubUrl } from './pii-scrubber';
import { resolveTelemetryConfig } from './telemetry.config';
import {
  SpanAttributeValue,
  TelemetryConfig,
  TelemetryRuntime,
  TelemetryRuntimeLoader,
  TelemetrySpan,
} from './telemetry.types';

/** Loads the SDK on demand; replaced in tests. The dynamic import keeps the whole OpenTelemetry SDK out of the initial bundle. */
export const TELEMETRY_RUNTIME_LOADER = new InjectionToken<TelemetryRuntimeLoader>('TELEMETRY_RUNTIME_LOADER', {
  providedIn: 'root',
  factory: () => (config: TelemetryConfig) => import('./telemetry-sdk').then((m) => m.createTelemetryRuntime(config)),
});

export const TELEMETRY_CONFIG = new InjectionToken<TelemetryConfig>('TELEMETRY_CONFIG', {
  providedIn: 'root',
  factory: () => resolveTelemetryConfig(),
});

/**
 * Browser tracing (issue #448). Off unless the build enables it; once on it traces the route navigations and the key ERP
 * actions, and every call to the web-api carries the W3C `traceparent` of the active span (the API stitches it into its own
 * trace). Nothing personal leaves the page: names, URLs and error messages go through the PII scrubber.
 */
@Service()
export class TelemetryService {
  private readonly router = inject(Router);
  private readonly config = inject(TELEMETRY_CONFIG);
  private readonly loader = inject(TELEMETRY_RUNTIME_LOADER);

  private runtime: TelemetryRuntime | null = null;
  private navigationSpan: TelemetrySpan | null = null;
  private started = false;

  /** True once the SDK is loaded and tracing. */
  readonly active = signal(false);

  /** Starts after bootstrap (never blocks it). A failure to load the SDK is swallowed: telemetry must never break the app. */
  async start(): Promise<void> {
    if (this.started || !this.config.enabled) {
      return;
    }
    this.started = true;
    try {
      this.runtime = await this.loader(this.config);
      this.active.set(true);
      this.traceNavigations();
    } catch {
      this.runtime = null;
    }
  }

  /** Runs `fn` inside a span called `name`; a no-op wrapper when tracing is off. The span ends when the promise settles. */
  traceAction<T>(name: string, fn: () => T | Promise<T>, attributes?: Record<string, SpanAttributeValue>): Promise<T> {
    const runtime = this.runtime;
    if (!runtime) {
      try {
        return Promise.resolve(fn());
      } catch (error) {
        return Promise.reject(error);
      }
    }
    const span = runtime.startSpan(`action ${name}`, { 'app.action': name, ...attributes });
    let result: T | Promise<T>;
    try {
      result = runtime.runInSpan(span, fn);
    } catch (error) {
      this.failSpan(span, error);
      span.end();
      return Promise.reject(error);
    }
    return Promise.resolve(result).then(
      (value) => {
        span.end();
        return value;
      },
      (error: unknown) => {
        this.failSpan(span, error);
        span.end();
        throw error;
      },
    );
  }

  /**
   * Traces an Observable call (an HTTP request of a key ERP action): the span opens at subscription, the request is issued inside
   * it so it carries the span's `traceparent`, and the span ends on completion, error or unsubscription. Pass-through when off.
   */
  traceStream<T>(name: string, source: Observable<T>, attributes?: Record<string, SpanAttributeValue>): Observable<T> {
    return new Observable<T>((subscriber) => {
      const runtime = this.runtime;
      if (!runtime) {
        return source.subscribe(subscriber);
      }
      const span = runtime.startSpan(`action ${name}`, { 'app.action': name, ...attributes });
      let ended = false;
      const finish = (error?: unknown): void => {
        if (ended) {
          return;
        }
        ended = true;
        if (error !== undefined) {
          this.failSpan(span, error);
        }
        span.end();
      };
      const subscription = runtime.runInSpan(span, () =>
        source.subscribe({
          next: (value) => subscriber.next(value),
          error: (error: unknown) => {
            finish(error);
            subscriber.error(error);
          },
          complete: () => {
            finish();
            subscriber.complete();
          },
        }),
      );
      return () => {
        subscription.unsubscribe();
        finish();
      };
    });
  }

  /** Puts an unhandled error into the active span (or a short span of its own): type and scrubbed message only, no stack. */
  recordError(error: unknown): void {
    const runtime = this.runtime;
    if (!runtime) {
      return;
    }
    const { type, message } = describeError(error);
    const active = runtime.activeSpan() ?? this.navigationSpan;
    const span = active ?? runtime.startSpan('frontend.error');
    span.addEvent('exception', { 'exception.type': type, 'exception.message': message });
    span.setError(message || type);
    if (!active) {
      span.end();
    }
  }

  async shutdown(): Promise<void> {
    this.navigationSpan?.end();
    this.navigationSpan = null;
    await this.runtime?.shutdown();
    this.runtime = null;
    this.active.set(false);
  }

  private failSpan(span: TelemetrySpan, error: unknown): void {
    const { type, message } = describeError(error);
    span.addEvent('exception', { 'exception.type': type, 'exception.message': message });
    span.setError(message || type);
  }

  private traceNavigations(): void {
    this.router.events.subscribe((event) => {
      const runtime = this.runtime;
      if (!runtime) {
        return;
      }
      if (event instanceof NavigationStart) {
        this.navigationSpan?.end();
        this.navigationSpan = runtime.startSpan('navigation', { 'navigation.trigger': event.navigationTrigger ?? 'imperative' });
      } else if (event instanceof NavigationEnd) {
        this.finishNavigation(scrubUrl(event.urlAfterRedirects));
      } else if (event instanceof NavigationCancel) {
        this.finishNavigation(scrubUrl(event.url), 'cancelled');
      } else if (event instanceof NavigationError) {
        this.navigationSpan?.setError('navigation error');
        this.finishNavigation(scrubUrl(event.url), 'error');
      }
    });
  }

  private finishNavigation(route: string, outcome = 'ok'): void {
    const span = this.navigationSpan;
    if (!span) {
      return;
    }
    span.setAttribute('http.route', route);
    span.setAttribute('navigation.outcome', outcome);
    span.end();
    this.navigationSpan = null;
  }
}
