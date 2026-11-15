import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import {
  GovAction,
  GovActionRequest,
  GovAudit,
  GovAuditPlan,
  GovAuditPlanRequest,
  GovAuditRequest,
  GovControl,
  GovControlRequest,
  GovControlTest,
  GovControlTestRequest,
  GovDashboard,
  GovFinding,
  GovFindingRequest,
  GovMember,
  GovObligation,
  GovObligationCompleteRequest,
  GovObligationRequest,
  GovObligationTemplate,
  GovRisk,
  GovRiskControlsRequest,
  GovRiskRequest,
  GovSeedObligationTemplatesRequest,
  GovSodException,
  GovSodExceptionRequest,
  GovSodRule,
  GovSodRuleRequest,
  GovSodScanResult,
  GovSodViolation,
  GovTransitionRequest,
  LaravelPaginationMeta,
} from '../models';

/** A resource collection of the governance API: `{ data: T[] }`, with `meta` when paginated. */
export interface GovList<T> {
  data: T[];
  meta?: LaravelPaginationMeta;
}

/** A single governance resource: `{ data: T }`. */
export interface GovItem<T> {
  data: T;
}

/** List filters shared by the governance endpoints (every one optional, the API ignores the unknown ones). */
export type GovListParams = Record<string, string | number | boolean | undefined>;

