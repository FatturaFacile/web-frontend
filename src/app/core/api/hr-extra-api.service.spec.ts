import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Observable } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { HrExtraApiService } from './hr-extra-api.service';

describe('HrExtraApiService', () => {
  let service: HrExtraApiService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [HrExtraApiService, provideHttpClient(), provideHttpClientTesting()] });
    service = TestBed.inject(HrExtraApiService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  const cases: [string, string, string, () => Observable<unknown>][] = [
    ['getMe', 'GET', '/hr/me', () => service.getMe()],
    ['updateEmployee', 'PUT', '/hr/employees/employ-1', () => service.updateEmployee('employ-1', {})],
    ['deleteEmployee', 'DELETE', '/hr/employees/employ-1', () => service.deleteEmployee('employ-1')],
    ['listOffboardingTemplates', 'GET', '/hr/offboarding-templates', () => service.listOffboardingTemplates()],
    ['listOffboardingChecklists', 'GET', '/hr/offboarding-checklists', () => service.listOffboardingChecklists()],
    ['listExitInterviews', 'GET', '/hr/exit-interviews', () => service.listExitInterviews()],
    ['listGoalCycles', 'GET', '/hr/goal-cycles', () => service.listGoalCycles()],
    ['listTeams', 'GET', '/hr/teams', () => service.listTeams()],
    ['listGoals', 'GET', '/hr/goals', () => service.listGoals()],
    ['listGoalCheckIns', 'GET', '/hr/goals/goalId-1/check-ins', () => service.listGoalCheckIns('goalId-1')],
    ['getAnalyticsHeadcount', 'GET', '/hr/analytics/headcount', () => service.getAnalyticsHeadcount()],
    ['getAnalyticsTurnover', 'GET', '/hr/analytics/turnover', () => service.getAnalyticsTurnover()],
    ['getAnalyticsTenure', 'GET', '/hr/analytics/tenure', () => service.getAnalyticsTenure()],
    ['getAnalyticsAbsenteeism', 'GET', '/hr/analytics/absenteeism', () => service.getAnalyticsAbsenteeism()],
    ['listAnalyticsPositions', 'GET', '/hr/analytics/positions', () => service.listAnalyticsPositions()],
    ['listAnalyticsUpcomingExpiries', 'GET', '/hr/analytics/upcoming-expiries', () => service.listAnalyticsUpcomingExpiries()],
    ['listPayrollWageTypes', 'GET', '/payroll/wage-types', () => service.listPayrollWageTypes()],
    ['createPayrollWageType', 'POST', '/payroll/wage-types', () => service.createPayrollWageType({})],
    ['updatePayrollWageType', 'PUT', '/payroll/wage-types/wageTy-1', () => service.updatePayrollWageType('wageTy-1', {})],
    ['listPayrollRateSets', 'GET', '/payroll/rate-sets', () => service.listPayrollRateSets()],
    ['createPayrollRateSet', 'POST', '/payroll/rate-sets', () => service.createPayrollRateSet({})],
    ['listPayrollWithholdingTariffs', 'GET', '/payroll/withholding-tariffs', () => service.listPayrollWithholdingTariffs()],
    ['createPayrollWithholdingTariff', 'POST', '/payroll/withholding-tariffs', () => service.createPayrollWithholdingTariff({})],
    ['importPayrollWithholdingTariff', 'POST', '/payroll/withholding-tariffs/import', () => service.importPayrollWithholdingTariff({})],
    ['getPayrollEmployeeProfile', 'GET', '/payroll/employees/employ-1/profile', () => service.getPayrollEmployeeProfile('employ-1')],
    ['updatePayrollEmployeeProfile', 'PUT', '/payroll/employees/employ-1/profile', () => service.updatePayrollEmployeeProfile('employ-1', {})],
    ['listPayrollRuns', 'GET', '/payroll/runs', () => service.listPayrollRuns()],
    ['createPayrollRun', 'POST', '/payroll/runs', () => service.createPayrollRun({})],
    ['getPayrollRun', 'GET', '/payroll/runs/runId-1', () => service.getPayrollRun('runId-1')],
    ['updatePayrollRun', 'PUT', '/payroll/runs/runId-1', () => service.updatePayrollRun('runId-1', {})],
    ['calculatePayrollRun', 'POST', '/payroll/runs/runId-1/calculate', () => service.calculatePayrollRun('runId-1', {})],
    ['approvePayrollRun', 'POST', '/payroll/runs/runId-1/approve', () => service.approvePayrollRun('runId-1', {})],
    ['closePayrollRun', 'POST', '/payroll/runs/runId-1/close', () => service.closePayrollRun('runId-1', {})],
    ['listPayrollRunPayslips', 'GET', '/payroll/runs/runId-1/payslips', () => service.listPayrollRunPayslips('runId-1')],
    ['getPayrollPayslip', 'GET', '/payroll/payslips/paysli-1', () => service.getPayrollPayslip('paysli-1')],
    ['createPayrollDeclaration', 'POST', '/payroll/declarations', () => service.createPayrollDeclaration({})],
    ['getPayrollDeclaration', 'GET', '/payroll/declarations/declar-1', () => service.getPayrollDeclaration('declar-1')],
    ['getPayrollDeclarationDownload', 'GET', '/payroll/declarations/declar-1/download', () => service.getPayrollDeclarationDownload('declar-1')],
    ['listRecruitingJobOpenings', 'GET', '/hr/recruiting/job-openings', () => service.listRecruitingJobOpenings()],
    ['createRecruitingJobOpening', 'POST', '/hr/recruiting/job-openings', () => service.createRecruitingJobOpening({})],
    ['getRecruitingJobOpening', 'GET', '/hr/recruiting/job-openings/jobOpe-1', () => service.getRecruitingJobOpening('jobOpe-1')],
    ['updateRecruitingJobOpening', 'PUT', '/hr/recruiting/job-openings/jobOpe-1', () => service.updateRecruitingJobOpening('jobOpe-1', {})],
    ['publishRecruitingJobOpening', 'POST', '/hr/recruiting/job-openings/jobOpe-1/publish', () => service.publishRecruitingJobOpening('jobOpe-1', {})],
    ['closeRecruitingJobOpening', 'POST', '/hr/recruiting/job-openings/jobOpe-1/close', () => service.closeRecruitingJobOpening('jobOpe-1', {})],
    ['getRecruitingJobOpeningBoard', 'GET', '/hr/recruiting/job-openings/jobOpe-1/board', () => service.getRecruitingJobOpeningBoard('jobOpe-1')],
    ['listRecruitingApplications', 'GET', '/hr/recruiting/applications', () => service.listRecruitingApplications()],
    ['createRecruitingApplication', 'POST', '/hr/recruiting/applications', () => service.createRecruitingApplication({ job_opening_id: 'j', first_name: 'A', last_name: 'B', email: 'a@b.ch' })],
    ['getRecruitingApplication', 'GET', '/hr/recruiting/applications/applic-1', () => service.getRecruitingApplication('applic-1')],
    ['updateRecruitingApplication', 'PATCH', '/hr/recruiting/applications/applic-1', () => service.updateRecruitingApplication('applic-1', {})],
    ['getRecruitingApplicationCv', 'GET', '/hr/recruiting/applications/applic-1/cv', () => service.getRecruitingApplicationCv('applic-1')],
    ['reparseCvRecruitingApplication', 'POST', '/hr/recruiting/applications/applic-1/reparse-cv', () => service.reparseCvRecruitingApplication('applic-1')],
    ['moveRecruitingApplication', 'POST', '/hr/recruiting/applications/applic-1/move', () => service.moveRecruitingApplication('applic-1', { stage: 'hr_screening' })],
    ['extendConsentRecruitingApplication', 'POST', '/hr/recruiting/applications/applic-1/extend-consent', () => service.extendConsentRecruitingApplication('applic-1', { months: 6 })],
    ['anonymizeRecruitingApplication', 'POST', '/hr/recruiting/applications/applic-1/anonymize', () => service.anonymizeRecruitingApplication('applic-1')],
    ['hireRecruitingApplication', 'POST', '/hr/recruiting/applications/applic-1/hire', () => service.hireRecruitingApplication('applic-1', {})],
    ['listRecruitingApplicationScorecards', 'GET', '/hr/recruiting/applications/applic-1/scorecards', () => service.listRecruitingApplicationScorecards('applic-1')],
    ['createRecruitingApplicationScorecard', 'POST', '/hr/recruiting/applications/applic-1/scorecards', () => service.createRecruitingApplicationScorecard('applic-1', { stage: 'hr_screening', criteria_scores: [], recommendation: 'hire' })],
    ['getRecruitingApplicationOffer', 'GET', '/hr/recruiting/applications/applic-1/offer', () => service.getRecruitingApplicationOffer('applic-1')],
    ['createRecruitingApplicationOffer', 'POST', '/hr/recruiting/applications/applic-1/offer', () => service.createRecruitingApplicationOffer('applic-1', { proposed_salary: 1, start_date: '2027-01-01' })],
    ['markSignedRecruitingOffer', 'POST', '/hr/recruiting/offers/offerI-1/mark-signed', () => service.markSignedRecruitingOffer('offerI-1', {})],
    ['declineRecruitingOffer', 'POST', '/hr/recruiting/offers/offerI-1/decline', () => service.declineRecruitingOffer('offerI-1', {})],
    ['listRecruitingEmailTemplates', 'GET', '/hr/recruiting/email-templates', () => service.listRecruitingEmailTemplates()],
    ['updateRecruitingEmailTemplate', 'PUT', '/hr/recruiting/email-templates/templa-1/templa-2', () => service.updateRecruitingEmailTemplate('templa-1', 'templa-2', { subject: 's', body: 'b', is_enabled: true })],
    ['getRecruitingSettings', 'GET', '/hr/recruiting/settings', () => service.getRecruitingSettings()],
    ['saveRecruitingSettings', 'PUT', '/hr/recruiting/settings', () => service.saveRecruitingSettings({})],
  ];

  it.each(cases)('%s sends %s %s', (_name, method, url, call) => {
    call().subscribe();
    const request = http.expectOne((r) => r.method === method && r.url.endsWith(url));
    request.flush(request.request.responseType === 'blob' ? new Blob() : {});
  });

  it('forwards GET filters as query parameters', () => {
    service.getMe({ page: 2 }).subscribe();
    const request = http.expectOne((r) => r.url.endsWith('/hr/me'));
    expect(request.request.params.get('page')).toBe('2');
    request.flush({});
  });
});
