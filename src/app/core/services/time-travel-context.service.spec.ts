import { TestBed } from '@angular/core/testing';
import { beforeEach, describe, expect, it } from 'vitest';
import { TIME_TRAVEL_QUERY_KEYS, TimeTravelContextService } from './time-travel-context.service';

const params = (values: Record<string, string>) => ({ get: (name: string) => values[name] ?? null });

describe('TimeTravelContextService', () => {
  let service: TimeTravelContextService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(TimeTravelContextService);
  });

  it('starts on live data', () => {
    expect(service.isActive()).toBe(false);
    expect(service.isDiffMode()).toBe(false);
    expect(service.validAt()).toBeNull();
    expect(service.knownAt()).toBeNull();
    expect(service.comparisonKnownAt()).toBeNull();
    expect(service.isReady()).toBe(false);
  });

  it('activates with the given coordinate', () => {
    const validAt = new Date('2025-12-31T23:59:59Z');
    const knownAt = new Date('2026-01-15T10:00:00Z');

    service.activate(validAt, knownAt);

    expect(service.isActive()).toBe(true);
    expect(service.isReady()).toBe(true);
    expect(service.validAtIso()).toBe(validAt.toISOString());
    expect(service.knownAtIso()).toBe(knownAt.toISOString());
  });

  it('defaults an incomplete coordinate to now', () => {
    service.activate();

    expect(service.validAt()).toBeInstanceOf(Date);
    expect(service.knownAt()).toBeInstanceOf(Date);
  });

  it('enters the diff mode with a comparison instant and leaves it again', () => {
    const comparison = new Date('2026-03-31T00:00:00Z');
    service.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T00:00:00Z'));

    service.enableDiff(comparison);

    expect(service.isDiffMode()).toBe(true);
    expect(service.comparisonKnownAtIso()).toBe(comparison.toISOString());
    expect(service.diffRangeValid()).toBe(true);

    service.disableDiff();

    expect(service.isDiffMode()).toBe(false);
    expect(service.isActive()).toBe(true);
  });

  it('flags a comparison that precedes the starting instant', () => {
    service.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-03-31T00:00:00Z'));
    service.enableDiff(new Date('2026-01-15T00:00:00Z'));

    expect(service.diffRangeValid()).toBe(false);
  });

  it('reverts to the live state on reset', () => {
    service.activate(new Date('2025-12-31T23:59:59Z'), new Date('2026-01-15T00:00:00Z'));
    service.enableDiff(new Date('2026-03-31T00:00:00Z'));

    service.reset();

    expect(service.isActive()).toBe(false);
    expect(service.isDiffMode()).toBe(false);
    expect(service.validAt()).toBeNull();
    expect(service.knownAt()).toBeNull();
    expect(service.comparisonKnownAt()).toBeNull();
  });

  it('serialises the coordinate as query parameters and clears them on reset', () => {
    const validAt = new Date('2025-12-31T23:59:59Z');
    const knownAt = new Date('2026-01-15T10:00:00Z');
    service.activate(validAt, knownAt);

    expect(service.toQueryParams()).toEqual({
      [TIME_TRAVEL_QUERY_KEYS.validAt]: validAt.toISOString(),
      [TIME_TRAVEL_QUERY_KEYS.knownAt]: knownAt.toISOString(),
      [TIME_TRAVEL_QUERY_KEYS.comparisonKnownAt]: null,
    });

    service.reset();

    expect(service.toQueryParams()).toEqual({
      [TIME_TRAVEL_QUERY_KEYS.validAt]: null,
      [TIME_TRAVEL_QUERY_KEYS.knownAt]: null,
      [TIME_TRAVEL_QUERY_KEYS.comparisonKnownAt]: null,
    });
  });

  it('restores the coordinate from a shared URL', () => {
    const restored = service.restoreFromQueryParams(
      params({
        [TIME_TRAVEL_QUERY_KEYS.validAt]: '2025-12-31T23:59:59.000Z',
        [TIME_TRAVEL_QUERY_KEYS.knownAt]: '2026-01-15T10:00:00.000Z',
        [TIME_TRAVEL_QUERY_KEYS.comparisonKnownAt]: '2026-03-31T10:00:00.000Z',
      }),
    );

    expect(restored).toBe(true);
    expect(service.isActive()).toBe(true);
    expect(service.isDiffMode()).toBe(true);
    expect(service.comparisonKnownAtIso()).toBe('2026-03-31T10:00:00.000Z');
  });

  it('ignores an incomplete or invalid URL', () => {
    expect(service.restoreFromQueryParams(params({ [TIME_TRAVEL_QUERY_KEYS.validAt]: '2025-12-31T00:00:00Z' }))).toBe(false);
    expect(
      service.restoreFromQueryParams(
        params({ [TIME_TRAVEL_QUERY_KEYS.validAt]: 'not a date', [TIME_TRAVEL_QUERY_KEYS.knownAt]: 'nope' }),
      ),
    ).toBe(false);
    expect(service.isActive()).toBe(false);
  });
});
