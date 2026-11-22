import {
  BillingModel,
  ContractStatus,
  FiscalJurisdiction,
  RetainerBalance,
  RetentionReleaseRule,
  SalStatus,
  WipMethod,
} from './project-billing.models';

export const MODEL_KEYS: Record<BillingModel, string> = {
  time_and_materials: 'PROJECT_BILLING.MODEL_TIME_AND_MATERIALS',
  fixed_milestone: 'PROJECT_BILLING.MODEL_FIXED_MILESTONE',
  prepaid_retainer: 'PROJECT_BILLING.MODEL_PREPAID_RETAINER',
  sal_progress: 'PROJECT_BILLING.MODEL_SAL_PROGRESS',
  hybrid: 'PROJECT_BILLING.MODEL_HYBRID',
};

export const CONTRACT_STATUS_KEYS: Record<ContractStatus, string> = {
  draft: 'PROJECT_BILLING.STATUS_DRAFT',
  active: 'PROJECT_BILLING.STATUS_ACTIVE',
  on_hold: 'PROJECT_BILLING.STATUS_ON_HOLD',
  completed: 'PROJECT_BILLING.STATUS_COMPLETED',
  closed: 'PROJECT_BILLING.STATUS_CLOSED',
};

export const SAL_STATUS_KEYS: Record<SalStatus, string> = {
  draft: 'PROJECT_BILLING.SAL_DRAFT',
  pending_approval: 'PROJECT_BILLING.SAL_PENDING_APPROVAL',
  approved: 'PROJECT_BILLING.SAL_APPROVED',
  invoiced: 'PROJECT_BILLING.SAL_INVOICED',
  cancelled: 'PROJECT_BILLING.SAL_CANCELLED',
};

export const RELEASE_RULE_KEYS: Record<RetentionReleaseRule, string> = {
  manual: 'PROJECT_BILLING.RULE_MANUAL',
  on_acceptance: 'PROJECT_BILLING.RULE_ON_ACCEPTANCE',
  on_warranty_expiry: 'PROJECT_BILLING.RULE_ON_WARRANTY_EXPIRY',
  on_milestone: 'PROJECT_BILLING.RULE_ON_MILESTONE',
};

export const WIP_METHOD_KEYS: Record<WipMethod, string> = {
  cost_to_cost_percentage_of_completion: 'PROJECT_BILLING.WIP_COST_TO_COST',
  completed_contract: 'PROJECT_BILLING.WIP_COMPLETED_CONTRACT',
  milestone_progress: 'PROJECT_BILLING.WIP_MILESTONE',
};

export const JURISDICTION_KEYS: Record<FiscalJurisdiction, string> = {
  IT: 'PROJECT_BILLING.JURISDICTION_IT',
  CH: 'PROJECT_BILLING.JURISDICTION_CH',
};

export const SAL_STATUS_COLORS: Record<SalStatus, string> = {
  draft: 'default',
  pending_approval: 'gold',
  approved: 'blue',
  invoiced: 'green',
  cancelled: 'red',
};

export interface SalPreviewInput {
  contractValue: string | number;
  cumulativePercent: number;
  previousPercent: number;
  previousCumulativeGross: string | number;
  advanceTotal: string | number;
  advanceRecouped: string | number;
  retentionPercent: string | number;
}

export interface SalPreview {
  cumulativeGross: string;
  currentGross: string;
  advanceDeduction: string;
  retentionWithheld: string;
  invoiceAmount: string;
  netBillable: string;
  isFinal: boolean;
}

/** Whole cents of an amount, rounded half away from zero, so sums never drift on binary fractions. */
export function toCents(value: string | number | null | undefined): number {
  const number = Number(value ?? 0);

  return Number.isFinite(number)
    ? Math.sign(number) * Math.round(Math.abs(number) * 100 + 1e-9)
    : 0;
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/**
 * Live preview of a SAL certificate, the same arithmetic as the API (SalCalculator): the incremental earned value, the
 * advance recouped in proportion (all of what is left on the final certificate), the retention withheld on the gross,
 * the invoice amount (gross less advance) and what the customer pays now (invoice less retention). Null while the
 * progress does not advance within 0-100 or the contract has no value.
 */
export function previewSal(input: SalPreviewInput): SalPreview | null {
  const contract = toCents(input.contractValue);

  if (
    contract <= 0 ||
    input.cumulativePercent > 100 ||
    input.cumulativePercent <= input.previousPercent
  ) {
    return null;
  }

  const isFinal = input.cumulativePercent === 100;
  const cumulativeGross = Math.round((contract * input.cumulativePercent) / 100);
  const currentGross = cumulativeGross - toCents(input.previousCumulativeGross);
  const advanceTotal = toCents(input.advanceTotal);
  const remaining = Math.max(advanceTotal - toCents(input.advanceRecouped), 0);
  const proportional = Math.round((advanceTotal * currentGross) / contract);
  const advanceDeduction = Math.max(
    Math.min(isFinal ? remaining : proportional, remaining, currentGross),
    0,
  );
  const retention = Math.round((currentGross * Number(input.retentionPercent || 0)) / 100);
  const invoice = currentGross - advanceDeduction;

  return {
    cumulativeGross: fromCents(cumulativeGross),
    currentGross: fromCents(currentGross),
    advanceDeduction: fromCents(advanceDeduction),
    retentionWithheld: fromCents(retention),
    invoiceAmount: fromCents(invoice),
    netBillable: fromCents(invoice - retention),
    isFinal,
  };
}

/** Whether the work in progress is a contract asset (recognised above billed), a liability (billed above) or even. */
export function wipNature(
  diff: string | null | undefined,
): 'contract_asset' | 'contract_liability' | 'balanced' {
  const cents = toCents(diff);

  return cents > 0 ? 'contract_asset' : cents < 0 ? 'contract_liability' : 'balanced';
}

export const WIP_NATURE_KEYS: Record<ReturnType<typeof wipNature>, string> = {
  contract_asset: 'PROJECT_BILLING.WIP_ASSET',
  contract_liability: 'PROJECT_BILLING.WIP_LIABILITY',
  balanced: 'PROJECT_BILLING.WIP_BALANCED',
};

/** Share of the retainer already burned, 0-100, for the burn-down bar. */
export function retainerBurnPercent(
  balance: Pick<RetainerBalance, 'remaining_percent'> | null,
): number {
  if (balance === null) {
    return 0;
  }

  return Math.min(100, Math.max(0, 100 - Number(balance.remaining_percent)));
}

/** Whether the wizard offers the step of a billing family for the model of the contract. */
export function modelSupports(
  model: BillingModel | null,
  family: 'time_and_materials' | 'milestones' | 'progress' | 'retainer',
): boolean {
  switch (family) {
    case 'time_and_materials':
      return model === 'time_and_materials' || model === 'prepaid_retainer' || model === 'hybrid';
    case 'milestones':
      return model === 'fixed_milestone' || model === 'hybrid';
    case 'progress':
      return model === 'sal_progress' || model === 'hybrid';
    case 'retainer':
      return model === 'prepaid_retainer' || model === 'hybrid';
  }
}
