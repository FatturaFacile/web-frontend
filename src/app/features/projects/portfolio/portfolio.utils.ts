import {
  BaselineNodeDates,
  BillingModel,
  DependencyType,
  KanbanColumn,
  PortfolioKpis,
  Project,
  ProjectStatus,
  ProjectType,
  ReorderItem,
  TaskDependency,
  WbsNode,
  WbsNodeType,
} from './portfolio.models';

/** Pure logic of the portfolio workspace (Mod 078): WBS tree, roll-ups, CPM preview, Gantt geometry and Kanban mapping. */

const DAY_MS = 86_400_000;

/** Italian public investment code: 15 alphanumeric characters. */
export const CUP_PATTERN = /^[A-Za-z0-9]{15}$/;
/** Italian tender code: 10 alphanumeric characters. */
export const CIG_PATTERN = /^[A-Za-z0-9]{10}$/;

export const PROJECT_TYPE_KEYS: Record<ProjectType, string> = {
  ClientBillable: 'PORTFOLIO.TYPE_CLIENT_BILLABLE',
  InternalRAndD: 'PORTFOLIO.TYPE_INTERNAL_R_AND_D',
  CapexInvestment: 'PORTFOLIO.TYPE_CAPEX',
};

export const BILLING_MODEL_KEYS: Record<BillingModel, string> = {
  TimeAndMaterials: 'PORTFOLIO.BILLING_TIME_AND_MATERIALS',
  FixedPrice: 'PORTFOLIO.BILLING_FIXED_PRICE',
  SalProgress: 'PORTFOLIO.BILLING_SAL_PROGRESS',
  Retainer: 'PORTFOLIO.BILLING_RETAINER',
};

export const STATUS_KEYS: Record<ProjectStatus, string> = {
  Planning: 'PORTFOLIO.STATUS_PLANNING',
  Active: 'PORTFOLIO.STATUS_ACTIVE',
  OnHold: 'PORTFOLIO.STATUS_ON_HOLD',
  Completed: 'PORTFOLIO.STATUS_COMPLETED',
  Cancelled: 'PORTFOLIO.STATUS_CANCELLED',
};

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  Planning: 'default',
  Active: 'green',
  OnHold: 'orange',
  Completed: 'blue',
  Cancelled: 'red',
};

export const NODE_TYPE_KEYS: Record<WbsNodeType, string> = {
  Phase: 'PORTFOLIO.NODE_PHASE',
  Deliverable: 'PORTFOLIO.NODE_DELIVERABLE',
  WorkPackage: 'PORTFOLIO.NODE_WORK_PACKAGE',
  Milestone: 'PORTFOLIO.NODE_MILESTONE',
};

export const DEPENDENCY_KEYS: Record<DependencyType, string> = {
  FS: 'PORTFOLIO.DEP_FS',
  SS: 'PORTFOLIO.DEP_SS',
  FF: 'PORTFOLIO.DEP_FF',
  SF: 'PORTFOLIO.DEP_SF',
};

export const KANBAN_KEYS: Record<KanbanColumn, string> = {
  todo: 'PORTFOLIO.KANBAN_TODO',
  inProgress: 'PORTFOLIO.KANBAN_IN_PROGRESS',
  done: 'PORTFOLIO.KANBAN_DONE',
};

// ---------------------------------------------------------------------------------------------------------------------
// Dates
// ---------------------------------------------------------------------------------------------------------------------

/** Days since the epoch of a `YYYY-MM-DD` date (timezone independent). */
export function toDay(iso: string): number {
  const [year, month, day] = iso.slice(0, 10).split('-').map(Number);

  return Math.round(Date.UTC(year, month - 1, day) / DAY_MS);
}

export function fromDay(day: number): string {
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return fromDay(toDay(iso) + days);
}

/** Signed number of days from `from` to `to`. */
export function diffDays(from: string, to: string): number {
  return toDay(to) - toDay(from);
}

// ---------------------------------------------------------------------------------------------------------------------
// Portfolio
// ---------------------------------------------------------------------------------------------------------------------

