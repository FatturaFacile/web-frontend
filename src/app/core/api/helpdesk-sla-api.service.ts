import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { map, Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  BreachRiskParams,
  BreachRiskTicket,
  EscalationChain,
  HandoffResult,
  HandoffRma,
  HandoffToFieldServiceRequest,
  HandoffToRmaRequest,
  HandoffWorkOrder,
  HelpdeskMetrics,
  HelpdeskMetricsParams,
  HolidayPreview,
  HolidayPreviewParams,
  LogTicketTimeRequest,
  SaveEscalationChainRequest,
  SlaPolicySettingsRequest,
  TicketCustomerContext,
  TicketEscalationLogEntry,
  TicketTimeEntry,
} from '../models';

/** Helpdesk SLA, escalation and time billing endpoints (`/esm/helpdesk/*`, `/esm/tickets/{id}/*`). */
@Service()
export class HelpdeskSlaApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/esm`;

  getBreachRisk(params?: BreachRiskParams): Observable<{ data: BreachRiskTicket[] }> {
    return this.http.get<{ data: BreachRiskTicket[] }>(`${this.base}/helpdesk/breach-risk`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getMetrics(params?: HelpdeskMetricsParams): Observable<{ data: HelpdeskMetrics }> {
    return this.http.get<{ data: HelpdeskMetrics }>(`${this.base}/helpdesk/metrics`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getCustomerContext(ticketId: string): Observable<{ data: TicketCustomerContext }> {
    return this.http.get<{ data: TicketCustomerContext }>(
      `${this.base}/tickets/${ticketId}/customer-context`,
    );
  }

  getEscalations(ticketId: string): Observable<{ data: TicketEscalationLogEntry[] }> {
    return this.http.get<{ data: TicketEscalationLogEntry[] }>(
      `${this.base}/tickets/${ticketId}/escalations`,
    );
  }

  getTimeEntries(ticketId: string): Observable<{ data: TicketTimeEntry[] }> {
    return this.http.get<{ data: TicketTimeEntry[] }>(
      `${this.base}/tickets/${ticketId}/time-entries`,
    );
  }

  logTime(ticketId: string, payload: LogTicketTimeRequest): Observable<{ data: TicketTimeEntry }> {
    return this.http.post<{ data: TicketTimeEntry }>(
      `${this.base}/tickets/${ticketId}/time-entries`,
      payload,
    );
  }

  /** 201 on the first hand-off, 200 when the ticket already has a work order. */
  escalateToFieldService(
    ticketId: string,
    payload: HandoffToFieldServiceRequest = {},
  ): Observable<HandoffResult<HandoffWorkOrder>> {
    return this.http
      .post<{ data: HandoffWorkOrder }>(
        `${this.base}/tickets/${ticketId}/escalate/field-service`,
        payload,
        {
          observe: 'response',
        },
      )
      .pipe(map((response) => this.toHandoff(response)));
  }

  escalateToRma(
    ticketId: string,
    payload: HandoffToRmaRequest = {},
  ): Observable<HandoffResult<HandoffRma>> {
    return this.http
      .post<{ data: HandoffRma; meta?: { tracking_token?: string } }>(
        `${this.base}/tickets/${ticketId}/escalate/rma`,
        payload,
        { observe: 'response' },
      )
      .pipe(map((response) => this.toHandoff(response)));
  }

  getEscalationChains(): Observable<{ data: EscalationChain[] }> {
    return this.http.get<{ data: EscalationChain[] }>(`${this.base}/helpdesk/escalation-chains`);
  }

  createEscalationChain(
    payload: SaveEscalationChainRequest,
  ): Observable<{ data: EscalationChain }> {
    return this.http.post<{ data: EscalationChain }>(
      `${this.base}/helpdesk/escalation-chains`,
      payload,
    );
  }

  updateEscalationChain(
    id: string,
    payload: SaveEscalationChainRequest,
  ): Observable<{ data: EscalationChain }> {
    return this.http.patch<{ data: EscalationChain }>(
      `${this.base}/helpdesk/escalation-chains/${id}`,
      payload,
    );
  }

  deleteEscalationChain(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/helpdesk/escalation-chains/${id}`);
  }

  updateSlaPolicySettings(
    id: string,
    payload: SlaPolicySettingsRequest,
  ): Observable<{ data: unknown }> {
    return this.http.put<{ data: unknown }>(
      `${this.base}/helpdesk/sla-policies/${id}/settings`,
      payload,
    );
  }

  getHolidays(params: HolidayPreviewParams): Observable<{ data: HolidayPreview }> {
    return this.http.get<{ data: HolidayPreview }>(`${this.base}/helpdesk/holidays`, {
      params: toHttpParams(params),
    });
  }

  private toHandoff<T extends { data: unknown; meta?: { tracking_token?: string } }>(
    response: HttpResponse<T>,
  ): HandoffResult<T['data']> {
    const body = response.body as T;
    return { created: response.status === 201, data: body.data, meta: body.meta };
  }
}
