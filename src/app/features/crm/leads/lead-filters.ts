import { Params } from '@angular/router';
import { LeadFilterParams, LeadRating, LeadSort } from '@core';

const RATINGS: readonly string[] = ['cold', 'warm', 'hot'];
const SORTS: readonly string[] = ['score', '-score', 'created_at'];

function str(v: unknown): string | undefined {
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

/** Reads the lead list filters from the URL query params, ignoring invalid values. */
export function leadFiltersFromQueryParams(q: Params): LeadFilterParams {
  const filters: LeadFilterParams = {};
  const rating = str(q['rating']);
  if (rating && RATINGS.includes(rating)) {
    filters.rating = rating as LeadRating;
  }
  const assignee = str(q['assigned_user_id']);
  if (assignee) {
    filters.assigned_user_id = assignee;
  }
  const source = str(q['source']);
  if (source) {
    filters.source = source;
  }
  const minScore = str(q['min_score']);
  if (minScore !== undefined && /^\d+$/.test(minScore)) {
    filters.min_score = Math.min(100, Number(minScore));
  }
  const sort = str(q['sort']);
  if (sort && SORTS.includes(sort)) {
    filters.sort = sort as LeadSort;
  }
  return filters;
}

/**
 * Serializes filters to query params; cleared filters become `null` so that
 * `queryParamsHandling: 'merge'` removes them from the URL.
 */
export function leadFiltersToQueryParams(f: LeadFilterParams): Params {
  return {
    rating: f.rating ?? null,
    assigned_user_id: f.assigned_user_id || null,
    source: f.source || null,
    min_score: f.min_score ?? null,
    sort: f.sort ?? null,
  };
}
