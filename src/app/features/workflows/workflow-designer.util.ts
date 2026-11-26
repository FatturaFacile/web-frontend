import type { WorkflowNodeResource, WorkflowNodeType, WorkflowSaveNodeRequest, WorkflowTransitionResource } from '@core';

export const NODE_WIDTH = 168;
export const NODE_HEIGHT = 56;
const GRID_X = 220;
const ORIGIN_X = 40;
const ORIGIN_Y = 80;

export const PALETTE_NODE_TYPES: readonly WorkflowNodeType[] = ['approval', 'condition', 'notification', 'end'];

export interface Point {
  x: number;
  y: number;
}

/** Position of a node on the canvas (0 when the API has none yet). */
export function positionOf(node: Pick<WorkflowNodeResource, 'position_x' | 'position_y'>): Point {
  return { x: node.position_x ?? 0, y: node.position_y ?? 0 };
}

/** Position after a drag: the old one plus the drag distance, rounded to the 10 px grid and kept on the canvas. */
export function movedPosition(from: Point, distance: Point): Point {
  const snap = (value: number): number => Math.max(0, Math.round(value / 10) * 10);
  return { x: snap(from.x + distance.x), y: snap(from.y + distance.y) };
}

/** Centre of a node box, where the edges start and end. */
export function centerOf(node: Pick<WorkflowNodeResource, 'position_x' | 'position_y'>): Point {
  const position = positionOf(node);
  return { x: position.x + NODE_WIDTH / 2, y: position.y + NODE_HEIGHT / 2 };
}

/** Edge of the canvas between two nodes, or null when one of them is unknown. */
export function edgeBetween(
  transition: Pick<WorkflowTransitionResource, 'from_node_id' | 'to_node_id'>,
  nodes: readonly WorkflowNodeResource[],
): { from: Point; to: Point } | null {
  const from = nodes.find((node) => node.id === transition.from_node_id);
  const to = nodes.find((node) => node.id === transition.to_node_id);
  return from && to ? { from: centerOf(from), to: centerOf(to) } : null;
}

/** Unique node key for a new node of a type: `approval_1`, `approval_2`, ... */
export function nextNodeKey(type: WorkflowNodeType, nodes: readonly Pick<WorkflowNodeResource, 'node_key'>[]): string {
  const taken = new Set(nodes.map((node) => node.node_key));
  let index = 1;
  while (taken.has(`${type}_${index}`)) {
    index += 1;
  }
  return `${type}_${index}`;
}

/** Default position of the n-th node of the canvas: a row, then the next row every 4 nodes. */
export function slotPosition(index: number): Point {
  return { x: ORIGIN_X + (index % 4) * GRID_X, y: ORIGIN_Y + Math.floor(index / 4) * 120 };
}

export interface WizardPlan {
  nodes: WorkflowSaveNodeRequest[];
  /** Index pairs into `nodes`: every node leads to the next one. */
  transitions: { from: number; to: number }[];
}

/** The linear graph of the wizard: start, one approval node per step name, end. Blank step names are ignored; the labels name the start and end nodes. */
export function buildWizardPlan(stepNames: readonly string[], labels: { start: string; end: string }): WizardPlan {
  const names = stepNames.map((name) => name.trim()).filter((name) => name !== '');
  const nodes: WorkflowSaveNodeRequest[] = [
    { node_key: 'start', name: labels.start, node_type: 'start', ...toXY(slotPosition(0)) },
    ...names.map(
      (name, index): WorkflowSaveNodeRequest => ({
        node_key: `approval_${index + 1}`,
        name,
        node_type: 'approval',
        ...toXY(slotPosition(index + 1)),
      }),
    ),
    { node_key: 'end', name: labels.end, node_type: 'end', ...toXY(slotPosition(names.length + 1)) },
  ];
  return { nodes, transitions: nodes.slice(1).map((_, index) => ({ from: index, to: index + 1 })) };
}

function toXY(point: Point): { position_x: number; position_y: number } {
  return { position_x: point.x, position_y: point.y };
}

/** Problems that stop a definition from being published (translation keys). */
export function publishProblems(nodes: readonly WorkflowNodeResource[], transitions: readonly WorkflowTransitionResource[]): string[] {
  const problems: string[] = [];
  if (nodes.filter((node) => node.node_type === 'start').length !== 1) {
    problems.push('workflows.designer.problem.start');
  }
  if (!nodes.some((node) => node.node_type === 'end')) {
    problems.push('workflows.designer.problem.end');
  }
  if (!nodes.some((node) => node.node_type === 'approval')) {
    problems.push('workflows.designer.problem.approval');
  }
  const connected = new Set(transitions.flatMap((transition) => [transition.from_node_id, transition.to_node_id]));
  if (nodes.length > 1 && nodes.some((node) => !connected.has(node.id))) {
    problems.push('workflows.designer.problem.disconnected');
  }
  return problems;
}
