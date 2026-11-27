import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  DstApproveResult,
  DstAtp,
  DstAtpMatrix,
  DstAvailability,
  DstChannel,
  DstChannelPayload,
  DstChannelRule,
  DstChannelRulePayload,
  DstConsignmentDirection,
  DstConsignmentStock,
  DstDashboard,
  DstDispatchPayload,
  DstDrpAlert,
  DstDrpGrid,
  DstDrpRun,
  DstDrpRunPayload,
  DstEnvelope,
  DstGenerateResult,
  DstInTransitFilters,
  DstInTransitLine,
  DstLane,
  DstLanePayload,
  DstLookups,
  DstNetworkWarehouse,
  DstPage,
  DstProfile,
  DstProfilePayload,
  DstProposal,
  DstProposalFilters,
  DstReceivePayload,
  DstReconciliation,
  DstReconciliationPayload,
  DstReturnPayload,
  DstRule,
  DstRulePayload,
  DstSettlement,
  DstSettlementPayload,
  DstStatusCounts,
  DstTransfer,
  DstTransferFilters,
  DstTransferPayload,
} from '../models';

type Envelope<T> = Observable<DstEnvelope<T>>;

/** Endpoints of distribution, multi-warehouse and transfers (DRP, Issue #271). */
@Service()
export class DistributionApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/distribution`;

  // --- Lookups and overview ---

  getLookups(): Envelope<DstLookups> {
    return this.http.get<DstEnvelope<DstLookups>>(`${this.base}/lookups`);
  }

  getDashboard(): Envelope<DstDashboard> {
    return this.http.get<DstEnvelope<DstDashboard>>(`${this.base}/dashboard`);
  }

  // --- Network and lanes ---

  listNetworkWarehouses(): Envelope<DstNetworkWarehouse[]> {
    return this.http.get<DstEnvelope<DstNetworkWarehouse[]>>(`${this.base}/network/warehouses`);
  }

  saveProfile(warehouseId: string, payload: DstProfilePayload): Envelope<DstProfile> {
    return this.http.put<DstEnvelope<DstProfile>>(
      `${this.base}/network/warehouses/${warehouseId}/profile`,
      payload,
    );
  }

  listLanes(): Envelope<DstLane[]> {
    return this.http.get<DstEnvelope<DstLane[]>>(`${this.base}/lanes`);
  }

  createLane(payload: DstLanePayload): Envelope<DstLane> {
    return this.http.post<DstEnvelope<DstLane>>(`${this.base}/lanes`, payload);
  }

  updateLane(id: string, payload: Partial<DstLanePayload>): Envelope<DstLane> {
    return this.http.put<DstEnvelope<DstLane>>(`${this.base}/lanes/${id}`, payload);
  }

  deleteLane(id: string): Envelope<null> {
    return this.http.delete<DstEnvelope<null>>(`${this.base}/lanes/${id}`);
  }

  // --- Transfers and goods in transit ---

  listTransfers(
    filters: DstTransferFilters = {},
  ): Observable<DstPage<DstTransfer, { status_counts?: DstStatusCounts }>> {
    return this.http.get<DstPage<DstTransfer, { status_counts?: DstStatusCounts }>>(
      `${this.base}/transfers`,
      { params: toHttpParams({ ...filters, per_page: 25 }) },
    );
  }

  getTransfer(id: string): Envelope<DstTransfer> {
    return this.http.get<DstEnvelope<DstTransfer>>(`${this.base}/transfers/${id}`);
  }

  createTransfer(payload: DstTransferPayload): Envelope<DstTransfer> {
    return this.http.post<DstEnvelope<DstTransfer>>(`${this.base}/transfers`, payload);
  }

  approveTransfer(id: string): Envelope<DstTransfer> {
    return this.http.post<DstEnvelope<DstTransfer>>(`${this.base}/transfers/${id}/approve`, {});
  }

  dispatchTransfer(id: string, payload: DstDispatchPayload): Envelope<DstTransfer> {
    return this.http.post<DstEnvelope<DstTransfer>>(
      `${this.base}/transfers/${id}/dispatch`,
      payload,
    );
  }

  receiveTransfer(id: string, payload: DstReceivePayload): Envelope<DstTransfer> {
    return this.http.post<DstEnvelope<DstTransfer>>(
      `${this.base}/transfers/${id}/receive`,
      payload,
    );
  }

  cancelTransfer(id: string): Envelope<DstTransfer> {
    return this.http.post<DstEnvelope<DstTransfer>>(`${this.base}/transfers/${id}/cancel`, {});
  }

  getAvailability(warehouseId: string, stockItemId: string): Envelope<DstAvailability> {
    return this.http.get<DstEnvelope<DstAvailability>>(`${this.base}/availability`, {
      params: toHttpParams({ warehouse_id: warehouseId, stock_item_id: stockItemId }),
    });
  }

  listInTransit(
    filters: DstInTransitFilters = {},
  ): Observable<
    DstPage<DstInTransitLine, { total_units?: number | string; total_value?: number | string }>
  > {
    const { overdue, ...rest } = filters;
    return this.http.get<
      DstPage<DstInTransitLine, { total_units?: number | string; total_value?: number | string }>
    >(`${this.base}/in-transit`, {
      params: toHttpParams({ ...rest, overdue: overdue ? 1 : undefined }),
    });
  }

  // --- Replenishment rules and proposals ---

  listRules(): Envelope<DstRule[]> {
    return this.http.get<DstEnvelope<DstRule[]>>(`${this.base}/replenishment-rules`, {
      params: toHttpParams({ per_page: 100 }),
    });
  }

  createRule(payload: DstRulePayload): Envelope<DstRule> {
    return this.http.post<DstEnvelope<DstRule>>(`${this.base}/replenishment-rules`, payload);
  }

  updateRule(id: string, payload: Partial<DstRulePayload>): Envelope<DstRule> {
    return this.http.put<DstEnvelope<DstRule>>(`${this.base}/replenishment-rules/${id}`, payload);
  }

  deleteRule(id: string): Envelope<null> {
    return this.http.delete<DstEnvelope<null>>(`${this.base}/replenishment-rules/${id}`);
  }

  listProposals(filters: DstProposalFilters = {}): Observable<DstPage<DstProposal>> {
    return this.http.get<DstPage<DstProposal>>(`${this.base}/proposals`, {
      params: toHttpParams({ ...filters, per_page: 50 }),
    });
  }

  getProposal(id: string): Envelope<DstProposal> {
    return this.http.get<DstEnvelope<DstProposal>>(`${this.base}/proposals/${id}`);
  }

  generateProposals(
    payload: { warehouse_ids?: string[]; stock_item_ids?: string[] } = {},
  ): Envelope<DstGenerateResult> {
    return this.http.post<DstEnvelope<DstGenerateResult>>(
      `${this.base}/proposals/generate`,
      payload,
    );
  }

  updateProposal(id: string, suggestedQuantity: number): Envelope<DstProposal> {
    return this.http.put<DstEnvelope<DstProposal>>(`${this.base}/proposals/${id}`, {
      suggested_quantity: suggestedQuantity,
    });
  }

  approveProposals(
    ids: string[],
    transferStatus: 'draft' | 'approved',
  ): Envelope<DstApproveResult> {
    return this.http.post<DstEnvelope<DstApproveResult>>(`${this.base}/proposals/approve`, {
      ids,
      transfer_status: transferStatus,
    });
  }

  rejectProposal(id: string): Envelope<DstProposal> {
    return this.http.post<DstEnvelope<DstProposal>>(`${this.base}/proposals/${id}/reject`, {});
  }

  // --- DRP ---

  runDrp(payload: DstDrpRunPayload): Envelope<DstDrpRun> {
    return this.http.post<DstEnvelope<DstDrpRun>>(`${this.base}/drp/runs`, payload);
  }

  listDrpRuns(): Envelope<DstDrpRun[]> {
    return this.http.get<DstEnvelope<DstDrpRun[]>>(`${this.base}/drp/runs`);
  }

  getDrpRun(id: string): Envelope<DstDrpRun> {
    return this.http.get<DstEnvelope<DstDrpRun>>(`${this.base}/drp/runs/${id}`);
  }

  getDrpGrid(
    runId: string,
    warehouseId?: string | null,
    stockItemId?: string | null,
  ): Envelope<DstDrpGrid> {
    return this.http.get<DstEnvelope<DstDrpGrid>>(`${this.base}/drp/runs/${runId}/grid`, {
      params: toHttpParams({ warehouse_id: warehouseId, stock_item_id: stockItemId }),
    });
  }

  listDrpAlerts(runId?: string): Envelope<DstDrpAlert[]> {
    return this.http.get<DstEnvelope<DstDrpAlert[]>>(`${this.base}/drp/alerts`, {
      params: toHttpParams({ run_id: runId }),
    });
  }

  // --- Channels and ATP ---

  listChannels(): Envelope<DstChannel[]> {
    return this.http.get<DstEnvelope<DstChannel[]>>(`${this.base}/channels`);
  }

  createChannel(payload: DstChannelPayload): Envelope<DstChannel> {
    return this.http.post<DstEnvelope<DstChannel>>(`${this.base}/channels`, payload);
  }

  updateChannel(id: string, payload: Partial<DstChannelPayload>): Envelope<DstChannel> {
    return this.http.put<DstEnvelope<DstChannel>>(`${this.base}/channels/${id}`, payload);
  }

  deleteChannel(id: string): Envelope<null> {
    return this.http.delete<DstEnvelope<null>>(`${this.base}/channels/${id}`);
  }

  listChannelRules(channelId: string): Envelope<DstChannelRule[]> {
    return this.http.get<DstEnvelope<DstChannelRule[]>>(
      `${this.base}/channels/${channelId}/warehouses`,
    );
  }

  createChannelRule(channelId: string, payload: DstChannelRulePayload): Envelope<DstChannelRule> {
    return this.http.post<DstEnvelope<DstChannelRule>>(
      `${this.base}/channels/${channelId}/warehouses`,
      payload,
    );
  }

  updateChannelRule(
    ruleId: string,
    payload: Partial<DstChannelRulePayload>,
  ): Envelope<DstChannelRule> {
    return this.http.put<DstEnvelope<DstChannelRule>>(
      `${this.base}/channel-warehouses/${ruleId}`,
      payload,
    );
  }

  deleteChannelRule(ruleId: string): Envelope<null> {
    return this.http.delete<DstEnvelope<null>>(`${this.base}/channel-warehouses/${ruleId}`);
  }

  getAtp(stockItemId: string, salesChannelId?: string | null): Envelope<DstAtp> {
    return this.http.get<DstEnvelope<DstAtp>>(`${this.base}/atp`, {
      params: toHttpParams({ stock_item_id: stockItemId, sales_channel_id: salesChannelId }),
    });
  }

  getAtpMatrix(page = 1): Envelope<DstAtpMatrix> {
    return this.http.get<DstEnvelope<DstAtpMatrix>>(`${this.base}/atp/matrix`, {
      params: toHttpParams({ page }),
    });
  }

  // --- Consignment and 3PL ---

  listConsignmentStock(
    direction?: DstConsignmentDirection | null,
  ): Observable<DstPage<DstConsignmentStock, { total_value?: number | string }>> {
    return this.http.get<DstPage<DstConsignmentStock, { total_value?: number | string }>>(
      `${this.base}/consignment/stock`,
      { params: toHttpParams({ direction }) },
    );
  }

  listSettlements(): Envelope<DstSettlement[]> {
    return this.http.get<DstEnvelope<DstSettlement[]>>(`${this.base}/consignment/settlements`);
  }

  createSettlement(payload: DstSettlementPayload): Envelope<DstSettlement> {
    return this.http.post<DstEnvelope<DstSettlement>>(
      `${this.base}/consignment/settlements`,
      payload,
    );
  }

  createConsignmentReturn(payload: DstReturnPayload): Envelope<DstTransfer> {
    return this.http.post<DstEnvelope<DstTransfer>>(`${this.base}/consignment/returns`, payload);
  }

  listReconciliations(): Envelope<DstReconciliation[]> {
    return this.http.get<DstEnvelope<DstReconciliation[]>>(`${this.base}/threepl/reconciliations`);
  }

  createReconciliation(payload: DstReconciliationPayload): Envelope<DstReconciliation> {
    return this.http.post<DstEnvelope<DstReconciliation>>(
      `${this.base}/threepl/reconciliations`,
      payload,
    );
  }
}
