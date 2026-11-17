import { CdkDragDrop } from '@angular/cdk/drag-drop';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { NzMessageService } from 'ng-zorro-antd/message';
import { of } from 'rxjs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { environment } from '@env';
import { ApplicationStage, CandidateApplicationCard, I18nService } from '@core';
import { boardStages, card, i18nStub, opening } from '../testing/recruiting-fixtures';
import { RecruitingBoardComponent } from './recruiting-board.component';

const API = 'https://api.fatturafacile.eu/api/v1';
const BOARD_URL = `${API}/hr/recruiting/job-openings/o1/board`;

function dropEvent(
  data: CandidateApplicationCard,
  from: ApplicationStage,
  to: ApplicationStage,
  currentIndex = 0,
): CdkDragDrop<ApplicationStage, ApplicationStage, CandidateApplicationCard> {
  const container = { data: to } as CdkDragDrop<ApplicationStage>['container'];
  const previous = { data: from } as CdkDragDrop<ApplicationStage>['previousContainer'];
  return {
    item: { data } as CdkDragDrop<
      ApplicationStage,
      ApplicationStage,
      CandidateApplicationCard
    >['item'],
    container,
    previousContainer: from === to ? container : previous,
    currentIndex,
    previousIndex: 0,
    isPointerOverContainer: true,
    distance: { x: 0, y: 0 },
    dropPoint: { x: 0, y: 0 },
    event: new MouseEvent('mouseup'),
  };
}

