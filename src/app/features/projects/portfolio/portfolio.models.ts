/** Wire types of the project portfolio, WBS, CPM, Gantt, baselines and Kanban endpoints (Mod 078). Dates are `YYYY-MM-DD`. */

export const PROJECT_TYPES = ['ClientBillable', 'InternalRAndD', 'CapexInvestment'] as const;
export type ProjectType = (typeof PROJECT_TYPES)[number];

export const BILLING_MODELS = ['TimeAndMaterials', 'FixedPrice', 'SalProgress', 'Retainer'] as const;
export type BillingModel = (typeof BILLING_MODELS)[number];

export const PROJECT_STATUSES = ['Planning', 'Active', 'OnHold', 'Completed', 'Cancelled'] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const WBS_NODE_TYPES = ['Phase', 'Deliverable', 'WorkPackage', 'Milestone'] as const;
export type WbsNodeType = (typeof WBS_NODE_TYPES)[number];

export const DEPENDENCY_TYPES = ['FS', 'SS', 'FF', 'SF'] as const;
export type DependencyType = (typeof DEPENDENCY_TYPES)[number];

export interface Envelope<T> {
  data: T;
  message?: string;
  meta?: Record<string, unknown>;
}

export interface Project {
  id: string;
  tenantId: string;
  legalEntityId: string | null;
  projectCode: string;
  name: string;
  customerId: string | null;
  projectManagerId: string | null;
  projectType: ProjectType;
  billingModel: BillingModel;
  costCenterId: string | null;
  startDate: string | null;
  targetEndDate: string | null;
  status: ProjectStatus;
  /** Italian public investment code (CUP) and tender code (CIG); only meaningful for Italian public contracts. */
  cupCode: string | null;
  cigCode: string | null;
  plannedHours: number;
  actualHours: number;
  plannedCost: number;
  actualCost: number;
  plannedRevenue: number;
  percentComplete: number;
}

export interface WbsNode {
  id: string;
  projectId: string;
  parentNodeId: string | null;
  wbsCode: string;
  title: string;
  nodeType: WbsNodeType;
  plannedHours: number;
  actualHours: number;
  plannedCost: number;
  actualCost: number;
  plannedRevenue: number;
  startDate: string;
  endDate: string;
  percentComplete: number;
  sortOrder: number;
  earlyStart: string | null;
  earlyFinish: string | null;
  lateStart: string | null;
  lateFinish: string | null;
  totalFloatDays: number | null;
  freeFloatDays: number | null;
  isCritical: boolean;
}

export interface TaskDependency {
  id: string;
  projectId: string;
  predecessorNodeId: string;
  successorNodeId: string;
  dependencyType: DependencyType;
  lagDays: number;
}

export interface ProjectBaseline {
  id: string;
  projectId: string;
  baselineNumber: number;
  name: string;
  capturedAt: string;
  snapshotJson?: unknown;
}

/** The planned dates of one node frozen by a baseline, drawn under the live bar of the Gantt. */
export interface BaselineNodeDates {
  nodeId: string;
  startDate: string;
  endDate: string;
}

/** Response of `GET /projects/{id}/gantt`: the live schedule plus the nodes of the baseline asked with `baselineId`. */
export interface GanttPayload {
  project: Project;
  nodes: WbsNode[];
  dependencies: TaskDependency[];
  baseline: { id: string; name: string; nodes: BaselineNodeDates[] } | null;
}

export interface BaselineVarianceRow {
  nodeId: string;
  wbsCode: string;
  title: string;
  startVarianceDays: number;
  endVarianceDays: number;
  plannedHoursVariance: number;
  plannedCostVariance: number;
}

export interface BaselineVariance {
  baselineId: string;
  projectEndVarianceDays: number;
  rows: BaselineVarianceRow[];
}

/** A project template of #186 that a new project can be created from. */
export interface ProjectTemplate {
  id: string;
  name: string;
  code?: string | null;
  description?: string | null;
}

export interface PortfolioFilters {
  status?: ProjectStatus | null;
  projectType?: ProjectType | null;
  search?: string | null;
}

export interface ProjectPayload {
  legalEntityId?: string | null;
  projectCode: string;
  name: string;
  customerId?: string | null;
  projectManagerId?: string | null;
  projectType: ProjectType;
  billingModel: BillingModel;
  costCenterId?: string | null;
  startDate?: string | null;
  targetEndDate?: string | null;
  cupCode?: string | null;
  cigCode?: string | null;
}

export interface FromTemplatePayload {
  templateId: string;
  projectCode: string;
  name: string;
  customerId?: string | null;
  projectManagerId?: string | null;
  startDate: string;
}

export interface WbsNodePayload {
  parentNodeId?: string | null;
  title: string;
  nodeType: WbsNodeType;
  plannedHours?: number;
  plannedCost?: number;
  plannedRevenue?: number;
  startDate: string;
  endDate: string;
  percentComplete?: number;
}

export interface ReorderItem {
  id: string;
  parentNodeId: string | null;
  sortOrder: number;
}

export interface DependencyPayload {
  predecessorNodeId: string;
  successorNodeId: string;
  dependencyType: DependencyType;
  lagDays: number;
}

/** Aggregates the portfolio overview shows above the table, computed from the listed projects. */
export interface PortfolioKpis {
  total: number;
  active: number;
  onHold: number;
  completed: number;
  plannedCost: number;
  actualCost: number;
  plannedRevenue: number;
  averageProgress: number;
}

export const KANBAN_COLUMNS = ['todo', 'inProgress', 'done'] as const;
export type KanbanColumn = (typeof KANBAN_COLUMNS)[number];
