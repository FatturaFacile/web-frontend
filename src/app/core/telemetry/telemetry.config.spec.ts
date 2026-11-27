import { describe, expect, it } from 'vitest';
import { apiOriginOf, resolveTelemetryConfig } from './telemetry.config';

const source = (overrides: Partial<{ enabled: boolean; endpoint: string; sampleRatio: string; serviceName: string }> = {}) => ({
  enabled: true,
  endpoint: 'https://otel.example.com/v1/traces',
  sampleRatio: '0.25',
  serviceName: 'ff-web',
  ...overrides,
});

describe('telemetry config', () => {
  it('is off unless enabled AND an endpoint is given', () => {
    expect(resolveTelemetryConfig(source({ enabled: false })).enabled).toBe(false);
    expect(resolveTelemetryConfig(source({ endpoint: '  ' })).enabled).toBe(false);
    expect(resolveTelemetryConfig(source()).enabled).toBe(true);
  });

  it('clamps the sampling ratio to 0..1 and defaults to 0.1', () => {
    expect(resolveTelemetryConfig(source({ sampleRatio: '5' })).sampleRatio).toBe(1);
    expect(resolveTelemetryConfig(source({ sampleRatio: '-1' })).sampleRatio).toBe(0);
    expect(resolveTelemetryConfig(source({ sampleRatio: 'abc' })).sampleRatio).toBe(0.1);
  });

  it('takes the API origin from the base URL, or the page origin for a relative one', () => {
    expect(apiOriginOf('/api/v1', 'https://app.example.com')).toBe('https://app.example.com');
    expect(apiOriginOf('https://api.example.com/api/v1', 'https://app.example.com')).toBe('https://api.example.com');
    expect(resolveTelemetryConfig(source(), 'https://api.example.com/api/v1', 'https://app.example.com', '1.2.3')).toMatchObject({
      apiOrigin: 'https://api.example.com',
      serviceVersion: '1.2.3',
      serviceName: 'ff-web',
    });
  });
});
