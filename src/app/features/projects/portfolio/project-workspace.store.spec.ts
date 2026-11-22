import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProjectPortfolioApiService } from './portfolio-api.service';
import { ganttPayload, NODES } from './portfolio.testing';
import { ProjectWorkspaceStore } from './project-workspace.store';

function createApi() {
  return {
    gantt: vi.fn((_id: string, _baselineId?: string | null) => of({ data: ganttPayload() })),
    baselines: vi.fn(() => of({ data: [{ id: 'b1', projectId: 'p1', baselineNumber: 1, name: 'Kick-off', capturedAt: '2027-01-01' }] })),
    captureBaseline: vi.fn(() => of({ data: {} })),
    variance: vi.fn(() => of({ data: { baselineId: 'b1', projectEndVarianceDays: 3, rows: [] } })),
    updateNode: vi.fn(() => of({ data: {} })),
    createNode: vi.fn(() => of({ data: {} })),
    deleteNode: vi.fn(() => of({})),
    reorderNodes: vi.fn(() => of({ data: [] })),
    recalculate: vi.fn(() => of({ data: [] })),
    createDependency: vi.fn(() => of({ data: {} })),
    updateDependency: vi.fn(() => of({ data: {} })),
    deleteDependency: vi.fn(() => of({})),
  };
}

