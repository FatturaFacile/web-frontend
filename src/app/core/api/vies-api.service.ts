import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../models/api.models';
import { ViesValidationRequest, ViesValidationResult } from '../models/vies.model';

@Service()
export class ViesApiService {
  private readonly http = inject(HttpClient);

  /** Server side: syntax first, then VIES. An outage answers 200 with status "unavailable". */
  validate(payload: ViesValidationRequest): Observable<ApiResponse<ViesValidationResult>> {
    return this.http.post<ApiResponse<ViesValidationResult>>(
      `${environment.apiBaseUrl}/fiscal/vies/validate`,
      payload,
    );
  }
}
