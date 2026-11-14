import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ConfiguratorConfiguration,
  ConfiguratorConfigurationRequest,
  ConfiguratorEnvelope,
  ConfiguratorEvaluation,
  ConfiguratorGroup,
  ConfiguratorGroupRequest,
  ConfiguratorModel,
  ConfiguratorModelRequest,
  ConfiguratorOption,
  ConfiguratorOptionRequest,
  ConfiguratorQuoteRequest,
  ConfiguratorRule,
  ConfiguratorRuleCheck,
  ConfiguratorRuleRequest,
} from '../models';

@Service()
export class ConfiguratorApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/configurator`;

  // Models
  getModels(status?: string): Observable<ConfiguratorEnvelope<ConfiguratorModel[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);

    return this.http.get<ConfiguratorEnvelope<ConfiguratorModel[]>>(`${this.base}/models`, { params });
  }

  getModel(id: string): Observable<ConfiguratorEnvelope<ConfiguratorModel>> {
    return this.http.get<ConfiguratorEnvelope<ConfiguratorModel>>(`${this.base}/models/${id}`);
  }

  createModel(payload: ConfiguratorModelRequest): Observable<ConfiguratorEnvelope<ConfiguratorModel>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorModel>>(`${this.base}/models`, payload);
  }

  updateModel(id: string, payload: ConfiguratorModelRequest): Observable<ConfiguratorEnvelope<ConfiguratorModel>> {
    return this.http.put<ConfiguratorEnvelope<ConfiguratorModel>>(`${this.base}/models/${id}`, payload);
  }

  deleteModel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/models/${id}`);
  }

  publishModel(id: string): Observable<ConfiguratorEnvelope<ConfiguratorModel>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorModel>>(`${this.base}/models/${id}/publish`, {});
  }

  archiveModel(id: string): Observable<ConfiguratorEnvelope<ConfiguratorModel>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorModel>>(`${this.base}/models/${id}/archive`, {});
  }

  checkRules(id: string): Observable<ConfiguratorEnvelope<ConfiguratorRuleCheck>> {
    return this.http.get<ConfiguratorEnvelope<ConfiguratorRuleCheck>>(`${this.base}/models/${id}/rule-check`);
  }

  /** Validates and prices a selection without saving anything. */
  evaluate(
    modelId: string,
    payload: ConfiguratorConfigurationRequest,
  ): Observable<ConfiguratorEnvelope<ConfiguratorEvaluation>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorEvaluation>>(`${this.base}/models/${modelId}/evaluate`, payload);
  }

  // Groups
  createGroup(modelId: string, payload: ConfiguratorGroupRequest): Observable<ConfiguratorEnvelope<ConfiguratorGroup>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorGroup>>(`${this.base}/models/${modelId}/groups`, payload);
  }

  updateGroup(id: string, payload: ConfiguratorGroupRequest): Observable<ConfiguratorEnvelope<ConfiguratorGroup>> {
    return this.http.put<ConfiguratorEnvelope<ConfiguratorGroup>>(`${this.base}/groups/${id}`, payload);
  }

  deleteGroup(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/groups/${id}`);
  }

  // Options
  createOption(groupId: string, payload: ConfiguratorOptionRequest): Observable<ConfiguratorEnvelope<ConfiguratorOption>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorOption>>(`${this.base}/groups/${groupId}/options`, payload);
  }

  updateOption(id: string, payload: ConfiguratorOptionRequest): Observable<ConfiguratorEnvelope<ConfiguratorOption>> {
    return this.http.put<ConfiguratorEnvelope<ConfiguratorOption>>(`${this.base}/options/${id}`, payload);
  }

  deleteOption(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/options/${id}`);
  }

  // Rules
  getRules(modelId: string): Observable<ConfiguratorEnvelope<ConfiguratorRule[]>> {
    return this.http.get<ConfiguratorEnvelope<ConfiguratorRule[]>>(`${this.base}/models/${modelId}/rules`);
  }

  createRule(modelId: string, payload: ConfiguratorRuleRequest): Observable<ConfiguratorEnvelope<ConfiguratorRule>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorRule>>(`${this.base}/models/${modelId}/rules`, payload);
  }

  updateRule(id: string, payload: ConfiguratorRuleRequest): Observable<ConfiguratorEnvelope<ConfiguratorRule>> {
    return this.http.put<ConfiguratorEnvelope<ConfiguratorRule>>(`${this.base}/rules/${id}`, payload);
  }

  deleteRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/rules/${id}`);
  }

  // Configurations
  getConfigurations(filters?: {
    status?: string;
    model_id?: string;
    contact_id?: string;
  }): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration[]>> {
    let params = new HttpParams();
    if (filters?.status) params = params.set('status', filters.status);
    if (filters?.model_id) params = params.set('model_id', filters.model_id);
    if (filters?.contact_id) params = params.set('contact_id', filters.contact_id);

    return this.http.get<ConfiguratorEnvelope<ConfiguratorConfiguration[]>>(`${this.base}/configurations`, { params });
  }

  getConfiguration(id: string): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration>> {
    return this.http.get<ConfiguratorEnvelope<ConfiguratorConfiguration>>(`${this.base}/configurations/${id}`);
  }

  createConfiguration(
    payload: ConfiguratorConfigurationRequest,
  ): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorConfiguration>>(`${this.base}/configurations`, payload);
  }

  updateConfiguration(
    id: string,
    payload: Partial<ConfiguratorConfigurationRequest>,
  ): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration>> {
    return this.http.put<ConfiguratorEnvelope<ConfiguratorConfiguration>>(`${this.base}/configurations/${id}`, payload);
  }

  deleteConfiguration(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/configurations/${id}`);
  }

  validateConfiguration(id: string): Observable<ConfiguratorEnvelope<ConfiguratorEvaluation>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorEvaluation>>(`${this.base}/configurations/${id}/validate`, {});
  }

  requestApproval(id: string): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorConfiguration>>(`${this.base}/configurations/${id}/request-approval`, {});
  }

  approveConfiguration(id: string, decisionNotes?: string): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorConfiguration>>(`${this.base}/configurations/${id}/approve`, {
      decision_notes: decisionNotes ?? null,
    });
  }

  rejectConfiguration(id: string, decisionNotes: string): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorConfiguration>>(`${this.base}/configurations/${id}/reject`, {
      decision_notes: decisionNotes,
    });
  }

  convertToQuote(
    id: string,
    payload: ConfiguratorQuoteRequest = {},
  ): Observable<ConfiguratorEnvelope<ConfiguratorConfiguration>> {
    return this.http.post<ConfiguratorEnvelope<ConfiguratorConfiguration>>(`${this.base}/configurations/${id}/convert-to-quote`, payload);
  }
}
