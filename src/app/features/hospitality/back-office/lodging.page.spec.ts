import { ResourceAction, ResourceField } from '@shared';
import { describe, expect, it } from 'vitest';
import { HOSPITALITY_LODGING_PAGE } from './lodging.page';

const allActions = (): ResourceAction[] => HOSPITALITY_LODGING_PAGE.tabs.flatMap((tab) => [...(tab.create ? [tab.create] : []), ...(tab.rowActions ?? []), ...(tab.toolbar ?? [])]);

const fieldKeys = (method: string, path: string): string[] => {
  const action = allActions().find((candidate) => candidate.method === method && candidate.path === path);
  expect(action, `${method} ${path}`).toBeDefined();
  return (action?.fields ?? []).map((field: ResourceField) => field.key);
};

describe('Hospitality lodging page', () => {
  it('reaches every lodging endpoint of the Hospitality API', () => {
    const reached = [...HOSPITALITY_LODGING_PAGE.tabs.map((tab) => `GET ${tab.list.path}`), ...allActions().map((action) => `${action.method} ${action.path}`)];

    for (const expected of [
      'GET /hospitality/stays',
      'POST /hospitality/stays',
      'POST /hospitality/stays/{id}/check-in',
      'POST /hospitality/stays/{id}/check-out',
      'POST /hospitality/stays/{id}/cancel',
      'POST /hospitality/stays/{id}/no-show',
      'POST /hospitality/stays/{id}/charges',
      'POST /hospitality/stays/{id}/payments',
      'GET /hospitality/housekeeping-tasks',
      'POST /hospitality/housekeeping-tasks',
      'POST /hospitality/housekeeping-tasks/{id}/start',
      'POST /hospitality/housekeeping-tasks/{id}/complete',
      'GET /hospitality/accommodations',
      'POST /hospitality/accommodations',
      'PUT /hospitality/accommodations/{id}',
      'GET /hospitality/room-types',
      'POST /hospitality/room-types',
      'PUT /hospitality/room-types/{id}',
      'GET /hospitality/rate-plans',
      'POST /hospitality/rate-plans',
      'PUT /hospitality/rate-plans/{id}',
      'GET /hospitality/stay-availability',
      'GET /hospitality/stay-quote',
    ]) {
      expect(reached, expected).toContain(expected);
    }
  });

  it('sends the field names of the API form requests', () => {
    expect(fieldKeys('POST', '/hospitality/group-blocks/{id}/dates')).toEqual(['check_in_date', 'check_out_date', 'release_date']);
    expect(fieldKeys('POST', '/hospitality/stays')).toEqual(['guest_name', 'guest_email', 'room_type_id', 'rate_plan_id', 'check_in_date', 'check_out_date', 'adults', 'notes']);
    expect(fieldKeys('POST', '/hospitality/stays/{id}/check-in')).toEqual(['accommodation_id', 'city_tax_per_person_night']);
    expect(fieldKeys('POST', '/hospitality/stays/{id}/charges')).toEqual(['category', 'description', 'quantity', 'unit_amount', 'posted_on']);
    expect(fieldKeys('POST', '/hospitality/stays/{id}/payments')).toEqual(['amount', 'payment_method', 'description']);
    expect(fieldKeys('POST', '/hospitality/housekeeping-tasks')).toEqual(['accommodation_id', 'task_type', 'due_on', 'assigned_to']);
    expect(fieldKeys('POST', '/hospitality/accommodations')).toEqual(['room_type_id', 'number', 'floor', 'status', 'housekeeping_status']);
    expect(fieldKeys('POST', '/hospitality/room-types')).toEqual(['code', 'name', 'max_occupancy', 'base_rate', 'is_active']);
    expect(fieldKeys('POST', '/hospitality/rate-plans')).toEqual(['code', 'name', 'room_type_id', 'meal_plan', 'nightly_rate', 'valid_from', 'valid_to', 'min_stay', 'priority', 'is_active']);
  });

  it('offers the stay actions only in the statuses the API accepts them', () => {
    const checkIn = allActions().find((action) => action.path === '/hospitality/stays/{id}/check-in');
    const checkOut = allActions().find((action) => action.path === '/hospitality/stays/{id}/check-out');

    expect(checkIn?.visible?.({ status: 'booked' })).toBe(true);
    expect(checkIn?.visible?.({ status: 'checked_in' })).toBe(false);
    expect(checkOut?.visible?.({ status: 'checked_in' })).toBe(true);
    expect(checkOut?.visible?.({ status: 'booked' })).toBe(false);
  });
});
