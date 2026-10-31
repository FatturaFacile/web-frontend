import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, RestoreBackupResult, SystemBackup } from '../models';

@Service()
export class SystemApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/system`;

  getTenantBackups(): Observable<ApiResponse<SystemBackup[]>> {
    return this.http.get<ApiResponse<SystemBackup[]>>(`${this.base}/backups`);
  }

  createTenantBackup(): Observable<ApiResponse<SystemBackup>> {
    return this.http.post<ApiResponse<SystemBackup>>(`${this.base}/backups`, {});
  }

  getTenantBackupById(id: string): Observable<ApiResponse<SystemBackup>> {
    return this.http.get<ApiResponse<SystemBackup>>(`${this.base}/backups/${id}`);
  }

  deleteTenantBackup(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/backups/${id}`);
  }

  downloadTenantBackup(id: string): Observable<Blob> {
    return this.http.get(`${this.base}/backups/${id}/download`, {
      responseType: 'blob',
    });
  }

  restoreTenantBackup(id: string): Observable<ApiResponse<RestoreBackupResult>> {
    return this.http.post<ApiResponse<RestoreBackupResult>>(`${this.base}/backups/${id}/restore`, {});
  }

  restoreTenantBackupUpload(formData: FormData): Observable<ApiResponse<RestoreBackupResult>> {
    return this.http.post<ApiResponse<RestoreBackupResult>>(`${this.base}/backups/restore-upload`, formData);
  }

  bootstrapSupportUser(): Observable<ApiResponse<unknown>> {
    return this.http.get<ApiResponse<unknown>>(`${this.base}/bootstrap-support`);
  }
}
