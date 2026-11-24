import {
  CountAbcClass,
  CountApprovalStatus,
  CountSessionStatus,
  CountType,
  CycleCadence,
  VarianceLine,
} from '@core';

export const COUNT_STATUS_LABELS: Record<CountSessionStatus, { key: string; color: string }> = {
  in_progress: { key: 'INVENTORY_COUNT.SESSION.STATUS_IN_PROGRESS', color: 'processing' },
  pending_approval: { key: 'INVENTORY_COUNT.SESSION.STATUS_PENDING_APPROVAL', color: 'warning' },
  reconciled: { key: 'INVENTORY_COUNT.SESSION.STATUS_RECONCILED', color: 'success' },
  cancelled: { key: 'INVENTORY_COUNT.SESSION.STATUS_CANCELLED', color: 'default' },
};

export const COUNT_TYPE_LABELS: Record<CountType, string> = {
  full_physical: 'INVENTORY_COUNT.SESSION.TYPE_FULL',
  cycle_count_abc: 'INVENTORY_COUNT.SESSION.TYPE_CYCLE',
  spot_check: 'INVENTORY_COUNT.SESSION.TYPE_SPOT',
  zone_sweep: 'INVENTORY_COUNT.SESSION.TYPE_ZONE',
};

export const CADENCE_LABELS: Record<CycleCadence, string> = {
  monthly: 'INVENTORY_COUNT.PLAN.CADENCE_MONTHLY',
  quarterly: 'INVENTORY_COUNT.PLAN.CADENCE_QUARTERLY',
  semi_annual: 'INVENTORY_COUNT.PLAN.CADENCE_SEMI_ANNUAL',
  annual: 'INVENTORY_COUNT.PLAN.CADENCE_ANNUAL',
  custom: 'INVENTORY_COUNT.PLAN.CADENCE_CUSTOM',
};

export const ABC_CLASS_COLORS: Record<CountAbcClass, string> = { A: 'red', B: 'gold', C: 'green' };

export const APPROVAL_STATUS_LABELS: Record<CountApprovalStatus, { key: string; color: string }> = {
  pending: { key: 'INVENTORY_COUNT.RECON.PENDING', color: 'warning' },
  approved: { key: 'INVENTORY_COUNT.RECON.APPROVED', color: 'success' },
  rejected: { key: 'INVENTORY_COUNT.RECON.REJECTED', color: 'error' },
  cancelled: { key: 'INVENTORY_COUNT.SESSION.STATUS_CANCELLED', color: 'default' },
};

export const APPROVAL_LEVEL_LABELS: Record<1 | 2, string> = {
  1: 'INVENTORY_COUNT.RECON.LEVEL1',
  2: 'INVENTORY_COUNT.RECON.LEVEL2',
};

/** Numeric value of a decimal that the API may send as number or string. */
export function toNumber(value: number | string | null | undefined): number {
  const n = typeof value === 'number' ? value : Number.parseFloat(value ?? '');
  return Number.isFinite(n) ? n : 0;
}

/** Blank form values mean "not set" for nullable numeric policy fields. */
export function nullableNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Lines of the workbench that can be sent back for a recount (counted and not already pending). */
export function recountableLines(lines: readonly VarianceLine[]): VarianceLine[] {
  return lines.filter((l) => l.is_counted && !l.recount_required);
}

/** A level is decidable only while pending and when every lower level is already approved. */
export function decidableLevels(
  approvals: readonly { level: number; status: CountApprovalStatus }[],
): Set<number> {
  const sorted = [...approvals].sort((a, b) => a.level - b.level);
  const result = new Set<number>();
  for (const approval of sorted) {
    if (approval.status === 'pending') {
      result.add(approval.level);
      break;
    }
    if (approval.status !== 'approved') {
      break;
    }
  }
  return result;
}

/** Index of the `nz-steps` current step: the first non-approved level. */
export function currentStepIndex(approvals: readonly { status: CountApprovalStatus }[]): number {
  const idx = approvals.findIndex((a) => a.status !== 'approved');
  return idx === -1 ? Math.max(approvals.length - 1, 0) : idx;
}

export function stepStatus(status: CountApprovalStatus): 'wait' | 'process' | 'finish' | 'error' {
  switch (status) {
    case 'approved':
      return 'finish';
    case 'rejected':
      return 'error';
    case 'pending':
      return 'process';
    default:
      return 'wait';
  }
}
