import { describe, expect, it } from 'vitest';
import { ApplicationStage } from '@core';
import { boardStages, card } from '../testing/recruiting-fixtures';
import {
  canMoveTo,
  columnsFromBoard,
  findCard,
  moveCard,
  moveTargets,
  replaceCard,
} from './board-state';

const ALL_ENABLED = new Set<ApplicationStage>([
  'applied',
  'hr_screening',
  'technical_interview',
  'manager_interview',
  'offer_extended',
  'hired',
  'rejected',
]);

describe('board-state', () => {
  it('builds columns sorted by board_position', () => {
    const cols = columnsFromBoard(
      boardStages([
        card('b', 'applied', { board_position: 1 }),
        card('a', 'applied', { board_position: 0 }),
      ]),
    );
    expect(cols.applied.map((c) => c.id)).toEqual(['a', 'b']);
    expect(cols.hired).toEqual([]);
  });

  it('moves a card immutably and renumbers positions', () => {
    const cols = columnsFromBoard(
      boardStages([
        card('a', 'applied'),
        card('b', 'applied', { board_position: 1 }),
        card('c', 'hr_screening'),
      ]),
    );
    const moved = moveCard(cols, 'a', 'hr_screening', 0);
    expect(cols.applied.length).toBe(2);
    expect(moved.applied.map((c) => [c.id, c.board_position])).toEqual([['b', 0]]);
    expect(moved.hr_screening.map((c) => [c.id, c.stage, c.board_position])).toEqual([
      ['a', 'hr_screening', 0],
      ['c', 'hr_screening', 1],
    ]);
    expect(findCard(moved, 'a')).toMatchObject({ stage: 'hr_screening', index: 0 });
  });

  it('clamps the target index and ignores unknown cards', () => {
    const cols = columnsFromBoard(boardStages([card('a', 'applied')]));
    expect(moveCard(cols, 'a', 'rejected', 99).rejected[0].id).toBe('a');
    expect(moveCard(cols, 'zzz', 'rejected', 0)).toBe(cols);
  });

  it('replaces a card keeping its column', () => {
    const cols = columnsFromBoard(boardStages([card('a', 'applied')]));
    const next = replaceCard(cols, { ...card('a', 'applied'), average_score: 4.5 });
    expect(next.applied[0].average_score).toBe(4.5);
  });

  it('mirrors the contract stage rules', () => {
    expect(canMoveTo('applied', 'technical_interview', ALL_ENABLED)).toBe(true);
    expect(canMoveTo('manager_interview', 'hr_screening', ALL_ENABLED)).toBe(true);
    expect(canMoveTo('applied', 'rejected', ALL_ENABLED)).toBe(true);
    expect(canMoveTo('applied', 'hired', ALL_ENABLED)).toBe(false);
    expect(canMoveTo('hired', 'applied', ALL_ENABLED)).toBe(false);
    expect(canMoveTo('rejected', 'applied', ALL_ENABLED)).toBe(true);
    expect(canMoveTo('rejected', 'hr_screening', ALL_ENABLED)).toBe(false);
    expect(canMoveTo('applied', 'applied', ALL_ENABLED)).toBe(false);
    const withoutScreening = new Set(ALL_ENABLED);
    withoutScreening.delete('hr_screening');
    expect(canMoveTo('applied', 'hr_screening', withoutScreening)).toBe(false);
  });

  it('lists move targets in pipeline order', () => {
    expect(moveTargets('applied', ALL_ENABLED)).toEqual([
      'hr_screening',
      'technical_interview',
      'manager_interview',
      'offer_extended',
      'rejected',
    ]);
    expect(moveTargets('hired', ALL_ENABLED)).toEqual([]);
  });
});
