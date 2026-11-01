import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse, FieldServiceTicket } from '../models';

// TODO: Pending API contract update
@Service()
export class FieldServiceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/field-service`;

  getTickets(): Observable<ApiResponse<FieldServiceTicket[]>> {
    return this.http.get<ApiResponse<FieldServiceTicket[]>>(`${this.base}/tickets`);
  }
}
