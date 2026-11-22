import { DestroyRef, inject, Service, signal } from '@angular/core';
import { SlaTargetKind } from '@core';

/** What is left (or how late) a due date is, split in units the translations render. */
export interface CountdownParts {
  overdue: boolean;
  days: number;
  hours: number;
  minutes: number;
}

export type RiskLevel = 'ok' | 'warning' | 'critical';

export const TARGET_LABEL_KEYS: Record<SlaTargetKind, string> = {
  response: 'HELPDESK_SLA.TARGET_RESPONSE',
  next_update: 'HELPDESK_SLA.TARGET_NEXT_UPDATE',
  resolution: 'HELPDESK_SLA.TARGET_RESOLUTION',
};

/** Parts of the distance between `now` and `dueAt` (epoch milliseconds); null without a due date. */
export function countdownParts(
  dueAt: string | null | undefined,
  now: number,
): CountdownParts | null {
  if (!dueAt) {
    return null;
  }
  const due = Date.parse(dueAt);
  if (Number.isNaN(due)) {
    return null;
  }

  const diff = due - now;
  const totalMinutes = Math.floor(Math.abs(diff) / 60_000);

  return {
    overdue: diff < 0,
    days: Math.floor(totalMinutes / 1440),
    hours: Math.floor((totalMinutes % 1440) / 60),
    minutes: totalMinutes % 60,
  };
}

/** Translation key of the compact duration for the parts (`{d}`, `{h}`, `{m}` placeholders). */
export function durationKey(parts: CountdownParts): string {
  if (parts.days > 0) {
    return 'HELPDESK_SLA.TIME_DAYS';
  }
  if (parts.hours > 0) {
    return 'HELPDESK_SLA.TIME_HOURS';
  }
  if (parts.minutes > 0) {
    return 'HELPDESK_SLA.TIME_MINUTES';
  }
  return 'HELPDESK_SLA.TIME_LESS_THAN_MINUTE';
}

/** Share of the time spent against the whole target, from the moment it started to the due date. */
export function elapsedPercent(
  startedAt: string | null | undefined,
  dueAt: string | null | undefined,
  now: number,
): number | null {
  if (!startedAt || !dueAt) {
    return null;
  }
  const start = Date.parse(startedAt);
  const due = Date.parse(dueAt);
  if (Number.isNaN(start) || Number.isNaN(due) || due <= start) {
    return null;
  }
  return Math.max(0, Math.round(((now - start) / (due - start)) * 100));
}

export function riskLevel(percent: number): RiskLevel {
  if (percent >= 100) {
    return 'critical';
  }
  return percent >= 75 ? 'warning' : 'ok';
}

/** Colour of the NG-ZORRO tag for a risk level. */
export function riskColor(level: RiskLevel): string {
  return level === 'critical' ? 'error' : level === 'warning' ? 'warning' : 'success';
}

/** One shared tick for every countdown on screen: the signal moves every 15 seconds, so a table of tickets runs one timer. */
@Service()
export class SlaClock {
  readonly now = signal(Date.now());

  constructor() {
    const timer = setInterval(() => this.now.set(Date.now()), 15_000);
    inject(DestroyRef).onDestroy(() => clearInterval(timer));
  }
}
