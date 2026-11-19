import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PgDsar } from '@core';
import { pollDsarPackage } from './dsar-package-poll';
import {
  breachRequiredFields,
  consentOptInRate,
  createBreachCountdown,
  crossBorderKinds,
  dsarCountdown,
  dsarDaysLeft,
  dsarElapsedPercent,
  dsarIsUrgent,
  dsarProgressStatus,
  formatCountdown,
  secondsUntil,
} from './privacy-governance.helpers';

const DAY = 86_400_000;
const received = '2027-03-01T00:00:00.000Z';
const deadline = '2027-03-31T00:00:00.000Z';

describe('DSAR 30 day countdown', () => {
  it('computes the whole days left and the elapsed percentage of the window', () => {
    const now = Date.parse(received) + 6 * DAY;
    expect(dsarDaysLeft(deadline, now)).toBe(24);
    expect(dsarElapsedPercent(received, deadline, now)).toBe(20);
    expect(dsarElapsedPercent(received, deadline, Date.parse(received))).toBe(0);
    expect(dsarElapsedPercent(received, deadline, Date.parse(deadline))).toBe(100);
  });

  it('clamps the percentage and reports overdue requests with negative days', () => {
    const late = Date.parse(deadline) + 2 * DAY;
    expect(dsarElapsedPercent(received, deadline, late)).toBe(100);
    expect(dsarElapsedPercent(received, deadline, Date.parse(received) - DAY)).toBe(0);
    expect(dsarDaysLeft(deadline, late)).toBe(-2);
  });

  it('marks a request urgent below five days and colours the bar', () => {
    expect(dsarIsUrgent(4)).toBe(true);
    expect(dsarIsUrgent(5)).toBe(false);
    expect(dsarIsUrgent(-1)).toBe(true);
    expect(dsarIsUrgent(null)).toBe(false);
    expect(dsarProgressStatus(3)).toBe('exception');
    expect(dsarProgressStatus(20)).toBe('active');
    expect(dsarProgressStatus(null)).toBe('success');
  });

  it('has no countdown for a closed request and prefers the server figure for an open one', () => {
    const base: Pick<PgDsar, 'status' | 'statutory_deadline_at' | 'days_remaining'> = {
      status: 'open',
      statutory_deadline_at: deadline,
      days_remaining: 7,
    };
    expect(dsarCountdown(base, Date.parse(received))).toBe(7);
    expect(dsarCountdown({ ...base, days_remaining: null }, Date.parse(received))).toBe(30);
    expect(dsarCountdown({ ...base, status: 'completed' })).toBeNull();
    expect(dsarCountdown({ ...base, status: 'partially_refused_fiscal_retention' })).toBeNull();
  });
});

describe('formatting and small helpers', () => {
  it('formats seconds as HH:MM:SS and never goes negative', () => {
    expect(formatCountdown(72 * 3600)).toBe('72:00:00');
    expect(formatCountdown(3661)).toBe('01:01:01');
    expect(formatCountdown(-5)).toBe('00:00:00');
  });

  it('computes the consent opt-in rate', () => {
    expect(consentOptInRate([])).toBeNull();
    expect(
      consentOptInRate([
        { consent_granted: true },
        { consent_granted: false },
        { consent_granted: true },
      ]),
    ).toBe(66.7);
  });

  it('classifies cross-border destinations', () => {
    expect(
      crossBorderKinds([
        { country_code: 'us', adequacy_decision: false, safeguard_mechanism: 'SCC' },
        { country_code: 'IT', adequacy_decision: true, safeguard_mechanism: null },
        { country_code: 'CH', adequacy_decision: true, safeguard_mechanism: null },
      ]),
    ).toEqual(['ch', 'eu', 'third']);
    expect(crossBorderKinds([])).toEqual([]);
  });

  it('adapts the mandatory breach fields to the jurisdiction', () => {
    expect(breachRequiredFields('ch_nlpd_fdpic')).not.toContain('affected_subjects_count');
    expect(breachRequiredFields('it_gdpr_garante')).toContain('affected_subjects_count');
    expect(breachRequiredFields('both_ch_it')).toContain('remediation_plan');
  });
});

describe('72 hours breach timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2027-05-01T10:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
    TestBed.resetTestingModule();
  });

  it('ticks every second and flags the deadline as overdue', () => {
    const deadlineIso = new Date(Date.now() + 72 * 3600 * 1000).toISOString();
    const deadlineSignal = signal<string | null>(deadlineIso);
    const countdown = TestBed.runInInjectionContext(() => createBreachCountdown(deadlineSignal));

    expect(countdown.label()).toBe('72:00:00');
    expect(countdown.overdue()).toBe(false);

    vi.advanceTimersByTime(1000);
    expect(countdown.label()).toBe('71:59:59');

    vi.advanceTimersByTime(3600 * 1000);
    expect(countdown.label()).toBe('70:59:59');

    vi.advanceTimersByTime(71 * 3600 * 1000);
    expect(countdown.seconds()).toBeLessThan(0);
    expect(countdown.label()).toBe('00:00:00');
    expect(countdown.overdue()).toBe(true);
  });

  it('follows a changed deadline and stops ticking once destroyed', () => {
    const deadlineSignal = signal<string | null>(null);
    const countdown = TestBed.runInInjectionContext(() => createBreachCountdown(deadlineSignal));
    expect(countdown.label()).toBe('00:00:00');
    expect(countdown.overdue()).toBe(false);

    deadlineSignal.set(new Date(Date.now() + 90 * 1000).toISOString());
    expect(countdown.label()).toBe('00:01:30');

    const clear = vi.spyOn(globalThis, 'clearInterval');
    TestBed.resetTestingModule();
    expect(clear).toHaveBeenCalled();
    expect(secondsUntil(new Date(Date.now() + 5000).toISOString())).toBe(5);
  });
});

describe('portability package polling', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('polls until the package is ready and then completes', () => {
    const states = ['queued', 'processing', 'ready', 'ready'] as const;
    let call = 0;
    const fetch = vi.fn(() => of({ data: { package_status: states[call++] } as PgDsar }));
    const seen: (string | null)[] = [];
    let completed = false;

    pollDsarPackage(fetch, 2000).subscribe({
      next: (dsar) => seen.push(dsar.package_status),
      complete: () => (completed = true),
    });

    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(2000);
    expect(completed).toBe(false);
    vi.advanceTimersByTime(2000);
    vi.advanceTimersByTime(10_000);

    expect(seen).toEqual(['queued', 'processing', 'ready']);
    expect(completed).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(3);
  });
});