export function portfolioKpis(projects: readonly Project[]): PortfolioKpis {
  const count = (status: ProjectStatus): number => projects.filter((project) => project.status === status).length;
  const sum = (pick: (project: Project) => number): number => projects.reduce((total, project) => total + (pick(project) || 0), 0);

  return {
    total: projects.length,
    active: count('Active'),
    onHold: count('OnHold'),
    completed: count('Completed'),
    plannedCost: sum((project) => project.plannedCost),
    actualCost: sum((project) => project.actualCost),
    plannedRevenue: sum((project) => project.plannedRevenue),
    averageProgress: projects.length === 0 ? 0 : Math.round(sum((project) => project.percentComplete) / projects.length),
  };
}

// ---------------------------------------------------------------------------------------------------------------------
// WBS tree
// ---------------------------------------------------------------------------------------------------------------------

export interface TreeRow {
  node: WbsNode;
  depth: number;
  hasChildren: boolean;
}

function compareNodes(a: WbsNode, b: WbsNode): number {
  return a.sortOrder - b.sortOrder || a.wbsCode.localeCompare(b.wbsCode, undefined, { numeric: true });
}

export function childrenByParent(nodes: readonly WbsNode[]): Map<string | null, WbsNode[]> {
  const ids = new Set(nodes.map((node) => node.id));
  const groups = new Map<string | null, WbsNode[]>();

  for (const node of nodes) {
    // A node whose parent is not part of the list is shown at the top level.
    const key = node.parentNodeId !== null && ids.has(node.parentNodeId) ? node.parentNodeId : null;
    groups.set(key, [...(groups.get(key) ?? []), node]);
  }

  for (const group of groups.values()) {
    group.sort(compareNodes);
  }

  return groups;
}

/** The rows of the tree in display order; the children of a collapsed node are left out. */
export function flattenTree(nodes: readonly WbsNode[], expanded: ReadonlySet<string>): TreeRow[] {
  const groups = childrenByParent(nodes);
  const rows: TreeRow[] = [];

  const visit = (parent: string | null, depth: number): void => {
    for (const node of groups.get(parent) ?? []) {
      const hasChildren = (groups.get(node.id) ?? []).length > 0;
      rows.push({ node, depth, hasChildren });

      if (hasChildren && expanded.has(node.id)) {
        visit(node.id, depth + 1);
      }
    }
  };

  visit(null, 0);

  return rows;
}

export function parentIds(nodes: readonly WbsNode[]): string[] {
  return [...childrenByParent(nodes).keys()].filter((key): key is string => key !== null);
}

export function descendantIds(nodes: readonly WbsNode[], id: string): Set<string> {
  const groups = childrenByParent(nodes);
  const found = new Set<string>();
  const stack = [id];

  while (stack.length > 0) {
    for (const child of groups.get(stack.pop() as string) ?? []) {
      found.add(child.id);
      stack.push(child.id);
    }
  }

  return found;
}

/** The nodes that carry the schedule: those without children. Dependencies link leaves only. */
export function leafNodes(nodes: readonly WbsNode[]): WbsNode[] {
  const parents = new Set(parentIds(nodes));

  return nodes.filter((node) => !parents.has(node.id));
}

export interface Totals {
  plannedHours: number;
  actualHours: number;
  plannedCost: number;
  actualCost: number;
  plannedRevenue: number;
  percentComplete: number;
  startDate: string;
  endDate: string;
}

