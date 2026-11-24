import type { FsmBoardBlock, FsmBoardLane, FsmBoardUnassigned } from '@core';
import { describe, expect, it } from 'vitest';
import {
  assignmentWarnings,
  boardStatusKey,
  buildTechnicianRoutes,
  EMPTY_QUEUE_FILTERS,
  extractDispatchBlockers,
  filterQueue,
  formatMinutes,
  ganttDayTicks,
  ganttGeometry,
  haversineKm,
  hasWarnings,
  instantAtFraction,
  isVanReady,
  missingSkills,
  nearestNeighbourRoute,
  orderedRoute,
  projectPoints,
  queueContractIds,
  queueSkills,
  ROAD_DETOUR_FACTOR,
  routeStopsOf,
  travelMinutes,
} from './dispatcher.utils';

const site = (lat: number | null, lng: number | null) => ({ address: null, latitude: lat, longitude: lng });

function unassigned(id: string, overrides: Partial<FsmBoardUnassigned> = {}): FsmBoardUnassigned {
  return {
    work_order_id: id,
    work_order_number: `WO-${id}`,
    title: id,
    work_type: 'corrective',
    work_order_type: 'corrective',
    priority: 'normal',
    status: 'unscheduled',
    scheduled_start: null,
    scheduled_end: null,
    site: site(null, null),
    required_skills: [],
    required_parts: [],
    ...overrides,
  };
}

function lane(overrides: Partial<FsmBoardLane> = {}): FsmBoardLane {
  return {
    technician_id: 't1',
    name: 'Anna',
    is_available: true,
    skills: ['HVAC'],
    van: { warehouse_id: 'v1', ready: true, distinct_products_in_stock: 1, stock: { p1: 5 } },
    blocks: [],
    ...overrides,
  };
}

function block(id: string, start: string, lat: number | null, lng: number | null, status: FsmBoardBlock['status'] = 'dispatched'): FsmBoardBlock {
  return {
    work_order_id: id,
    work_order_number: `WO-${id}`,
    title: id,
    work_type: 'corrective',
    priority: 'normal',
    status,
    scheduled_start: start,
    scheduled_end: new Date(Date.parse(start) + 3_600_000).toISOString(),
    site: site(lat, lng),
  };
}

describe('boardStatusKey', () => {
  it('maps raw and legacy statuses to the board vocabulary', () => {
    expect(boardStatusKey('draft')).toBe('unscheduled');
    expect(boardStatusKey('scheduled')).toBe('dispatched');
    expect(boardStatusKey('in_progress')).toBe('on_site');
    expect(boardStatusKey('en_route')).toBe('en_route');
    expect(boardStatusKey('invoiced')).toBe('invoiced');
    expect(boardStatusKey('something-else')).toBe('unscheduled');
  });
});

describe('skills, van readiness and warnings', () => {
  it('finds the missing skills case-insensitively', () => {
    expect(missingSkills(['hvac', 'Electrical'], ['HVAC'])).toEqual(['Electrical']);
    expect(missingSkills([], [])).toEqual([]);
  });

  it('is ready without parts and when one van covers all of them', () => {
    const lanes = [lane({ van: { warehouse_id: 'v', ready: true, distinct_products_in_stock: 1, stock: { p1: 2 } } })];
    expect(isVanReady(unassigned('a'), lanes)).toBe(true);
    expect(isVanReady(unassigned('a', { required_parts: [{ product_id: 'p1', quantity: '2' }] }), lanes)).toBe(true);
    expect(isVanReady(unassigned('a', { required_parts: [{ product_id: 'p1', quantity: 3 }] }), lanes)).toBe(false);
    expect(isVanReady(unassigned('a', { required_parts: [{ product_id: 'p2', quantity: 1 }] }), lanes)).toBe(false);
  });

  it('sums repeated parts and treats an empty stock array and a missing van as not ready', () => {
    const wo = unassigned('a', {
      required_parts: [
        { product_id: 'p1', quantity: 3 },
        { product_id: 'p1', quantity: 3 },
      ],
    });
    expect(isVanReady(wo, [lane()])).toBe(false);
    const empty = lane({ van: { warehouse_id: 'v', ready: true, distinct_products_in_stock: 0, stock: [] } });
    expect(isVanReady(unassigned('a', { required_parts: [{ product_id: 'p1', quantity: 1 }] }), [empty])).toBe(false);
    const noVan = lane({ van: { warehouse_id: null, ready: false, distinct_products_in_stock: 0 } });
    expect(isVanReady(unassigned('a', { required_parts: [{ product_id: 'p1', quantity: 1 }] }), [noVan])).toBe(false);
  });

  it('builds the assignment warnings', () => {
    const wo = unassigned('a', { required_skills: ['electrical'], required_parts: [{ product_id: 'p9', quantity: 1 }] });
    const warnings = assignmentWarnings(wo, lane({ is_available: false }));
    expect(warnings).toEqual({ missingSkills: ['electrical'], vanNotReady: true, technicianUnavailable: true });
    expect(hasWarnings(warnings)).toBe(true);
    expect(hasWarnings(assignmentWarnings(unassigned('b'), lane()))).toBe(false);
  });
});

