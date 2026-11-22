import type {
  FsmBoardBlock,
  FsmBoardLane,
  FsmBoardStatus,
  FsmBoardUnassigned,
  FsmDispatchBlockers,
} from '@core';

/** Pure helpers of the dispatcher board: queue filtering, warnings, Gantt geometry, map projection and route ordering. */

export type BoardStatusKey = 'unscheduled' | 'dispatched' | 'en_route' | 'on_site' | 'completed' | 'invoiced' | 'cancelled';

export const BOARD_STATUS_KEYS: readonly BoardStatusKey[] = [
  'unscheduled',
  'dispatched',
  'en_route',
  'on_site',
  'completed',
  'invoiced',
];

/** Colors of the status legend and the Gantt blocks (all keep AA contrast against white text). */
export const BOARD_STATUS_COLORS: Record<BoardStatusKey, string> = {
  unscheduled: '#595959',
  dispatched: '#0958d9',
  en_route: '#ad4e00',
  on_site: '#531dab',
  completed: '#237804',
  invoiced: '#08979c',
  cancelled: '#a8071a',
};

/** Maps the raw board status (including the legacy `draft`, `scheduled`, `in_progress`) to the board vocabulary. */
export function boardStatusKey(status: FsmBoardStatus | string): BoardStatusKey {
  switch (status) {
    case 'draft':
    case 'unscheduled':
      return 'unscheduled';
    case 'scheduled':
    case 'dispatched':
      return 'dispatched';
    case 'en_route':
      return 'en_route';
    case 'in_progress':
    case 'on_site':
      return 'on_site';
    case 'completed':
      return 'completed';
    case 'invoiced':
      return 'invoiced';
    case 'cancelled':
      return 'cancelled';
    default:
      return 'unscheduled';
  }
}

// ---------------------------------------------------------------------------------------------------------------------
// Queue filtering and warnings
// ---------------------------------------------------------------------------------------------------------------------

export type VanReadinessFilter = 'all' | 'ready' | 'not_ready';
export type WorkKindFilter = 'all' | 'preventive' | 'corrective';

export interface QueueFilters {
  priority: string;
  contractId: string;
  skill: string;
  vanReadiness: VanReadinessFilter;
  kind: WorkKindFilter;
}

export const EMPTY_QUEUE_FILTERS: QueueFilters = {
  priority: '',
  contractId: '',
  skill: '',
  vanReadiness: 'all',
  kind: 'all',
};

const PRIORITY_RANK: Record<string, number> = { urgent: 0, critical: 0, high: 1, medium: 2, normal: 2, low: 3 };

export function priorityRank(priority: string): number {
  return PRIORITY_RANK[priority] ?? 3;
}

export function normalizeSkill(skill: string): string {
  return skill.trim().toLowerCase();
}

/** Skills the technician lacks for the work order (comparison is case-insensitive). */
export function missingSkills(required: readonly string[], technicianSkills: readonly string[]): string[] {
  const have = new Set(technicianSkills.map(normalizeSkill));
  return required.filter((skill) => !have.has(normalizeSkill(skill)));
}

function stockOf(lane: FsmBoardLane): Record<string, number> {
  const stock = lane.van.stock;
  return stock && !Array.isArray(stock) ? stock : {};
}

/** Whether the van of the lane holds every part the work order needs. A lane without a van never is ready. */
export function vanCoversParts(wo: Pick<FsmBoardUnassigned, 'required_parts'>, lane: FsmBoardLane): boolean {
  if (!lane.van.ready) {
    return false;
  }
  const stock = stockOf(lane);
  const needed = new Map<string, number>();
  for (const part of wo.required_parts) {
    needed.set(part.product_id, (needed.get(part.product_id) ?? 0) + Number(part.quantity));
  }
  for (const [productId, quantity] of needed) {
    if ((stock[productId] ?? 0) + 1e-9 < quantity) {
      return false;
    }
  }
  return true;
}

/** Ready when the work order needs no part, or at least one technician van covers all of them. */
export function isVanReady(wo: Pick<FsmBoardUnassigned, 'required_parts'>, lanes: readonly FsmBoardLane[]): boolean {
  if (wo.required_parts.length === 0) {
    return true;
  }
  return lanes.some((lane) => vanCoversParts(wo, lane));
}

