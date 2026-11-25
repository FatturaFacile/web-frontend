import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  CpqBomMappingRecord,
  CpqCharacteristicRecord,
  CpqConfiguratorEnvelope,
  CpqDiagnostics,
  CpqEvaluation,
  CpqEvaluationRequest,
  CpqExpressionCheck,
  CpqInstance,
  CpqModelRecord,
  CpqOptionRecord,
  CpqPricingFormulaRecord,
  CpqProposal,
  CpqRecordPayload,
  CpqRoutingMappingRecord,
  CpqRuleRecord,
} from '../models';

/** The kinds of child record a model owns, with the path segment of the collection and of the single record. */
export type CpqChildKind = 'rules' | 'superbom-mappings' | 'routing-mappings' | 'pricing-formulas';

/**
 * Technical-commercial CPQ configurator (Mod 230): models and their definition, the live evaluation of a selection, the
 * confirmation that reuses or issues a part number, the configured instances and the proposal.
 */
@Service()
export class CpqConfiguratorApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/cpq-configurator`;

  // Models
  getModels(status?: string): Observable<CpqConfiguratorEnvelope<CpqModelRecord[]>> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);

    return this.http.get<CpqConfiguratorEnvelope<CpqModelRecord[]>>(`${this.base}/models`, {
      params,
    });
  }

  getModel(id: string): Observable<CpqConfiguratorEnvelope<CpqModelRecord>> {
    return this.http.get<CpqConfiguratorEnvelope<CpqModelRecord>>(`${this.base}/models/${id}`);
  }

  createModel(payload: CpqRecordPayload): Observable<CpqConfiguratorEnvelope<CpqModelRecord>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqModelRecord>>(`${this.base}/models`, payload);
  }

  updateModel(
    id: string,
    payload: CpqRecordPayload,
  ): Observable<CpqConfiguratorEnvelope<CpqModelRecord>> {
    return this.http.put<CpqConfiguratorEnvelope<CpqModelRecord>>(
      `${this.base}/models/${id}`,
      payload,
    );
  }

  deleteModel(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/models/${id}`);
  }

  publishModel(id: string): Observable<CpqConfiguratorEnvelope<CpqModelRecord>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqModelRecord>>(
      `${this.base}/models/${id}/publish`,
      {},
    );
  }

  archiveModel(id: string): Observable<CpqConfiguratorEnvelope<CpqModelRecord>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqModelRecord>>(
      `${this.base}/models/${id}/archive`,
      {},
    );
  }

  getDiagnostics(id: string): Observable<CpqConfiguratorEnvelope<CpqDiagnostics>> {
    return this.http.get<CpqConfiguratorEnvelope<CpqDiagnostics>>(
      `${this.base}/models/${id}/diagnostics`,
    );
  }

  checkExpression(
    modelId: string,
    expression: string,
  ): Observable<CpqConfiguratorEnvelope<CpqExpressionCheck>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqExpressionCheck>>(
      `${this.base}/models/${modelId}/expression-check`,
      { expression },
    );
  }

  // Characteristics and options
  createCharacteristic(
    modelId: string,
    payload: CpqRecordPayload,
  ): Observable<CpqConfiguratorEnvelope<CpqCharacteristicRecord>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqCharacteristicRecord>>(
      `${this.base}/models/${modelId}/characteristics`,
      payload,
    );
  }

  updateCharacteristic(
    id: string,
    payload: CpqRecordPayload,
  ): Observable<CpqConfiguratorEnvelope<CpqCharacteristicRecord>> {
    return this.http.put<CpqConfiguratorEnvelope<CpqCharacteristicRecord>>(
      `${this.base}/characteristics/${id}`,
      payload,
    );
  }

  deleteCharacteristic(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/characteristics/${id}`);
  }

  createOption(
    characteristicId: string,
    payload: CpqRecordPayload,
  ): Observable<CpqConfiguratorEnvelope<CpqOptionRecord>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqOptionRecord>>(
      `${this.base}/characteristics/${characteristicId}/options`,
      payload,
    );
  }

  updateOption(
    id: string,
    payload: CpqRecordPayload,
  ): Observable<CpqConfiguratorEnvelope<CpqOptionRecord>> {
    return this.http.put<CpqConfiguratorEnvelope<CpqOptionRecord>>(
      `${this.base}/options/${id}`,
      payload,
    );
  }

  deleteOption(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/options/${id}`);
  }

  // Rules, super-BOM and routing mappings, pricing formulas
  listChildren<
    T extends
      CpqRuleRecord | CpqBomMappingRecord | CpqRoutingMappingRecord | CpqPricingFormulaRecord,
  >(kind: CpqChildKind, modelId: string): Observable<CpqConfiguratorEnvelope<T[]>> {
    return this.http.get<CpqConfiguratorEnvelope<T[]>>(`${this.base}/models/${modelId}/${kind}`);
  }

  createChild<T>(
    kind: CpqChildKind,
    modelId: string,
    payload: CpqRecordPayload,
  ): Observable<CpqConfiguratorEnvelope<T>> {
    return this.http.post<CpqConfiguratorEnvelope<T>>(
      `${this.base}/models/${modelId}/${kind}`,
      payload,
    );
  }

  updateChild<T>(
    kind: CpqChildKind,
    id: string,
    payload: CpqRecordPayload,
  ): Observable<CpqConfiguratorEnvelope<T>> {
    return this.http.put<CpqConfiguratorEnvelope<T>>(`${this.base}/${kind}/${id}`, payload);
  }

  deleteChild(kind: CpqChildKind, id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/${kind}/${id}`);
  }

  // Guided configuration
  /** Validates and prices a selection without saving anything. */
  evaluate(
    modelId: string,
    payload: CpqEvaluationRequest,
  ): Observable<CpqConfiguratorEnvelope<CpqEvaluation>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqEvaluation>>(
      `${this.base}/models/${modelId}/evaluate`,
      payload,
    );
  }

  /** Confirms a selection: an identical configuration answers 200 with `meta.reused`, a new one 201 with a new part number. */
  confirm(
    modelId: string,
    payload: CpqEvaluationRequest,
  ): Observable<CpqConfiguratorEnvelope<CpqInstance>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqInstance>>(
      `${this.base}/models/${modelId}/confirm`,
      payload,
    );
  }

  previewProposal(
    modelId: string,
    payload: CpqEvaluationRequest,
  ): Observable<CpqConfiguratorEnvelope<CpqProposal>> {
    return this.http.post<CpqConfiguratorEnvelope<CpqProposal>>(
      `${this.base}/models/${modelId}/proposal`,
      payload,
    );
  }

  // Instances
  getInstances(
    filters: { model_id?: string; search?: string } = {},
  ): Observable<CpqConfiguratorEnvelope<CpqInstance[]>> {
    let params = new HttpParams();
    if (filters.model_id) params = params.set('model_id', filters.model_id);
    if (filters.search) params = params.set('search', filters.search);

    return this.http.get<CpqConfiguratorEnvelope<CpqInstance[]>>(`${this.base}/instances`, {
      params,
    });
  }

  getInstance(id: string): Observable<CpqConfiguratorEnvelope<CpqInstance>> {
    return this.http.get<CpqConfiguratorEnvelope<CpqInstance>>(`${this.base}/instances/${id}`);
  }

  getInstanceProposal(
    id: string,
    options: {
      quantity?: number;
      discount_percent?: number;
      include_breakdown?: boolean;
      customer_reference?: string;
    } = {},
  ): Observable<CpqConfiguratorEnvelope<CpqProposal>> {
    let params = new HttpParams();
    if (options.quantity !== undefined) params = params.set('quantity', options.quantity);
    if (options.discount_percent !== undefined)
      params = params.set('discount_percent', options.discount_percent);
    if (options.include_breakdown) params = params.set('include_breakdown', 1);
    if (options.customer_reference)
      params = params.set('customer_reference', options.customer_reference);

    return this.http.get<CpqConfiguratorEnvelope<CpqProposal>>(
      `${this.base}/instances/${id}/proposal`,
      { params },
    );
  }

  downloadInstanceProposalPdf(
    id: string,
    options: { quantity?: number; discount_percent?: number } = {},
  ): Observable<Blob> {
    let params = new HttpParams();
    if (options.quantity !== undefined) params = params.set('quantity', options.quantity);
    if (options.discount_percent !== undefined)
      params = params.set('discount_percent', options.discount_percent);

    return this.http.get(`${this.base}/instances/${id}/proposal/pdf`, {
      params,
      responseType: 'blob',
    });
  }
}
