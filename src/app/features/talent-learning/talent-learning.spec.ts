import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NzMessageService } from 'ng-zorro-antd/message';
import { provideNzIcons } from 'ng-zorro-antd/icon';
import { icons } from '../../icons-provider';
import {
  TalentCompCycle,
  TalentCourse,
  TalentEnrolment,
  TalentLearningApiService,
  TalentLearningDashboard,
  TalentMeritProposal,
  TalentPlanningDashboard,
  TalentSuccessionPosition,
  TalentSurvey,
  TranslateService,
} from '@core';
import { TalentComplianceComponent } from './talent-compliance.component';
import { TalentCompensationComponent } from './talent-compensation.component';
import { TalentCoursesComponent } from './talent-courses.component';
import { TalentDashboardComponent } from './talent-dashboard.component';
import { TalentEnrolmentsComponent } from './talent-enrolments.component';
import { TalentSuccessionComponent } from './talent-succession.component';
import { TalentSurveyResultsComponent } from './talent-survey-results.component';
import { TalentSurveysComponent } from './talent-surveys.component';
import { tagColor } from './talent-learning.util';

const position: TalentSuccessionPosition = {
  id: 'pos-1',
  position_id: null,
  title: 'Head of Finance',
  incumbent_employee_id: null,
  criticality: 'critical',
  vacancy_risk: 'high',
  status: 'active',
  notes: null,
  coverage: 'uncovered',
  candidates: [],
};

const cycle: TalentCompCycle = {
  id: 'cy-1',
  name: 'Merit 2027',
  fiscal_year: 2027,
  currency: 'EUR',
  starts_on: '2027-01-01',
  ends_on: '2027-03-31',
  effective_on: '2027-04-01',
  status: 'draft',
  closed_at: null,
  notes: null,
};

const proposal = { id: 'pr-1', status: 'submitted' } as TalentMeritProposal;

const course: TalentCourse = {
  id: 'co-1',
  code: 'SAFE-01',
  title: 'Workplace safety',
  description: null,
  delivery: 'online',
  duration_hours: '4.00',
  is_mandatory: true,
  validity_months: 36,
  pass_score: 70,
  status: 'draft',
};

const enrolment: TalentEnrolment = {
  id: 'en-1',
  course_id: 'co-1',
  course: { id: 'co-1', code: 'SAFE-01', title: 'Workplace safety', is_mandatory: true, pass_score: 70 },
  employee_id: 'emp-1',
  learning_path_id: null,
  status: 'in_progress',
  progress_percent: 20,
  due_on: null,
  is_overdue: false,
  completed_at: null,
  score: null,
  certificate: null,
};

const survey: TalentSurvey = {
  id: 'sv-1',
  title: 'Pulse 2027',
  description: null,
  status: 'open',
  is_anonymous: true,
  min_group_size: 5,
  opens_on: null,
  closes_on: null,
  has_answered: false,
  questions: [
    { id: 'q-1', position: 1, prompt: 'Recommend us?', question_type: 'enps', is_required: true },
    { id: 'q-2', position: 2, prompt: 'Comments', question_type: 'text', is_required: false },
  ],
};

const planning: TalentPlanningDashboard = {
  succession: {
    positions_total: 2,
    coverage: { covered: 1, at_risk: 0, uncovered: 1 },
    candidates_by_readiness: { ready_now: 1, ready_1_2_years: 0, ready_3_plus_years: 0 },
    high_risk_of_loss_candidates: 0,
    positions_needing_attention: [],
  },
  compensation: { cycles_total: 0, open_cycles: 0, current_cycle: null },
};

const learning: TalentLearningDashboard = {
  learning: {
    courses_published: 3,
    learning_paths_published: 1,
    enrolments_by_status: { enrolled: 1, in_progress: 2, completed: 5, cancelled: 0 },
    completion_rate_percent: 62.5,
    overdue_enrolments: 1,
    certificates_issued: 5,
    certificates_expired: 0,
    certificates_expiring_90_days: 1,
    mandatory_compliance_percent: 80,
  },
  engagement: null,
  surveys_open: 1,
};

const messageSpy = { success: vi.fn(), error: vi.fn(), warning: vi.fn(), info: vi.fn() };
const translateSpy = { instant: vi.fn().mockImplementation((key: string) => key), translate: vi.fn().mockImplementation((key: string) => key) };

function configure(api: Record<string, unknown>, extra: unknown[] = []): void {
  TestBed.resetTestingModule();
  TestBed.configureTestingModule({
    providers: [
      provideRouter([]),
      { provide: TalentLearningApiService, useValue: api },
      { provide: NzMessageService, useValue: messageSpy },
      { provide: TranslateService, useValue: translateSpy },
      provideNzIcons(icons),
      ...(extra as never[]),
    ],
  });
}

