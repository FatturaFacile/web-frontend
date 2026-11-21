import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { ApiResponse } from '../../../core/models';
import { MesBoard, MesCommandMeta, MesPhase, MesTraceability } from './mes.models';

const IDEMPOTENCY_HEADER = 'Idempotency-Key';

/**
 * Client of the MES operator board API (`/manufacturing/mes`). Every command carries the idempotency key chosen by the
 * caller in its body and header, so a retry of the same operator action, by hand or by the service worker, is answered by
 * the stored result instead of running twice.
 */
@Service()
export class MesApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/manufacturing/mes`;

  /** Query: the board of a work centre, optionally of one operator. */
  getBoard(workCenterId: string, operatorId?: string): Observable<ApiResponse<MesBoard>> {
    let params = new HttpParams().set('work_center_id', workCenterId);
    if (operatorId) {
      params = params.set('operator_id', operatorId);
    }

    return this.http.get<ApiResponse<MesBoard>>(`${this.base}/board`, { params });
  }

  /** Query: intervals, declarations, scrap reasons and lots of a phase. */
  getTraceability(phaseId: string): Observable<ApiResponse<MesTraceability>> {
    return this.http.get<ApiResponse<MesTraceability>>(`${this.base}/phases/${phaseId}/traceability`);
  }

  /** Command: takes an operation over (creates the phase) or hands a suspended phase to another operator. */
  takeOver(
    meta: MesCommandMeta,
    body: { production_order_operation_id: string; operator_id: string; machine_id?: string | null },
  ): Observable<ApiResponse<MesPhase>> {
    return this.http.post<ApiResponse<MesPhase>>(`${this.base}/phases/take-over`, { ...body, ...meta }, this.options(meta));
  }

  /** Command: any other action on a phase, named by its route segment. */
  command(
    phaseId: string,
    path: 'start-setup' | 'start-production' | 'suspend' | 'resume' | 'declarations' | 'material-consumptions' | 'close',
    meta: MesCommandMeta,
    body: Record<string, unknown> = {},
  ): Observable<ApiResponse<MesPhase>> {
    return this.http.post<ApiResponse<MesPhase>>(`${this.base}/phases/${phaseId}/${path}`, { ...body, ...meta }, this.options(meta));
  }

  private options(meta: MesCommandMeta): { headers: Record<string, string> } {
    return { headers: { [IDEMPOTENCY_HEADER]: meta.idempotency_key } };
  }
}
