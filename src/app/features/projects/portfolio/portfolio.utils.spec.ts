import { describe, expect, it } from 'vitest';
import { DEPENDENCIES, dependency, node, NODES, project } from './portfolio.testing';
import {
  addDays,
  barGeometry,
  baselineSlip,
  childrenByParent,
  CIG_PATTERN,
  CUP_PATTERN,
  descendantIds,
  diffDays,
  dragDates,
  flattenTree,
  fromDay,
  ganttScale,
  ganttWidth,
  kanbanCards,
  kanbanColumn,
  leafNodes,
  monthTicks,
  parentIds,
  percentForColumn,
  portfolioKpis,
  reorderItems,
  rollupTotals,
  schedule,
  toDay,
  wouldCreateCycle,
  xToDay,
} from './portfolio.utils';

describe('dates', () => {
  it('converts to and from day numbers and does arithmetic across month ends', () => {
    expect(fromDay(toDay('2027-01-31'))).toBe('2027-01-31');
    expect(addDays('2027-01-31', 1)).toBe('2027-02-01');
    expect(addDays('2027-03-01', -1)).toBe('2027-02-28');
    expect(diffDays('2027-01-04', '2027-01-18')).toBe(14);
    expect(diffDays('2027-01-18', '2027-01-04')).toBe(-14);
  });
});

describe('codes', () => {
  it('validates the shape of CUP (15) and CIG (10)', () => {
    expect(CUP_PATTERN.test('B11H20000010001')).toBe(true);
    expect(CUP_PATTERN.test('B11H2000001000')).toBe(false);
    expect(CIG_PATTERN.test('8123456AB1')).toBe(true);
    expect(CIG_PATTERN.test('8123456AB')).toBe(false);
    expect(CIG_PATTERN.test('8123456A-1')).toBe(false);
  });
});

describe('portfolioKpis', () => {
  it('counts statuses and sums the money of the listed projects', () => {
    const kpis = portfolioKpis([
      project({ id: 'a', status: 'Active', plannedCost: 100, actualCost: 40, plannedRevenue: 300, percentComplete: 40 }),
      project({ id: 'b', status: 'OnHold', plannedCost: 50, actualCost: 10, plannedRevenue: 80, percentComplete: 20 }),
      project({ id: 'c', status: 'Completed', plannedCost: 10, actualCost: 12, plannedRevenue: 20, percentComplete: 100 }),
    ]);

    expect(kpis).toEqual({
      total: 3,
      active: 1,
      onHold: 1,
      completed: 1,
      plannedCost: 160,
      actualCost: 62,
      plannedRevenue: 400,
      averageProgress: 53,
    });
  });

  it('is all zeros for an empty portfolio', () => {
    expect(portfolioKpis([]).averageProgress).toBe(0);
    expect(portfolioKpis([]).total).toBe(0);
  });
});

describe('WBS tree', () => {
  it('orders the children by sort order and shows only the expanded branches', () => {
    expect(flattenTree(NODES, new Set()).map((row) => row.node.id)).toEqual(['n1', 'n2']);

    const rows = flattenTree(NODES, new Set(['n1']));

    expect(rows.map((row) => row.node.wbsCode)).toEqual(['1', '1.1', '1.2', '1.3', '2']);
    expect(rows.map((row) => row.depth)).toEqual([0, 1, 1, 1, 0]);
    expect(rows[0].hasChildren).toBe(true);
    expect(rows[1].hasChildren).toBe(false);
  });

  it('shows a node whose parent is missing at the top level', () => {
    const rows = flattenTree([node({ id: 'x', parentNodeId: 'gone' })], new Set());

    expect(rows).toHaveLength(1);
    expect(rows[0].depth).toBe(0);
  });

  it('finds parents, leaves and descendants', () => {
    expect(parentIds(NODES)).toEqual(['n1']);
    expect(leafNodes(NODES).map((leaf) => leaf.id)).toEqual(['n11', 'n12', 'n13', 'n2']);
    expect([...descendantIds(NODES, 'n1')].sort()).toEqual(['n11', 'n12', 'n13']);
    expect(descendantIds(NODES, 'n2').size).toBe(0);
    expect(childrenByParent(NODES).get(null)?.map((entry) => entry.id)).toEqual(['n1', 'n2']);
  });

  it('rolls hours, cost, dates and a weighted completion up to the parents', () => {
    const totals = rollupTotals(NODES);
    const phase = totals.get('n1');

    expect(phase?.plannedHours).toBe(120);
    expect(phase?.plannedCost).toBe(6000);
    expect(phase?.startDate).toBe('2027-01-04');
    expect(phase?.endDate).toBe('2027-01-14');
    // (0 * 40 + 50 * 80 + 0 * 0) / 120 = 33.3
    expect(phase?.percentComplete).toBe(33);
    expect(totals.get('n11')?.plannedHours).toBe(40);
  });

  it('averages the completion of a parent whose children have no hours', () => {
    const totals = rollupTotals([
      node({ id: 'p', nodeType: 'Phase' }),
      node({ id: 'a', parentNodeId: 'p', percentComplete: 20 }),
      node({ id: 'b', parentNodeId: 'p', percentComplete: 60 }),
    ]);

    expect(totals.get('p')?.percentComplete).toBe(40);
  });
});

