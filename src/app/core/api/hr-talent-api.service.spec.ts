import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { environment } from '@env';
import { HrTalentApiService } from '@core';

const ok = { success: true, message: '', data: [] };
const one = { success: true, message: '', data: {} };

describe('HrTalentApiService', () => {
  let service: HrTalentApiService;
  let httpMock: HttpTestingController;
  const hr = `${environment.apiBaseUrl}/hr`;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HrTalentApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HrTalentApiService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => httpMock.verify());

  it('performance reviews: list, submit, complete', () => {
    service.getPerformanceReviews().subscribe();
    httpMock.expectOne(`${hr}/performance-reviews`).flush(ok);
    service
      .submitPerformanceReview({ employee_id: 'e1', review_period: '2026', goals_score: '80.5', competencies_score: '70' })
      .subscribe();
    const post = httpMock.expectOne(`${hr}/performance-reviews`);
    expect(post.request.body.goals_score).toBe('80.5');
    post.flush(one);
    service.completeReview('r1').subscribe();
    const done = httpMock.expectOne(`${hr}/performance-reviews/r1/complete`);
    expect(done.request.method).toBe('POST');
    done.flush(one);
  });

  it('training: courses, records and optional score', () => {
    service.getTrainingCourses().subscribe();
    httpMock.expectOne(`${hr}/training-courses`).flush(ok);
    service.createTrainingCourse({ course_code: 'SAF', title: 'Safety', duration_hours: '8.00' }).subscribe();
    httpMock.expectOne(`${hr}/training-courses`).flush(one);
    service.getTrainingRecords().subscribe();
    httpMock.expectOne(`${hr}/training-records`).flush(ok);
    service.assignTraining({ employee_id: 'e1', course_id: 'c1', override_cost: '10.00' }).subscribe();
    httpMock.expectOne(`${hr}/training-records`).flush(one);
    service.completeTrainingRecord('t1', '92.5').subscribe();
    const withScore = httpMock.expectOne(`${hr}/training-records/t1/complete`);
    expect(withScore.request.body).toEqual({ score: '92.5' });
    withScore.flush(one);
    service.completeTrainingRecord('t2').subscribe();
    expect(httpMock.expectOne(`${hr}/training-records/t2/complete`).request.body).toEqual({});
  });

  it('certifications and the expiry scan', () => {
    service.getCertifications().subscribe();
    httpMock.expectOne(`${hr}/certifications`).flush(ok);
    service.scanExpiringCertifications(45).subscribe();
    const scan = httpMock.expectOne(`${hr}/certifications/scan-expiring`);
    expect(scan.request.body).toEqual({ within_days: 45 });
    scan.flush({ success: true, message: '', data: { expiring_certifications_alerted: 2 } });
  });

  it('recruiting: postings, pipeline and applications', () => {
    service.getJobPostings().subscribe();
    httpMock.expectOne(`${hr}/job-postings`).flush(ok);
    service.createJobPosting({ title: 'Dev', status: 'open' }).subscribe();
    httpMock.expectOne(`${hr}/job-postings`).flush(one);
    service.closeJobPosting('p1').subscribe();
    httpMock.expectOne(`${hr}/job-postings/p1/close`).flush(one);
    service.getPipelineStages().subscribe();
    httpMock.expectOne(`${hr}/pipeline-stages`).flush(ok);

    service.getJobApplications({ job_posting_id: 'p1' }).subscribe();
    const list = httpMock.expectOne((r) => r.url === `${hr}/job-applications`);
    expect(list.request.params.get('job_posting_id')).toBe('p1');
    list.flush({ ...ok, meta: {} });
    service.getJobApplication('a1').subscribe();
    httpMock.expectOne(`${hr}/job-applications/a1`).flush(one);
    service
      .createJobApplication({ job_posting_id: 'p1', first_name: 'A', last_name: 'B', email: 'a@b.test' })
      .subscribe();
    httpMock.expectOne(`${hr}/job-applications`).flush(one);
    service.deleteJobApplication('a1').subscribe();
    httpMock.expectOne(`${hr}/job-applications/a1`).flush(null, { status: 204, statusText: 'No Content' });
  });

  it('recruiting: move, notes, reject, consent and hire with a decimal salary', () => {
    service.moveJobApplication('a1', 's1').subscribe();
    expect(httpMock.expectOne(`${hr}/job-applications/a1/move`).request.body).toEqual({ pipeline_stage_id: 's1' });
    service.addInterviewNote('a1', 'good', 4).subscribe();
    const note = httpMock.expectOne(`${hr}/job-applications/a1/notes`);
    expect(note.request.body).toEqual({ note: 'good', rating: 4 });
    note.flush(one);
    service.rejectJobApplication('a1').subscribe();
    httpMock.expectOne(`${hr}/job-applications/a1/reject`).flush(one);
    service.recordConsent('a1', '2027-01-01').subscribe();
    expect(httpMock.expectOne(`${hr}/job-applications/a1/consent`).request.body).toEqual({ consent_until: '2027-01-01' });
    service.hireCandidate('a1', { base_annual_salary: '90000.00', hire_date: '2026-12-01' }).subscribe();
    const hire = httpMock.expectOne(`${hr}/job-applications/a1/hire`);
    expect(hire.request.body.base_annual_salary).toBe('90000.00');
    hire.flush({ success: true, message: '', data: { employee_id: 'e', employee_number: '1' } });
  });

  it('recruiting settings and onboarding', () => {
    service.setRecruitingRetention(90).subscribe();
    const put = httpMock.expectOne(`${hr}/recruiting-settings`);
    expect(put.request.method).toBe('PUT');
    expect(put.request.body).toEqual({ retention_days: 90 });
    service.createOnboardingTemplate({ name: 'Std', tasks: [{ title: 'Laptop', due_after_days: 1 }] }).subscribe();
    httpMock.expectOne(`${hr}/onboarding-templates`).flush(one);
    service.getOnboardingChecklists('e1').subscribe();
    const lists = httpMock.expectOne((r) => r.url === `${hr}/onboarding-checklists`);
    expect(lists.request.params.get('employee_id')).toBe('e1');
    lists.flush(ok);
    service.completeOnboardingTask('k1').subscribe();
    httpMock.expectOne(`${hr}/onboarding-tasks/k1/complete`).flush(one);
  });
});
