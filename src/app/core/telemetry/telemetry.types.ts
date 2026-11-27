/** What the app needs from the tracing SDK; the SDK itself is loaded lazily (see telemetry-sdk.ts) and sits behind this seam. */
export type SpanAttributeValue = string | number | boolean;

export interface TelemetrySpan {
  setAttribute(key: string, value: SpanAttributeValue): void;
  addEvent(name: string, attributes?: Record<string, SpanAttributeValue>): void;
  /** Marks the span as failed with a message that is already scrubbed. */
  setError(message: string): void;
  end(): void;
}

export interface TelemetryRuntime {
  startSpan(name: string, attributes?: Record<string, SpanAttributeValue>): TelemetrySpan;
  /** Runs `fn` with `span` as the active span, so the HTTP calls it makes carry its trace id in `traceparent`. */
  runInSpan<T>(span: TelemetrySpan, fn: () => T): T;
  /** The span that is active now (an action or a navigation), or null. */
  activeSpan(): TelemetrySpan | null;
  shutdown(): Promise<void>;
}

export interface TelemetryConfig {
  readonly enabled: boolean;
  readonly endpoint: string;
  readonly sampleRatio: number;
  readonly serviceName: string;
  readonly serviceVersion: string;
  /** Origin of the web-api: the only one that receives `traceparent`. */
  readonly apiOrigin: string;
}

export type TelemetryRuntimeLoader = (config: TelemetryConfig) => Promise<TelemetryRuntime>;
