import { HttpErrorResponse } from '@angular/common/http';
import {
  MrpCapacityMode,
  MrpDemandSourceType,
  MrpExceptionCode,
  MrpProposal,
  MrpProposalAction,
  MrpProposalStatus,
  MrpProposalType,
  MrpRunMode,
  MrpRunStatus,
  MrpSchedulingDirection,
} from './mrp.models';

/** Translation keys per enum value; the texts live in the backend seeder (MrpPlanningFrontendTranslations). */
export const PROPOSAL_TYPE_KEYS: Record<MrpProposalType, string> = {
  PlannedPurchaseRequisition: 'MRP.TYPE_PURCHASE_REQUISITION',
  PlannedProductionOrder: 'MRP.TYPE_PRODUCTION_ORDER',
  PlannedSubcontractOrder: 'MRP.TYPE_SUBCONTRACT_ORDER',
  RescheduleIn_Expedite: 'MRP.TYPE_RESCHEDULE_IN',
  RescheduleOut_Defer: 'MRP.TYPE_RESCHEDULE_OUT',
  CancelExcessOrder: 'MRP.TYPE_CANCEL_EXCESS',
};

export const PROPOSAL_TYPE_COLORS: Record<MrpProposalType, string> = {
  PlannedPurchaseRequisition: 'blue',
  PlannedProductionOrder: 'green',
  PlannedSubcontractOrder: 'cyan',
  RescheduleIn_Expedite: 'orange',
  RescheduleOut_Defer: 'gold',
  CancelExcessOrder: 'red',
};

export const PROPOSAL_STATUS_KEYS: Record<MrpProposalStatus, string> = {
  Proposed: 'MRP.STATUS_PROPOSED',
  Firm: 'MRP.STATUS_FIRM',
  Released: 'MRP.STATUS_RELEASED',
  Dismissed: 'MRP.STATUS_DISMISSED',
};

export const PROPOSAL_STATUS_COLORS: Record<MrpProposalStatus, string> = {
  Proposed: 'default',
  Firm: 'processing',
  Released: 'success',
  Dismissed: 'default',
};

export const RUN_STATUS_KEYS: Record<MrpRunStatus, string> = {
  Pending: 'MRP.RUN_STATUS_PENDING',
  Running: 'MRP.RUN_STATUS_RUNNING',
  Completed: 'MRP.RUN_STATUS_COMPLETED',
  Failed: 'MRP.RUN_STATUS_FAILED',
};

export const RUN_STATUS_COLORS: Record<MrpRunStatus, string> = {
  Pending: 'default',
  Running: 'processing',
  Completed: 'success',
  Failed: 'error',
};

export const RUN_MODE_KEYS: Record<MrpRunMode, string> = {
  RegenerativeFull: 'MRP.MODE_REGENERATIVE',
  NetChange: 'MRP.MODE_NET_CHANGE',
};

export const CAPACITY_MODE_KEYS: Record<MrpCapacityMode, string> = {
  InfiniteCapacity: 'MRP.CAPACITY_INFINITE',
  FiniteCapacityConstraint: 'MRP.CAPACITY_FINITE',
};

export const DIRECTION_KEYS: Record<MrpSchedulingDirection, string> = {
  BackwardFromDueDate: 'MRP.DIRECTION_BACKWARD',
  ForwardFromToday: 'MRP.DIRECTION_FORWARD',
};

export const EXCEPTION_KEYS: Record<MrpExceptionCode, string> = {
  Expedite: 'MRP.EXC_EXPEDITE',
  Defer: 'MRP.EXC_DEFER',
  PastDueRelease: 'MRP.EXC_PAST_DUE_RELEASE',
  BelowSafetyStock: 'MRP.EXC_BELOW_SAFETY_STOCK',
  CapacityOverload: 'MRP.EXC_CAPACITY_OVERLOAD',
  HolidayShiftApplied: 'MRP.EXC_HOLIDAY_SHIFT',
  CustomsLeadTimeApplied: 'MRP.EXC_CUSTOMS_LEAD_TIME',
  LateDelivery: 'MRP.EXC_LATE_DELIVERY',
  ExcessSupply: 'MRP.EXC_EXCESS_SUPPLY',
};

export const EXCEPTION_COLORS: Record<MrpExceptionCode, string> = {
  Expedite: 'orange',
  Defer: 'gold',
  PastDueRelease: 'red',
  BelowSafetyStock: 'magenta',
  CapacityOverload: 'volcano',
  HolidayShiftApplied: 'cyan',
  CustomsLeadTimeApplied: 'geekblue',
  LateDelivery: 'purple',
  ExcessSupply: 'lime',
};