export function filterQueue(
  queue: readonly FsmBoardUnassigned[],
  filters: QueueFilters,
  lanes: readonly FsmBoardLane[],
): FsmBoardUnassigned[] {
  const skill = normalizeSkill(filters.skill);
  return queue.filter((wo) => {
    if (filters.priority && wo.priority !== filters.priority) {
      return false;
    }
    if (filters.contractId && wo.service_contract_id !== filters.contractId) {
      return false;
    }
    if (skill && !wo.required_skills.some((s) => normalizeSkill(s) === skill)) {
      return false;
    }
    const kind = wo.work_order_type ?? wo.work_type;
    if (filters.kind === 'preventive' && kind !== 'preventive') {
      return false;
    }
    if (filters.kind === 'corrective' && kind === 'preventive') {
      return false;
    }
    if (filters.vanReadiness !== 'all') {
      const ready = isVanReady(wo, lanes);
      if ((filters.vanReadiness === 'ready') !== ready) {
        return false;
      }
    }
    return true;
  });
}

export interface AssignmentWarnings {
  missingSkills: string[];
  vanNotReady: boolean;
  technicianUnavailable: boolean;
}

/** Warnings shown next to a candidate assignment, mirroring the checks the dispatch endpoint enforces. */
export function assignmentWarnings(wo: FsmBoardUnassigned, lane: FsmBoardLane): AssignmentWarnings {
  return {
    missingSkills: missingSkills(wo.required_skills, lane.skills),
    vanNotReady: wo.required_parts.length > 0 && !vanCoversParts(wo, lane),
    technicianUnavailable: !lane.is_available,
  };
}

export function hasWarnings(warnings: AssignmentWarnings): boolean {
  return warnings.missingSkills.length > 0 || warnings.vanNotReady || warnings.technicianUnavailable;
}

/** Distinct, sorted skills of the queue, to feed the skill filter. */
export function queueSkills(queue: readonly FsmBoardUnassigned[]): string[] {
  return [...new Set(queue.flatMap((wo) => wo.required_skills.map(normalizeSkill)))].sort();
}

/** The contracts referenced by the queue, to feed the contract filter. */
export function queueContractIds(queue: readonly FsmBoardUnassigned[]): string[] {
  return [...new Set(queue.map((wo) => wo.service_contract_id).filter((id): id is string => !!id))].sort();
}

/**
 * Blockers of a rejected dispatch: the 422 `errors` object (`schedule`, `skills`, `van_stock`, `technician`, `hse`,
 * ...) flattened to message lists. Returns `null` when the error is not a validation error.
 */
export function extractDispatchBlockers(error: unknown): FsmDispatchBlockers | null {
  const candidate = error as { status?: unknown; error?: { errors?: unknown } } | null;
  const errors = candidate?.error?.errors;
  if (!candidate || candidate.status !== 422 || errors === null || typeof errors !== 'object') {
    return null;
  }
  const result: FsmDispatchBlockers = {};
  for (const [key, value] of Object.entries(errors as Record<string, unknown>)) {
    const messages = (Array.isArray(value) ? value : [value]).filter((m): m is string => typeof m === 'string');
    if (messages.length > 0) {
      result[key] = messages;
    }
  }
  return Object.keys(result).length > 0 ? result : null;
}

// ---------------------------------------------------------------------------------------------------------------------
// Gantt geometry
// ---------------------------------------------------------------------------------------------------------------------

export interface GanttWindow {
  from: string;
  to: string;
}

export interface GanttBarGeometry {
  /** Percent of the window width. */
  left: number;
  width: number;
}

/** Position of a scheduled block inside the board window, clamped to it. `null` when it lies outside or is unscheduled. */
export function ganttGeometry(block: Pick<FsmBoardBlock, 'scheduled_start' | 'scheduled_end'>, window: GanttWindow): GanttBarGeometry | null {
  if (!block.scheduled_start || !block.scheduled_end) {
    return null;
  }
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const start = Date.parse(block.scheduled_start);
  const end = Date.parse(block.scheduled_end);
  if ([from, to, start, end].some(Number.isNaN) || to <= from || end <= from || start >= to) {
    return null;
  }
  const span = to - from;
  const left = (Math.max(start, from) - from) / span;
  const right = (Math.min(end, to) - from) / span;
  return { left: left * 100, width: Math.max((right - left) * 100, 0.5) };
}

