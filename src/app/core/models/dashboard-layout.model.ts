export interface DashboardWidgetDefinition {
  id: string;
  title: string;
  description: string;
  type: string;
  default_dimensions: { w: number; h: number };
  configurable_options: Record<string, unknown>;
}

export interface DashboardWidgetPlacement {
  widget_id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  settings?: Record<string, unknown> | null;
}

export interface DashboardLayout {
  id: string | null;
  name: string;
  is_default: boolean;
  is_customized: boolean;
  widgets_layout: DashboardWidgetPlacement[];
  updated_at: string | null;
}

export interface SaveDashboardLayoutPayload {
  name?: string;
  widgets_layout: DashboardWidgetPlacement[];
}

export interface DashboardWidgetData {
  widgets: unknown[];
  generated_at: string;
}