const lookup = { getEmployeeLookup: vi.fn().mockReturnValue(of({ data: [] })), getPositionLookup: vi.fn().mockReturnValue(of({ data: [] })) };

describe('talent learning util', () => {
  it('maps values to tag colours with a neutral fallback', () => {
    expect(tagColor('critical')).toBe('red');
    expect(tagColor('approved')).toBe('green');
    expect(tagColor('unknown')).toBe('default');
  });
});

describe('TalentDashboardComponent', () => {
  it('loads both dashboards', () => {
    const api = { getPlanningDashboard: vi.fn().mockReturnValue(of({ data: planning })), getDashboard: vi.fn().mockReturnValue(of({ data: learning })) };
    configure(api);
    const fixture = TestBed.createComponent(TalentDashboardComponent);
    fixture.detectChanges();

    expect(fixture.componentInstance.planning()).toEqual(planning);
    expect(fixture.componentInstance.learning()).toEqual(learning);
  });

  it('shows the API error', () => {
    const failure = () => throwError(() => new HttpErrorResponse({ status: 500, error: { message: 'Server error' } }));
    configure({ getPlanningDashboard: vi.fn().mockReturnValue(failure()), getDashboard: vi.fn().mockReturnValue(failure()) });
    messageSpy.error.mockClear();
    TestBed.createComponent(TalentDashboardComponent).detectChanges();

    expect(messageSpy.error).toHaveBeenCalledWith('Server error');
  });
});

describe('TalentSuccessionComponent', () => {
  const api = {
    ...lookup,
    getSuccessionPositions: vi.fn(),
    getSuccessionPosition: vi.fn(),
    createSuccessionPosition: vi.fn(),
    updateSuccessionPosition: vi.fn(),
    deleteSuccessionPosition: vi.fn(),
    createCandidate: vi.fn(),
    deleteCandidate: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lookup.getEmployeeLookup.mockReturnValue(of({ data: [] }));
    lookup.getPositionLookup.mockReturnValue(of({ data: [] }));
    api.getSuccessionPositions.mockReturnValue(of({ data: [position] }));
    api.getSuccessionPosition.mockReturnValue(of({ data: position }));
    api.createSuccessionPosition.mockReturnValue(of({ data: position }));
    api.createCandidate.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('creates a critical position with the API payload', () => {
    const fixture = TestBed.createComponent(TalentSuccessionComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    expect(component.positions()).toHaveLength(1);
    component.openPositionModal();
    component.positionForm.patchValue({ title: ' Head of Finance ', criticality: 'critical', vacancy_risk: 'high' });
    component.savePosition();

    expect(api.createSuccessionPosition).toHaveBeenCalledWith({
      position_id: null,
      title: 'Head of Finance',
      incumbent_employee_id: null,
      criticality: 'critical',
      vacancy_risk: 'high',
      status: 'active',
      notes: null,
    });
    expect(messageSpy.success).toHaveBeenCalled();
  });

  it('adds a successor candidate with readiness, potential, risk and ranking', () => {
    const fixture = TestBed.createComponent(TalentSuccessionComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCandidates(position);
    component.candidateForm.patchValue({ employee_id: 'emp-1', readiness: 'ready_now', risk_of_loss: 'medium', potential: 'high', ranking: 1 });
    component.addCandidate();

    expect(api.createCandidate).toHaveBeenCalledWith('pos-1', {
      employee_id: 'emp-1',
      readiness: 'ready_now',
      risk_of_loss: 'medium',
      potential: 'high',
      ranking: 1,
      development_plan: null,
    });
  });

  it('shows the API reason when the candidate is refused', () => {
    api.createCandidate.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { employee_id: ['The candidate is the incumbent'] } } })));
    const fixture = TestBed.createComponent(TalentSuccessionComponent);
    fixture.detectChanges();
    fixture.componentInstance.openCandidates(position);
    fixture.componentInstance.candidateForm.patchValue({ employee_id: 'emp-1' });
    fixture.componentInstance.addCandidate();

    expect(messageSpy.error).toHaveBeenCalledWith('The candidate is the incumbent');
  });
});