/** Roll-up of a node: its own figures for a leaf, the sum (and widest date range) of the children for a parent. */
export function rollupTotals(nodes: readonly WbsNode[]): Map<string, Totals> {
  const groups = childrenByParent(nodes);
  const result = new Map<string, Totals>();

  const compute = (node: WbsNode): Totals => {
    const children = groups.get(node.id) ?? [];

    if (children.length === 0) {
      const own: Totals = {
        plannedHours: node.plannedHours,
        actualHours: node.actualHours,
        plannedCost: node.plannedCost,
        actualCost: node.actualCost,
        plannedRevenue: node.plannedRevenue,
        percentComplete: node.percentComplete,
        startDate: node.startDate,
        endDate: node.endDate,
      };
      result.set(node.id, own);

      return own;
    }

    const parts = children.map(compute);
    const sum = (pick: (totals: Totals) => number): number => parts.reduce((total, part) => total + pick(part), 0);
    const hours = sum((part) => part.plannedHours);
    const totals: Totals = {
      plannedHours: hours,
      actualHours: sum((part) => part.actualHours),
      plannedCost: sum((part) => part.plannedCost),
      actualCost: sum((part) => part.actualCost),
      plannedRevenue: sum((part) => part.plannedRevenue),
      percentComplete: Math.round(
        hours > 0
          ? parts.reduce((total, part) => total + part.percentComplete * part.plannedHours, 0) / hours
          : sum((part) => part.percentComplete) / parts.length,
      ),
      startDate: parts.map((part) => part.startDate).reduce((a, b) => (a <= b ? a : b)),
      endDate: parts.map((part) => part.endDate).reduce((a, b) => (a >= b ? a : b)),
    };
    result.set(node.id, totals);

    return totals;
  };

  for (const root of groups.get(null) ?? []) {
    compute(root);
  }

  return result;
}

export type MoveAction = 'up' | 'down' | 'indent' | 'outdent';

