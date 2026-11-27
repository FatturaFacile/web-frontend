import { environment } from '@env';
import { TelemetryConfig } from './telemetry.types';

interface EnvironmentTelemetry {
  enabled: boolean;
  endpoint: string;
  sampleRatio: string;
  serviceName: string;
}

/** The origin the API base URL points to; a relative base ("/api/v1") means the origin of the page. */
export function apiOriginOf(apiBaseUrl: string, pageOrigin: string): string {
  try {
    return new URL(apiBaseUrl, pageOrigin).origin;
  } catch {
    return pageOrigin;
  }
}

/** Telemetry is on only when the build enables it AND names an OTLP/HTTP endpoint; the ratio is clamped to 0..1 (default 0.1). */
export function resolveTelemetryConfig(
  source: EnvironmentTelemetry = environment.telemetry,
  apiBaseUrl: string = environment.apiBaseUrl,
  pageOrigin: string = typeof location === 'undefined' ? 'http://localhost' : location.origin,
  version: string = environment.appVersion,
): TelemetryConfig {
  const parsed = Number.parseFloat(source.sampleRatio);
  const ratio = Number.isFinite(parsed) ? Math.min(1, Math.max(0, parsed)) : 0.1;
  const endpoint = source.endpoint.trim();
  return {
    enabled: source.enabled && endpoint !== '',
    endpoint,
    sampleRatio: ratio,
    serviceName: source.serviceName || 'fatturafacile-web',
    serviceVersion: version,
    apiOrigin: apiOriginOf(apiBaseUrl, pageOrigin),
  };
}
