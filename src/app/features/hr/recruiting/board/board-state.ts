import {
  ApplicationStage,
  BoardStageColumn,
  CandidateApplicationCard,
  NON_TERMINAL_STAGES,
  RECRUITING_STAGES,
} from '@core';

export type BoardColumns = Record<ApplicationStage, CandidateApplicationCard[]>;

export interface CardLocation {
  stage: ApplicationStage;
  index: number;
  card: CandidateApplicationCard;
}

export function emptyColumns(): BoardColumns {
  return RECRUITING_STAGES.reduce((acc, stage) => {
    acc[stage] = [];
    return acc;
  }, {} as BoardColumns);
}

/** Builds the column map from the board endpoint (cards sorted by `board_position`). */
export function columnsFromBoard(stages: readonly BoardStageColumn[]): BoardColumns {
  const columns = emptyColumns();
  for (const column of stages) {
    columns[column.stage] = [...column.applications].sort(
      (a, b) => a.board_position - b.board_position,
    );
  }
  return columns;
}

export function findCard(columns: BoardColumns, id: string): CardLocation | null {
  for (const stage of RECRUITING_STAGES) {
    const index = columns[stage].findIndex((c) => c.id === id);
    if (index >= 0) {
      return { stage, index, card: columns[stage][index] };
    }
  }
  return null;
}

/**
 * Returns a new column map with the card moved to `toStage` at `toIndex`
 * (clamped). The moved card gets the new stage and `board_position`, and
 * positions in both affected columns are renumbered. Input is not mutated.
 */
export function moveCard(
  columns: BoardColumns,
  id: string,
  toStage: ApplicationStage,
  toIndex: number,
): BoardColumns {
  const from = findCard(columns, id);
  if (!from) {
    return columns;
  }
  const source = columns[from.stage].filter((c) => c.id !== id);
  const target = from.stage === toStage ? source : [...columns[toStage]];
  const index = Math.max(0, Math.min(toIndex, target.length));
  target.splice(index, 0, { ...from.card, stage: toStage });

  const renumber = (cards: CandidateApplicationCard[]) =>
    cards.map((c, i) => (c.board_position === i ? c : { ...c, board_position: i }));

  return {
    ...columns,
    [from.stage]: renumber(source),
    [toStage]: renumber(target),
  };
}

/** Replaces a card (matched by id) in place, keeping its column and index. */
export function replaceCard(columns: BoardColumns, card: CandidateApplicationCard): BoardColumns {
  const at = findCard(columns, card.id);
  if (!at) {
    return columns;
  }
  const list = [...columns[at.stage]];
  list[at.index] = { ...card, stage: at.stage, board_position: at.index };
  return { ...columns, [at.stage]: list };
}

/**
 * Client-side mirror of the contract stage rules, used to decide which
 * columns accept a card. The server remains authoritative (409 on violation).
 * - `hired` is never a `move` target (hire endpoint only).
 * - `hired` cards cannot move; `rejected` cards can only reopen to `applied`.
 * - Non-terminal cards can move to any other enabled non-terminal stage or to `rejected`.
 */
export function canMoveTo(
  from: ApplicationStage,
  to: ApplicationStage,
  enabled: ReadonlySet<ApplicationStage>,
): boolean {
  if (from === to || to === 'hired' || from === 'hired') {
    return false;
  }
  if (!enabled.has(to)) {
    return false;
  }
  if (from === 'rejected') {
    return to === 'applied';
  }
  return to === 'rejected' || NON_TERMINAL_STAGES.includes(to);
}

/** Valid "Move to..." targets for a card, in pipeline order. */
export function moveTargets(
  from: ApplicationStage,
  enabled: ReadonlySet<ApplicationStage>,
): ApplicationStage[] {
  return RECRUITING_STAGES.filter((stage) => canMoveTo(from, stage, enabled));
}