@Service()
export class GovernanceApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/governance`;

  getDashboard(basis: 'residual' | 'inherent' = 'residual'): Observable<GovItem<GovDashboard>> {
    return this.http.get<GovItem<GovDashboard>>(`${this.base}/dashboard`, { params: toHttpParams({ basis }) });
  }

  getMembers(): Observable<GovList<GovMember>> {
    return this.http.get<GovList<GovMember>>(`${this.base}/members`);
  }

  // Risks
  getRisks(params: GovListParams = {}): Observable<GovList<GovRisk>> {
    return this.http.get<GovList<GovRisk>>(`${this.base}/risks`, { params: toHttpParams(params) });
  }

  getRisk(id: string): Observable<GovItem<GovRisk>> {
    return this.http.get<GovItem<GovRisk>>(`${this.base}/risks/${id}`);
  }

  createRisk(payload: GovRiskRequest): Observable<GovItem<GovRisk>> {
    return this.http.post<GovItem<GovRisk>>(`${this.base}/risks`, payload);
  }

  updateRisk(id: string, payload: Partial<GovRiskRequest>): Observable<GovItem<GovRisk>> {
    return this.http.put<GovItem<GovRisk>>(`${this.base}/risks/${id}`, payload);
  }

  deleteRisk(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/risks/${id}`);
  }

  transitionRisk(id: string, payload: GovTransitionRequest): Observable<GovItem<GovRisk>> {
    return this.http.post<GovItem<GovRisk>>(`${this.base}/risks/${id}/transition`, payload);
  }

  syncRiskControls(id: string, payload: GovRiskControlsRequest): Observable<GovItem<GovRisk>> {
    return this.http.put<GovItem<GovRisk>>(`${this.base}/risks/${id}/controls`, payload);
  }

  // Controls
  getControls(params: GovListParams = {}): Observable<GovList<GovControl>> {
    return this.http.get<GovList<GovControl>>(`${this.base}/controls`, { params: toHttpParams(params) });
  }

  createControl(payload: GovControlRequest): Observable<GovItem<GovControl>> {
    return this.http.post<GovItem<GovControl>>(`${this.base}/controls`, payload);
  }

  updateControl(id: string, payload: Partial<GovControlRequest>): Observable<GovItem<GovControl>> {
    return this.http.put<GovItem<GovControl>>(`${this.base}/controls/${id}`, payload);
  }

  getControlTests(id: string): Observable<GovList<GovControlTest>> {
    return this.http.get<GovList<GovControlTest>>(`${this.base}/controls/${id}/tests`);
  }

  recordControlTest(id: string, payload: GovControlTestRequest): Observable<GovItem<GovControlTest>> {
    return this.http.post<GovItem<GovControlTest>>(`${this.base}/controls/${id}/tests`, payload);
  }

  // Audit plans and audits
  getAuditPlans(params: GovListParams = {}): Observable<GovList<GovAuditPlan>> {
    return this.http.get<GovList<GovAuditPlan>>(`${this.base}/audit-plans`, { params: toHttpParams(params) });
  }

  getAuditPlan(id: string): Observable<GovItem<GovAuditPlan>> {
    return this.http.get<GovItem<GovAuditPlan>>(`${this.base}/audit-plans/${id}`);
  }

  createAuditPlan(payload: GovAuditPlanRequest): Observable<GovItem<GovAuditPlan>> {
    return this.http.post<GovItem<GovAuditPlan>>(`${this.base}/audit-plans`, payload);
  }

  updateAuditPlan(id: string, payload: Partial<GovAuditPlanRequest>): Observable<GovItem<GovAuditPlan>> {
    return this.http.put<GovItem<GovAuditPlan>>(`${this.base}/audit-plans/${id}`, payload);
  }

  transitionAuditPlan(id: string, payload: GovTransitionRequest): Observable<GovItem<GovAuditPlan>> {
    return this.http.post<GovItem<GovAuditPlan>>(`${this.base}/audit-plans/${id}/transition`, payload);
  }

  getAudits(params: GovListParams = {}): Observable<GovList<GovAudit>> {
    return this.http.get<GovList<GovAudit>>(`${this.base}/audits`, { params: toHttpParams(params) });
  }

  createAudit(payload: GovAuditRequest): Observable<GovItem<GovAudit>> {
    return this.http.post<GovItem<GovAudit>>(`${this.base}/audits`, payload);
  }

  updateAudit(id: string, payload: Partial<GovAuditRequest>): Observable<GovItem<GovAudit>> {
    return this.http.put<GovItem<GovAudit>>(`${this.base}/audits/${id}`, payload);
  }

  transitionAudit(id: string, payload: GovTransitionRequest): Observable<GovItem<GovAudit>> {
    return this.http.post<GovItem<GovAudit>>(`${this.base}/audits/${id}/transition`, payload);
  }

  // Findings and remediation actions
  getFindings(params: GovListParams = {}): Observable<GovList<GovFinding>> {
    return this.http.get<GovList<GovFinding>>(`${this.base}/findings`, { params: toHttpParams(params) });
  }

  getFinding(id: string): Observable<GovItem<GovFinding>> {
    return this.http.get<GovItem<GovFinding>>(`${this.base}/findings/${id}`);
  }

  createFinding(payload: GovFindingRequest): Observable<GovItem<GovFinding>> {
    return this.http.post<GovItem<GovFinding>>(`${this.base}/findings`, payload);
  }

  updateFinding(id: string, payload: Partial<GovFindingRequest>): Observable<GovItem<GovFinding>> {
    return this.http.put<GovItem<GovFinding>>(`${this.base}/findings/${id}`, payload);
  }

  transitionFinding(id: string, payload: GovTransitionRequest): Observable<GovItem<GovFinding>> {
    return this.http.post<GovItem<GovFinding>>(`${this.base}/findings/${id}/transition`, payload);
  }

  createFindingAction(findingId: string, payload: GovActionRequest): Observable<GovItem<GovAction>> {
    return this.http.post<GovItem<GovAction>>(`${this.base}/findings/${findingId}/actions`, payload);
  }

  getActions(params: GovListParams = {}): Observable<GovList<GovAction>> {
    return this.http.get<GovList<GovAction>>(`${this.base}/actions`, { params: toHttpParams(params) });
  }

  updateAction(id: string, payload: Partial<GovActionRequest>): Observable<GovItem<GovAction>> {
    return this.http.put<GovItem<GovAction>>(`${this.base}/actions/${id}`, payload);
  }

  transitionAction(id: string, payload: GovTransitionRequest): Observable<GovItem<GovAction>> {
    return this.http.post<GovItem<GovAction>>(`${this.base}/actions/${id}/transition`, payload);
  }

  // Compliance obligations calendar
  getObligations(params: GovListParams = {}): Observable<GovList<GovObligation>> {
    return this.http.get<GovList<GovObligation>>(`${this.base}/obligations`, { params: toHttpParams(params) });
  }

  createObligation(payload: GovObligationRequest): Observable<GovItem<GovObligation>> {
    return this.http.post<GovItem<GovObligation>>(`${this.base}/obligations`, payload);
  }

  updateObligation(id: string, payload: Partial<GovObligationRequest>): Observable<GovItem<GovObligation>> {
    return this.http.put<GovItem<GovObligation>>(`${this.base}/obligations/${id}`, payload);
  }

  transitionObligation(id: string, payload: GovTransitionRequest): Observable<GovItem<GovObligation>> {
    return this.http.post<GovItem<GovObligation>>(`${this.base}/obligations/${id}/transition`, payload);
  }

  completeObligation(id: string, payload: GovObligationCompleteRequest = {}): Observable<GovItem<GovObligation>> {
    return this.http.post<GovItem<GovObligation>>(`${this.base}/obligations/${id}/complete`, payload);
  }

  getObligationTemplates(): Observable<GovList<GovObligationTemplate>> {
    return this.http.get<GovList<GovObligationTemplate>>(`${this.base}/obligations/templates`);
  }

  seedObligationTemplates(
    payload: GovSeedObligationTemplatesRequest,
  ): Observable<GovItem<{ created: number; skipped: number }>> {
    return this.http.post<GovItem<{ created: number; skipped: number }>>(`${this.base}/obligations/seed-templates`, payload);
  }

  // Segregation of duties
  getSodRules(): Observable<GovList<GovSodRule>> {
    return this.http.get<GovList<GovSodRule>>(`${this.base}/sod/rules`);
  }

  createSodRule(payload: GovSodRuleRequest): Observable<GovItem<GovSodRule>> {
    return this.http.post<GovItem<GovSodRule>>(`${this.base}/sod/rules`, payload);
  }

  updateSodRule(id: string, payload: Partial<Omit<GovSodRuleRequest, 'code'>>): Observable<GovItem<GovSodRule>> {
    return this.http.put<GovItem<GovSodRule>>(`${this.base}/sod/rules/${id}`, payload);
  }

  deleteSodRule(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/sod/rules/${id}`);
  }

  seedSodRules(): Observable<GovItem<{ created: number; skipped: number }>> {
    return this.http.post<GovItem<{ created: number; skipped: number }>>(`${this.base}/sod/rules/seed-defaults`, {});
  }

  getSodViolations(params: GovListParams = {}): Observable<GovList<GovSodViolation>> {
    return this.http.get<GovList<GovSodViolation>>(`${this.base}/sod/violations`, { params: toHttpParams(params) });
  }

  scanSod(): Observable<GovItem<GovSodScanResult>> {
    return this.http.post<GovItem<GovSodScanResult>>(`${this.base}/sod/scan`, {});
  }

  getSodExceptions(params: GovListParams = {}): Observable<GovList<GovSodException>> {
    return this.http.get<GovList<GovSodException>>(`${this.base}/sod/exceptions`, { params: toHttpParams(params) });
  }

  createSodException(payload: GovSodExceptionRequest): Observable<GovItem<GovSodException>> {
    return this.http.post<GovItem<GovSodException>>(`${this.base}/sod/exceptions`, payload);
  }

  revokeSodException(id: string): Observable<GovItem<GovSodException>> {
    return this.http.post<GovItem<GovSodException>>(`${this.base}/sod/exceptions/${id}/revoke`, {});
  }
}
