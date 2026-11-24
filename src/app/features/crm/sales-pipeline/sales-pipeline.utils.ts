import type {
  SalesBoard,
  SalesBoardColumn,
  SalesColumnTotals,
  SalesDeal,
  SalesPipelineStage,
} from '@core';

/** Money is handled in integer cents so sums never drift. */
export function toCents(value: number | string | null | undefined): number {
  const number = Number(value ?? 0);
  return Number.isFinite(number) ? Math.round(number * 100) : 0;
}

export function fromCents(cents: number): string {
  return (cents / 100).toFixed(2);
}

/** Clamps a probability to the percentage range 0..100 (the unit used everywhere, never 0..1). */
export function clampProbability(probability: number | string | null | undefined): number {
  const number = Number(probability ?? 0);
  return Number.isFinite(number) ? Math.min(100, Math.max(0, number)) : 0;
}

/** Weighted value = deal value x probability %, rounded half up to the cent (same rule as the API). */
export function weightedValue(amount: number | string, probability: number | string): number {
  return Math.round((toCents(amount) * clampProbability(probability)) / 100) / 100;
}

export function columnTotals(deals: readonly SalesDeal[]): SalesColumnTotals {
  let amount = 0;
  let weighted = 0;
  for (const deal of deals) {
    amount += toCents(deal.amount);
    weighted += toCents(weightedValue(deal.amount, deal.probability));
  }
  return { count: deals.length, amount: fromCents(amount), weighted_amount: fromCents(weighted) };
}

export function boardTotals(columns: readonly SalesBoardColumn[]): SalesColumnTotals {
  let count = 0;
  let amount = 0;
  let weighted = 0;
  for (const column of columns) {
    count += column.totals.count;
    amount += toCents(column.totals.amount);
    weighted += toCents(column.totals.weighted_amount);
  }
  return { count, amount: fromCents(amount), weighted_amount: fromCents(weighted) };
}

export function isTerminalStage(stage: Pick<SalesPipelineStage, 'is_won' | 'is_lost'>): boolean {
  return stage.is_won || stage.is_lost;
}

/**
 * Applies a drag-and-drop move to a copy of the board and recomputes the totals of the affected columns at once
 * (optimistic update). It mirrors what the API does: a won stage forces 100 %, a lost stage 0 %, any other stage its
 * default probability unless one is given.
 */
export function applyMove(
  board: SalesBoard,
  dealId: string,
  targetStageId: string,
  position?: number,
  probability?: number,
): SalesBoard {
  const source = board.columns.find((column) =>
    column.opportunities.some((deal) => deal.id === dealId),
  );
  const target = board.columns.find((column) => column.stage.id === targetStageId);
  const deal = source?.opportunities.find((candidate) => candidate.id === dealId);
  if (!source || !target || !deal) {
    return board;
  }

  const stage = target.stage;
  const nextProbability = stage.is_won
    ? 100
    : stage.is_lost
      ? 0
      : clampProbability(
          probability ?? (source === target ? deal.probability : stage.default_probability),
        );
  const moved: SalesDeal = {
    ...deal,
    stage_id: stage.id,
    probability: nextProbability,
    weighted_amount: weightedValue(deal.amount, nextProbability),
    status: stage.is_won ? 'won' : stage.is_lost ? 'lost' : 'open',
    forecast_category: stage.is_won
      ? 'closed'
      : stage.is_lost
        ? 'omitted'
        : source === target
          ? deal.forecast_category
          : categoryOfStage(stage, deal.forecast_category),
  };

  const columns = board.columns.map((column): SalesBoardColumn => {
    const without = column.opportunities.filter((candidate) => candidate.id !== dealId);
    const opportunities =
      column === target ? insertAt(without, moved, position ?? without.length) : without;
    const changed = column === source || column === target;
    return changed
      ? { ...column, opportunities: renumber(opportunities), totals: columnTotals(opportunities) }
      : column;
  });

  return { ...board, columns, totals: boardTotals(columns) };
}

/** Replaces the totals of columns with the ones reconciled by the API after a move. */
export function reconcileTotals(
  board: SalesBoard,
  stageTotals: Record<string, SalesColumnTotals>,
): SalesBoard {
  const columns = board.columns.map((column) =>
    stageTotals[column.stage.id] ? { ...column, totals: stageTotals[column.stage.id] } : column,
  );
  return { ...board, columns, totals: boardTotals(columns) };
}

function categoryOfStage(stage: SalesPipelineStage, current: string): string {
  return stage.forecast_category === 'best_case' || stage.forecast_category === 'commit'
    ? stage.forecast_category
    : current;
}

function insertAt(deals: SalesDeal[], deal: SalesDeal, position: number): SalesDeal[] {
  const index = Math.max(0, Math.min(position, deals.length));
  return [...deals.slice(0, index), deal, ...deals.slice(index)];
}

function renumber(deals: SalesDeal[]): SalesDeal[] {
  return deals.map((deal, index) =>
    deal.board_position === index ? deal : { ...deal, board_position: index },
  );
}
