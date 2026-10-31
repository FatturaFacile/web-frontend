import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  ContactResource,
  ContactStatistics,
  ContactStatement,
  ContactType,
  CreateContactPayload,
  PaginatedResponse,
  QueryFilterParams,
  UpdateContactPayload,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

export interface CrmContactFilterParams extends QueryFilterParams {
  type?: ContactType | string;
  country?: string;
  search?: string;
}

@Service()
export class CrmApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/crm`;

  getContacts(filters?: CrmContactFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http.get<PaginatedResponse<ContactResource>>(`${this.base}/contacts`, {
      params: filters ? toHttpParams(filters) : undefined,
    });
  }

  getClients(params?: QueryFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http.get<PaginatedResponse<ContactResource>>(`${this.base}/clients`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getSuppliers(params?: QueryFilterParams): Observable<PaginatedResponse<ContactResource>> {
    return this.http.get<PaginatedResponse<ContactResource>>(`${this.base}/suppliers`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getContactById(id: string): Observable<ApiResponse<ContactResource>> {
    return this.http.get<ApiResponse<ContactResource>>(`${this.base}/contacts/${id}`);
  }

  createContact(payload: CreateContactPayload): Observable<ApiResponse<ContactResource>> {
    return this.http.post<ApiResponse<ContactResource>>(`${this.base}/contacts`, payload);
  }

  updateContact(id: string, payload: UpdateContactPayload): Observable<ApiResponse<ContactResource>> {
    return this.http.put<ApiResponse<ContactResource>>(`${this.base}/contacts/${id}`, payload);
  }

  deleteContact(id: string): Observable<ApiResponse<unknown>> {
    return this.http.delete<ApiResponse<unknown>>(`${this.base}/contacts/${id}`);
  }

  getContactStatistics(id: string): Observable<ApiResponse<ContactStatistics>> {
    return this.http.get<ApiResponse<ContactStatistics>>(`${this.base}/contacts/${id}/statistics`);
  }

  getContactStatement(id: string, asOf?: string): Observable<ApiResponse<ContactStatement>> {
    return this.http.get<ApiResponse<ContactStatement>>(`${this.base}/contacts/${id}/statement`, {
      params: asOf ? toHttpParams({ as_of: asOf }) : undefined,
    });
  }

  emailContactStatement(id: string, payload: { email: string; note?: string }): Observable<ApiResponse<unknown>> {
    return this.http.post<ApiResponse<unknown>>(`${this.base}/contacts/${id}/statement/email`, payload);
  }
}