export interface GanttTick {
  /** ISO date-time of the day start. */
  at: string;
  left: number;
}

/** One tick per day of the window (the window start counts as the first). */
export function ganttDayTicks(window: GanttWindow): GanttTick[] {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  if (Number.isNaN(from) || Number.isNaN(to) || to <= from) {
    return [];
  }
  const dayMs = 24 * 60 * 60 * 1000;
  const ticks: GanttTick[] = [];
  for (let at = from; at < to && ticks.length < 62; at += dayMs) {
    ticks.push({ at: new Date(at).toISOString(), left: ((at - from) / (to - from)) * 100 });
  }
  return ticks;
}

/** Instant (ISO) under a click at `fraction` (0..1) of the window, snapped to `stepMinutes`. */
export function instantAtFraction(window: GanttWindow, fraction: number, stepMinutes = 30): string {
  const from = Date.parse(window.from);
  const to = Date.parse(window.to);
  const clamped = Math.min(Math.max(fraction, 0), 1);
  const step = stepMinutes * 60 * 1000;
  const raw = from + clamped * (to - from);
  return new Date(Math.round(raw / step) * step).toISOString();
}

// ---------------------------------------------------------------------------------------------------------------------
// Map and route optimisation
// ---------------------------------------------------------------------------------------------------------------------

export interface GeoPoint {
  lat: number;
  lng: number;
}

export interface RouteStop extends GeoPoint {
  id: string;
  label: string;
}

export interface RouteLeg {
  stop: RouteStop;
  /** Distance from the previous stop, in km (0 for the first stop when no start is given). */
  distanceKm: number;
  travelMinutes: number;
}

export interface OptimisedRoute {
  legs: RouteLeg[];
  totalKm: number;
  totalMinutes: number;
}

const EARTH_RADIUS_KM = 6371.0088;
/** Average road speed used for the travel-time estimate when nothing better is known. */
export const DEFAULT_AVERAGE_SPEED_KMH = 50;
/** Straight-line distance understates road distance; a flat detour factor keeps the estimate honest. */
export const ROAD_DETOUR_FACTOR = 1.3;

