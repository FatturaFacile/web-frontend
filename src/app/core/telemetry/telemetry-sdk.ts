import { context, Span, SpanStatusCode, trace } from '@opentelemetry/api';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { registerInstrumentations } from '@opentelemetry/instrumentation';
import { FetchInstrumentation } from '@opentelemetry/instrumentation-fetch';
import { XMLHttpRequestInstrumentation } from '@opentelemetry/instrumentation-xml-http-request';
import { resourceFromAttributes } from '@opentelemetry/resources';
import {
  BatchSpanProcessor,
  ParentBasedSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { WebTracerProvider } from '@opentelemetry/sdk-trace-web';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { scrubUrl } from './pii-scrubber';
import { SpanAttributeValue, TelemetryConfig, TelemetryRuntime, TelemetrySpan } from './telemetry.types';

/**
 * The OpenTelemetry web SDK wiring. Imported ONLY through a dynamic `import()` after bootstrap, so none of it is in the
 * initial bundle. The app is zoneless, so the default stack context manager is used (no zone.js).
 */
function escapeRegExp(value: string): RegExp {
  return new RegExp(`^${value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
}

/** The SDK span behind each wrapper, needed to make a span the active one. */
const SDK_SPANS = new WeakMap<TelemetrySpan, Span>();

function wrap(span: Span): TelemetrySpan {
  const wrapper: TelemetrySpan = {
    setAttribute: (key, value) => void span.setAttribute(key, value),
    addEvent: (name, attributes) => void span.addEvent(name, attributes),
    setError: (message) => void span.setStatus({ code: SpanStatusCode.ERROR, message }),
    end: () => span.end(),
  };
  SDK_SPANS.set(wrapper, span);
  return wrapper;
}

/** Keeps the URL of a client span free of query strings and ids (it may carry search terms or personal data). */
function scrubUrlAttributes(span: Span, request: unknown): void {
  const candidate = request as { url?: string; responseURL?: string } | null;
  const url = candidate?.url ?? candidate?.responseURL;
  if (url) {
    const safe = scrubUrl(url);
    span.setAttribute('url.full', safe);
    span.setAttribute('http.url', safe);
  }
}

export async function createTelemetryRuntime(config: TelemetryConfig): Promise<TelemetryRuntime> {
  const provider = new WebTracerProvider({
    resource: resourceFromAttributes({
      [ATTR_SERVICE_NAME]: config.serviceName,
      [ATTR_SERVICE_VERSION]: config.serviceVersion,
    }),
    sampler: new ParentBasedSampler({ root: new TraceIdRatioBasedSampler(config.sampleRatio) }),
    spanProcessors: [new BatchSpanProcessor(new OTLPTraceExporter({ url: config.endpoint }))],
  });
  provider.register();

  const propagateTo = [escapeRegExp(config.apiOrigin)];
  const ignoreUrls = [escapeRegExp(config.endpoint)];
  registerInstrumentations({
    tracerProvider: provider,
    instrumentations: [
      new FetchInstrumentation({
        propagateTraceHeaderCorsUrls: propagateTo,
        ignoreUrls,
        applyCustomAttributesOnSpan: scrubUrlAttributes,
      }),
      new XMLHttpRequestInstrumentation({
        propagateTraceHeaderCorsUrls: propagateTo,
        ignoreUrls,
        applyCustomAttributesOnSpan: scrubUrlAttributes,
      }),
    ],
  });

  const tracer = trace.getTracer(config.serviceName, config.serviceVersion);

  return {
    startSpan: (name, attributes?: Record<string, SpanAttributeValue>) =>
      wrap(tracer.startSpan(name, { attributes }, context.active())),
    runInSpan: (span, fn) => {
      const sdkSpan = SDK_SPANS.get(span);
      return sdkSpan ? context.with(trace.setSpan(context.active(), sdkSpan), fn) : fn();
    },
    activeSpan: () => {
      const active = trace.getActiveSpan();
      return active ? wrap(active) : null;
    },
    shutdown: () => provider.shutdown(),
  };
}
