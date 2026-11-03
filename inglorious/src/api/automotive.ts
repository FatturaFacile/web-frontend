import type { ApiResponse } from "../models/api"
import type { TireRecord } from "../models/automotive"
import { http } from "./http"

/** The endpoint answers with a bare array, without the usual envelope. */
export const listTireRecords = () =>
  http.get<TireRecord[]>("/automotive/tire-hotel")

export const sendTireReminder = (id: string) =>
  http.post<ApiResponse<void>>(`/automotive/tire-hotel/${id}/reminder`, {})
