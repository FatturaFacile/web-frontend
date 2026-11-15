import { HttpErrorResponse } from '@angular/common/http';
import { CommunicationCampaignStatus, CommunicationConversationStatus } from '@core';

/** First validation message of a Laravel 422 (or its summary message), so the user sees the real reason. */
export function apiErrorText(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body = error.error as { message?: unknown; errors?: Record<string, unknown> } | null;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }

  return typeof body?.message === 'string' && body.message !== '' ? body.message : null;
}

export const CONVERSATION_STATUSES: readonly CommunicationConversationStatus[] = ['open', 'pending', 'resolved', 'closed'];

export const CONVERSATION_STATUS_COLORS: Record<CommunicationConversationStatus, string> = {
  open: 'blue',
  pending: 'orange',
  resolved: 'green',
  closed: 'default',
};

export const CAMPAIGN_STATUS_COLORS: Record<CommunicationCampaignStatus, string> = {
  draft: 'default',
  scheduled: 'blue',
  sending: 'orange',
  completed: 'green',
  cancelled: 'red',
};

/** A campaign can still be edited, sent or scheduled only before it starts. */
export function isCampaignOpen(status: CommunicationCampaignStatus): boolean {
  return status === 'draft' || status === 'scheduled';
}

/** `datetime-local` input value (browser time zone) to the ISO 8601 instant the API expects. */
export function localDateTimeToIso(value: string): string {
  return new Date(value).toISOString();
}
