import { ResourceAction } from '@shared';
import { describe, expect, it } from 'vitest';
import { AUTOMOTIVE_SCHEDULE_PAGE } from './schedule.page';

const allActions = (): ResourceAction[] => AUTOMOTIVE_SCHEDULE_PAGE.tabs.flatMap((tab) => [...(tab.create ? [tab.create] : []), ...(tab.rowActions ?? [])]);

describe('Automotive schedule page', () => {
  it('reaches every scheduling endpoint of the Workshop API', () => {
    const reached = [...AUTOMOTIVE_SCHEDULE_PAGE.tabs.map((tab) => `GET ${tab.list.path}`), ...allActions().map((action) => `${action.method} ${action.path}`)];

    for (const expected of [
      'GET /workshop/schedule',
      'POST /workshop/schedule',
      'PUT /workshop/schedule/{id}',
      'POST /workshop/schedule/{id}/start',
      'POST /workshop/schedule/{id}/complete',
      'POST /workshop/schedule/{id}/cancel',
      'GET /workshop/bays',
      'POST /workshop/bays',
      'PUT /workshop/bays/{id}',
    ]) {
      expect(reached, expected).toContain(expected);
    }
  });

  it('sends the field names of the API form requests', () => {
    const keys = (method: string, path: string): string[] => (allActions().find((action) => action.method === method && action.path === path)?.fields ?? []).map((field) => field.key);

    expect(keys('POST', '/workshop/schedule')).toEqual(['folder_id', 'technician_user_id', 'bay_id', 'starts_at', 'ends_at', 'notes']);
    expect(keys('PUT', '/workshop/schedule/{id}')).not.toContain('folder_id');
    expect(keys('POST', '/workshop/bays')).toEqual(['code', 'name', 'is_active']);
  });

  it('moves only planned slots and starts only planned ones', () => {
    const find = (path: string): ResourceAction | undefined => allActions().find((action) => action.path === path);

    expect(find('/workshop/schedule/{id}')?.visible?.({ status: 'planned' })).toBe(true);
    expect(find('/workshop/schedule/{id}')?.visible?.({ status: 'in_progress' })).toBe(false);
    expect(find('/workshop/schedule/{id}/complete')?.visible?.({ status: 'in_progress' })).toBe(true);
  });
});
