import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import {
  AbcOverride,
  AbcOverridePayload,
  AbcRun,
  AbcRunPayload,
  AssignCountPayload,
  CountEvent,
  CountPolicy,
  CountPolicyPayload,
  CountSession,
  CountSessionFilterParams,
  CountSheet,
  CountVariance,
  CreateCountSessionPayload,
  CycleCountPlan,
  CycleCountPlanPayload,
  GenerateCyclePlansPayload,
  InventoryDataEnvelope,
  InventoryListEnvelope,
  PaginatedResponse,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';
import { toInventoryPage, unwrapInventoryData } from './inventory-valuation-api.service';

/** Physical inventory, ABC cycle counting and variance reconciliation (FatturaFacile#159, Mod 058). */
@Service()
export class InventoryCountApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/inventory`;

  // --- Counting policy ---

  getPolicy(): Observable<CountPolicy> {
    return this.http
      .get<CountPolicy | InventoryDataEnvelope<CountPolicy>>(`${this.base}/count-policy`)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  updatePolicy(payload: CountPolicyPayload): Observable<CountPolicy> {
    return this.http
      .put<CountPolicy | InventoryDataEnvelope<CountPolicy>>(`${this.base}/count-policy`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  // --- ABC analysis ---

  listAbcRuns(): Observable<AbcRun[]> {
    return this.http
      .get<InventoryListEnvelope<AbcRun> | AbcRun[]>(`${this.base}/abc-runs`)
      .pipe(map((res) => toInventoryPage(res).data));
  }

  runAbc(payload: AbcRunPayload): Observable<AbcRun> {
    return this.http
      .post<AbcRun | InventoryDataEnvelope<AbcRun>>(`${this.base}/abc-runs`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  getAbcRun(id: string): Observable<AbcRun> {
    return this.http
      .get<AbcRun | InventoryDataEnvelope<AbcRun>>(`${this.base}/abc-runs/${id}`)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  listAbcOverrides(): Observable<AbcOverride[]> {
    return this.http
      .get<InventoryListEnvelope<AbcOverride> | AbcOverride[]>(`${this.base}/abc-overrides`)
      .pipe(map((res) => toInventoryPage(res).data));
  }

  createAbcOverride(payload: AbcOverridePayload): Observable<AbcOverride> {
    return this.http
      .post<AbcOverride | InventoryDataEnvelope<AbcOverride>>(`${this.base}/abc-overrides`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  // --- Cycle count plans ---

  listPlans(warehouseId?: string): Observable<CycleCountPlan[]> {
    return this.http
      .get<InventoryListEnvelope<CycleCountPlan> | CycleCountPlan[]>(`${this.base}/cycle-count-plans`, {
        params: toHttpParams({ warehouse_id: warehouseId }),
      })
      .pipe(map((res) => toInventoryPage(res).data));
  }

  createPlan(payload: CycleCountPlanPayload): Observable<CycleCountPlan> {
    return this.http
      .post<CycleCountPlan | InventoryDataEnvelope<CycleCountPlan>>(`${this.base}/cycle-count-plans`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  updatePlan(id: string, payload: CycleCountPlanPayload): Observable<CycleCountPlan> {
    return this.http
      .put<CycleCountPlan | InventoryDataEnvelope<CycleCountPlan>>(`${this.base}/cycle-count-plans/${id}`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  deletePlan(id: string): Observable<unknown> {
    return this.http.delete<unknown>(`${this.base}/cycle-count-plans/${id}`);
  }

  runPlan(id: string): Observable<CountSession> {
    return this.http
      .post<CountSession | InventoryDataEnvelope<CountSession>>(`${this.base}/cycle-count-plans/${id}/run`, {})
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  runDuePlans(): Observable<{ opened: number }> {
    return this.http.post<{ opened: number }>(`${this.base}/cycle-count-plans/run-due`, {});
  }

  generatePlans(payload: GenerateCyclePlansPayload): Observable<CycleCountPlan[]> {
    return this.http
      .post<InventoryListEnvelope<CycleCountPlan> | CycleCountPlan[]>(`${this.base}/cycle-count-plans/generate`, payload)
      .pipe(map((res) => toInventoryPage(res).data));
  }

  // --- Count sessions ---

  listSessions(filters?: CountSessionFilterParams): Observable<PaginatedResponse<CountSession>> {
    return this.http
      .get<InventoryListEnvelope<CountSession>>(`${this.base}/counts`, {
        params: filters ? toHttpParams(filters) : undefined,
      })
      .pipe(map((res) => toInventoryPage(res)));
  }

  createSession(payload: CreateCountSessionPayload): Observable<CountSession> {
    return this.http
      .post<CountSession | InventoryDataEnvelope<CountSession>>(`${this.base}/counts`, payload)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  getSession(id: string): Observable<CountSession> {
    return this.http
      .get<CountSession | InventoryDataEnvelope<CountSession>>(`${this.base}/counts/${id}`)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  getSheet(id: string, pendingOnly = false): Observable<CountSheet> {
    return this.http.get<CountSheet>(`${this.base}/counts/${id}/sheet`, {
      params: toHttpParams({ pending: pendingOnly ? 1 : undefined }),
    });
  }

  getVariance(id: string): Observable<CountVariance> {
    return this.http
      .get<CountVariance | InventoryDataEnvelope<CountVariance>>(`${this.base}/counts/${id}/variance`)
      .pipe(map((res) => unwrapInventoryData(res)));
  }

  getEvents(id: string): Observable<CountEvent[]> {
    return this.http
      .get<InventoryListEnvelope<CountEvent> | CountEvent[]>(`${this.base}/counts/${id}/events`)
      .pipe(map((res) => toInventoryPage(res).data));
  }

  recount(id: string, lineIds: string[]): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/counts/${id}/recount`, { line_ids: lineIds });
  }

  /** Submits the differences: opens the stock adjustment (approved or pending approval). */
  reconcile(id: string): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/counts/${id}/reconcile`, {});
  }

  cancel(id: string): Observable<CountSession> {
    return this.post(id, 'cancel', {});
  }

  freeze(id: string): Observable<CountSession> {
    return this.post(id, 'freeze', {});
  }

  unfreeze(id: string, reason: string): Observable<CountSession> {
    return this.post(id, 'unfreeze', { reason });
  }

  assign(id: string, payload: AssignCountPayload): Observable<CountSession> {
    return this.post(id, 'assign', payload);
  }

  approve(id: string, level: 1 | 2, notes?: string): Observable<CountSession> {
    return this.post(id, `approvals/${level}/approve`, notes ? { notes } : {});
  }

  reject(id: string, level: 1 | 2, reason: string): Observable<CountSession> {
    return this.post(id, `approvals/${level}/reject`, { reason });
  }

  private post(id: string, action: string, body: object): Observable<CountSession> {
    return this.http
      .post<CountSession | InventoryDataEnvelope<CountSession>>(`${this.base}/counts/${id}/${action}`, body)
      .pipe(map((res) => unwrapInventoryData(res)));
  }
}
