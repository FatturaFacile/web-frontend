import { describe, expect, it } from 'vitest';
import type { WorkflowNodeResource, WorkflowTransitionResource } from '@core';
import {
  buildWizardPlan,
  centerOf,
  edgeBetween,
  movedPosition,
  nextNodeKey,
  NODE_HEIGHT,
  NODE_WIDTH,
  PALETTE_NODE_TYPES,
  publishProblems,
} from './workflow-designer.util';

function node(id: string, type: WorkflowNodeResource['node_type'], x = 0, y = 0): WorkflowNodeResource {
  return { id, workflow_definition_id: 'd1', node_key: `${type}_${id}`, name: id, node_type: type, position_x: x, position_y: y };
}

function link(id: string, from: string, to: string): WorkflowTransitionResource {
  return { id, workflow_definition_id: 'd1', from_node_id: from, to_node_id: to };
}

describe('workflow designer util', () => {
  it('snaps a dragged node to the grid and keeps it on the canvas', () => {
    expect(movedPosition({ x: 40, y: 80 }, { x: 33, y: -12 })).toEqual({ x: 70, y: 70 });
    expect(movedPosition({ x: 10, y: 10 }, { x: -100, y: -100 })).toEqual({ x: 0, y: 0 });
  });

  it('draws the edges from centre to centre', () => {
    const nodes = [node('a', 'start', 0, 0), node('b', 'approval', 200, 100)];

    expect(centerOf(nodes[0])).toEqual({ x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 });
    expect(edgeBetween(link('t', 'a', 'b'), nodes)).toEqual({
      from: { x: NODE_WIDTH / 2, y: NODE_HEIGHT / 2 },
      to: { x: 200 + NODE_WIDTH / 2, y: 100 + NODE_HEIGHT / 2 },
    });
    expect(edgeBetween(link('t', 'a', 'missing'), nodes)).toBeNull();
  });

  it('picks the next free node key of a type', () => {
    expect(nextNodeKey('approval', [])).toBe('approval_1');
    expect(nextNodeKey('approval', [{ node_key: 'approval_1' }, { node_key: 'approval_2' }])).toBe('approval_3');
  });

  it('builds the linear graph of the wizard and skips blank steps', () => {
    const plan = buildWizardPlan(['Manager', '  ', 'Finance'], { start: 'Start', end: 'End' });

    expect(plan.nodes.map((n) => [n.node_key, n.node_type, n.name])).toEqual([
      ['start', 'start', 'Start'],
      ['approval_1', 'approval', 'Manager'],
      ['approval_2', 'approval', 'Finance'],
      ['end', 'end', 'End'],
    ]);
    expect(plan.transitions).toEqual([
      { from: 0, to: 1 },
      { from: 1, to: 2 },
      { from: 2, to: 3 },
    ]);
  });

  it('lists what stops a definition from being published', () => {
    expect(publishProblems([], [])).toEqual([
      'workflows.designer.problem.start',
      'workflows.designer.problem.end',
      'workflows.designer.problem.approval',
    ]);

    const nodes = [node('s', 'start'), node('a', 'approval'), node('e', 'end'), node('x', 'notification')];
    expect(publishProblems(nodes, [link('1', 's', 'a'), link('2', 'a', 'e')])).toEqual(['workflows.designer.problem.disconnected']);
    expect(publishProblems(nodes.slice(0, 3), [link('1', 's', 'a'), link('2', 'a', 'e')])).toEqual([]);
  });

  it('offers the parallel split and join in the palette with their own keys', () => {
    expect(PALETTE_NODE_TYPES).toContain('parallel_split');
    expect(PALETTE_NODE_TYPES).toContain('parallel_join');
    expect(nextNodeKey('parallel_split', [{ node_key: 'parallel_split_1' }])).toBe('parallel_split_2');
  });
});