describe('reorderItems', () => {
  it('swaps a node with its neighbour and renumbers the siblings', () => {
    expect(reorderItems(NODES, 'n12', 'up')).toEqual([
      { id: 'n12', parentNodeId: 'n1', sortOrder: 0 },
      { id: 'n11', parentNodeId: 'n1', sortOrder: 1 },
      { id: 'n13', parentNodeId: 'n1', sortOrder: 2 },
    ]);
    expect(reorderItems(NODES, 'n1', 'down')).toEqual([
      { id: 'n2', parentNodeId: null, sortOrder: 0 },
      { id: 'n1', parentNodeId: null, sortOrder: 1 },
    ]);
  });

  it('does nothing at the edges, for unknown nodes and for a top-level outdent', () => {
    expect(reorderItems(NODES, 'n11', 'up')).toEqual([]);
    expect(reorderItems(NODES, 'n2', 'down')).toEqual([]);
    expect(reorderItems(NODES, 'missing', 'up')).toEqual([]);
    expect(reorderItems(NODES, 'n1', 'outdent')).toEqual([]);
    expect(reorderItems(NODES, 'n1', 'indent')).toEqual([]);
  });

  it('indents under the previous sibling, appending after its children', () => {
    expect(reorderItems(NODES, 'n2', 'indent')).toEqual([
      { id: 'n1', parentNodeId: null, sortOrder: 0 },
      { id: 'n11', parentNodeId: 'n1', sortOrder: 0 },
      { id: 'n12', parentNodeId: 'n1', sortOrder: 1 },
      { id: 'n13', parentNodeId: 'n1', sortOrder: 2 },
      { id: 'n2', parentNodeId: 'n1', sortOrder: 3 },
    ]);
  });

  it('outdents right after the former parent', () => {
    expect(reorderItems(NODES, 'n12', 'outdent')).toEqual([
      { id: 'n1', parentNodeId: null, sortOrder: 0 },
      { id: 'n12', parentNodeId: null, sortOrder: 1 },
      { id: 'n2', parentNodeId: null, sortOrder: 2 },
      { id: 'n11', parentNodeId: 'n1', sortOrder: 0 },
      { id: 'n13', parentNodeId: 'n1', sortOrder: 1 },
    ]);
  });
});

describe('wouldCreateCycle', () => {
  it('refuses a self link and a link that closes the chain', () => {
    expect(wouldCreateCycle(DEPENDENCIES, 'n11', 'n11')).toBe(true);
    expect(wouldCreateCycle(DEPENDENCIES, 'n13', 'n11')).toBe(true);
    expect(wouldCreateCycle(DEPENDENCIES, 'n12', 'n11')).toBe(true);
  });

  it('allows links that keep the graph acyclic', () => {
    expect(wouldCreateCycle(DEPENDENCIES, 'n11', 'n13')).toBe(false);
    expect(wouldCreateCycle(DEPENDENCIES, 'n2', 'n12')).toBe(false);
    expect(wouldCreateCycle([], 'a', 'b')).toBe(false);
  });
});

