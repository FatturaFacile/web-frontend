import {
  APPLICATION_STAGE_LABEL_KEYS,
  ApplicationStage,
  CvParseStatus,
  JobOpeningStatus,
  OfferStatus,
} from '@core';

export const stageLabelKey = (stage: ApplicationStage): string =>
  APPLICATION_STAGE_LABEL_KEYS[stage];

export const OPENING_STATUS_COLORS: Record<JobOpeningStatus, string> = {
  draft: 'default',
  published: 'green',
  internal_only: 'blue',
  closed_filled: 'purple',
  cancelled: 'red',
};

export const OFFER_STATUS_COLORS: Record<OfferStatus, string> = {
  draft: 'default',
  sent: 'blue',
  signed: 'green',
  declined: 'red',
  expired: 'orange',
  cancelled: 'default',
};

export const CV_PARSE_ICONS: Record<CvParseStatus, string> = {
  pending: 'fa-solid fa-hourglass-half',
  parsed: 'fa-solid fa-circle-check',
  partial: 'fa-solid fa-circle-half-stroke',
  failed: 'fa-solid fa-triangle-exclamation',
  not_provided: 'fa-regular fa-file',
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `now` until `isoDate` (negative when past), or null. */
export function daysUntil(isoDate: string | null, now: Date): number | null {
  if (!isoDate) {
    return null;
  }
  const target = new Date(isoDate).getTime();
  if (Number.isNaN(target)) {
    return null;
  }
  return Math.ceil((target - now.getTime()) / DAY_MS);
}

/** Today's date as `YYYY-MM-DD` (local time). */
export function todayIso(now: Date): string {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}