export const SOURCE_TYPE_KEYS: Record<MrpDemandSourceType, string> = {
  sales_order_line: 'MRP.SOURCE_SALES_ORDER',
  mps_line: 'MRP.SOURCE_MPS',
  safety_stock: 'MRP.SOURCE_SAFETY_STOCK',
  allocated_stock: 'MRP.SOURCE_ALLOCATED_STOCK',
  production_order: 'MRP.SOURCE_PRODUCTION_ORDER',
  mrp_proposal: 'MRP.SOURCE_PARENT_PROPOSAL',
};

export const PROPOSAL_TYPES = Object.keys(PROPOSAL_TYPE_KEYS) as MrpProposalType[];
export const PROPOSAL_STATUSES = Object.keys(PROPOSAL_STATUS_KEYS) as MrpProposalStatus[];
export const EXCEPTION_CODES = Object.keys(EXCEPTION_KEYS) as MrpExceptionCode[];
export const RUN_MODES = Object.keys(RUN_MODE_KEYS) as MrpRunMode[];
export const CAPACITY_MODES = Object.keys(CAPACITY_MODE_KEYS) as MrpCapacityMode[];
export const DIRECTIONS = Object.keys(DIRECTION_KEYS) as MrpSchedulingDirection[];

const PURCHASE_TYPES: MrpProposalType[] = ['PlannedPurchaseRequisition'];
const PRODUCTION_TYPES: MrpProposalType[] = ['PlannedProductionOrder', 'PlannedSubcontractOrder'];

/** `true` for the proposals that turn into a document (a requisition or a production order); the rest is advice. */
export function isNewOrder(proposal: Pick<MrpProposal, 'proposal_type'>): boolean {
  return (
    PURCHASE_TYPES.includes(proposal.proposal_type) ||
    PRODUCTION_TYPES.includes(proposal.proposal_type)
  );
}

/** Mirrors the server rules: only Proposed new orders are firmed, Proposed or Firm new orders are released, advice is only dismissed. */
export function isEligible(proposal: MrpProposal, action: MrpProposalAction): boolean {
  switch (action) {
    case 'firm':
      return isNewOrder(proposal) && proposal.status === 'Proposed';
    case 'release':
      return isNewOrder(proposal) && (proposal.status === 'Proposed' || proposal.status === 'Firm');
    case 'dismiss':
      return proposal.status === 'Proposed' || proposal.status === 'Firm';
  }
}

export interface ActionSummary {
  action: MrpProposalAction;
  selected: number;
  eligible: number;
  ineligible: number;
  /** Eligible PlannedPurchaseRequisition rows: they end up in draft purchase requisitions (Mod 044/046). */
  purchaseRequisitions: number;
  /** Eligible PlannedProductionOrder and PlannedSubcontractOrder rows: they end up in planned production orders (Mod 064). */
  productionOrders: number;
}

/** What an action on the selected proposals would do, computed before the server is called. */
export function summarizeAction(
  proposals: MrpProposal[],
  action: MrpProposalAction,
): ActionSummary {
  const eligible = proposals.filter((proposal) => isEligible(proposal, action));

  return {
    action,
    selected: proposals.length,
    eligible: eligible.length,
    ineligible: proposals.length - eligible.length,
    purchaseRequisitions: eligible.filter((proposal) =>
      PURCHASE_TYPES.includes(proposal.proposal_type),
    ).length,
    productionOrders: eligible.filter((proposal) =>
      PRODUCTION_TYPES.includes(proposal.proposal_type),
    ).length,
  };
}

/** The server detail of a failed call (RFC 7807 `detail`, or the Laravel `message`), `null` when there is none. */
export function errorDetail(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body: unknown = error.error;
  if (typeof body === 'object' && body !== null) {
    const record = body as Record<string, unknown>;
    for (const field of ['detail', 'message']) {
      const value = record[field];
      if (typeof value === 'string' && value.trim() !== '') {
        return value;
      }
    }
  }

  return null;
}

/** Formats a decimal string ("20.0000") without trailing zeros; unparsable values are returned untouched. */
export function formatQuantity(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === '') {
    return '-';
  }
  const parsed = Number(value);

  return Number.isFinite(parsed) ? String(Number(parsed.toFixed(4))) : String(value);
}

export function toNumber(value: string | number | null | undefined): number {
  const parsed = Number(value);

  return Number.isFinite(parsed) ? parsed : 0;
}

/** Entries of a count map ordered by count (largest first), for the KPI cards. */
export function countEntries(
  counts: Record<string, number> | null | undefined,
): { key: string; count: number }[] {
  return Object.entries(counts ?? {})
    .map(([key, count]) => ({ key, count }))
    .filter((entry) => entry.count > 0)
    .sort((a, b) => b.count - a.count || a.key.localeCompare(b.key));
}
