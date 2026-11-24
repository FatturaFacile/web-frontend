import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  AssignShiftPayload,
  AssignShiftResult,
  EligibleSwapPeer,
  GenerateRosterPayload,
  GenerateRosterResult,
  PublishRosterResult,
  RosterGroupBy,
  RosterMatrix,
  RosterPeriod,
  RequestSwapPayload,
  RosterPeriodType,
  ShiftAssignment,
  ShiftPlanningResponse,
  ShiftSwapRequest,
  ShiftTemplate,
  ShiftTemplatePayload,
  SwapDecisionPayload,
  SwapStatus,
  TeamShift,
} from '../models';

/** Manager and employee endpoints of the shift planning module (Mod 073). */
@Service()
export class ShiftPlanningApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/shift-planning`;

  // --- Templates ---

  getTemplates(): Observable<ShiftPlanningResponse<ShiftTemplate[]>> {
    return this.http.get<ShiftPlanningResponse<ShiftTemplate[]>>(`${this.base}/templates`);
  }

  createTemplate(payload: ShiftTemplatePayload): Observable<ShiftPlanningResponse<ShiftTemplate>> {
    return this.http.post<ShiftPlanningResponse<ShiftTemplate>>(`${this.base}/templates`, payload);
  }

  updateTemplate(
    id: string,
    payload: ShiftTemplatePayload,
  ): Observable<ShiftPlanningResponse<ShiftTemplate>> {
    return this.http.put<ShiftPlanningResponse<ShiftTemplate>>(
      `${this.base}/templates/${id}`,
      payload,
    );
  }

  // --- Roster periods ---

  getPeriods(
    periodType?: RosterPeriodType,
    from?: string,
    to?: string,
  ): Observable<ShiftPlanningResponse<RosterPeriod[]>> {
    let params = new HttpParams();
    if (periodType) {
      params = params.set('period_type', periodType);
    }
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return this.http.get<ShiftPlanningResponse<RosterPeriod[]>>(`${this.base}/periods`, { params });
  }

  generatePeriod(
    payload: GenerateRosterPayload,
  ): Observable<ShiftPlanningResponse<GenerateRosterResult>> {
    return this.http.post<ShiftPlanningResponse<GenerateRosterResult>>(
      `${this.base}/periods/generate`,
      payload,
    );
  }

  getMatrix(
    periodId: string,
    groupBy: RosterGroupBy,
  ): Observable<ShiftPlanningResponse<RosterMatrix>> {
    return this.http.get<ShiftPlanningResponse<RosterMatrix>>(
      `${this.base}/periods/${periodId}/matrix`,
      {
        params: new HttpParams().set('group_by', groupBy),
      },
    );
  }

  publishPeriod(periodId: string): Observable<ShiftPlanningResponse<PublishRosterResult>> {
    return this.http.post<ShiftPlanningResponse<PublishRosterResult>>(
      `${this.base}/periods/${periodId}/publish`,
      {},
    );
  }

  lockPeriod(periodId: string): Observable<ShiftPlanningResponse<RosterPeriod>> {
    return this.http.post<ShiftPlanningResponse<RosterPeriod>>(
      `${this.base}/periods/${periodId}/lock`,
      {},
    );
  }

  // --- Assignments ---

  createAssignment(
    payload: AssignShiftPayload,
  ): Observable<ShiftPlanningResponse<AssignShiftResult>> {
    return this.http.post<ShiftPlanningResponse<AssignShiftResult>>(
      `${this.base}/assignments`,
      payload,
    );
  }

  /** Assigns an open shift or moves a shift to another employee or day. */
  moveAssignment(
    id: string,
    payload: AssignShiftPayload,
  ): Observable<ShiftPlanningResponse<AssignShiftResult>> {
    return this.http.patch<ShiftPlanningResponse<AssignShiftResult>>(
      `${this.base}/assignments/${id}`,
      payload,
    );
  }

  // --- Swaps (manager inbox) ---

  getSwaps(status?: SwapStatus): Observable<ShiftPlanningResponse<ShiftSwapRequest[]>> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<ShiftPlanningResponse<ShiftSwapRequest[]>>(`${this.base}/swaps`, {
      params,
    });
  }

  decideSwap(
    id: string,
    payload: SwapDecisionPayload,
  ): Observable<ShiftPlanningResponse<ShiftSwapRequest>> {
    return this.http.post<ShiftPlanningResponse<ShiftSwapRequest>>(
      `${this.base}/swaps/${id}/decision`,
      payload,
    );
  }

  // --- Employee self-service ---

  getMyShifts(from?: string, to?: string): Observable<ShiftPlanningResponse<ShiftAssignment[]>> {
    return this.http.get<ShiftPlanningResponse<ShiftAssignment[]>>(`${this.base}/my/shifts`, {
      params: this.window(from, to),
    });
  }

  getOpenShifts(from?: string, to?: string): Observable<ShiftPlanningResponse<ShiftAssignment[]>> {
    return this.http.get<ShiftPlanningResponse<ShiftAssignment[]>>(`${this.base}/my/open-shifts`, {
      params: this.window(from, to),
    });
  }

  claimOpenShift(id: string): Observable<
    ShiftPlanningResponse<{
      assignment: ShiftAssignment;
      warnings: ShiftAssignment['compliance_warnings'];
    }>
  > {
    return this.http.post<
      ShiftPlanningResponse<{
        assignment: ShiftAssignment;
        warnings: ShiftAssignment['compliance_warnings'];
      }>
    >(`${this.base}/my/open-shifts/${id}/claim`, {});
  }

  getTeamShifts(from?: string, to?: string): Observable<ShiftPlanningResponse<TeamShift[]>> {
    return this.http.get<ShiftPlanningResponse<TeamShift[]>>(`${this.base}/my/team-shifts`, {
      params: this.window(from, to),
    });
  }

  getEligiblePeers(shiftId: string): Observable<ShiftPlanningResponse<EligibleSwapPeer[]>> {
    return this.http.get<ShiftPlanningResponse<EligibleSwapPeer[]>>(
      `${this.base}/my/shifts/${shiftId}/eligible-peers`,
    );
  }

  /** The swaps the employee requested, those offered to the employee and the open broadcasts. */
  getMySwaps(status?: SwapStatus): Observable<ShiftPlanningResponse<ShiftSwapRequest[]>> {
    const params = status ? new HttpParams().set('status', status) : undefined;
    return this.http.get<ShiftPlanningResponse<ShiftSwapRequest[]>>(`${this.base}/my/swaps`, {
      params,
    });
  }

  requestSwap(payload: RequestSwapPayload): Observable<ShiftPlanningResponse<ShiftSwapRequest>> {
    return this.http.post<ShiftPlanningResponse<ShiftSwapRequest>>(
      `${this.base}/my/swaps`,
      payload,
    );
  }

  /** First step of the swap approval: the colleague accepts or declines. */
  respondToSwap(
    id: string,
    decision: 'approve' | 'reject',
  ): Observable<ShiftPlanningResponse<ShiftSwapRequest>> {
    return this.http.post<ShiftPlanningResponse<ShiftSwapRequest>>(
      `${this.base}/my/swaps/${id}/respond`,
      { decision },
    );
  }

  private window(from?: string, to?: string): HttpParams {
    let params = new HttpParams();
    if (from) {
      params = params.set('from', from);
    }
    if (to) {
      params = params.set('to', to);
    }
    return params;
  }
}