describe('queue filtering', () => {
  const queue = [
    unassigned('1', { priority: 'urgent', work_order_type: 'preventive', service_contract_id: 'c1', required_skills: ['hvac'] }),
    unassigned('2', { priority: 'normal', work_order_type: 'corrective', service_contract_id: 'c2', required_skills: ['electrical'] }),
    unassigned('3', { priority: 'urgent', work_order_type: 'warranty', required_parts: [{ product_id: 'p1', quantity: 99 }] }),
  ];
  const lanes = [lane()];
  const ids = (filters: Partial<typeof EMPTY_QUEUE_FILTERS>) =>
    filterQueue(queue, { ...EMPTY_QUEUE_FILTERS, ...filters }, lanes).map((wo) => wo.work_order_id);

  it('returns everything without filters', () => {
    expect(ids({})).toEqual(['1', '2', '3']);
  });

  it('filters by priority, contract and skill', () => {
    expect(ids({ priority: 'urgent' })).toEqual(['1', '3']);
    expect(ids({ contractId: 'c2' })).toEqual(['2']);
    expect(ids({ skill: 'HVAC' })).toEqual(['1']);
  });

  it('separates preventive from corrective work', () => {
    expect(ids({ kind: 'preventive' })).toEqual(['1']);
    expect(ids({ kind: 'corrective' })).toEqual(['2', '3']);
  });

  it('filters by van stock readiness', () => {
    expect(ids({ vanReadiness: 'ready' })).toEqual(['1', '2']);
    expect(ids({ vanReadiness: 'not_ready' })).toEqual(['3']);
  });

  it('lists the distinct skills and contracts of the queue', () => {
    expect(queueSkills(queue)).toEqual(['electrical', 'hvac']);
    expect(queueContractIds(queue)).toEqual(['c1', 'c2']);
  });
});

describe('extractDispatchBlockers', () => {
  it('flattens the 422 errors object', () => {
    const error = { status: 422, error: { errors: { skills: ['missing hvac'], schedule: ['overlap'], van_stock: 'short' } } };
    expect(extractDispatchBlockers(error)).toEqual({ skills: ['missing hvac'], schedule: ['overlap'], van_stock: ['short'] });
  });

  it('ignores other errors', () => {
    expect(extractDispatchBlockers({ status: 500, error: {} })).toBeNull();
    expect(extractDispatchBlockers(null)).toBeNull();
    expect(extractDispatchBlockers({ status: 422, error: { errors: {} } })).toBeNull();
  });
});

describe('gantt geometry', () => {
  const window = { from: '2026-03-02T00:00:00Z', to: '2026-03-09T00:00:00Z' };

  it('places a block as percentages of the window', () => {
    const geometry = ganttGeometry(block('a', '2026-03-02T12:00:00Z', null, null), window);
    expect(geometry?.left).toBeCloseTo((12 / (7 * 24)) * 100, 5);
    expect(geometry?.width).toBeCloseTo((1 / (7 * 24)) * 100, 5);
  });

  it('clamps blocks crossing the window edges and drops blocks outside', () => {
    const crossing = { scheduled_start: '2026-03-01T22:00:00Z', scheduled_end: '2026-03-02T02:00:00Z' };
    expect(ganttGeometry(crossing, window)?.left).toBe(0);
    expect(ganttGeometry({ scheduled_start: '2026-03-10T00:00:00Z', scheduled_end: '2026-03-10T02:00:00Z' }, window)).toBeNull();
    expect(ganttGeometry({ scheduled_start: null, scheduled_end: null }, window)).toBeNull();
  });

  it('creates one tick per day and snaps clicks to 30 minutes', () => {
    const ticks = ganttDayTicks(window);
    expect(ticks).toHaveLength(7);
    expect(ticks[1].left).toBeCloseTo(100 / 7, 5);
    expect(instantAtFraction(window, 0)).toBe('2026-03-02T00:00:00.000Z');
    expect(instantAtFraction(window, 0.5 / 7 + 0.001)).toBe('2026-03-02T12:00:00.000Z');
    expect(instantAtFraction(window, 5)).toBe('2026-03-09T00:00:00.000Z');
  });
});

