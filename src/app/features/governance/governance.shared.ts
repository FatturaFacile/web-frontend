import {
  GovActionStatus,
  GovAuditPlanStatus,
  GovAuditStatus,
  GovControlStatus,
  GovFindingStatus,
  GovHeatmapCell,
  GovObligationStatus,
  GovRating,
  GovRiskStatus,
  GovSeverity,
  GovTestResult,
} from '@core';

/** A select option whose label is a translation key. */
export interface GovOption<T extends string = string> {
  readonly value: T;
  readonly labelKey: string;
}

/** Builds the options of an enum: the label key is `<prefix>.<VALUE>` in upper case. */
export function govOptions<T extends string>(prefix: string, values: readonly T[]): GovOption<T>[] {
  return values.map((value) => ({ value, labelKey: `${prefix}.${value.toUpperCase()}` }));
}

export const GOV_RISK_CATEGORIES = [
  'strategic',
  'operational',
  'financial',
  'compliance',
  'it_security',
  'legal',
  'reputational',
  'environmental',
] as const;
export const GOV_TREATMENTS = ['mitigate', 'accept', 'transfer', 'avoid'] as const;
export const GOV_CONTROL_TYPES = ['preventive', 'detective', 'corrective'] as const;
export const GOV_FREQUENCIES = ['continuous', 'daily', 'weekly', 'monthly', 'quarterly', 'annual', 'ad_hoc'] as const;
export const GOV_TEST_RESULTS = ['pass', 'partial', 'fail'] as const;
export const GOV_AUDIT_TYPES = ['process', 'compliance', 'it', 'financial', 'follow_up'] as const;
export const GOV_SEVERITIES = ['low', 'medium', 'high', 'critical'] as const;
export const GOV_FINDING_SOURCES = ['audit', 'control_test', 'self_assessment', 'external'] as const;
export const GOV_FRAMEWORKS = ['d_lgs_231', 'gdpr', 'nis2', 'fadp', 'iso_27001', 'other'] as const;
export const GOV_JURISDICTIONS = ['IT', 'CH', 'EU', 'INT'] as const;
export const GOV_RECURRENCES = ['once', 'monthly', 'quarterly', 'semiannual', 'annual'] as const;

/** Status changes the screens offer, mirroring the state machines of the API (the API stays the authority). */
export const GOV_RISK_TRANSITIONS: Readonly<Record<GovRiskStatus, readonly GovRiskStatus[]>> = {
  identified: ['assessed', 'closed'],
  assessed: ['treating', 'accepted', 'closed'],
  treating: ['assessed', 'accepted', 'closed'],
  accepted: ['treating', 'closed'],
  closed: ['assessed'],
};

export const GOV_CONTROL_TRANSITIONS: Readonly<Record<GovControlStatus, readonly GovControlStatus[]>> = {
  draft: ['active', 'retired'],
  active: ['retired'],
  retired: ['active'],
};

export const GOV_AUDIT_PLAN_TRANSITIONS: Readonly<Record<GovAuditPlanStatus, readonly GovAuditPlanStatus[]>> = {
  draft: ['approved'],
  approved: ['closed'],
  closed: [],
};

export const GOV_AUDIT_TRANSITIONS: Readonly<Record<GovAuditStatus, readonly GovAuditStatus[]>> = {
  planned: ['in_progress', 'cancelled'],
  in_progress: ['reporting', 'cancelled'],
  reporting: ['closed', 'in_progress'],
  closed: [],
  cancelled: [],
};

/** Manual changes of a finding: remediation and resolved follow its actions on their own. */
export const GOV_FINDING_TRANSITIONS: Readonly<Record<GovFindingStatus, readonly GovFindingStatus[]>> = {
  open: ['risk_accepted'],
  remediation: ['risk_accepted'],
  resolved: ['closed'],
  closed: ['open'],
  risk_accepted: ['open', 'closed'],
};

export const GOV_ACTION_TRANSITIONS: Readonly<Record<GovActionStatus, readonly GovActionStatus[]>> = {
  open: ['in_progress', 'completed', 'cancelled'],
  in_progress: ['completed', 'cancelled'],
  completed: ['verified', 'in_progress'],
  verified: [],
  cancelled: [],
};

export const GOV_OBLIGATION_TRANSITIONS: Readonly<Record<GovObligationStatus, readonly GovObligationStatus[]>> = {
  pending: ['in_progress', 'cancelled'],
  in_progress: ['pending', 'cancelled'],
  completed: [],
  cancelled: ['pending'],
};

/** Statuses whose change needs the notes (a justification, a reason, a conclusion or closure notes). */
export const GOV_NOTES_REQUIRED: Readonly<Record<string, readonly string[]>> = {
  risk: ['accepted'],
  audit: ['cancelled', 'closed'],
  finding: ['risk_accepted', 'closed'],
  action: ['cancelled'],
  obligation: [],
};

export function govRatingColor(rating: GovRating | null | undefined): string {
  switch (rating) {
    case 'critical':
      return 'red';
    case 'high':
      return 'orange';
    case 'medium':
      return 'gold';
    case 'low':
      return 'green';
    default:
      return 'default';
  }
}

export function govSeverityColor(severity: GovSeverity): string {
  return govRatingColor(severity);
}

export function govStatusColor(status: string): string {
  switch (status) {
    case 'closed':
    case 'verified':
    case 'completed':
    case 'approved':
    case 'active':
    case 'resolved':
      return 'green';
    case 'cancelled':
    case 'retired':
      return 'default';
    case 'in_progress':
    case 'remediation':
    case 'treating':
    case 'reporting':
      return 'blue';
    case 'risk_accepted':
    case 'accepted':
      return 'purple';
    default:
      return 'gold';
  }
}

export function govTestResultColor(result: GovTestResult | null | undefined): string {
  switch (result) {
    case 'pass':
      return 'green';
    case 'partial':
      return 'orange';
    case 'fail':
      return 'red';
    default:
      return 'default';
  }
}

/** Rows of the heatmap, likelihood 5 on top to 1 at the bottom, each with impact 1 to 5 from the left. */
export function govHeatmapRows(cells: readonly GovHeatmapCell[]): GovHeatmapCell[][] {
  const rows: GovHeatmapCell[][] = [];
  for (let likelihood = 5; likelihood >= 1; likelihood--) {
    rows.push(
      cells.filter((cell) => cell.likelihood === likelihood).sort((first, second) => first.impact - second.impact),
    );
  }
  return rows;
}

/** Rating of a likelihood x impact score, the same bands as the API: 1-4 low, 5-9 medium, 10-14 high, 15-25 critical. */
export function govRatingOfScore(score: number): GovRating {
  if (score >= 15) {
    return 'critical';
  }
  if (score >= 10) {
    return 'high';
  }
  return score >= 5 ? 'medium' : 'low';
}

/** Today as `Y-m-d`, the format of the date fields of the API. */
export function govToday(): string {
  const now = new Date();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

/** Date field value of a form: the `Y-m-d` text, or null when empty. */
export function govDateOrNull(value: string | null | undefined): string | null {
  return value ? value : null;
}
