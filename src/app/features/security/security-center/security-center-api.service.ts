import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  PiiUnmaskRequest,
  PiiUnmaskResponse,
  SecurityItem,
  SecurityPosture,
} from './security-center.model';

/** Posture dashboard and justified PII unmasking of the Security, Privacy & Compliance Center. */
@Service()
export class SecurityCenterApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/security`;

  posture(): Observable<SecurityItem<SecurityPosture>> {
    return this.http.get<SecurityItem<SecurityPosture>>(`${this.base}/posture`);
  }

  /** Asks the API for the clear value of a masked field; the justification is written to the audit trail. */
  unmask(request: PiiUnmaskRequest): Observable<PiiUnmaskResponse> {
    return this.http.post<PiiUnmaskResponse>(`${this.base}/pii/unmask`, request);
  }
}
