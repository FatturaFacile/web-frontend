import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../../../core/http/laravel-http.utils';
import {
  MrpAutoLevelResult,
  MrpEnvelope,
  MrpGantt,
  MrpGanttQuery,
  MrpPageMeta,
  MrpPegging,
  MrpProposal,
  MrpProposalAction,
  MrpProposalActionResult,
  MrpProposalFilters,
  MrpRescheduleResult,
  MrpReschedulePayload,
  MrpRun,
  MrpRunDetail,
  MrpRunPayload,
  MrpRunStatus,
  MrpSchedulingDirection,
} from './mrp.models';

/** HTTP access to `/api/v1/mrp` (Mod 063: MRP I & II). */
@Service()
export class MrpApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/mrp`;

  runs(
    query: { status?: MrpRunStatus; page?: number; perPage?: number } = {},
  ): Observable<MrpEnvelope<MrpRun[], MrpPageMeta>> {
    return this.http.get<MrpEnvelope<MrpRun[], MrpPageMeta>>(`${this.base}/runs`, {
      params: toHttpParams({ status: query.status, page: query.page, per_page: query.perPage }),
    });
  }

  startRun(payload: MrpRunPayload): Observable<MrpEnvelope<MrpRun>> {
    return this.http.post<MrpEnvelope<MrpRun>>(`${this.base}/runs`, payload);
  }

  run(id: string): Observable<MrpEnvelope<MrpRunDetail>> {
    return this.http.get<MrpEnvelope<MrpRunDetail>>(`${this.base}/runs/${id}`);
  }

  proposals(filters: MrpProposalFilters): Observable<MrpEnvelope<MrpProposal[], MrpPageMeta>> {
    return this.http.get<MrpEnvelope<MrpProposal[], MrpPageMeta>>(`${this.base}/proposals`, {
      params: toHttpParams({
        run_id: filters.runId,
        proposal_type: filters.proposalType,
        status: filters.status,
        exception_code: filters.exceptionCode,
        item_id: filters.itemId,
        work_center_id: filters.workCenterId,
        need_by_from: filters.needByFrom,
        need_by_to: filters.needByTo,
        sort_by: filters.sortBy,
        sort_direction: filters.sortDirection,
        page: filters.page,
        per_page: filters.perPage,
      }),
    });
  }

  applyAction(
    proposalIds: string[],
    action: MrpProposalAction,
  ): Observable<MrpEnvelope<MrpProposalActionResult>> {
    return this.http.post<MrpEnvelope<MrpProposalActionResult>>(`${this.base}/proposals/actions`, {
      proposal_ids: proposalIds,
      action,
    });
  }

  pegging(proposalId: string): Observable<MrpEnvelope<MrpPegging>> {
    return this.http.get<MrpEnvelope<MrpPegging>>(`${this.base}/proposals/${proposalId}/pegging`);
  }

  gantt(runId: string, query: MrpGanttQuery): Observable<MrpEnvelope<MrpGantt>> {
    let params = toHttpParams({ from: query.from, to: query.to });
    for (const id of query.workCenterIds ?? []) {
      params = params.append('work_center_ids[]', id);
    }

    return this.http.get<MrpEnvelope<MrpGantt>>(`${this.base}/runs/${runId}/gantt`, { params });
  }

  autoLevel(
    runId: string,
    direction?: MrpSchedulingDirection,
  ): Observable<MrpEnvelope<MrpAutoLevelResult>> {
    return this.http.post<MrpEnvelope<MrpAutoLevelResult>>(
      `${this.base}/runs/${runId}/auto-level`,
      {
        scheduling_direction: direction,
      },
    );
  }

  reschedule(
    blockId: string,
    payload: MrpReschedulePayload,
  ): Observable<MrpEnvelope<MrpRescheduleResult>> {
    return this.http.post<MrpEnvelope<MrpRescheduleResult>>(
      `${this.base}/schedule-blocks/${blockId}/reschedule`,
      payload,
    );
  }
}
