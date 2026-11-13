import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { environment } from '@env';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  AssignTrainingPayload,
  CertificationResource,
  HireCandidatePayload,
  JobApplicationPayload,
  JobApplicationRecord,
  JobPostingPayload,
  JobPostingRecord,
  OnboardingChecklistRecord,
  OnboardingTemplatePayload,
  PaginatedResponse,
  PerformanceReviewResource,
  PipelineStageRecord,
  QueryFilterParams,
  SubmitPerformanceReviewPayload,
  TrainingCoursePayload,
  TrainingCourseResource,
  TrainingRecordResource,
} from '../models';
import { toHttpParams } from '../http/laravel-http.utils';

/** Performance reviews, training, certifications and recruiting. */
@Service()
export class HrTalentApiService {
  private readonly http = inject(HttpClient);
  private readonly base = `${environment.apiBaseUrl}/hr`;

  // --- Performance reviews ---

  getPerformanceReviews(params?: QueryFilterParams): Observable<PaginatedResponse<PerformanceReviewResource>> {
    return this.http.get<PaginatedResponse<PerformanceReviewResource>>(`${this.base}/performance-reviews`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  submitPerformanceReview(payload: SubmitPerformanceReviewPayload): Observable<ApiResponse<PerformanceReviewResource>> {
    return this.http.post<ApiResponse<PerformanceReviewResource>>(`${this.base}/performance-reviews`, payload);
  }

  completeReview(id: string): Observable<ApiResponse<PerformanceReviewResource>> {
    return this.http.post<ApiResponse<PerformanceReviewResource>>(`${this.base}/performance-reviews/${id}/complete`, {});
  }

  // --- Training ---

  getTrainingCourses(params?: QueryFilterParams): Observable<PaginatedResponse<TrainingCourseResource>> {
    return this.http.get<PaginatedResponse<TrainingCourseResource>>(`${this.base}/training-courses`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createTrainingCourse(payload: TrainingCoursePayload): Observable<ApiResponse<TrainingCourseResource>> {
    return this.http.post<ApiResponse<TrainingCourseResource>>(`${this.base}/training-courses`, payload);
  }

  getTrainingRecords(params?: QueryFilterParams): Observable<PaginatedResponse<TrainingRecordResource>> {
    return this.http.get<PaginatedResponse<TrainingRecordResource>>(`${this.base}/training-records`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  assignTraining(payload: AssignTrainingPayload): Observable<ApiResponse<TrainingRecordResource>> {
    return this.http.post<ApiResponse<TrainingRecordResource>>(`${this.base}/training-records`, payload);
  }

  /** The score is optional: the server defaults to 100. */
  completeTrainingRecord(id: string, score?: string): Observable<ApiResponse<TrainingRecordResource>> {
    return this.http.post<ApiResponse<TrainingRecordResource>>(
      `${this.base}/training-records/${id}/complete`,
      score ? { score } : {},
    );
  }

  getCertifications(params?: QueryFilterParams): Observable<PaginatedResponse<CertificationResource>> {
    return this.http.get<PaginatedResponse<CertificationResource>>(`${this.base}/certifications`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  scanExpiringCertifications(withinDays?: number): Observable<ApiResponse<{ expiring_certifications_alerted: number }>> {
    return this.http.post<ApiResponse<{ expiring_certifications_alerted: number }>>(
      `${this.base}/certifications/scan-expiring`,
      withinDays === undefined ? {} : { within_days: withinDays },
    );
  }

  // --- Recruiting ---

  getJobPostings(params?: QueryFilterParams): Observable<PaginatedResponse<JobPostingRecord>> {
    return this.http.get<PaginatedResponse<JobPostingRecord>>(`${this.base}/job-postings`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  createJobPosting(payload: JobPostingPayload): Observable<ApiResponse<JobPostingRecord>> {
    return this.http.post<ApiResponse<JobPostingRecord>>(`${this.base}/job-postings`, payload);
  }

  closeJobPosting(id: string): Observable<ApiResponse<JobPostingRecord>> {
    return this.http.post<ApiResponse<JobPostingRecord>>(`${this.base}/job-postings/${id}/close`, {});
  }

  getPipelineStages(): Observable<ApiResponse<PipelineStageRecord[]>> {
    return this.http.get<ApiResponse<PipelineStageRecord[]>>(`${this.base}/pipeline-stages`);
  }

  getJobApplications(params?: { job_posting_id?: string; page?: number; per_page?: number }): Observable<PaginatedResponse<JobApplicationRecord>> {
    return this.http.get<PaginatedResponse<JobApplicationRecord>>(`${this.base}/job-applications`, {
      params: params ? toHttpParams(params) : undefined,
    });
  }

  getJobApplication(id: string): Observable<ApiResponse<JobApplicationRecord>> {
    return this.http.get<ApiResponse<JobApplicationRecord>>(`${this.base}/job-applications/${id}`);
  }

  createJobApplication(payload: JobApplicationPayload): Observable<ApiResponse<JobApplicationRecord>> {
    return this.http.post<ApiResponse<JobApplicationRecord>>(`${this.base}/job-applications`, payload);
  }

  deleteJobApplication(id: string): Observable<void> {
    return this.http.delete<void>(`${this.base}/job-applications/${id}`);
  }

  moveJobApplication(id: string, pipelineStageId: string): Observable<ApiResponse<JobApplicationRecord>> {
    return this.http.post<ApiResponse<JobApplicationRecord>>(`${this.base}/job-applications/${id}/move`, {
      pipeline_stage_id: pipelineStageId,
    });
  }

  addInterviewNote(id: string, note: string, rating?: number): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/job-applications/${id}/notes`, {
      note,
      ...(rating === undefined ? {} : { rating }),
    });
  }

  rejectJobApplication(id: string): Observable<ApiResponse<JobApplicationRecord>> {
    return this.http.post<ApiResponse<JobApplicationRecord>>(`${this.base}/job-applications/${id}/reject`, {});
  }

  recordConsent(id: string, consentUntil: string): Observable<ApiResponse<JobApplicationRecord>> {
    return this.http.post<ApiResponse<JobApplicationRecord>>(`${this.base}/job-applications/${id}/consent`, {
      consent_until: consentUntil,
    });
  }

  hireCandidate(id: string, payload: HireCandidatePayload): Observable<ApiResponse<{ employee_id: string; employee_number: string }>> {
    return this.http.post<ApiResponse<{ employee_id: string; employee_number: string }>>(
      `${this.base}/job-applications/${id}/hire`,
      payload,
    );
  }

  setRecruitingRetention(retentionDays: number): Observable<ApiResponse<{ id: string; retention_days: number }>> {
    return this.http.put<ApiResponse<{ id: string; retention_days: number }>>(`${this.base}/recruiting-settings`, {
      retention_days: retentionDays,
    });
  }

  createOnboardingTemplate(payload: OnboardingTemplatePayload): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/onboarding-templates`, payload);
  }

  getOnboardingChecklists(employeeId?: string, params?: QueryFilterParams): Observable<PaginatedResponse<OnboardingChecklistRecord>> {
    return this.http.get<PaginatedResponse<OnboardingChecklistRecord>>(`${this.base}/onboarding-checklists`, {
      params: toHttpParams({ ...params, employee_id: employeeId }),
    });
  }

  completeOnboardingTask(id: string): Observable<ApiResponse<Record<string, unknown>>> {
    return this.http.post<ApiResponse<Record<string, unknown>>>(`${this.base}/onboarding-tasks/${id}/complete`, {});
  }
}
