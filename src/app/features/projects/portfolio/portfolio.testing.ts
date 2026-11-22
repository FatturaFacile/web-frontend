import { GanttPayload, Project, TaskDependency, WbsNode } from './portfolio.models';

/** Fixtures shared by the specs of the portfolio feature. */

export function node(overrides: Partial<WbsNode> & Pick<WbsNode, 'id'>): WbsNode {
  return {
    projectId: 'p1',
    parentNodeId: null,
    wbsCode: overrides.id,
    title: `Node ${overrides.id}`,
    nodeType: 'WorkPackage',
    plannedHours: 0,
    actualHours: 0,
    plannedCost: 0,
    actualCost: 0,
    plannedRevenue: 0,
    startDate: '2027-01-04',
    endDate: '2027-01-08',
    percentComplete: 0,
    sortOrder: 0,
    earlyStart: null,
    earlyFinish: null,
    lateStart: null,
    lateFinish: null,
    totalFloatDays: null,
    freeFloatDays: null,
    isCritical: false,
    ...overrides,
  };
}

export function dependency(overrides: Partial<TaskDependency> & Pick<TaskDependency, 'id' | 'predecessorNodeId' | 'successorNodeId'>): TaskDependency {
  return { projectId: 'p1', dependencyType: 'FS', lagDays: 0, ...overrides };
}

export function project(overrides: Partial<Project> & Pick<Project, 'id'>): Project {
  return {
    tenantId: 't1',
    legalEntityId: null,
    projectCode: `PRJ-${overrides.id}`,
    name: `Project ${overrides.id}`,
    customerId: null,
    projectManagerId: null,
    projectType: 'ClientBillable',
    billingModel: 'FixedPrice',
    costCenterId: null,
    startDate: '2027-01-04',
    targetEndDate: '2027-06-30',
    status: 'Active',
    cupCode: null,
    cigCode: null,
    plannedHours: 0,
    actualHours: 0,
    plannedCost: 0,
    actualCost: 0,
    plannedRevenue: 0,
    percentComplete: 0,
    ...overrides,
  };
}

/**
 * A small project: phase `1` with design `1.1` (4 – 8 Jan 2027), build `1.2` (9 – 13 Jan) and the milestone
 * `1.3` (14 Jan), chained finish-to-start with no slack between them (the schedule counts calendar days). `2` is a lone work package outside the chain.
 */
export const NODES: WbsNode[] = [
  node({ id: 'n1', wbsCode: '1', title: 'Phase one', nodeType: 'Phase', sortOrder: 0 }),
  node({ id: 'n11', wbsCode: '1.1', title: 'Design', parentNodeId: 'n1', sortOrder: 0, startDate: '2027-01-04', endDate: '2027-01-08', plannedHours: 40, plannedCost: 2000 }),
  node({ id: 'n12', wbsCode: '1.2', title: 'Build', parentNodeId: 'n1', sortOrder: 1, startDate: '2027-01-09', endDate: '2027-01-13', plannedHours: 80, plannedCost: 4000, percentComplete: 50 }),
  node({ id: 'n13', wbsCode: '1.3', title: 'Go live', nodeType: 'Milestone', parentNodeId: 'n1', sortOrder: 2, startDate: '2027-01-14', endDate: '2027-01-14' }),
  node({ id: 'n2', wbsCode: '2', title: 'Training', sortOrder: 1, startDate: '2027-01-04', endDate: '2027-01-06', percentComplete: 100 }),
];

export const DEPENDENCIES: TaskDependency[] = [
  dependency({ id: 'd1', predecessorNodeId: 'n11', successorNodeId: 'n12' }),
  dependency({ id: 'd2', predecessorNodeId: 'n12', successorNodeId: 'n13' }),
];

export function ganttPayload(overrides: Partial<GanttPayload> = {}): GanttPayload {
  return { project: project({ id: 'p1' }), nodes: NODES, dependencies: DEPENDENCIES, baseline: null, ...overrides };
}
