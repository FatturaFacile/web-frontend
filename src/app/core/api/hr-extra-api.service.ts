import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import { toHttpParams } from '../http/laravel-http.utils';
import { ApiResponse, LaravelPaginationMeta } from '../models';

type Filters = Record<string, string | number | boolean | null | undefined | string[]>;
/** Request body: field names mirror the Laravel FormRequest of the route. */
type Payload = Record<string, unknown>;
/** Generic resource returned by the API. */
type Row = Record<string, unknown>;
type ListResponse<T> = ApiResponse<T[]> & { meta?: LaravelPaginationMeta };

/** Additional endpoints of the hr API not covered by the dedicated typed services. */
@Service()
export class HrExtraApiService {
  private readonly http = inject(HttpClient);
  private readonly base = environment.apiBaseUrl;

  /** GET /hr/me */
  getMe(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/me`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /hr/employees/{} */
  updateEmployee(employeeId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/hr/employees/${employeeId}`, payload);
  }

  /** DELETE /hr/employees/{} */
  deleteEmployee(employeeId: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/hr/employees/${employeeId}`);
  }

  /** GET /hr/offboarding-templates */
  listOffboardingTemplates(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/offboarding-templates`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/offboarding-checklists */
  listOffboardingChecklists(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/offboarding-checklists`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/exit-interviews */
  listExitInterviews(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/exit-interviews`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/goal-cycles */
  listGoalCycles(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/goal-cycles`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/teams */
  listTeams(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/teams`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/goals */
  listGoals(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/goals`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/goals/{}/check-ins */
  listGoalCheckIns(goalId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/goals/${goalId}/check-ins`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/analytics/headcount */
  getAnalyticsHeadcount(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/analytics/headcount`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/analytics/turnover */
  getAnalyticsTurnover(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/analytics/turnover`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/analytics/tenure */
  getAnalyticsTenure(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/analytics/tenure`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/analytics/absenteeism */
  getAnalyticsAbsenteeism(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/analytics/absenteeism`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/analytics/positions */
  listAnalyticsPositions(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/analytics/positions`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/analytics/upcoming-expiries */
  listAnalyticsUpcomingExpiries(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/analytics/upcoming-expiries`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/payroll/wage-types */
  listPayrollWageTypes(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/payroll/wage-types`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/payroll/wage-types */
  createPayrollWageType(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/wage-types`, payload);
  }

  /** PUT /hr/payroll/wage-types/{} */
  updatePayrollWageType(wageTypeId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/hr/payroll/wage-types/${wageTypeId}`, payload);
  }

  /** GET /hr/payroll/rate-sets */
  listPayrollRateSets(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/payroll/rate-sets`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/payroll/rate-sets */
  createPayrollRateSet(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/rate-sets`, payload);
  }

  /** GET /hr/payroll/withholding-tariffs */
  listPayrollWithholdingTariffs(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/payroll/withholding-tariffs`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/payroll/withholding-tariffs */
  createPayrollWithholdingTariff(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/withholding-tariffs`, payload);
  }

  /** POST /hr/payroll/withholding-tariffs/import */
  importPayrollWithholdingTariff(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/withholding-tariffs/import`, payload);
  }

  /** GET /hr/payroll/employees/{}/profile */
  getPayrollEmployeeProfile(employeeId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/payroll/employees/${employeeId}/profile`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /hr/payroll/employees/{}/profile */
  updatePayrollEmployeeProfile(employeeId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/hr/payroll/employees/${employeeId}/profile`, payload);
  }

  /** GET /hr/payroll/runs */
  listPayrollRuns(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/payroll/runs`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/payroll/runs */
  createPayrollRun(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/runs`, payload);
  }

  /** GET /hr/payroll/runs/{} */
  getPayrollRun(runId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/payroll/runs/${runId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /hr/payroll/runs/{} */
  updatePayrollRun(runId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/hr/payroll/runs/${runId}`, payload);
  }

  /** POST /hr/payroll/runs/{}/calculate */
  calculatePayrollRun(runId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/runs/${runId}/calculate`, payload);
  }

  /** POST /hr/payroll/runs/{}/approve */
  approvePayrollRun(runId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/runs/${runId}/approve`, payload);
  }

  /** POST /hr/payroll/runs/{}/close */
  closePayrollRun(runId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/runs/${runId}/close`, payload);
  }

  /** GET /hr/payroll/runs/{}/payslips */
  listPayrollRunPayslips(runId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/payroll/runs/${runId}/payslips`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/payroll/payslips/{} */
  getPayrollPayslip(payslipId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/payroll/payslips/${payslipId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/payroll/declarations */
  createPayrollDeclaration(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/payroll/declarations`, payload);
  }

  /** GET /hr/payroll/declarations/{} */
  getPayrollDeclaration(declarationId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/payroll/declarations/${declarationId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/payroll/declarations/{}/download */
  getPayrollDeclarationDownload(declarationId: string, filters?: Filters): Observable<Blob> {
    return this.http.get(`${this.base}/hr/payroll/declarations/${declarationId}/download`, { params: filters ? toHttpParams(filters) : undefined, responseType: 'blob' });
  }

  /** GET /hr/recruiting/job-openings */
  listRecruitingJobOpenings(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/recruiting/job-openings`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/recruiting/job-openings */
  createRecruitingJobOpening(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/job-openings`, payload);
  }

  /** GET /hr/recruiting/job-openings/{} */
  getRecruitingJobOpening(jobOpeningId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/recruiting/job-openings/${jobOpeningId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /hr/recruiting/job-openings/{} */
  updateRecruitingJobOpening(jobOpeningId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/hr/recruiting/job-openings/${jobOpeningId}`, payload);
  }

  /** POST /hr/recruiting/job-openings/{}/publish */
  publishRecruitingJobOpening(jobOpeningId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/job-openings/${jobOpeningId}/publish`, payload);
  }

  /** POST /hr/recruiting/job-openings/{}/close */
  closeRecruitingJobOpening(jobOpeningId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/job-openings/${jobOpeningId}/close`, payload);
  }

  /** GET /hr/recruiting/job-openings/{}/board */
  getRecruitingJobOpeningBoard(jobOpeningId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/recruiting/job-openings/${jobOpeningId}/board`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** GET /hr/recruiting/applications */
  listRecruitingApplications(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/recruiting/applications`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/recruiting/applications */
  createRecruitingApplication(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications`, payload);
  }

  /** GET /hr/recruiting/applications/{} */
  getRecruitingApplication(applicationId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PATCH /hr/recruiting/applications/{} */
  updateRecruitingApplication(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.patch<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}`, payload);
  }

  /** GET /hr/recruiting/applications/{}/cv */
  getRecruitingApplicationCv(applicationId: string, filters?: Filters): Observable<Blob> {
    return this.http.get(`${this.base}/hr/recruiting/applications/${applicationId}/cv`, { params: filters ? toHttpParams(filters) : undefined, responseType: 'blob' });
  }

  /** POST /hr/recruiting/applications/{}/reparse-cv */
  reparseCvRecruitingApplication(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/reparse-cv`, payload);
  }

  /** POST /hr/recruiting/applications/{}/move */
  moveRecruitingApplication(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/move`, payload);
  }

  /** POST /hr/recruiting/applications/{}/extend-consent */
  extendConsentRecruitingApplication(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/extend-consent`, payload);
  }

  /** POST /hr/recruiting/applications/{}/anonymize */
  anonymizeRecruitingApplication(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/anonymize`, payload);
  }

  /** POST /hr/recruiting/applications/{}/hire */
  hireRecruitingApplication(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/hire`, payload);
  }

  /** GET /hr/recruiting/applications/{}/scorecards */
  listRecruitingApplicationScorecards(applicationId: string, filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/scorecards`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/recruiting/applications/{}/scorecards */
  createRecruitingApplicationScorecard(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/scorecards`, payload);
  }

  /** GET /hr/recruiting/applications/{}/offer */
  getRecruitingApplicationOffer(applicationId: string, filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/offer`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** POST /hr/recruiting/applications/{}/offer */
  createRecruitingApplicationOffer(applicationId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/applications/${applicationId}/offer`, payload);
  }

  /** POST /hr/recruiting/offers/{}/mark-signed */
  markSignedRecruitingOffer(offerId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/offers/${offerId}/mark-signed`, payload);
  }

  /** POST /hr/recruiting/offers/{}/decline */
  declineRecruitingOffer(offerId: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.post<ApiResponse<Row>>(`${this.base}/hr/recruiting/offers/${offerId}/decline`, payload);
  }

  /** GET /hr/recruiting/email-templates */
  listRecruitingEmailTemplates(filters?: Filters): Observable<ListResponse<Row>> {
    return this.http.get<ListResponse<Row>>(`${this.base}/hr/recruiting/email-templates`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /hr/recruiting/email-templates/{}/{} */
  updateRecruitingEmailTemplate(templateKey: string, templateKey2: string, payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/hr/recruiting/email-templates/${templateKey}/${templateKey2}`, payload);
  }

  /** GET /hr/recruiting/settings */
  getRecruitingSettings(filters?: Filters): Observable<ApiResponse<Row>> {
    return this.http.get<ApiResponse<Row>>(`${this.base}/hr/recruiting/settings`, { params: filters ? toHttpParams(filters) : undefined });
  }

  /** PUT /hr/recruiting/settings */
  saveRecruitingSettings(payload: Payload = {}): Observable<ApiResponse<Row>> {
    return this.http.put<ApiResponse<Row>>(`${this.base}/hr/recruiting/settings`, payload);
  }
}
