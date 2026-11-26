import { AccrualType, AccrualYearlySlice } from '@core';

export interface CompetencePreviewInput {
  totalAmount: number;
  startDate: string | null | undefined;
  endDate: string | null | undefined;
  documentDate?: string | null;
  direction?: 'cost' | 'revenue';
  explicitType?: AccrualType | null;
  fiscalYearStart?: string | null;
  fiscalYearEnd?: string | null;
}

export interface CompetencePreviewOutput {
  accrualType: AccrualType | null;
  totalDays: number;
  periodDays: number;
  transitoryDays: number;
  recognizedCents: number;
  transitoryCents: number;
  recognizedAmount: number;
  transitoryAmount: number;
  cutoffDate: string;
  reversalDate: string;
  yearlySchedule: AccrualYearlySlice[];
}

export type CompetencePairStatus = 'valid' | 'empty' | 'incomplete' | 'inverted';

const DAY_MS = 86_400_000;

function parseIsoDayUtc(iso: string): number | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso.trim());
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]) - 1;
  const day = Number(match[3]);
  const ms = Date.UTC(year, month, day);
  const check = new Date(ms);
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month ||
    check.getUTCDate() !== day
  ) {
    return null;
  }
  return ms;
}

function formatUtcIso(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

function addDaysUtc(ms: number, days: number): number {
  return ms + days * DAY_MS;
}

export function isValidCompetencePair(
  start: string | null | undefined,
  end: string | null | undefined,
): CompetencePairStatus {
  const hasStart = !!start && start.trim() !== '';
  const hasEnd = !!end && end.trim() !== '';
  if (!hasStart && !hasEnd) {
    return 'empty';
  }
  if (!hasStart || !hasEnd) {
    return 'incomplete';
  }
  const startMs = parseIsoDayUtc(start);
  const endMs = parseIsoDayUtc(end);
  if (startMs === null || endMs === null) {
    return 'incomplete';
  }
  return endMs < startMs ? 'inverted' : 'valid';
}

export function inclusiveCalendarDays(startIso: string, endIso: string): number {
  const startMs = parseIsoDayUtc(startIso);
  const endMs = parseIsoDayUtc(endIso);
  if (startMs === null || endMs === null || endMs < startMs) {
    return 0;
  }
  return Math.floor((endMs - startMs) / DAY_MS) + 1;
}

function overlapDaysUtc(startMs: number, endMs: number, winStartMs: number, winEndMs: number): number {
  const from = Math.max(startMs, winStartMs);
  const to = Math.min(endMs, winEndMs);
  if (to < from) {
    return 0;
  }
  return Math.floor((to - from) / DAY_MS) + 1;
}

function allocateCentsLargestRemainder(totalCents: number, totalDays: number, sliceDays: number[]): number[] {
  if (sliceDays.length === 0 || totalDays <= 0) {
    return sliceDays.map(() => 0);
  }
  const negative = totalCents < 0;
  const absTotal = Math.abs(Math.round(totalCents));

  const floors: number[] = [];
  const remainders: { index: number; numRem: number }[] = [];
  let floorSum = 0;

  for (let i = 0; i < sliceDays.length; i++) {
    const product = absTotal * sliceDays[i];
    const floorPart = Math.floor(product / totalDays);
    const numRem = product % totalDays;
    floors.push(floorPart);
    remainders.push({ index: i, numRem });
    floorSum += floorPart;
  }

  const residual = absTotal - floorSum;
  remainders.sort((a, b) => (b.numRem !== a.numRem ? b.numRem - a.numRem : a.index - b.index));

  for (let i = 0; i < residual && i < remainders.length; i++) {
    floors[remainders[i].index] += 1;
  }

  return negative ? floors.map((c) => -c) : floors;
}

export function presetFullCalendarYear(referenceDateIso?: string | null): { start: string; end: string } {
  const ms = referenceDateIso ? parseIsoDayUtc(referenceDateIso) : null;
  const year = ms !== null ? new Date(ms).getUTCFullYear() : new Date().getFullYear();
  return { start: `${year}-01-01`, end: `${year}-12-31` };
}

export function presetTwelveMonths(startIso?: string | null): { start: string; end: string } {
  const ms = startIso ? parseIsoDayUtc(startIso) : null;
  const base = ms !== null ? new Date(ms) : new Date();
  const y = ms !== null ? base.getUTCFullYear() : base.getFullYear();
  const m = ms !== null ? base.getUTCMonth() : base.getMonth();
  const d = ms !== null ? base.getUTCDate() : base.getDate();

  const startMs = Date.UTC(y, m, d);
  const nextYearMs = Date.UTC(y + 1, m, d);
  const endMs = addDaysUtc(nextYearMs, -1);
  return { start: formatUtcIso(startMs), end: formatUtcIso(endMs) };
}

export function calculateCompetencePreview(input: CompetencePreviewInput): CompetencePreviewOutput | null {
  if (isValidCompetencePair(input.startDate, input.endDate) !== 'valid') {
    return null;
  }
  const startMs = parseIsoDayUtc(input.startDate!)!;
  const endMs = parseIsoDayUtc(input.endDate!)!;
  const totalDays = Math.floor((endMs - startMs) / DAY_MS) + 1;

  const docMs = input.documentDate ? parseIsoDayUtc(input.documentDate) : null;
  const targetYear =
    input.fiscalYearEnd
      ? new Date(parseIsoDayUtc(input.fiscalYearEnd)!).getUTCFullYear()
      : // Without an explicit fiscal year the reference year is the one in which the competence
        // starts, unless the document is dated earlier. A document booked in a later year than
        // the competence start is an accrual (rateo).
        (docMs !== null
          ? Math.min(new Date(docMs).getUTCFullYear(), new Date(startMs).getUTCFullYear())
          : new Date(startMs).getUTCFullYear());

  const fyStartMs = input.fiscalYearStart
    ? (parseIsoDayUtc(input.fiscalYearStart) ?? Date.UTC(targetYear, 0, 1))
    : Date.UTC(targetYear, 0, 1);
  const fyEndMs = input.fiscalYearEnd
    ? (parseIsoDayUtc(input.fiscalYearEnd) ?? Date.UTC(targetYear, 11, 31))
    : Date.UTC(targetYear, 11, 31);

  const periodDays = overlapDaysUtc(startMs, endMs, fyStartMs, fyEndMs);

  let accrualType: AccrualType | null = input.explicitType ?? null;
  if (!accrualType && input.direction) {
    if (docMs !== null && docMs > fyEndMs) {
      if (startMs <= fyEndMs && endMs >= fyStartMs) {
        accrualType = input.direction === 'revenue' ? 'accrued_revenue' : 'accrued_expense';
      }
    } else if (endMs > fyEndMs) {
      accrualType = input.direction === 'cost' ? 'prepaid_expense' : 'deferred_revenue';
    }
  }

  const startYear = new Date(startMs).getUTCFullYear();
  const endYear = new Date(endMs).getUTCFullYear();
  const slicesMeta: { label: string; startDate: string; endDate: string; days: number; isCurrent: boolean; isFuture: boolean }[] = [];

  for (let yr = startYear; yr <= endYear; yr++) {
    const yrStartMs = Date.UTC(yr, 0, 1);
    const yrEndMs = Date.UTC(yr, 11, 31);
    const sMs = Math.max(startMs, yrStartMs);
    const eMs = Math.min(endMs, yrEndMs);
    slicesMeta.push({
      label: String(yr),
      startDate: formatUtcIso(sMs),
      endDate: formatUtcIso(eMs),
      days: Math.floor((eMs - sMs) / DAY_MS) + 1,
      isCurrent: yr === targetYear,
      isFuture: yr > targetYear,
    });
  }

  const totalCents = Math.round(input.totalAmount * 100);
  const allocatedCents = allocateCentsLargestRemainder(
    totalCents,
    totalDays,
    slicesMeta.map((s) => s.days),
  );

  let recognizedCents = 0;
  let futureCents = 0;
  let futureDays = 0;

  const yearlySchedule: AccrualYearlySlice[] = slicesMeta.map((slice, idx) => {
    const cents = allocatedCents[idx] ?? 0;
    if (slice.isCurrent) {
      recognizedCents += cents;
    } else if (slice.isFuture) {
      futureCents += cents;
      futureDays += slice.days;
    }
    return {
      label: slice.label,
      start_date: slice.startDate,
      end_date: slice.endDate,
      days: slice.days,
      amount: (cents / 100).toFixed(2),
      is_current_year: slice.isCurrent,
      is_future: slice.isFuture,
    };
  });

  let transitoryDays = 0;
  let transitoryCents = 0;
  if (accrualType === 'accrued_revenue' || accrualType === 'accrued_expense') {
    transitoryDays = periodDays;
    transitoryCents = recognizedCents;
  } else if (accrualType === 'prepaid_expense' || accrualType === 'deferred_revenue') {
    transitoryDays = futureDays;
    transitoryCents = futureCents;
  }

  return {
    accrualType,
    totalDays,
    periodDays,
    transitoryDays,
    recognizedCents,
    transitoryCents,
    recognizedAmount: recognizedCents / 100,
    transitoryAmount: transitoryCents / 100,
    cutoffDate: formatUtcIso(fyEndMs),
    reversalDate: formatUtcIso(addDaysUtc(fyEndMs, 1)),
    yearlySchedule,
  };
}
