import type { ApiResponse, ListResponse } from "../models/api"
import type { SystemBackup } from "../models/system"
import { http } from "./http"
import { toPage } from "./page"

const PATH = "/system/backups"

export async function listBackups(): Promise<SystemBackup[]> {
  return toPage(await http.get<ListResponse<SystemBackup>>(PATH)).items
}

export const createBackup = () => http.post<ApiResponse<SystemBackup>>(PATH, {})

export const downloadBackup = (id: string) =>
  http.download(`${PATH}/${id}/download`)

export const restoreBackup = (id: string) =>
  http.post<ApiResponse<unknown>>(`${PATH}/${id}/restore`, {})

export const deleteBackup = (id: string) =>
  http.delete<ApiResponse<unknown>>(`${PATH}/${id}`)

/** Restores the tenant from a ZIP archive the user picked. */
export function restoreBackupUpload(file: File) {
  const form = new FormData()
  form.append("file", file)
  return http.post<ApiResponse<unknown>>(`${PATH}/restore-upload`, form)
}