const toRad = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle distance in km. */
export function haversineKm(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Estimated road distance: straight line times the detour factor. */
export function roadKm(a: GeoPoint, b: GeoPoint): number {
  return haversineKm(a, b) * ROAD_DETOUR_FACTOR;
}

export function travelMinutes(km: number, speedKmh: number = DEFAULT_AVERAGE_SPEED_KMH): number {
  return speedKmh > 0 ? (km / speedKmh) * 60 : 0;
}

/**
 * Nearest-neighbour ordering of the stops. Begins at `start` (e.g. the technician base); without a start the first
 * given stop is the origin. Ties resolve to the earlier input index, so the result is deterministic.
 */
export function nearestNeighbourRoute(
  stops: readonly RouteStop[],
  start: GeoPoint | null = null,
  speedKmh: number = DEFAULT_AVERAGE_SPEED_KMH,
): OptimisedRoute {
  const remaining = [...stops];
  const legs: RouteLeg[] = [];
  let current: GeoPoint | null = start;

  if (current === null && remaining.length > 0) {
    const first = remaining.shift() as RouteStop;
    legs.push({ stop: first, distanceKm: 0, travelMinutes: 0 });
    current = first;
  }

  while (remaining.length > 0 && current !== null) {
    let bestIndex = 0;
    let bestKm = Number.POSITIVE_INFINITY;
    remaining.forEach((candidate, index) => {
      const km = roadKm(current as GeoPoint, candidate);
      if (km < bestKm) {
        bestKm = km;
        bestIndex = index;
      }
    });
    const [next] = remaining.splice(bestIndex, 1);
    legs.push({ stop: next, distanceKm: bestKm, travelMinutes: travelMinutes(bestKm, speedKmh) });
    current = next;
  }

  return summarise(legs);
}

/** Distance and time of the stops visited in the given order (no reordering): the baseline of the optimisation. */
export function orderedRoute(
  stops: readonly RouteStop[],
  start: GeoPoint | null = null,
  speedKmh: number = DEFAULT_AVERAGE_SPEED_KMH,
): OptimisedRoute {
  let previous: GeoPoint | null = start;
  const legs = stops.map((stop): RouteLeg => {
    const km = previous === null ? 0 : roadKm(previous, stop);
    previous = stop;
    return { stop, distanceKm: km, travelMinutes: travelMinutes(km, speedKmh) };
  });
  return summarise(legs);
}

function summarise(legs: RouteLeg[]): OptimisedRoute {
  return {
    legs,
    totalKm: legs.reduce((sum, leg) => sum + leg.distanceKm, 0),
    totalMinutes: legs.reduce((sum, leg) => sum + leg.travelMinutes, 0),
  };
}

export interface TechnicianRoute {
  technicianId: string;
  name: string;
  current: OptimisedRoute;
  optimised: OptimisedRoute;
  savedKm: number;
}

/** Work-order blocks that still have to be visited (not completed, invoiced or cancelled) and carry coordinates. */
export function routeStopsOf(blocks: readonly FsmBoardBlock[]): RouteStop[] {
  return [...blocks]
    .filter((block) => {
      const key = boardStatusKey(block.status);
      return key !== 'completed' && key !== 'invoiced' && key !== 'cancelled';
    })
    .sort((a, b) => Date.parse(a.scheduled_start ?? '') - Date.parse(b.scheduled_start ?? ''))
    .filter((block) => block.site.latitude !== null && block.site.longitude !== null)
    .map((block) => ({
      id: block.work_order_id,
      label: block.work_order_number,
      lat: block.site.latitude as number,
      lng: block.site.longitude as number,
    }));
}

/**
 * Route per technician: the scheduled order against the nearest-neighbour order. The first scheduled stop stays the
 * origin of both (it is the one the technician reaches first), so the comparison measures the reordering only.
 */
export function buildTechnicianRoutes(lanes: readonly FsmBoardLane[], speedKmh: number = DEFAULT_AVERAGE_SPEED_KMH): TechnicianRoute[] {
  return lanes
    .map((lane) => {
      const stops = routeStopsOf(lane.blocks);
      const current = orderedRoute(stops, null, speedKmh);
      const optimised = nearestNeighbourRoute(stops, null, speedKmh);
      return {
        technicianId: lane.technician_id,
        name: lane.name,
        current,
        optimised,
        savedKm: Math.max(current.totalKm - optimised.totalKm, 0),
      };
    })
    .filter((route) => route.optimised.legs.length > 0);
}

export interface ProjectedPoint {
  x: number;
  y: number;
}

/**
 * Equirectangular projection of the points into a `width` x `height` viewport with `padding`. The longitude is
 * scaled by cos(mean latitude) so distances keep their proportions; a single point lands in the centre.
 */
export function projectPoints(points: readonly GeoPoint[], width: number, height: number, padding = 24): ProjectedPoint[] {
  if (points.length === 0) {
    return [];
  }
  const meanLat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const kx = Math.cos(toRad(meanLat));
  const xs = points.map((p) => p.lng * kx);
  const ys = points.map((p) => p.lat);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const spanX = maxX - minX;
  const spanY = maxY - minY;
  const innerW = width - padding * 2;
  const innerH = height - padding * 2;
  const scale = spanX === 0 && spanY === 0 ? 0 : Math.min(spanX === 0 ? Infinity : innerW / spanX, spanY === 0 ? Infinity : innerH / spanY);
  const offsetX = padding + (innerW - spanX * scale) / 2;
  const offsetY = padding + (innerH - spanY * scale) / 2;
  return points.map((_, i) => ({
    x: offsetX + (xs[i] - minX) * scale,
    // North is up: larger latitude means smaller y.
    y: offsetY + (maxY - ys[i]) * scale,
  }));
}

export function formatKm(km: number): string {
  return `${km.toFixed(1)} km`;
}

export function formatMinutes(minutes: number): string {
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  return h > 0 ? `${h} h ${m.toString().padStart(2, '0')} min` : `${m} min`;
}