describe('schedule (CPM)', () => {
  const find = (id: string, nodes = schedule(NODES, DEPENDENCIES).nodes) => nodes.find((entry) => entry.id === id)!;

  it('keeps a chain that already satisfies its links in place and marks it critical', () => {
    const result = schedule(NODES, DEPENDENCIES);

    expect(result.cyclic).toBe(false);
    expect(find('n11', result.nodes).startDate).toBe('2027-01-04');
    expect(find('n12', result.nodes).startDate).toBe('2027-01-09');
    expect(find('n13', result.nodes).startDate).toBe('2027-01-14');
    expect(result.finishDate).toBe('2027-01-14');
    expect(['n11', 'n12', 'n13'].every((id) => find(id, result.nodes).isCritical)).toBe(true);
    expect(find('n11', result.nodes).totalFloatDays).toBe(0);
  });

  it('gives the work off the critical path positive float and does not flag it', () => {
    const training = find('n2');

    expect(training.isCritical).toBe(false);
    // Training ends on 6 Jan; the project finishes on 14 Jan.
    expect(training.totalFloatDays).toBe(7);
    expect(training.freeFloatDays).toBe(7);
    expect(training.lateFinish).toBe('2027-01-13');
  });

  it('pushes the successors when a predecessor is delayed (cascading finish-to-start)', () => {
    const delayed = NODES.map((entry) => (entry.id === 'n11' ? { ...entry, endDate: '2027-01-12' } : entry));
    const result = schedule(delayed, DEPENDENCIES);

    expect(find('n12', result.nodes).startDate).toBe('2027-01-13');
    expect(find('n12', result.nodes).endDate).toBe('2027-01-17');
    expect(find('n13', result.nodes).startDate).toBe('2027-01-18');
    expect(result.finishDate).toBe('2027-01-18');
  });

  it('never pulls a task earlier than the day it is planned on', () => {
    const early = NODES.map((entry) => (entry.id === 'n11' ? { ...entry, startDate: '2027-01-01', endDate: '2027-01-02' } : entry));

    expect(find('n12', schedule(early, DEPENDENCIES).nodes).startDate).toBe('2027-01-09');
  });

  it('applies lag and lead to finish-to-start', () => {
    const lagged = [dependency({ id: 'd1', predecessorNodeId: 'n11', successorNodeId: 'n12', lagDays: 3 }), DEPENDENCIES[1]];

    // Design occupies 4 – 8 Jan (finish at the end of the 8th = 9 Jan); +3 days of lag = 12 Jan.
    expect(find('n12', schedule(NODES, lagged).nodes).startDate).toBe('2027-01-12');
  });

  it('supports start-to-start, finish-to-finish and start-to-finish links', () => {
    const base = [
      node({ id: 'a', startDate: '2027-02-01', endDate: '2027-02-05' }),
      node({ id: 'b', startDate: '2027-01-01', endDate: '2027-01-03' }),
    ];
    const run = (type: 'SS' | 'FF' | 'SF', lagDays: number) =>
      schedule(base, [dependency({ id: 'x', predecessorNodeId: 'a', successorNodeId: 'b', dependencyType: type, lagDays })]).nodes.find((entry) => entry.id === 'b')!;

    // SS + 2: b starts 2 days after a starts.
    expect(run('SS', 2).startDate).toBe('2027-02-03');
    // FF: b (3 days) finishes together with a: it ends Fri 5 Feb and starts Wed 3 Feb.
    expect(run('FF', 0).endDate).toBe('2027-02-05');
    expect(run('FF', 0).startDate).toBe('2027-02-03');
    // SF: b finishes when a starts (exclusive finish): it ends Sun 31 Jan.
    expect(run('SF', 0).endDate).toBe('2027-01-31');
  });

  it('treats a milestone as a point and keeps it on the day', () => {
    const milestone = find('n13');

    expect(milestone.startDate).toBe(milestone.endDate);
  });

  it('rolls the dates and the criticality up to the parent', () => {
    const phase = find('n1');

    expect(phase.startDate).toBe('2027-01-04');
    expect(phase.endDate).toBe('2027-01-14');
    expect(phase.isCritical).toBe(true);
  });

  it('reports a cycle and leaves the nodes unchanged', () => {
    const loop = [...DEPENDENCIES, dependency({ id: 'd3', predecessorNodeId: 'n13', successorNodeId: 'n11' })];
    const result = schedule(NODES, loop);

    expect(result.cyclic).toBe(true);
    expect(result.nodes).toEqual(NODES);
    expect(result.finishDate).toBeNull();
  });

  it('ignores links to nodes that are not schedulable leaves', () => {
    const toParent = [dependency({ id: 'dp', predecessorNodeId: 'n1', successorNodeId: 'n2' })];

    expect(find('n2', schedule(NODES, toParent).nodes).startDate).toBe('2027-01-04');
  });

  it('copes with an empty project', () => {
    expect(schedule([], [])).toEqual({ nodes: [], cyclic: false, finishDate: null });
  });
});

