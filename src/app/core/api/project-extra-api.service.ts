import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, ProjectTimesheetResource, StoreProjectTimesheetPayload } from '../models';

/** Project endpoints not covered by `ProjectApiService`: edit and delete of a timesheet entry. */
@Service()
export class ProjectExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/projects`;

  updateTimesheet(
    timesheetId: string,
    payload: Partial<StoreProjectTimesheetPayload>,
  ): Observable<ApiResponse<ProjectTimesheetResource>> {
    return this.http.put<ApiResponse<ProjectTimesheetResource>>(`${this.base}/timesheets/${timesheetId}`, payload);
  }

  deleteTimesheet(timesheetId: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/timesheets/${timesheetId}`);
  }
}
