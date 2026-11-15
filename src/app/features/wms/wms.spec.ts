import { describe, expect, it } from 'vitest';
import { WMS_CROSS_DOCK_PAGE, WMS_DOCKS_PAGE, WMS_SLOTTING_PAGE, WMS_TASKS_PAGE } from './wms.pages';
import { WMS_ROUTES } from './wms.routes';

const PAGES = [WMS_TASKS_PAGE, WMS_SLOTTING_PAGE, WMS_CROSS_DOCK_PAGE, WMS_DOCKS_PAGE];

describe('WMS screens', () => {
  it('every panel reads and writes inside the wms API under the wms module', () => {
    for (const page of PAGES) {
      for (const tab of page.tabs) {
        expect(tab.module).toBe('wms');
        expect(tab.list.path.startsWith('/wms/')).toBe(true);
        for (const action of [tab.create, ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])]) {
          if (action) {
            expect(action.path.startsWith('/wms/')).toBe(true);
          }
        }
      }
    }
  });

  it('sends the payload fields the API FormRequests validate', () => {
    const create = WMS_TASKS_PAGE.tabs[0].create;
    expect(create?.fields?.map((field) => field.key)).toEqual([
      'warehouse_id', 'task_type', 'priority', 'stock_item_id', 'source_bin_id', 'destination_bin_id', 'planned_quantity', 'reference', 'due_at', 'notes',
    ]);
    const door = WMS_DOCKS_PAGE.tabs[1].create;
    expect(door?.fields?.map((field) => field.key)).toEqual(['warehouse_id', 'code', 'name', 'direction', 'is_active', 'notes']);
    const crossDock = WMS_CROSS_DOCK_PAGE.tabs[0].create?.fields?.find((field) => field.key === 'lines');
    expect(crossDock?.fields?.map((field) => field.key)).toEqual(['stock_item_id', 'inbound_quantity', 'outbound_quantity']);
  });

  it('offers the task actions only in the states the state machine allows', () => {
    const actions = WMS_TASKS_PAGE.tabs[0].rowActions ?? [];
    const visibleFor = (status: string) => actions.filter((action) => action.visible?.({ status }) ?? true).map((action) => action.path.split('/').pop());
    expect(visibleFor('in_progress')).toEqual(expect.arrayContaining(['confirm', 'short', 'skip', 'cancel']));
    expect(visibleFor('in_progress')).not.toContain('start');
    expect(visibleFor('completed')).toEqual([]);
  });

  it('lazy routes cover the dashboard and the four pages', () => {
    expect(WMS_ROUTES.map((route) => route.path)).toEqual(['', 'tasks', 'slotting', 'cross-dock', 'docks']);
  });
});