describe('Gantt geometry', () => {
  it('spans every node and baseline entry with padding', () => {
    const scale = ganttScale(NODES, [{ nodeId: 'n11', startDate: '2026-12-21', endDate: '2026-12-25' }], 20, 7);

    expect(fromDay(scale.startDay)).toBe('2026-12-14');
    expect(fromDay(scale.endDay)).toBe('2027-01-21');
    expect(ganttWidth(scale)).toBe((scale.endDay - scale.startDay + 1) * 20);
  });

  it('has a default range without nodes', () => {
    expect(ganttScale([]).endDay).toBeGreaterThan(ganttScale([]).startDay);
  });

  it('positions bars on both end days and converts pixels back to whole days', () => {
    const scale = ganttScale(NODES, [], 10, 0);
    const bar = barGeometry(scale, '2027-01-09', '2027-01-13');

    expect(bar.x).toBe(50);
    expect(bar.width).toBe(50);
    expect(barGeometry(scale, '2027-01-14', '2027-01-14').width).toBe(10);
    expect(xToDay(scale, 70) - scale.startDay).toBe(7);
    expect(xToDay(scale, 74)).toBe(xToDay(scale, 70));
  });

  it('lists a tick for the start of the range and each first of the month', () => {
    const scale = ganttScale([node({ id: 'a', startDate: '2027-01-20', endDate: '2027-03-05' })], [], 10, 0);

    expect(monthTicks(scale).map((tick) => tick.label)).toEqual(['2027-01', '2027-02', '2027-03']);
  });

  it('moves a bar and keeps its length, or resizes only the end by at least one day', () => {
    const task = { startDate: '2027-01-11', endDate: '2027-01-15', nodeType: 'WorkPackage' as const };

    expect(dragDates(task, 'move', 2)).toEqual({ startDate: '2027-01-13', endDate: '2027-01-17' });
    expect(dragDates(task, 'resize', 3)).toEqual({ startDate: '2027-01-11', endDate: '2027-01-18' });
    expect(dragDates(task, 'resize', -30)).toEqual({ startDate: '2027-01-11', endDate: '2027-01-11' });
  });

  it('moves a milestone even when asked to resize it', () => {
    const milestone = { startDate: '2027-01-18', endDate: '2027-01-18', nodeType: 'Milestone' as const };

    expect(dragDates(milestone, 'resize', 2)).toEqual({ startDate: '2027-01-20', endDate: '2027-01-20' });
  });

  it('measures the finish slip against the baseline', () => {
    const task = node({ id: 'a', endDate: '2027-01-20' });

    expect(baselineSlip(task, { nodeId: 'a', startDate: '2027-01-04', endDate: '2027-01-15' })).toBe(5);
    expect(baselineSlip(task, { nodeId: 'a', startDate: '2027-01-04', endDate: '2027-01-25' })).toBe(-5);
    expect(baselineSlip(task, undefined)).toBeNull();
  });
});

describe('Kanban', () => {
  it('puts a task in the column its completion implies', () => {
    expect(kanbanColumn({ percentComplete: 0 })).toBe('todo');
    expect(kanbanColumn({ percentComplete: 1 })).toBe('inProgress');
    expect(kanbanColumn({ percentComplete: 99 })).toBe('inProgress');
    expect(kanbanColumn({ percentComplete: 100 })).toBe('done');
  });

  it('sets the completion for a dropped card, keeping an existing in-progress value', () => {
    expect(percentForColumn({ percentComplete: 70 }, 'todo')).toBe(0);
    expect(percentForColumn({ percentComplete: 70 }, 'done')).toBe(100);
    expect(percentForColumn({ percentComplete: 70 }, 'inProgress')).toBe(70);
    expect(percentForColumn({ percentComplete: 0 }, 'inProgress')).toBe(50);
    expect(percentForColumn({ percentComplete: 100 }, 'inProgress')).toBe(50);
  });

  it('offers the leaves and narrows them by text, type and criticality', () => {
    const all = { search: '', nodeType: null, criticalOnly: false } as const;

    expect(kanbanCards(NODES, all).map((card) => card.id)).toEqual(['n11', 'n12', 'n13', 'n2']);
    expect(kanbanCards(NODES, { ...all, search: ' DESIGN ' }).map((card) => card.id)).toEqual(['n11']);
    expect(kanbanCards(NODES, { ...all, search: '1.2' }).map((card) => card.id)).toEqual(['n12']);
    expect(kanbanCards(NODES, { ...all, nodeType: 'Milestone' }).map((card) => card.id)).toEqual(['n13']);

    const critical = NODES.map((entry) => (entry.id === 'n12' ? { ...entry, isCritical: true } : entry));

    expect(kanbanCards(critical, { ...all, criticalOnly: true }).map((card) => card.id)).toEqual(['n12']);
  });
});
