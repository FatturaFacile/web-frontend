import type { TimeAttendanceData } from "../models/time-attendance"
import { http } from "./http"

export const getTimeAttendance = () =>
  http.get<TimeAttendanceData>("/time-attendance")
