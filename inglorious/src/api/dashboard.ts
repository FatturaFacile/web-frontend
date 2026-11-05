import type { ApiResponse } from "../models/api"
import type { KpiSummary } from "../models/dashboard"
import { http } from "./http"

export const getKpiSummary = () =>
  http.get<ApiResponse<KpiSummary>>("/dashboard/kpi-summary")
