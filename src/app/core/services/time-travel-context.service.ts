import { computed, Service, signal } from '@angular/core';

/** Query parameters that carry the time-travel coordinate in a shareable URL. */
export const TIME_TRAVEL_QUERY_KEYS = {
  validAt: 'tt_valid_at',
  knownAt: 'tt_known_at',
  comparisonKnownAt: 'tt_compare_known_at',
} as const;

function parseDate(value: string | null | undefined): Date | null {
  if (!value) {
    return null;
  }
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Global bi-temporal coordinate of the session (Mod 354): `validAt` is the economic date (competenza) and `knownAt` the instant the
 * state must have been recorded by. While active, the accounting and warehouse views ask the time-travel endpoints instead of the
 * live tables; `reset()` returns them to the live state. In diff mode the second known-at is compared with the first.
 */
@Service()
export class TimeTravelContextService {
  private readonly active = signal(false);
  private readonly valid = signal<Date | null>(null);
  private readonly known = signal<Date | null>(null);
  private readonly comparison = signal<Date | null>(null);
  private readonly diff = signal(false);

  readonly isActive = this.active.asReadonly();
  readonly validAt = this.valid.asReadonly();
  readonly knownAt = this.known.asReadonly();
  readonly comparisonKnownAt = this.comparison.asReadonly();
  readonly isDiffMode = computed(() => this.active() && this.diff() && this.comparison() !== null);

  readonly validAtIso = computed(() => this.valid()?.toISOString() ?? null);
  readonly knownAtIso = computed(() => this.known()?.toISOString() ?? null);
  readonly comparisonKnownAtIso = computed(() => this.comparison()?.toISOString() ?? null);

  /** The coordinate is complete (both dates chosen), so a time-travel request can be made. */
  readonly isReady = computed(() => this.active() && this.valid() !== null && this.known() !== null);

  /** Valid when the record is known no later than it is valid for the comparison: `known_at_from` precedes `known_at_to`. */
  readonly diffRangeValid = computed(() => {
    const from = this.known();
    const to = this.comparison();
    return from !== null && to !== null && from.getTime() <= to.getTime();
  });

  activate(validAt: Date | null = null, knownAt: Date | null = null): void {
    this.active.set(true);
    this.valid.set(validAt ?? this.valid() ?? new Date());
    this.known.set(knownAt ?? this.known() ?? new Date());
  }

  setValidAt(value: Date | null): void {
    this.valid.set(value);
  }

  setKnownAt(value: Date | null): void {
    this.known.set(value);
  }

  setComparisonKnownAt(value: Date | null): void {
    this.comparison.set(value);
  }

  /** Opens the cut-off diff: `known_at` against the comparison instant (today when none was chosen). */
  enableDiff(comparisonKnownAt: Date | null = null): void {
    this.activate();
    this.comparison.set(comparisonKnownAt ?? this.comparison() ?? new Date());
    this.diff.set(true);
  }

  disableDiff(): void {
    this.diff.set(false);
  }

  /** Back to the live state. */
  reset(): void {
    this.active.set(false);
    this.diff.set(false);
    this.valid.set(null);
    this.known.set(null);
    this.comparison.set(null);
  }

  /** The coordinate as query parameters; empty while the mode is off, so that a reset clears them from the URL. */
  toQueryParams(): Record<string, string | null> {
    if (!this.active()) {
      return {
        [TIME_TRAVEL_QUERY_KEYS.validAt]: null,
        [TIME_TRAVEL_QUERY_KEYS.knownAt]: null,
        [TIME_TRAVEL_QUERY_KEYS.comparisonKnownAt]: null,
      };
    }
    return {
      [TIME_TRAVEL_QUERY_KEYS.validAt]: this.validAtIso(),
      [TIME_TRAVEL_QUERY_KEYS.knownAt]: this.knownAtIso(),
      [TIME_TRAVEL_QUERY_KEYS.comparisonKnownAt]: this.diff() ? this.comparisonKnownAtIso() : null,
    };
  }

  /** Restores the coordinate from a URL; returns whether the URL carried a complete one. */
  restoreFromQueryParams(params: { get(name: string): string | null }): boolean {
    const validAt = parseDate(params.get(TIME_TRAVEL_QUERY_KEYS.validAt));
    const knownAt = parseDate(params.get(TIME_TRAVEL_QUERY_KEYS.knownAt));
    if (!validAt || !knownAt) {
      return false;
    }
    const comparison = parseDate(params.get(TIME_TRAVEL_QUERY_KEYS.comparisonKnownAt));
    this.active.set(true);
    this.valid.set(validAt);
    this.known.set(knownAt);
    this.comparison.set(comparison);
    this.diff.set(comparison !== null);
    return true;
  }
}
