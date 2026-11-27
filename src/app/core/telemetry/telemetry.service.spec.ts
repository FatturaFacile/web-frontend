import { TestBed } from '@angular/core/testing';
import { NavigationEnd, NavigationStart, Router } from '@angular/router';
import { Subject, firstValueFrom, of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TELEMETRY_CONFIG, TELEMETRY_RUNTIME_LOADER, TelemetryService } from './telemetry.service';
import { SpanAttributeValue, TelemetryConfig, TelemetryRuntime, TelemetrySpan } from './telemetry.types';

interface FakeSpan extends TelemetrySpan {
  name: string;
  attributes: Record<string, SpanAttributeValue>;
  events: { name: string; attributes?: Record<string, SpanAttributeValue> }[];
  error: string | null;
  ended: number;
}

function fakeRuntime() {
  const spans: FakeSpan[] = [];
  let active: FakeSpan | null = null;
  const runtime: TelemetryRuntime = {
    startSpan: (name, attributes = {}) => {
      const span: FakeSpan = {
        name,
        attributes: { ...attributes },
        events: [],
        error: null,
        ended: 0,
        setAttribute: (key, value) => void (span.attributes[key] = value),
        addEvent: (eventName, eventAttributes) => void span.events.push({ name: eventName, attributes: eventAttributes }),
        setError: (message) => void (span.error = message),
        end: () => void span.ended++,
      };
      spans.push(span);
      return span;
    },
    runInSpan: (span, fn) => {
      active = span as FakeSpan;
      try {
        return fn();
      } finally {
        active = null;
      }
    },
    activeSpan: () => active,
    shutdown: vi.fn().mockResolvedValue(undefined),
  };
  return { runtime, spans };
}

const config = (enabled: boolean): TelemetryConfig => ({
  enabled,
  endpoint: 'https://otel.example.com/v1/traces',
  sampleRatio: 1,
  serviceName: 'ff-web',
  serviceVersion: 'test',
  apiOrigin: 'https://api.example.com',
});

function setup(enabled = true, loader?: () => Promise<TelemetryRuntime>) {
  const fake = fakeRuntime();
  const load = vi.fn(loader ?? (() => Promise.resolve(fake.runtime)));
  const events = new Subject<unknown>();
  TestBed.configureTestingModule({
    providers: [
      { provide: TELEMETRY_CONFIG, useValue: config(enabled) },
      { provide: TELEMETRY_RUNTIME_LOADER, useValue: load },
      { provide: Router, useValue: { events } },
    ],
  });
  return { service: TestBed.inject(TelemetryService), fake, load, events };
}

describe('TelemetryService', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('never loads the SDK when telemetry is disabled and runs actions untouched', async () => {
    const { service, load } = setup(false);

    await service.start();

    expect(load).not.toHaveBeenCalled();
    expect(service.active()).toBe(false);
    await expect(service.traceAction('invoice.create', () => 42)).resolves.toBe(42);
    expect(await firstValueFrom(service.traceStream('x', of('ok')))).toBe('ok');
  });

  it('loads the SDK once, becomes active and survives a loading failure', async () => {
    const { service, load } = setup();
    await service.start();
    await service.start();

    expect(load).toHaveBeenCalledTimes(1);
    expect(service.active()).toBe(true);

    TestBed.resetTestingModule();
    const broken = setup(true, () => Promise.reject(new Error('chunk failed')));
    await expect(broken.service.start()).resolves.toBeUndefined();
    expect(broken.service.active()).toBe(false);
  });

  it('traces an action: a span around the call, ended once, errors recorded without a stack', async () => {
    const { service, fake } = setup();
    await service.start();

    await expect(service.traceAction('invoice.pdf', async () => 'pdf', { 'app.size': 1 })).resolves.toBe('pdf');
    const ok = fake.spans.find((span) => span.name === 'action invoice.pdf');
    expect(ok?.attributes).toMatchObject({ 'app.action': 'invoice.pdf', 'app.size': 1 });
    expect(ok?.ended).toBe(1);

    await expect(service.traceAction('invoice.send_sdi', () => Promise.reject(new Error('fail a@b.ch')))).rejects.toThrow();
    const failed = fake.spans.find((span) => span.name === 'action invoice.send_sdi');
    expect(failed?.error).toBe('fail [redacted:email]');
    expect(failed?.ended).toBe(1);
  });

  it('traces an observable request inside the span and ends it on completion or error', async () => {
    const { service, fake } = setup();
    await service.start();

    expect(await firstValueFrom(service.traceStream('invoice.create', of(1)))).toBe(1);
    await expect(firstValueFrom(service.traceStream('invoice.create', throwError(() => new Error('nope'))))).rejects.toThrow('nope');

    const spans = fake.spans.filter((span) => span.name === 'action invoice.create');
    expect(spans).toHaveLength(2);
    expect(spans.map((span) => span.ended)).toEqual([1, 1]);
    expect(spans[1].error).toBe('nope');
  });

  it('records route navigations with a scrubbed route', async () => {
    const { service, fake, events } = setup();
    await service.start();

    events.next(new NavigationStart(1, '/sales/invoices/42'));
    events.next(new NavigationEnd(1, '/sales/invoices/42', '/sales/invoices/42?q=mario'));

    const navigation = fake.spans.find((span) => span.name === 'navigation');
    expect(navigation?.attributes['http.route']).toBe('/sales/invoices/:id');
    expect(navigation?.attributes['navigation.outcome']).toBe('ok');
    expect(navigation?.ended).toBe(1);
  });

  it('puts an unhandled error into the active span, or into a short span of its own', async () => {
    const { service, fake } = setup();
    await service.start();

    service.recordError(new Error('boom IT60X0542811101000000123456'));

    const span = fake.spans.find((candidate) => candidate.name === 'frontend.error');
    expect(span?.events[0].attributes?.['exception.message']).toBe('boom [redacted:iban]');
    expect(span?.error).toBe('boom [redacted:iban]');
    expect(span?.ended).toBe(1);
  });
});
