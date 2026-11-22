import {
  AllocationVector,
  AnalyticalCenterNode,
  ApportionmentAllocation,
  ApportionmentRunStep,
  ContributionMarginStatement,
} from '@core';

/** Decimal text or number to cents, rounded half away from zero. */
export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined || value === '') {
    return 0;
  }
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) {
    return 0;
  }
  const scaled = Math.abs(number) * 100;
  const rounded = Math.floor(scaled + 0.5 + 1e-9);
  return number < 0 ? -rounded : rounded;
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? '-' : '';
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, '0')}`;
}

/** Largest Remainder (Hamilton) split of cents over non-negative weights: the parts always add up to the total. */
export function allocateCents(totalCents: number, weights: number[]): number[] {
  const scaled = weights.map((weight) => BigInt(Math.round(Math.max(weight, 0) * 10_000)));
  const sum = scaled.reduce((a, b) => a + b, 0n);
  if (sum === 0n) {
    return weights.map(() => 0);
  }
  const magnitude = BigInt(Math.abs(totalCents));
  const floors = scaled.map((weight) => (magnitude * weight) / sum);
  const remainders = scaled.map((weight) => (magnitude * weight) % sum);
  let leftover = Number(magnitude - floors.reduce((a, b) => a + b, 0n));
  const order = remainders
    .map((remainder, index) => ({ remainder, index }))
    .sort((a, b) =>
      a.remainder === b.remainder ? a.index - b.index : a.remainder > b.remainder ? -1 : 1,
    );
  const shares = floors.map((floor) => Number(floor));
  for (let i = 0; leftover > 0; i = (i + 1) % order.length, leftover--) {
    shares[order[i].index]++;
  }
  return totalCents < 0 ? shares.map((share) => -share) : shares;
}

export type VectorMode = 'percentage' | 'amount';

export interface VectorSplitResult {
  valid: boolean;
  mode: VectorMode | null;
  errors: string[];
  /** Cents of each vector, in order; empty while invalid. */
  amounts: number[];
}

/** Checks the allocation vectors of a line against its amount and gives the exact split. */
export function splitVectors(amount: string | number, vectors: AllocationVector[]): VectorSplitResult {
  const errors: string[] = [];
  if (vectors.length === 0) {
    return { valid: false, mode: null, errors: ['ANALYTICAL.VECTOR_REQUIRED'], amounts: [] };
  }
  const withPercentage = vectors.filter((v) => v.percentage !== null && v.percentage !== undefined);
  const withAmount = vectors.filter((v) => v.amount !== null && v.amount !== undefined && v.amount !== '');
  if (withPercentage.length > 0 && withAmount.length > 0) {
    errors.push('ANALYTICAL.VECTOR_MIXED_MODES');
  }
  const hasTarget = (v: AllocationVector): boolean =>
    !!(v.cost_center_id || v.profit_center_id || v.project_id);
  if (!vectors.every(hasTarget)) {
    errors.push('ANALYTICAL.VECTOR_TARGET_REQUIRED');
  }
  const total = toCents(amount);
  const mode: VectorMode = withAmount.length > 0 ? 'amount' : 'percentage';
  let amounts: number[] = [];
  if (errors.length === 0 && mode === 'percentage') {
    if (withPercentage.length !== vectors.length) {
      errors.push('ANALYTICAL.VECTOR_VALUE_REQUIRED');
    } else {
      const sum = vectors.reduce((acc, v) => acc + Math.round((v.percentage ?? 0) * 10_000), 0);
      if (sum !== 1_000_000) {
        errors.push('ANALYTICAL.VECTOR_PERCENT_SUM');
      } else {
        amounts = allocateCents(
          total,
          vectors.map((v) => v.percentage ?? 0),
        );
      }
    }
  }
  if (errors.length === 0 && mode === 'amount') {
    if (withAmount.length !== vectors.length) {
      errors.push('ANALYTICAL.VECTOR_VALUE_REQUIRED');
    } else {
      amounts = vectors.map((v) => toCents(v.amount));
      if (amounts.reduce((a, b) => a + b, 0) !== total) {
        errors.push('ANALYTICAL.VECTOR_AMOUNT_SUM');
        amounts = [];
      }
    }
  }
  return { valid: errors.length === 0, mode, errors, amounts };
}

export interface CenterRow {
  node: AnalyticalCenterNode;
  depth: number;
}

/** Depth-first rows of the tree; children of a collapsed node are skipped. */
export function visibleRows(
  tree: AnalyticalCenterNode[],
  collapsed: ReadonlySet<string>,
  depth = 0,
): CenterRow[] {
  return tree.flatMap((node) => [
    { node, depth },
    ...(collapsed.has(node.id) ? [] : visibleRows(node.children, collapsed, depth + 1)),
  ]);
}

export function flattenTree(tree: AnalyticalCenterNode[]): AnalyticalCenterNode[] {
  return tree.flatMap((node) => [node, ...flattenTree(node.children)]);
}

/** Ids a center cannot be moved under: itself and its descendants. */
export function invalidParents(tree: AnalyticalCenterNode[], id: string): Set<string> {
  const node = flattenTree(tree).find((candidate) => candidate.id === id);
  return new Set(node ? flattenTree([node]).map((n) => n.id) : [id]);
}

/** Percentage with two decimals of part over base, "0.00" on an empty base. */
export function percentOf(part: number, base: number): string {
  return base === 0 ? '0.00' : ((part / base) * 100).toFixed(2);
}

export interface MarginLevels {
  contributionMargin1: string;
  contributionMargin2: string;
  operatingResult: string;
}

/** The margin levels from the cost blocks, in cents, so the screen can check what the API reports. */
export function marginLevels(blocks: {
  revenues: string | number;
  variable: string | number;
  fixed: string | number;
  indirect: string | number;
  apportioned: string | number;
}): MarginLevels {
  const cm1 = toCents(blocks.revenues) - toCents(blocks.variable);
  const cm2 = cm1 - toCents(blocks.fixed);
  const result = cm2 - toCents(blocks.indirect) - toCents(blocks.apportioned);
  return {
    contributionMargin1: fromCents(cm1),
    contributionMargin2: fromCents(cm2),
    operatingResult: fromCents(result),
  };
}

/** True when the reported statement adds up: CM I, CM II and the operating result follow from its blocks. */
export function statementIsConsistent(statement: ContributionMarginStatement): boolean {
  const levels = marginLevels({
    revenues: statement.operating_revenues,
    variable: statement.direct_variable_costs,
    fixed: statement.direct_fixed_costs,
    indirect: statement.indirect_costs,
    apportioned: statement.apportioned_costs,
  });
  return (
    toCents(levels.contributionMargin1) === toCents(statement.contribution_margin_1) &&
    toCents(levels.contributionMargin2) === toCents(statement.contribution_margin_2) &&
    toCents(levels.operatingResult) === toCents(statement.operating_result)
  );
}

export interface StepTrace {
  step: ApportionmentRunStep;
  allocations: ApportionmentAllocation[];
  /** Cents allocated by the step; equals the pool of an executed step. */
  allocatedCents: number;
  balanced: boolean;
}

/** Groups the allocations of a run under their step so the chain can be read source by source. */
export function traceByStep(
  steps: ApportionmentRunStep[],
  allocations: ApportionmentAllocation[],
): StepTrace[] {
  return [...steps]
    .sort((a, b) => a.step_order - b.step_order)
    .map((step) => {
      const own = allocations.filter((a) => a.step_order === step.step_order);
      const allocatedCents = own.reduce((sum, a) => sum + toCents(a.allocated_amount), 0);
      return {
        step,
        allocations: own,
        allocatedCents,
        balanced: step.status === 'SKIPPED' || allocatedCents === toCents(step.pool_amount),
      };
    });
}

/** Reads the first validation message of an API error, else the message, else null. */
export function problemDetail(error: unknown): string | null {
  const body = (error as { error?: { message?: unknown; errors?: Record<string, unknown> } })?.error;
  const first = Object.values(body?.errors ?? {})[0];
  if (Array.isArray(first) && typeof first[0] === 'string') {
    return first[0];
  }
  return typeof body?.message === 'string' ? body.message : null;
}