/** The sort orders to send to `wbs-nodes/reorder` for moving a node; empty when the move is not possible. */
export function reorderItems(nodes: readonly WbsNode[], id: string, action: MoveAction): ReorderItem[] {
  const node = nodes.find((candidate) => candidate.id === id);

  if (node === undefined) {
    return [];
  }

  const groups = childrenByParent(nodes);
  const parent = groups.has(node.parentNodeId) ? node.parentNodeId : null;
  const siblings = [...(groups.get(parent) ?? [])];
  const index = siblings.findIndex((candidate) => candidate.id === id);
  const renumber = (list: readonly WbsNode[], parentNodeId: string | null): ReorderItem[] =>
    list.map((item, position) => ({ id: item.id, parentNodeId, sortOrder: position }));

  switch (action) {
    case 'up':
    case 'down': {
      const target = action === 'up' ? index - 1 : index + 1;

      if (target < 0 || target >= siblings.length) {
        return [];
      }

      [siblings[index], siblings[target]] = [siblings[target], siblings[index]];

      return renumber(siblings, parent);
    }
    case 'indent': {
      if (index <= 0) {
        return [];
      }

      const newParent = siblings[index - 1];
      const remaining = siblings.filter((candidate) => candidate.id !== id);
      const adopted = [...(groups.get(newParent.id) ?? []), node];

      return [...renumber(remaining, parent), ...renumber(adopted, newParent.id)];
    }
    case 'outdent': {
      if (parent === null) {
        return [];
      }

      const parentNode = nodes.find((candidate) => candidate.id === parent) as WbsNode;
      const grandParent = groups.has(parentNode.parentNodeId) ? parentNode.parentNodeId : null;
      const uncles = [...(groups.get(grandParent) ?? [])];
      const position = uncles.findIndex((candidate) => candidate.id === parent);
      uncles.splice(position + 1, 0, node);

      return [...renumber(uncles, grandParent), ...renumber(siblings.filter((candidate) => candidate.id !== id), parent)];
    }
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Dependencies and CPM
// ---------------------------------------------------------------------------------------------------------------------

/** `true` when linking `predecessor` to `successor` would close a loop (or links a node to itself). */
export function wouldCreateCycle(dependencies: readonly TaskDependency[], predecessor: string, successor: string): boolean {
  if (predecessor === successor) {
    return true;
  }

  const seen = new Set<string>();
  const stack = [successor];

  while (stack.length > 0) {
    const current = stack.pop() as string;

    if (current === predecessor) {
      return true;
    }

    if (seen.has(current)) {
      continue;
    }

    seen.add(current);

    for (const dependency of dependencies) {
      if (dependency.predecessorNodeId === current) {
        stack.push(dependency.successorNodeId);
      }
    }
  }

  return false;
}

export interface ScheduleResult {
  nodes: WbsNode[];
  /** `true` when the dependencies contain a loop; the nodes are then returned unchanged. */
  cyclic: boolean;
  /** End of the project: the latest finish of the leaves. */
  finishDate: string | null;
}

/** Number of days a leaf occupies on the timeline: a milestone is a point (0), any other node counts both end days. */
function duration(node: WbsNode): number {
  return node.nodeType === 'Milestone' ? 0 : Math.max(1, toDay(node.endDate) - toDay(node.startDate) + 1);
}

/** Last day shown for an exclusive finish `finish` of a node of the given duration. */
function lastDay(finish: number, length: number): number {
  return length === 0 ? finish : finish - 1;
}

/**
 * Client-side critical path method, used for the instant feedback while a bar is dragged (the API stays authoritative
 * and recalculates on drop). A leaf never starts before the day it is planned on, and is pushed later only when a
 * dependency (FS, SS, FF, SF, with lag or lead in days) requires it; a backward pass from the project finish gives the
 * late dates, the total and free float, and flags the nodes with no float as critical. Parents roll up their children.
 */
export function schedule(nodes: readonly WbsNode[], dependencies: readonly TaskDependency[]): ScheduleResult {
  const leaves = leafNodes(nodes);
  const byId = new Map(leaves.map((leaf) => [leaf.id, leaf]));
  const links = dependencies.filter((link) => byId.has(link.predecessorNodeId) && byId.has(link.successorNodeId));

  // Topological order (Kahn).
  const incoming = new Map(leaves.map((leaf) => [leaf.id, 0]));
  for (const link of links) {
    incoming.set(link.successorNodeId, (incoming.get(link.successorNodeId) ?? 0) + 1);
  }

  const queue = leaves.filter((leaf) => incoming.get(leaf.id) === 0).map((leaf) => leaf.id);
  const order: string[] = [];

  while (queue.length > 0) {
    const id = queue.shift() as string;
    order.push(id);

    for (const link of links.filter((candidate) => candidate.predecessorNodeId === id)) {
      const left = (incoming.get(link.successorNodeId) as number) - 1;
      incoming.set(link.successorNodeId, left);

      if (left === 0) {
        queue.push(link.successorNodeId);
      }
    }
  }

  if (order.length !== leaves.length) {
    return { nodes: [...nodes], cyclic: true, finishDate: null };
  }

  const length = new Map(leaves.map((leaf) => [leaf.id, duration(leaf)]));
  const es = new Map<string, number>();
  const ef = new Map<string, number>();

  for (const id of order) {
    const own = length.get(id) as number;
    let start = toDay((byId.get(id) as WbsNode).startDate);

    for (const link of links.filter((candidate) => candidate.successorNodeId === id)) {
      const predStart = es.get(link.predecessorNodeId) as number;
      const predFinish = ef.get(link.predecessorNodeId) as number;
      const earliest = {
        FS: predFinish + link.lagDays,
        SS: predStart + link.lagDays,
        FF: predFinish + link.lagDays - own,
        SF: predStart + link.lagDays - own,
      }[link.dependencyType];
      start = Math.max(start, earliest);
    }

    es.set(id, start);
    ef.set(id, start + own);
  }

  const finish = leaves.length === 0 ? 0 : Math.max(...order.map((id) => ef.get(id) as number));
  const lf = new Map(order.map((id) => [id, finish]));
  const ls = new Map<string, number>();

  for (const id of [...order].reverse()) {
    const own = length.get(id) as number;
    ls.set(id, (lf.get(id) as number) - own);

    for (const link of links.filter((candidate) => candidate.successorNodeId === id)) {
      const succStart = ls.get(id) as number;
      const succFinish = lf.get(id) as number;
      const predLength = length.get(link.predecessorNodeId) as number;
      const latestFinish = {
        FS: succStart - link.lagDays,
        SS: succStart - link.lagDays + predLength,
        FF: succFinish - link.lagDays,
        SF: succFinish - link.lagDays + predLength,
      }[link.dependencyType];
      lf.set(link.predecessorNodeId, Math.min(lf.get(link.predecessorNodeId) as number, latestFinish));
    }
  }

  const scheduled = new Map<string, WbsNode>();

  for (const id of order) {
    const node = byId.get(id) as WbsNode;
    const own = length.get(id) as number;
    const total = (ls.get(id) as number) - (es.get(id) as number);
    const slacks = links
      .filter((link) => link.predecessorNodeId === id)
      .map((link) => {
        const succStart = es.get(link.successorNodeId) as number;
        const succFinish = ef.get(link.successorNodeId) as number;

        return {
          FS: succStart - ((ef.get(id) as number) + link.lagDays),
          SS: succStart - ((es.get(id) as number) + link.lagDays),
          FF: succFinish - ((ef.get(id) as number) + link.lagDays),
          SF: succFinish - ((es.get(id) as number) + link.lagDays),
        }[link.dependencyType];
      });

    scheduled.set(id, {
      ...node,
      startDate: fromDay(es.get(id) as number),
      endDate: fromDay(lastDay(ef.get(id) as number, own)),
      earlyStart: fromDay(es.get(id) as number),
      earlyFinish: fromDay(lastDay(ef.get(id) as number, own)),
      lateStart: fromDay(ls.get(id) as number),
      lateFinish: fromDay(lastDay(lf.get(id) as number, own)),
      totalFloatDays: total,
      freeFloatDays: slacks.length > 0 ? Math.min(...slacks) : finish - (ef.get(id) as number),
      isCritical: total <= 0,
    });
  }

  const finishDate = [...scheduled.values()].map((leaf) => leaf.endDate).reduce<string | null>((latest, date) => (latest === null || date > latest ? date : latest), null);

  return { nodes: rollParents(nodes, scheduled), cyclic: false, finishDate };
}

/** Replaces the leaves with their scheduled copies and recomputes dates, float and criticality of every parent. */
function rollParents(nodes: readonly WbsNode[], scheduled: ReadonlyMap<string, WbsNode>): WbsNode[] {
  const groups = childrenByParent(nodes);
  const result = new Map<string, WbsNode>();

  const resolve = (node: WbsNode): WbsNode => {
    const children = groups.get(node.id) ?? [];

    if (children.length === 0) {
      const leaf = scheduled.get(node.id) ?? node;
      result.set(node.id, leaf);

      return leaf;
    }

    const parts = children.map(resolve);
    const floats = parts.map((part) => part.totalFloatDays).filter((value): value is number => value !== null);
    const rolled: WbsNode = {
      ...node,
      startDate: parts.map((part) => part.startDate).reduce((a, b) => (a <= b ? a : b)),
      endDate: parts.map((part) => part.endDate).reduce((a, b) => (a >= b ? a : b)),
      totalFloatDays: floats.length > 0 ? Math.min(...floats) : null,
      isCritical: parts.some((part) => part.isCritical),
    };
    result.set(node.id, rolled);

    return rolled;
  };

  for (const root of groups.get(null) ?? []) {
    resolve(root);
  }

  return nodes.map((node) => result.get(node.id) ?? node);
}

// ---------------------------------------------------------------------------------------------------------------------
// Gantt geometry
// ---------------------------------------------------------------------------------------------------------------------

export interface GanttScale {
  startDay: number;
  endDay: number;
  dayWidth: number;
}

export function ganttScale(
  nodes: readonly WbsNode[],
  baseline: readonly BaselineNodeDates[] = [],
  dayWidth = 24,
  padDays = 7,
): GanttScale {
  const dates = [...nodes.flatMap((node) => [node.startDate, node.endDate]), ...baseline.flatMap((entry) => [entry.startDate, entry.endDate])];

  if (dates.length === 0) {
    const today = toDay(new Date().toISOString().slice(0, 10));

    return { startDay: today, endDay: today + 30, dayWidth };
  }

  const days = dates.map(toDay);

  return { startDay: Math.min(...days) - padDays, endDay: Math.max(...days) + padDays, dayWidth };
}

export function dayToX(scale: GanttScale, day: number): number {
  return (day - scale.startDay) * scale.dayWidth;
}

export function xToDay(scale: GanttScale, x: number): number {
  return scale.startDay + Math.round(x / scale.dayWidth);
}

export function ganttWidth(scale: GanttScale): number {
  return (scale.endDay - scale.startDay + 1) * scale.dayWidth;
}

export interface BarGeometry {
  x: number;
  width: number;
}

/** Horizontal position of a bar; a milestone is a one-day marker and every bar covers both of its end days. */
export function barGeometry(scale: GanttScale, startDate: string, endDate: string): BarGeometry {
  const start = toDay(startDate);
  const end = Math.max(start, toDay(endDate));

  return { x: dayToX(scale, start), width: (end - start + 1) * scale.dayWidth };
}

export interface MonthTick {
  label: string;
  x: number;
}

/** First day of each month inside the range, with a `YYYY-MM` label. */
export function monthTicks(scale: GanttScale): MonthTick[] {
  const ticks: MonthTick[] = [];

  for (let day = scale.startDay; day <= scale.endDay; day++) {
    const iso = fromDay(day);

    if (iso.endsWith('-01') || day === scale.startDay) {
      ticks.push({ label: iso.slice(0, 7), x: dayToX(scale, day) });
    }
  }

  return ticks;
}

export type DragMode = 'move' | 'resize';

/** The dates of a node after dragging its bar by `deltaDays`: `move` shifts it, `resize` moves only the end (at least one day). */
export function dragDates(node: Pick<WbsNode, 'startDate' | 'endDate' | 'nodeType'>, mode: DragMode, deltaDays: number): { startDate: string; endDate: string } {
  if (mode === 'move' || node.nodeType === 'Milestone') {
    return { startDate: addDays(node.startDate, deltaDays), endDate: addDays(node.endDate, deltaDays) };
  }

  const end = Math.max(toDay(node.startDate), toDay(node.endDate) + deltaDays);

  return { startDate: node.startDate, endDate: fromDay(end) };
}

/** Signed finish slip (days) of a node against the dates of the selected baseline. */
export function baselineSlip(node: WbsNode, baseline: BaselineNodeDates | undefined): number | null {
  return baseline === undefined ? null : diffDays(baseline.endDate, node.endDate);
}

// ---------------------------------------------------------------------------------------------------------------------
// Kanban
// ---------------------------------------------------------------------------------------------------------------------

export interface KanbanFilters {
  search: string;
  nodeType: WbsNodeType | null;
  criticalOnly: boolean;
}

export function kanbanColumn(node: Pick<WbsNode, 'percentComplete'>): KanbanColumn {
  if (node.percentComplete >= 100) {
    return 'done';
  }

  return node.percentComplete > 0 ? 'inProgress' : 'todo';
}

/** The completion a card gets when dropped in a column: an in-progress card keeps its own value when it already has one. */
export function percentForColumn(node: Pick<WbsNode, 'percentComplete'>, column: KanbanColumn): number {
  switch (column) {
    case 'todo':
      return 0;
    case 'done':
      return 100;
    case 'inProgress':
      return node.percentComplete > 0 && node.percentComplete < 100 ? node.percentComplete : 50;
  }
}

/** The cards of the board: the schedulable nodes (leaves), narrowed by the filters. */
export function kanbanCards(nodes: readonly WbsNode[], filters: KanbanFilters): WbsNode[] {
  const search = filters.search.trim().toLowerCase();

  return leafNodes(nodes).filter(
    (node) =>
      (filters.nodeType === null || node.nodeType === filters.nodeType) &&
      (!filters.criticalOnly || node.isCritical) &&
      (search === '' || node.title.toLowerCase().includes(search) || node.wbsCode.toLowerCase().includes(search)),
  );
}
