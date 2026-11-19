import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CrmPortalSettings,
  FsmMaintenanceContract,
  FsmMaintenanceContractPayload,
  FsmPreventiveRunResult,
  LeadWebhookEndpoint,
  LeadWebhookEndpointPayload,
} from '../models';

interface DataEnvelope<T> {
  data: T;
}

/** FSM maintenance contracts, CRM portal settings and Web-to-Lead endpoints. */
@Service()
export class GapViewsApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  listMaintenanceContracts(): Observable<DataEnvelope<FsmMaintenanceContract[]>> {
    return this.http.get<DataEnvelope<FsmMaintenanceContract[]>>(
      `${this.base}/fsm/maintenance-contracts`,
    );
  }

  createMaintenanceContract(
    payload: FsmMaintenanceContractPayload,
  ): Observable<DataEnvelope<FsmMaintenanceContract>> {
    return this.http.post<DataEnvelope<FsmMaintenanceContract>>(
      `${this.base}/fsm/maintenance-contracts`,
      payload,
    );
  }

  updateMaintenanceContract(
    id: string,
    payload: Partial<FsmMaintenanceContractPayload>,
  ): Observable<DataEnvelope<FsmMaintenanceContract>> {
    return this.http.patch<DataEnvelope<FsmMaintenanceContract>>(
      `${this.base}/fsm/maintenance-contracts/${id}`,
      payload,
    );
  }

  runPreventiveMaintenance(): Observable<DataEnvelope<FsmPreventiveRunResult>> {
    return this.http.post<DataEnvelope<FsmPreventiveRunResult>>(
      `${this.base}/fsm/preventive-maintenance/run`,
      {},
    );
  }

  getPortalSettings(): Observable<DataEnvelope<CrmPortalSettings>> {
    return this.http.get<DataEnvelope<CrmPortalSettings>>(`${this.base}/crm/portal-settings`);
  }

  savePortalSettings(payload: CrmPortalSettings): Observable<DataEnvelope<CrmPortalSettings>> {
    return this.http.put<DataEnvelope<CrmPortalSettings>>(
      `${this.base}/crm/portal-settings`,
      payload,
    );
  }

  listLeadWebhooks(): Observable<DataEnvelope<LeadWebhookEndpoint[]>> {
    return this.http.get<DataEnvelope<LeadWebhookEndpoint[]>>(`${this.base}/crm/lead-webhooks`);
  }

  createLeadWebhook(payload: LeadWebhookEndpointPayload): Observable<LeadWebhookEndpoint> {
    return this.http.post<LeadWebhookEndpoint>(`${this.base}/crm/lead-webhooks`, payload);
  }

  rotateLeadWebhookSecret(id: string): Observable<LeadWebhookEndpoint> {
    return this.http.post<LeadWebhookEndpoint>(
      `${this.base}/crm/lead-webhooks/${id}/rotate-secret`,
      {},
    );
  }

  deleteLeadWebhook(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/crm/lead-webhooks/${id}`);
  }
}