describe('route optimisation', () => {
  const zurich = { id: 'z', label: 'Zurich', lat: 47.3769, lng: 8.5417 };
  const bern = { id: 'b', label: 'Bern', lat: 46.948, lng: 7.4474 };
  const basel = { id: 'ba', label: 'Basel', lat: 47.5596, lng: 7.5886 };
  const winterthur = { id: 'w', label: 'Winterthur', lat: 47.4988, lng: 8.7237 };

  it('computes great-circle distances', () => {
    expect(haversineKm(zurich, zurich)).toBe(0);
    expect(haversineKm(zurich, bern)).toBeGreaterThan(90);
    expect(haversineKm(zurich, bern)).toBeLessThan(100);
  });

  it('estimates the travel time from distance and speed', () => {
    expect(travelMinutes(50)).toBeCloseTo(60, 5);
    expect(travelMinutes(25, 50)).toBeCloseTo(30, 5);
    expect(travelMinutes(10, 0)).toBe(0);
    expect(formatMinutes(95)).toBe('1 h 35 min');
    expect(formatMinutes(20)).toBe('20 min');
  });

  it('visits the nearest stop first starting from the first stop', () => {
    // Zurich -> Winterthur (close) -> Basel -> Bern, instead of Zurich -> Bern -> Basel -> Winterthur.
    const route = nearestNeighbourRoute([zurich, bern, basel, winterthur]);
    expect(route.legs.map((leg) => leg.stop.id)).toEqual(['z', 'w', 'ba', 'b']);
    expect(route.legs[0].distanceKm).toBe(0);
    expect(route.totalKm).toBeCloseTo(route.legs.reduce((sum, leg) => sum + leg.distanceKm, 0), 9);
    expect(route.legs[1].distanceKm).toBeCloseTo(haversineKm(zurich, winterthur) * ROAD_DETOUR_FACTOR, 6);
    expect(route.totalMinutes).toBeGreaterThan(0);
  });

  it('starts from the given origin and is stable on empty input', () => {
    const route = nearestNeighbourRoute([zurich, winterthur], bern);
    expect(route.legs.map((leg) => leg.stop.id)).toEqual(['z', 'w']);
    expect(route.legs[0].distanceKm).toBeGreaterThan(0);
    expect(nearestNeighbourRoute([])).toEqual({ legs: [], totalKm: 0, totalMinutes: 0 });
  });

  it('is never longer than the scheduled order on the same stops', () => {
    const stops = [zurich, bern, basel, winterthur];
    expect(nearestNeighbourRoute(stops).totalKm).toBeLessThanOrEqual(orderedRoute(stops).totalKm);
  });

  it('keeps only open blocks with coordinates, in schedule order', () => {
    const stops = routeStopsOf([
      block('late', '2026-03-03T09:00:00Z', 47.4, 8.5),
      block('early', '2026-03-02T09:00:00Z', 47.3, 8.4),
      block('done', '2026-03-02T07:00:00Z', 47.2, 8.3, 'completed'),
      block('nogeo', '2026-03-02T08:00:00Z', null, null),
    ]);
    expect(stops.map((s) => s.id)).toEqual(['early', 'late']);
  });

  it('builds a route per technician with the saved distance', () => {
    const blocks = [
      block('1', '2026-03-02T08:00:00Z', zurich.lat, zurich.lng),
      block('2', '2026-03-02T10:00:00Z', bern.lat, bern.lng),
      block('3', '2026-03-02T12:00:00Z', basel.lat, basel.lng),
      block('4', '2026-03-02T14:00:00Z', winterthur.lat, winterthur.lng),
    ];
    const routes = buildTechnicianRoutes([lane({ blocks }), lane({ technician_id: 't2', name: 'Bruno', blocks: [] })]);
    expect(routes).toHaveLength(1);
    expect(routes[0].technicianId).toBe('t1');
    expect(routes[0].optimised.legs.map((l) => l.stop.id)).toEqual(['1', '4', '3', '2']);
    expect(routes[0].savedKm).toBeGreaterThan(0);
  });
});

describe('projectPoints', () => {
  it('keeps points inside the padded viewport with north up', () => {
    const points = projectPoints(
      [
        { lat: 47, lng: 8 },
        { lat: 48, lng: 9 },
      ],
      400,
      300,
      20,
    );
    for (const p of points) {
      expect(p.x).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(p.x).toBeLessThanOrEqual(380 + 1e-6);
      expect(p.y).toBeGreaterThanOrEqual(20 - 1e-6);
      expect(p.y).toBeLessThanOrEqual(280 + 1e-6);
    }
    expect(points[1].y).toBeLessThan(points[0].y);
    expect(points[1].x).toBeGreaterThan(points[0].x);
  });

  it('centres a single point and handles an empty list', () => {
    expect(projectPoints([{ lat: 47, lng: 8 }], 400, 300, 20)).toEqual([{ x: 200, y: 150 }]);
    expect(projectPoints([], 400, 300)).toEqual([]);
  });
});
