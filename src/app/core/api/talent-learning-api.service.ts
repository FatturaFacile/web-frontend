import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  TalentBudgetPool,
  TalentBudgetPoolRequest,
  TalentCertificate,
  TalentCompCycle,
  TalentCompCycleRequest,
  TalentCompliance,
  TalentCourse,
  TalentCourseRequest,
  TalentCycleSummary,
  TalentEmployee,
  TalentEnrolment,
  TalentEnrolmentRequest,
  TalentGuideline,
  TalentLearningDashboard,
  TalentLearningPath,
  TalentLearningPathRequest,
  TalentListFilters,
  TalentMeritProposal,
  TalentMeritProposalRequest,
  TalentPathEnrolmentRequest,
  TalentPlanningDashboard,
  TalentPositionLookup,
  TalentResponse,
  TalentSuccessionCandidate,
  TalentSuccessionCandidateRequest,
  TalentSuccessionPosition,
  TalentSuccessionPositionRequest,
  TalentSurvey,
  TalentSurveyAnswerRequest,
  TalentSurveyRequest,
  TalentSurveyResults,
} from '../models';

type Wrapped<T> = Observable<TalentResponse<T>>;

@Service()
export class TalentLearningApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/talent-learning`;

  // Dashboards and lookups
  getDashboard(): Wrapped<TalentLearningDashboard> {
    return this.get('dashboard');
  }

  getPlanningDashboard(): Wrapped<TalentPlanningDashboard> {
    return this.get('planning/dashboard');
  }

  getEmployeeLookup(search?: string): Wrapped<TalentEmployee[]> {
    return this.get('lookups/employees', { search, limit: 100 });
  }

  getPositionLookup(search?: string): Wrapped<TalentPositionLookup[]> {
    return this.get('lookups/positions', { search });
  }

  // Succession planning
  getSuccessionPositions(filters?: TalentListFilters): Wrapped<TalentSuccessionPosition[]> {
    return this.get('succession/positions', filters);
  }

  getSuccessionPosition(id: string): Wrapped<TalentSuccessionPosition> {
    return this.get(`succession/positions/${id}`);
  }

  createSuccessionPosition(payload: TalentSuccessionPositionRequest): Wrapped<TalentSuccessionPosition> {
    return this.http.post<TalentResponse<TalentSuccessionPosition>>(`${this.base}/succession/positions`, payload);
  }

  updateSuccessionPosition(id: string, payload: Partial<TalentSuccessionPositionRequest>): Wrapped<TalentSuccessionPosition> {
    return this.http.put<TalentResponse<TalentSuccessionPosition>>(`${this.base}/succession/positions/${id}`, payload);
  }

  deleteSuccessionPosition(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/succession/positions/${id}`);
  }

  createCandidate(positionId: string, payload: TalentSuccessionCandidateRequest): Wrapped<TalentSuccessionCandidate> {
    return this.http.post<TalentResponse<TalentSuccessionCandidate>>(`${this.base}/succession/positions/${positionId}/candidates`, payload);
  }

  updateCandidate(id: string, payload: Partial<TalentSuccessionCandidateRequest>): Wrapped<TalentSuccessionCandidate> {
    return this.http.put<TalentResponse<TalentSuccessionCandidate>>(`${this.base}/succession/candidates/${id}`, payload);
  }

  deleteCandidate(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/succession/candidates/${id}`);
  }

  // Compensation planning
  getCycles(filters?: TalentListFilters): Wrapped<TalentCompCycle[]> {
    return this.get('compensation/cycles', filters);
  }

  getCycle(id: string): Wrapped<TalentCompCycle> {
    return this.get(`compensation/cycles/${id}`);
  }

  createCycle(payload: TalentCompCycleRequest): Wrapped<TalentCompCycle> {
    return this.http.post<TalentResponse<TalentCompCycle>>(`${this.base}/compensation/cycles`, payload);
  }

  deleteCycle(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/compensation/cycles/${id}`);
  }

  openCycle(id: string): Wrapped<TalentCompCycle> {
    return this.http.post<TalentResponse<TalentCompCycle>>(`${this.base}/compensation/cycles/${id}/open`, {});
  }

  closeCycle(id: string): Wrapped<TalentCompCycle> {
    return this.http.post<TalentResponse<TalentCompCycle>>(`${this.base}/compensation/cycles/${id}/close`, {});
  }

  replaceGuidelines(id: string, guidelines: TalentGuideline[]): Wrapped<TalentGuideline[]> {
    return this.http.put<TalentResponse<TalentGuideline[]>>(`${this.base}/compensation/cycles/${id}/guidelines`, { guidelines });
  }

  getCycleSummary(id: string): Wrapped<TalentCycleSummary> {
    return this.get(`compensation/cycles/${id}/summary`);
  }

  getBudgetPools(filters?: TalentListFilters): Wrapped<TalentBudgetPool[]> {
    return this.get('compensation/pools', filters);
  }

  createBudgetPool(payload: TalentBudgetPoolRequest): Wrapped<TalentBudgetPool> {
    return this.http.post<TalentResponse<TalentBudgetPool>>(`${this.base}/compensation/pools`, payload);
  }

  deleteBudgetPool(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/compensation/pools/${id}`);
  }

  getMeritProposals(filters?: TalentListFilters): Wrapped<TalentMeritProposal[]> {
    return this.get('compensation/proposals', filters);
  }

  createMeritProposal(payload: TalentMeritProposalRequest): Wrapped<TalentMeritProposal> {
    return this.http.post<TalentResponse<TalentMeritProposal>>(`${this.base}/compensation/proposals`, payload);
  }

  submitMeritProposal(id: string): Wrapped<TalentMeritProposal> {
    return this.http.post<TalentResponse<TalentMeritProposal>>(`${this.base}/compensation/proposals/${id}/submit`, {});
  }

  decideMeritProposal(id: string, decision: 'approve' | 'reject', decisionNote: string | null): Wrapped<TalentMeritProposal> {
    return this.http.post<TalentResponse<TalentMeritProposal>>(`${this.base}/compensation/proposals/${id}/${decision}`, { decision_note: decisionNote });
  }

  deleteMeritProposal(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/compensation/proposals/${id}`);
  }

  // Learning
  getCourses(filters?: TalentListFilters): Wrapped<TalentCourse[]> {
    return this.get('courses', filters);
  }

  createCourse(payload: TalentCourseRequest): Wrapped<TalentCourse> {
    return this.http.post<TalentResponse<TalentCourse>>(`${this.base}/courses`, payload);
  }

  updateCourse(id: string, payload: Partial<TalentCourseRequest>): Wrapped<TalentCourse> {
    return this.http.put<TalentResponse<TalentCourse>>(`${this.base}/courses/${id}`, payload);
  }

  transitionCourse(id: string, action: 'publish' | 'archive'): Wrapped<TalentCourse> {
    return this.http.post<TalentResponse<TalentCourse>>(`${this.base}/courses/${id}/${action}`, {});
  }

  deleteCourse(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/courses/${id}`);
  }

  getLearningPaths(filters?: TalentListFilters): Wrapped<TalentLearningPath[]> {
    return this.get('learning-paths', filters);
  }

  createLearningPath(payload: TalentLearningPathRequest): Wrapped<TalentLearningPath> {
    return this.http.post<TalentResponse<TalentLearningPath>>(`${this.base}/learning-paths`, payload);
  }

  updateLearningPath(id: string, payload: Partial<TalentLearningPathRequest>): Wrapped<TalentLearningPath> {
    return this.http.put<TalentResponse<TalentLearningPath>>(`${this.base}/learning-paths/${id}`, payload);
  }

  transitionLearningPath(id: string, action: 'publish' | 'archive'): Wrapped<TalentLearningPath> {
    return this.http.post<TalentResponse<TalentLearningPath>>(`${this.base}/learning-paths/${id}/${action}`, {});
  }

  enrolInLearningPath(id: string, payload: TalentPathEnrolmentRequest): Wrapped<TalentEnrolment[]> {
    return this.http.post<TalentResponse<TalentEnrolment[]>>(`${this.base}/learning-paths/${id}/enrol`, payload);
  }

  deleteLearningPath(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/learning-paths/${id}`);
  }

  getEnrolments(filters?: TalentListFilters): Wrapped<TalentEnrolment[]> {
    return this.get('enrolments', filters);
  }

  createEnrolment(payload: TalentEnrolmentRequest): Wrapped<TalentEnrolment> {
    return this.http.post<TalentResponse<TalentEnrolment>>(`${this.base}/enrolments`, payload);
  }

  updateEnrolmentProgress(id: string, progressPercent: number): Wrapped<TalentEnrolment> {
    return this.http.post<TalentResponse<TalentEnrolment>>(`${this.base}/enrolments/${id}/progress`, { progress_percent: progressPercent });
  }

  completeEnrolment(id: string, score: number | null): Wrapped<TalentEnrolment> {
    return this.http.post<TalentResponse<TalentEnrolment>>(`${this.base}/enrolments/${id}/complete`, { score });
  }

  cancelEnrolment(id: string): Wrapped<TalentEnrolment> {
    return this.http.post<TalentResponse<TalentEnrolment>>(`${this.base}/enrolments/${id}/cancel`, {});
  }

  /** The enrolments of the employee linked to the logged-in user (not paginated). */
  getMyEnrolments(): Wrapped<TalentEnrolment[]> {
    return this.get('my/enrolments');
  }

  getMyCertificates(): Wrapped<TalentCertificate[]> {
    return this.get('my/certificates');
  }

  /** A learner records the progress of her own enrolment; completion stays with the learning managers. */
  updateMyEnrolmentProgress(id: string, progressPercent: number): Wrapped<TalentEnrolment> {
    return this.http.post<TalentResponse<TalentEnrolment>>(`${this.base}/my/enrolments/${id}/progress`, { progress_percent: progressPercent });
  }

  getCertificates(filters?: TalentListFilters): Wrapped<TalentCertificate[]> {
    return this.get('certificates', filters);
  }

  getCompliance(courseId?: string): Wrapped<TalentCompliance> {
    return this.get('compliance', { course_id: courseId });
  }

  // Engagement surveys
  getSurveys(filters?: TalentListFilters): Wrapped<TalentSurvey[]> {
    return this.get('surveys', filters);
  }

  getSurvey(id: string): Wrapped<TalentSurvey> {
    return this.get(`surveys/${id}`);
  }

  createSurvey(payload: TalentSurveyRequest): Wrapped<TalentSurvey> {
    return this.http.post<TalentResponse<TalentSurvey>>(`${this.base}/surveys`, payload);
  }

  updateSurvey(id: string, payload: Partial<TalentSurveyRequest>): Wrapped<TalentSurvey> {
    return this.http.put<TalentResponse<TalentSurvey>>(`${this.base}/surveys/${id}`, payload);
  }

  openSurvey(id: string): Wrapped<TalentSurvey> {
    return this.http.post<TalentResponse<TalentSurvey>>(`${this.base}/surveys/${id}/open`, {});
  }

  closeSurvey(id: string): Wrapped<TalentSurvey> {
    return this.http.post<TalentResponse<TalentSurvey>>(`${this.base}/surveys/${id}/close`, {});
  }

  submitSurveyResponse(id: string, answers: TalentSurveyAnswerRequest[]): Observable<unknown> {
    return this.http.post<unknown>(`${this.base}/surveys/${id}/responses`, { answers });
  }

  getSurveyResults(id: string): Wrapped<TalentSurveyResults> {
    return this.get(`surveys/${id}/results`);
  }

  deleteSurvey(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/surveys/${id}`);
  }

  private get<T>(path: string, filters?: object): Wrapped<T> {
    return this.http.get<TalentResponse<T>>(`${this.base}/${path}`, { params: this.params(filters) });
  }

  private params(values?: object): HttpParams {
    let params = new HttpParams();
    for (const [key, value] of Object.entries(values ?? {})) {
      if (value !== undefined && value !== null && value !== '') {
        params = params.set(key, typeof value === 'boolean' ? (value ? '1' : '0') : String(value));
      }
    }
    return params;
  }
}