describe('TalentCompensationComponent', () => {
  const api = {
    ...lookup,
    getCycles: vi.fn(),
    getCycle: vi.fn(),
    createCycle: vi.fn(),
    openCycle: vi.fn(),
    closeCycle: vi.fn(),
    deleteCycle: vi.fn(),
    replaceGuidelines: vi.fn(),
    getCycleSummary: vi.fn(),
    getBudgetPools: vi.fn(),
    createBudgetPool: vi.fn(),
    deleteBudgetPool: vi.fn(),
    getMeritProposals: vi.fn(),
    createMeritProposal: vi.fn(),
    submitMeritProposal: vi.fn(),
    decideMeritProposal: vi.fn(),
    deleteMeritProposal: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lookup.getEmployeeLookup.mockReturnValue(of({ data: [] }));
    api.getCycles.mockReturnValue(of({ data: [cycle] }));
    api.getCycle.mockReturnValue(of({ data: { ...cycle, guidelines: [{ performance_rating: 3, min_percent: '2.00', max_percent: '4.00' }] } }));
    api.getCycleSummary.mockReturnValue(of({ data: { pools: [] } }));
    api.getBudgetPools.mockReturnValue(of({ data: [] }));
    api.getMeritProposals.mockReturnValue(of({ data: [] }));
    api.createCycle.mockReturnValue(of({ data: cycle }));
    api.openCycle.mockReturnValue(of({ data: { ...cycle, status: 'open' } }));
    api.replaceGuidelines.mockReturnValue(of({ data: [] }));
    api.createMeritProposal.mockReturnValue(of({ data: {} }));
    api.decideMeritProposal.mockReturnValue(of({ data: {} }));
    configure(api);
  });

  it('creates a cycle with the effective date', () => {
    const fixture = TestBed.createComponent(TalentCompensationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCycleModal();
    component.cycleForm.patchValue({ name: 'Merit 2027', fiscal_year: 2027, starts_on: '2027-01-01', ends_on: '2027-03-31', effective_on: '2027-04-01' });
    component.saveCycle();

    expect(api.createCycle).toHaveBeenCalledWith({
      name: 'Merit 2027',
      fiscal_year: 2027,
      currency: 'EUR',
      starts_on: '2027-01-01',
      ends_on: '2027-03-31',
      effective_on: '2027-04-01',
      notes: null,
    });
  });

  it('loads the saved guidelines and replaces them with the five rating rows', () => {
    const fixture = TestBed.createComponent(TalentCompensationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openGuidelines(cycle);
    expect(component.guidelineRows.at(2).getRawValue()).toEqual({ performance_rating: 3, min_percent: 2, max_percent: 4 });

    component.saveGuidelines();
    expect(api.replaceGuidelines).toHaveBeenCalledWith('cy-1', [
      { performance_rating: 1, min_percent: '0', max_percent: '0' },
      { performance_rating: 2, min_percent: '0', max_percent: '0' },
      { performance_rating: 3, min_percent: '2', max_percent: '4' },
      { performance_rating: 4, min_percent: '0', max_percent: '0' },
      { performance_rating: 5, min_percent: '0', max_percent: '0' },
    ]);
  });

  it('opens a cycle and loads summary, pools and proposals when selected', () => {
    const fixture = TestBed.createComponent(TalentCompensationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.transition(cycle, 'open');
    expect(api.openCycle).toHaveBeenCalledWith('cy-1');

    component.select(cycle);
    expect(api.getCycleSummary).toHaveBeenCalledWith('cy-1');
    expect(api.getBudgetPools).toHaveBeenCalledWith({ cycle_id: 'cy-1', per_page: 100 });
    expect(api.getMeritProposals).toHaveBeenCalledWith({ cycle_id: 'cy-1', per_page: 100 });
  });

  it('creates a merit proposal without a salary and rejects only with a note', () => {
    const fixture = TestBed.createComponent(TalentCompensationComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component.select(cycle);

    component.openProposalModal();
    component.proposalForm.patchValue({ employee_id: 'emp-1', budget_pool_id: 'pool-1', performance_rating: 4, increase_percent: 4, justification: ' ' });
    component.saveProposal();
    component.openDecision(proposal, 'reject');
    component.decisionNote = 'Over budget';
    component.saveDecision();

    expect(api.createMeritProposal).toHaveBeenCalledWith({
      cycle_id: 'cy-1',
      employee_id: 'emp-1',
      budget_pool_id: 'pool-1',
      performance_rating: 4,
      increase_percent: '4',
      justification: null,
    });
    expect(api.decideMeritProposal).toHaveBeenCalledWith('pr-1', 'reject', 'Over budget');
  });

  it('shows the API reason when a transition is refused', () => {
    api.openCycle.mockReturnValue(throwError(() => new HttpErrorResponse({ status: 422, error: { errors: { status: ['The cycle has no budget pool'] } } })));
    const fixture = TestBed.createComponent(TalentCompensationComponent);
    fixture.detectChanges();
    fixture.componentInstance.transition(cycle, 'open');

    expect(messageSpy.error).toHaveBeenCalledWith('The cycle has no budget pool');
  });
});

describe('TalentCoursesComponent', () => {
  const api = {
    ...lookup,
    getCourses: vi.fn(),
    getLearningPaths: vi.fn(),
    createCourse: vi.fn(),
    updateCourse: vi.fn(),
    transitionCourse: vi.fn(),
    deleteCourse: vi.fn(),
    createLearningPath: vi.fn(),
    transitionLearningPath: vi.fn(),
    enrolInLearningPath: vi.fn(),
    deleteLearningPath: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lookup.getEmployeeLookup.mockReturnValue(of({ data: [] }));
    api.getCourses.mockReturnValue(of({ data: [course] }));
    api.getLearningPaths.mockReturnValue(of({ data: [] }));
    api.createCourse.mockReturnValue(of({ data: course }));
    api.transitionCourse.mockReturnValue(of({ data: course }));
    api.createLearningPath.mockReturnValue(of({ data: {} }));
    api.enrolInLearningPath.mockReturnValue(of({ data: [] }));
    configure(api);
  });

  it('creates a mandatory course with the API payload', () => {
    const fixture = TestBed.createComponent(TalentCoursesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openCourseModal();
    component.courseForm.patchValue({ code: 'SAFE-01', title: 'Workplace safety', duration_hours: 4, validity_months: 36, pass_score: 70, is_mandatory: true });
    component.saveCourse();

    expect(api.createCourse).toHaveBeenCalledWith({
      code: 'SAFE-01',
      title: 'Workplace safety',
      description: null,
      delivery: 'online',
      duration_hours: '4',
      validity_months: 36,
      pass_score: 70,
      is_mandatory: true,
    });
  });

  it('publishes a course, creates a path and enrols employees in it', () => {
    const fixture = TestBed.createComponent(TalentCoursesComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.transitionCourse(course, 'publish');
    component.openPathModal();
    component.pathForm.patchValue({ name: 'Onboarding', course_ids: ['co-1'] });
    component.savePath();
    component.openEnrol({ id: 'pa-1', name: 'Onboarding', description: null, status: 'published' });
    component.enrolForm.patchValue({ employee_ids: ['emp-1', 'emp-2'], due_on: '2027-05-01' });
    component.saveEnrol();

    expect(api.transitionCourse).toHaveBeenCalledWith('co-1', 'publish');
    expect(api.createLearningPath).toHaveBeenCalledWith({ name: 'Onboarding', description: null, course_ids: ['co-1'] });
    expect(api.enrolInLearningPath).toHaveBeenCalledWith('pa-1', { employee_ids: ['emp-1', 'emp-2'], due_on: '2027-05-01' });
  });
});

describe('TalentEnrolmentsComponent', () => {
  const api = {
    ...lookup,
    getEnrolments: vi.fn(),
    getCourses: vi.fn(),
    createEnrolment: vi.fn(),
    updateEnrolmentProgress: vi.fn(),
    completeEnrolment: vi.fn(),
    cancelEnrolment: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    lookup.getEmployeeLookup.mockReturnValue(of({ data: [] }));
    api.getEnrolments.mockReturnValue(of({ data: [enrolment] }));
    api.getCourses.mockReturnValue(of({ data: [course] }));
    api.createEnrolment.mockReturnValue(of({ data: enrolment }));
    api.updateEnrolmentProgress.mockReturnValue(of({ data: enrolment }));
    api.completeEnrolment.mockReturnValue(of({ data: enrolment }));
    api.cancelEnrolment.mockReturnValue(of({ data: enrolment }));
    configure(api);
  });

  it('enrols, updates the progress, completes with a score and cancels', () => {
    const fixture = TestBed.createComponent(TalentEnrolmentsComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ course_id: 'co-1', employee_id: 'emp-1', due_on: '2027-05-01' });
    component.save();
    component.openProgress(enrolment);
    component.progressForm.patchValue({ progress_percent: 60 });
    component.saveProgress();
    component.openComplete(enrolment);
    component.completeForm.patchValue({ score: 85 });
    component.saveComplete();
    component.cancel(enrolment);

    expect(api.createEnrolment).toHaveBeenCalledWith({ course_id: 'co-1', employee_id: 'emp-1', due_on: '2027-05-01' });
    expect(api.updateEnrolmentProgress).toHaveBeenCalledWith('en-1', 60);
    expect(api.completeEnrolment).toHaveBeenCalledWith('en-1', 85);
    expect(api.cancelEnrolment).toHaveBeenCalledWith('en-1');
  });

  it('rejects a progress above 100', () => {
    const fixture = TestBed.createComponent(TalentEnrolmentsComponent);
    fixture.detectChanges();
    fixture.componentInstance.openProgress(enrolment);
    fixture.componentInstance.progressForm.patchValue({ progress_percent: 120 });

    expect(fixture.componentInstance.progressForm.valid).toBe(false);
  });
});

describe('TalentComplianceComponent', () => {
  it('loads the compliance and the gaps of a course', () => {
    const row = { course: { id: 'co-1', code: 'SAFE-01', title: 'Safety' }, employees_total: 2, compliant: 1, in_progress: 0, overdue: 0, expired: 0, missing: 1, compliance_percent: 50 };
    const api = {
      getCompliance: vi.fn().mockImplementation((courseId?: string) => of({ data: { courses: [courseId ? { ...row, non_compliant: [] } : row], compliance_percent: 50 } })),
    };
    configure(api);
    const fixture = TestBed.createComponent(TalentComplianceComponent);
    fixture.detectChanges();
    fixture.componentInstance.showGaps(row);

    expect(api.getCompliance).toHaveBeenCalledWith('co-1');
    expect(fixture.componentInstance.gaps()?.non_compliant).toEqual([]);
  });
});

describe('TalentSurveysComponent', () => {
  const api = {
    getSurveys: vi.fn(),
    getSurvey: vi.fn(),
    createSurvey: vi.fn(),
    openSurvey: vi.fn(),
    closeSurvey: vi.fn(),
    deleteSurvey: vi.fn(),
    submitSurveyResponse: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    api.getSurveys.mockReturnValue(of({ data: [survey] }));
    api.getSurvey.mockReturnValue(of({ data: survey }));
    api.createSurvey.mockReturnValue(of({ data: survey }));
    api.submitSurveyResponse.mockReturnValue(of({}));
    configure(api);
  });

  it('creates an anonymous survey with its questions', () => {
    const fixture = TestBed.createComponent(TalentSurveysComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openModal();
    component.form.patchValue({ title: 'Pulse 2027', min_group_size: 5 });
    component.questions.at(0).patchValue({ prompt: 'Recommend us?', question_type: 'enps' });
    component.save();

    expect(api.createSurvey).toHaveBeenCalledWith({
      title: 'Pulse 2027',
      description: null,
      is_anonymous: true,
      min_group_size: 5,
      opens_on: null,
      closes_on: null,
      questions: [{ prompt: 'Recommend us?', question_type: 'enps', is_required: true }],
    });
  });

  it('refuses a minimum group size below the anonymity floor', () => {
    const fixture = TestBed.createComponent(TalentSurveysComponent);
    fixture.detectChanges();
    fixture.componentInstance.openModal();
    fixture.componentInstance.form.patchValue({ title: 'Pulse', min_group_size: 2 });
    fixture.componentInstance.questions.at(0).patchValue({ prompt: 'Q' });

    expect(fixture.componentInstance.form.valid).toBe(false);
  });

  it('submits the answers only, with no group or employee reference', () => {
    const fixture = TestBed.createComponent(TalentSurveysComponent);
    fixture.detectChanges();
    const component = fixture.componentInstance;

    component.openAnswer(survey);
    component.setValue('q-1', 9);
    component.setText('q-2', 'Great');
    component.submitAnswer();

    expect(api.submitSurveyResponse).toHaveBeenCalledWith('sv-1', [
      { question_id: 'q-1', value: 9, text: null },
      { question_id: 'q-2', value: null, text: 'Great' },
    ]);
  });
});

describe('TalentSurveyResultsComponent', () => {
  it('loads the survey and the aggregated results', () => {
    const results = {
      survey_id: 'sv-1',
      status: 'open',
      is_anonymous: true,
      min_group_size: 5,
      invited_count: 10,
      responses_count: 3,
      participation_rate_percent: 30,
      results_visible: false,
      hidden_segments: false,
      questions: [],
      segments: [],
    };
    const api = { getSurvey: vi.fn().mockReturnValue(of({ data: survey })), getSurveyResults: vi.fn().mockReturnValue(of({ data: results })) };
    configure(api, [{ provide: ActivatedRoute, useValue: { snapshot: { paramMap: { get: () => 'sv-1' } } } }]);
    const fixture = TestBed.createComponent(TalentSurveyResultsComponent);
    fixture.detectChanges();

    expect(api.getSurveyResults).toHaveBeenCalledWith('sv-1');
    expect(fixture.componentInstance.results()?.results_visible).toBe(false);
  });
});
