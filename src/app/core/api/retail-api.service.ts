import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, RetailSession } from '../models';

// TODO: Pending API contract update
@Service()
export class RetailApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/retail`;

  getSessions(): Observable<ApiResponse<RetailSession[]>> {
    return this.http.get<ApiResponse<RetailSession[]>>(`${this.base}/sessions`);
  }
}