describe('RecruitingBoardComponent', () => {
  let fixture: ComponentFixture<RecruitingBoardComponent>;
  let component: RecruitingBoardComponent;
  let http: HttpTestingController;
  let message: {
    success: ReturnType<typeof vi.fn>;
    error: ReturnType<typeof vi.fn>;
    info: ReturnType<typeof vi.fn>;
  };
  const originalApiBaseUrl = environment.apiBaseUrl;

  const anna = card('anna', 'applied');
  const bruno = card('bruno', 'hr_screening');
  const ghost = card('ghost', 'applied', {
    is_anonymized: true,
    full_name: 'Anonymized Candidate',
    board_position: 1,
  });

  beforeEach(async () => {
    environment.apiBaseUrl = API;
    message = { success: vi.fn(), error: vi.fn(), info: vi.fn() };
    await TestBed.configureTestingModule({
      imports: [RecruitingBoardComponent],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'o1' })) } },
        { provide: I18nService, useValue: i18nStub() },
        { provide: NzMessageService, useValue: message },
      ],
    }).compileComponents();

    http = TestBed.inject(HttpTestingController);
    fixture = TestBed.createComponent(RecruitingBoardComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
    http
      .expectOne((r) => r.url === BOARD_URL)
      .flush({ data: { job_opening: opening(), stages: boardStages([anna, bruno, ghost]) } });
    fixture.detectChanges();
  });

  afterEach(() => {
    http.verify();
    environment.apiBaseUrl = originalApiBaseUrl;
  });

  it('renders enabled columns with counts', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelectorAll('.board-column').length).toBe(7);
    expect(component.visibleColumns().find((c) => c.stage === 'applied')?.count).toBe(2);
  });

  it('moves a dragged card immediately and sends a single move request', () => {
    component.onDrop(dropEvent(anna, 'applied', 'hr_screening', 0));
    expect(component.columns().hr_screening.map((c) => c.id)).toEqual(['anna', 'bruno']);
    expect(component.visibleColumns().find((c) => c.stage === 'applied')?.count).toBe(1);

    const req = http.expectOne(`${API}/hr/recruiting/applications/anna/move`);
    expect(req.request.method).toBe('POST');
    expect(req.request.body).toEqual({ stage: 'hr_screening', board_position: 0 });
    req.flush({ data: { ...anna, stage: 'hr_screening', average_score: 3 } });
    expect(component.columns().hr_screening[0].average_score).toBe(3);
  });

  it('rolls the card back and shows the translated error on 409', () => {
    component.onDrop(dropEvent(anna, 'applied', 'technical_interview', 0));
    expect(component.columns().technical_interview.map((c) => c.id)).toEqual(['anna']);

    http
      .expectOne(`${API}/hr/recruiting/applications/anna/move`)
      .flush(
        { message: 'Not allowed', error_code: 'invalid_stage_transition' },
        { status: 409, statusText: 'Conflict' },
      );

    expect(component.columns().technical_interview).toEqual([]);
    expect(component.columns().applied.map((c) => c.id)).toEqual(['anna', 'ghost']);
    expect(message.error).toHaveBeenCalledWith(
      'hr.recruiting.errors.codes.invalid_stage_transition',
    );
  });

  it('opens the reject dialog before moving to rejected; cancel changes nothing', () => {
    component.onDrop(dropEvent(anna, 'applied', 'rejected', 0));
    expect(component.rejectOpen()).toBe(true);
    expect(component.columns().applied.some((c) => c.id === 'anna')).toBe(true);
    http.expectNone(`${API}/hr/recruiting/applications/anna/move`);

    component.rejectOpen.set(false);
    component.onRejectCancelled();
    expect(component.columns().rejected).toEqual([]);
    http.expectNone(`${API}/hr/recruiting/applications/anna/move`);
  });

  it('sends the rejection reason, note and email flag after confirmation', () => {
    component.onDrop(dropEvent(anna, 'applied', 'rejected', 0));
    component.onRejectConfirmed({
      rejection_reason_code: 'not_qualified',
      rejection_note: 'n',
      send_email: false,
    });

    expect(component.columns().rejected.map((c) => c.id)).toEqual(['anna']);
    const req = http.expectOne(`${API}/hr/recruiting/applications/anna/move`);
    expect(req.request.body).toEqual({
      stage: 'rejected',
      rejection_reason_code: 'not_qualified',
      rejection_note: 'n',
      send_email: false,
      board_position: 0,
    });
    req.flush({ data: { ...anna, stage: 'rejected' } });
  });

  it('never moves a card to hired through drag-and-drop', () => {
    component.onDrop(dropEvent(anna, 'applied', 'hired', 0));
    http.expectNone(`${API}/hr/recruiting/applications/anna/move`);
    expect(component.columns().hired).toEqual([]);
    expect(message.info).toHaveBeenCalledWith('hr.recruiting.board.hiredHint');
    expect(component.targetsFor(anna)).not.toContain('hired');
  });

  it('uses the same request for the keyboard "Move to" menu and keeps focus on the card', async () => {
    component.onMoveRequested(anna, 'technical_interview');
    const req = http.expectOne(`${API}/hr/recruiting/applications/anna/move`);
    expect(req.request.body).toEqual({ stage: 'technical_interview', board_position: 0 });
    fixture.detectChanges();
    await fixture.whenStable();
    const trigger = (fixture.nativeElement as HTMLElement).querySelector(
      '[data-move-trigger="anna"]',
    );
    expect(document.activeElement).toBe(trigger);
    req.flush({ data: { ...anna, stage: 'technical_interview' } });
  });

  it('disables actions on anonymized cards', () => {
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[data-move-trigger="ghost"]')).toBeNull();
    expect(el.querySelector('[data-card-id="ghost"]')?.textContent).toContain(
      'hr.recruiting.board.anonymized',
    );
    component.onMoveRequested(ghost, 'hr_screening');
    http.expectNone(`${API}/hr/recruiting/applications/ghost/move`);
  });

  it('ignores a second move while the first one is pending', () => {
    component.onMoveRequested(anna, 'hr_screening');
    component.onMoveRequested(anna, 'technical_interview');
    const reqs = http.match(`${API}/hr/recruiting/applications/anna/move`);
    expect(reqs.length).toBe(1);
    reqs[0].flush({ data: { ...anna, stage: 'hr_screening' } });
  });
});
