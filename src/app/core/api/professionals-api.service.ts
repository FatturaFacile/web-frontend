import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  CreateTimeLogPayload,
  FeeNote,
  LegalCase,
  TimeLog,
} from '../models';

@Service()
export class ProfessionalsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/professionals`;

  getCases(): Observable<ApiResponse<LegalCase[]>> {
    return this.http.get<ApiResponse<LegalCase[]>>(`${this.base}/cases`);
  }

  getTimeLogs(): Observable<ApiResponse<TimeLog[]>> {
    return this.http.get<ApiResponse<TimeLog[]>>(`${this.base}/time-logs`);
  }

  logTime(payload: CreateTimeLogPayload): Observable<ApiResponse<TimeLog>> {
    return this.http.post<ApiResponse<TimeLog>>(`${this.base}/time-logs`, payload);
  }

  getFeeNotes(): Observable<ApiResponse<FeeNote[]>> {
    return this.http.get<ApiResponse<FeeNote[]>>(`${this.base}/fee-notes`);
  }
}
