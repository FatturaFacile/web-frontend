import { describe, expect, it } from 'vitest';
import { boardFixture } from './sales-pipeline.fixtures';
import {
  applyMove,
  boardTotals,
  clampProbability,
  columnTotals,
  fromCents,
  reconcileTotals,
  toCents,
  weightedValue,
} from './sales-pipeline.utils';

describe('weighted value engine', () => {
  it.each([
    [10000, 60, 6000],
    [1999.99, 12.5, 250],
    [0.05, 10, 0.01],
    [5000, 0, 0],
    [4321.1, 100, 4321.1],
    [19.99, 33.33, 6.66],
  ])('weighs %f at %f %% as %f', (amount, probability, expected) => {
    expect(weightedValue(amount, probability)).toBe(expected);
  });

  it('keeps probabilities in the 0..100 percentage range', () => {
    expect(clampProbability(150)).toBe(100);
    expect(clampProbability(-3)).toBe(0);
    expect(clampProbability('42.5')).toBe(42.5);
    expect(clampProbability(undefined)).toBe(0);
    expect(weightedValue(1000, 0.5)).toBe(5);
  });

  it('converts money through integer cents', () => {
    expect(toCents('12.34')).toBe(1234);
    expect(toCents(0.1 + 0.2)).toBe(30);
    expect(toCents('abc')).toBe(0);
    expect(fromCents(1999)).toBe('19.99');
  });
});

describe('column and board totals', () => {
  it('sums deal value and weighted value per column', () => {
    const board = boardFixture();

    expect(columnTotals(board.columns[0].opportunities)).toEqual({
      count: 2,
      amount: '15000.00',
      weighted_amount: '3750.00',
    });
    expect(boardTotals(board.columns)).toEqual({
      count: 3,
      amount: '17000.00',
      weighted_amount: '5250.00',
    });
    expect(columnTotals([])).toEqual({ count: 0, amount: '0.00', weighted_amount: '0.00' });
  });
});

describe('optimistic move', () => {
  it('recalculates the totals of both columns and the deal weighted value at once', () => {
    const board = boardFixture();
    const moved = applyMove(board, 'd1', 's2', 0);

    const [qualification, negotiation] = moved.columns;
    expect(qualification.totals).toEqual({
      count: 1,
      amount: '5000.00',
      weighted_amount: '1250.00',
    });
    expect(negotiation.totals).toEqual({
      count: 2,
      amount: '12000.00',
      weighted_amount: '9000.00',
    });
    expect(negotiation.opportunities.map((deal) => deal.id)).toEqual(['d1', 'd3']);
    expect(negotiation.opportunities[0]).toMatchObject({
      probability: 75,
      weighted_amount: 7500,
      forecast_category: 'commit',
      board_position: 0,
      stage_id: 's2',
    });
    expect(moved.totals).toEqual({ count: 3, amount: '17000.00', weighted_amount: '10250.00' });
    // The source board is never mutated, so a failed call can roll back to it.
    expect(board.columns[0].opportunities).toHaveLength(2);
  });

  it('honours a custom probability over the stage default', () => {
    const moved = applyMove(boardFixture(), 'd2', 's2', undefined, 33.33);

    expect(moved.columns[1].opportunities.at(-1)).toMatchObject({
      id: 'd2',
      probability: 33.33,
      weighted_amount: 1666.5,
    });
  });

  it('forces 100 % on a won stage and 0 % on a lost stage', () => {
    const won = applyMove(boardFixture(), 'd1', 's3');
    const lost = applyMove(boardFixture(), 'd1', 's4');

    expect(won.columns[2].opportunities[0]).toMatchObject({
      status: 'won',
      probability: 100,
      weighted_amount: 10000,
      forecast_category: 'closed',
    });
    expect(lost.columns[3].opportunities[0]).toMatchObject({
      status: 'lost',
      probability: 0,
      weighted_amount: 0,
      forecast_category: 'omitted',
    });
    expect(lost.columns[3].totals).toEqual({
      count: 1,
      amount: '10000.00',
      weighted_amount: '0.00',
    });
  });

  it('reorders inside a column without touching probability or totals', () => {
    const moved = applyMove(boardFixture(), 'd2', 's1', 0);
    const column = moved.columns[0];

    expect(column.opportunities.map((deal) => [deal.id, deal.board_position])).toEqual([
      ['d2', 0],
      ['d1', 1],
    ]);
    expect(column.opportunities[0].probability).toBe(25);
    expect(column.totals).toEqual({ count: 2, amount: '15000.00', weighted_amount: '3750.00' });
  });

  it('ignores unknown deals and stages', () => {
    const board = boardFixture();

    expect(applyMove(board, 'nope', 's2')).toBe(board);
    expect(applyMove(board, 'd1', 'nope')).toBe(board);
  });

  it('reconciles the totals with the ones the API returns', () => {
    const moved = applyMove(boardFixture(), 'd1', 's2', 0);
    const reconciled = reconcileTotals(moved, {
      s2: { count: 2, amount: '12000.00', weighted_amount: '9000.01' },
    });

    expect(reconciled.columns[1].totals.weighted_amount).toBe('9000.01');
    expect(reconciled.totals.weighted_amount).toBe('10250.01');
  });
});