describe('ProjectWorkspaceStore', () => {
  let api: ReturnType<typeof createApi>;
  let store: InstanceType<typeof ProjectWorkspaceStore>;

  beforeEach(async () => {
    api = createApi();
    TestBed.resetTestingModule();
    TestBed.configureTestingModule({
      providers: [ProjectWorkspaceStore, { provide: ProjectPortfolioApiService, useValue: api }],
    });
    store = TestBed.inject(ProjectWorkspaceStore);
    await store.load('p1');
  });

  it('loads the schedule and the baselines and opens every parent', () => {
    expect(store.project()?.id).toBe('p1');
    expect(store.nodes()).toHaveLength(NODES.length);
    expect(store.dependencies()).toHaveLength(2);
    expect(store.baselines()).toHaveLength(1);
    expect(store.loading()).toBe(false);
    expect(store.rows().map((row) => row.node.id)).toEqual(['n1', 'n11', 'n12', 'n13', 'n2']);
  });

  it('flags a load error', async () => {
    api.gantt.mockReturnValueOnce(throwError(() => new Error('boom')));
    await store.load('p1');

    expect(store.error()).toBe(true);
    expect(store.loading()).toBe(false);
  });

  it('collapses and expands one branch or all of them', () => {
    store.toggle('n1');

    expect(store.rows().map((row) => row.node.id)).toEqual(['n1', 'n2']);

    store.toggle('n1');
    store.toggleAll();

    expect(store.allExpanded()).toBe(false);

    store.toggleAll();

    expect(store.allExpanded()).toBe(true);
  });

  it('exposes the roll-ups, the selection and the critical count', () => {
    store.select('n12');

    expect(store.selectedNode()?.title).toBe('Build');
    expect(store.totals().get('n1')?.plannedHours).toBe(120);
    expect(store.criticalCount()).toBe(0);
  });

  it('previews the cascade of a dragged bar without calling the API', () => {
    store.previewMove('n11', 'resize', 4);

    const build = store.nodes().find((node) => node.id === 'n12');

    expect(store.previewing()).toBe(true);
    expect(store.nodes().find((node) => node.id === 'n11')?.endDate).toBe('2027-01-12');
    expect(build?.startDate).toBe('2027-01-13');
    expect(store.nodes().find((node) => node.id === 'n13')?.startDate).toBe('2027-01-18');
    expect(store.criticalCount()).toBeGreaterThan(0);
    expect(api.updateNode).not.toHaveBeenCalled();
  });

  it('computes every preview from the dates before the drag, not from the previous preview', () => {
    store.previewMove('n11', 'resize', 4);
    store.previewMove('n11', 'resize', 1);

    expect(store.nodes().find((node) => node.id === 'n11')?.endDate).toBe('2027-01-09');
    expect(store.nodes().find((node) => node.id === 'n12')?.startDate).toBe('2027-01-10');
  });

  it('restores the schedule when the drag is cancelled', () => {
    store.previewMove('n12', 'move', 5);
    store.cancelMove();

    expect(store.previewing()).toBe(false);
    expect(store.nodes().find((node) => node.id === 'n12')?.startDate).toBe('2027-01-09');
  });

  it('commits a drop: saves the dates, recalculates, then reloads the server schedule', async () => {
    store.previewMove('n11', 'resize', 4);

    expect(await store.commitMove('n11')).toBe(true);
    expect(api.updateNode).toHaveBeenCalledWith('p1', 'n11', { startDate: '2027-01-04', endDate: '2027-01-12' });
    expect(api.recalculate).toHaveBeenCalledWith('p1');
    expect(api.gantt).toHaveBeenCalledTimes(2);
    expect(store.previewing()).toBe(false);
    expect(store.saving()).toBe(false);
  });

  it('goes back to the server schedule when the drop is refused', async () => {
    api.updateNode.mockReturnValueOnce(throwError(() => new Error('conflict')));
    store.previewMove('n11', 'resize', 4);

    expect(await store.commitMove('n11')).toBe(false);
    expect(api.gantt).toHaveBeenCalledTimes(2);
    expect(store.nodes().find((node) => node.id === 'n11')?.endDate).toBe('2027-01-08');
    expect(store.saving()).toBe(false);
  });

  it('refuses a dependency that closes a loop before calling the API', async () => {
    expect(await store.addDependency({ predecessorNodeId: 'n13', successorNodeId: 'n11', dependencyType: 'FS', lagDays: 0 })).toBe('cycle');
    expect(api.createDependency).not.toHaveBeenCalled();
  });

  it('creates, updates and deletes dependencies and reloads the schedule', async () => {
    const payload = { predecessorNodeId: 'n2', successorNodeId: 'n12', dependencyType: 'SS' as const, lagDays: -1 };

    expect(await store.addDependency(payload)).toBe('created');
    expect(api.createDependency).toHaveBeenCalledWith('p1', payload);

    expect(await store.updateDependency('d1', { dependencyType: 'FF', lagDays: 2 })).toBe(true);
    expect(api.updateDependency).toHaveBeenCalledWith('p1', 'd1', { dependencyType: 'FF', lagDays: 2 });

    expect(await store.deleteDependency('d1')).toBe(true);
    expect(api.deleteDependency).toHaveBeenCalledWith('p1', 'd1');
    expect(api.gantt).toHaveBeenCalledTimes(4);
  });

  it('reports a failed dependency call', async () => {
    api.createDependency.mockReturnValueOnce(throwError(() => new Error('422')));

    expect(await store.addDependency({ predecessorNodeId: 'n2', successorNodeId: 'n12', dependencyType: 'FS', lagDays: 0 })).toBe('failed');
  });

  it('creates a node, or updates it when an id is given', async () => {
    const payload = { title: 'New', nodeType: 'WorkPackage' as const, startDate: '2027-02-01', endDate: '2027-02-05' };

    expect(await store.saveNode(payload)).toBe(true);
    expect(api.createNode).toHaveBeenCalledWith('p1', payload);

    expect(await store.saveNode(payload, 'n2')).toBe(true);
    expect(api.updateNode).toHaveBeenCalledWith('p1', 'n2', payload);
  });

  it('deletes a node and drops the selection when it was the selected one', async () => {
    store.select('n2');

    expect(await store.deleteNode('n2')).toBe(true);
    expect(api.deleteNode).toHaveBeenCalledWith('p1', 'n2');
    expect(store.selectedNodeId()).toBeNull();
  });

  it('sends the new order when a node is moved, and nothing when the move is impossible', async () => {
    expect(await store.moveNode('n12', 'up')).toBe(true);
    expect(api.reorderNodes).toHaveBeenCalledWith('p1', [
      { id: 'n12', parentNodeId: 'n1', sortOrder: 0 },
      { id: 'n11', parentNodeId: 'n1', sortOrder: 1 },
      { id: 'n13', parentNodeId: 'n1', sortOrder: 2 },
    ]);

    api.reorderNodes.mockClear();

    expect(await store.moveNode('n11', 'up')).toBe(false);
    expect(api.reorderNodes).not.toHaveBeenCalled();
  });

  it('overlays a baseline and loads its variance, and clears both again', async () => {
    api.gantt.mockReturnValueOnce(
      of({ data: ganttPayload({ baseline: { id: 'b1', name: 'Kick-off', nodes: [{ nodeId: 'n11', startDate: '2027-01-04', endDate: '2027-01-06' }] } }) }),
    );

    expect(await store.selectBaseline('b1')).toBe(true);
    expect(api.gantt).toHaveBeenLastCalledWith('p1', 'b1');
    expect(store.baselineByNode().get('n11')?.endDate).toBe('2027-01-06');
    expect(store.variance()?.projectEndVarianceDays).toBe(3);

    await store.selectBaseline(null);

    expect(store.baselineByNode().size).toBe(0);
    expect(store.variance()).toBeNull();
  });

  it('captures a baseline and refreshes the list', async () => {
    expect(await store.captureBaseline('Re-plan')).toBe(true);
    expect(api.captureBaseline).toHaveBeenCalledWith('p1', 'Re-plan');
    expect(api.baselines).toHaveBeenCalledTimes(2);
  });

  it('recalculates the critical path on request', async () => {
    expect(await store.recalculate()).toBe(true);
    expect(api.recalculate).toHaveBeenCalledWith('p1');
  });
});
