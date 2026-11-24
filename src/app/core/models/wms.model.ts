/** Warehouse management (WMS). Mirrors the API of the Wms module: the dashboard payload and the enums of the screens. */

export type WmsTaskType = 'putaway' | 'pick' | 'replenish' | 'count' | 'move';
export type WmsTaskStatus = 'open' | 'assigned' | 'in_progress' | 'completed' | 'short_completed' | 'skipped' | 'cancelled';
export type WmsDockDirection = 'inbound' | 'outbound' | 'both';
export type WmsBinType = 'storage' | 'picking' | 'bulk' | 'receiving' | 'staging' | 'shipping' | 'quarantine' | 'transit';

export const WMS_TASK_TYPES: readonly WmsTaskType[] = ['putaway', 'pick', 'replenish', 'count', 'move'];
export const WMS_TASK_STATUSES: readonly WmsTaskStatus[] = ['open', 'assigned', 'in_progress', 'completed', 'short_completed', 'skipped', 'cancelled'];
export const WMS_BIN_TYPES: readonly WmsBinType[] = ['storage', 'picking', 'bulk', 'receiving', 'staging', 'shipping', 'quarantine', 'transit'];
export const WMS_DOCK_DIRECTIONS: readonly WmsDockDirection[] = ['inbound', 'outbound', 'both'];

export interface WmsResponse<T> {
  data: T;
}

export interface WmsThroughputDay {
  date: string;
  total: number;
  putaway: number;
  pick: number;
  replenish: number;
  count: number;
  move: number;
}

export interface WmsDockDoorUtilization {
  door_id: string;
  code: string;
  name: string | null;
  booked_hours: string;
  utilization_percent: string;
}

export interface WmsDashboard {
  period: { from: string; to: string; days: number };
  throughput: { total: number; by_type: Record<WmsTaskType, number>; per_day: WmsThroughputDay[] };
  open_tasks: { by_status: Record<string, number>; by_type: Record<WmsTaskType, number>; total: number };
  pick_short_rate_percent: string | null;
  dock_utilization: { overall_percent: string; doors: WmsDockDoorUtilization[] };
  pending_recommendations: number;
  open_waves: number;
  open_cross_docks: number;
}

export interface WmsDashboardFilters {
  days?: number;
  warehouse_id?: string;
  operating_hours?: number;
}
