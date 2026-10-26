import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models';

export interface LoginPayload {
  email: string;
  password: string;
  tenant_id?: string | null;
}

export interface LoginResult {
  token: string;
}

@Service()
export class AuthApiService {
  private readonly http = inject(HttpClient);

  login(payload: LoginPayload): Observable<ApiResponse<LoginResult>> {
    return this.http.post<ApiResponse<LoginResult>>(`${environment.apiBaseUrl}/auth/login`, payload);
  }
}
