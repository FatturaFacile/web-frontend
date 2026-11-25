import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CsPublicSurvey, CustomerSatisfactionApiService } from '@core';
import { PublicSurveyStore } from './public-survey.store';

const survey = (overrides: Partial<CsPublicSurvey> = {}): CsPublicSurvey => ({
  survey_type: 'nps',
  scale: { min: 0, max: 10 },
  locale: 'it-CH',
  answered: true,
  score: 3,
  band: 'detractor',
  prompt: 'Ci dispiace. Cosa è andato storto?',
  prompts: { low: 'Ci dispiace', mid: 'Grazie', high: 'Grazie!' },
  allow_voice_comment: true,
  has_comment: false,
  voice_max_kb: 10240,
  ...overrides,
});

describe('PublicSurveyStore', () => {
  const api = {
    getPublicSurvey: vi.fn(),
    submitPublicScore: vi.fn(),
    submitPublicFeedback: vi.fn(),
    optOutPublic: vi.fn(),
  };
  let store: InstanceType<typeof PublicSurveyStore>;

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [PublicSurveyStore, { provide: CustomerSatisfactionApiService, useValue: api }],
    });
    store = TestBed.inject(PublicSurveyStore);
  });

  it('shows the score a one-click link already stored, before anything is typed', async () => {
    api.getPublicSurvey.mockReturnValue(of({ success: true, message: '', data: survey() }));

    await store.load('tok');

    expect(api.getPublicSurvey).toHaveBeenCalledWith('tok');
    expect(store.survey()?.answered).toBe(true);
    expect(store.survey()?.prompt).toContain('Ci dispiace');
    expect(store.feedbackSent()).toBe(false);
  });

  it('skips the follow-up when a comment is already stored', async () => {
    api.getPublicSurvey.mockReturnValue(
      of({ success: true, message: '', data: survey({ has_comment: true }) }),
    );

    await store.load('tok');

    expect(store.feedbackSent()).toBe(true);
  });

  it('answers an invalid or expired link with the key of its code', async () => {
    api.getPublicSurvey.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 410, error: { code: 'survey_expired' } })),
    );

    await store.load('old');

    expect(store.survey()).toBeNull();
    expect(store.errorKey()).toBe('customerSatisfaction.error.survey_expired');
  });

  it('records the score picked on the page and reloads the follow-up question', async () => {
    api.getPublicSurvey
      .mockReturnValueOnce(
        of({
          success: true,
          message: '',
          data: survey({ answered: false, score: null, band: null, prompt: null }),
        }),
      )
      .mockReturnValueOnce(
        of({ success: true, message: '', data: survey({ score: 9, band: 'promoter' }) }),
      );
    api.submitPublicScore.mockReturnValue(of({ success: true, message: '', data: {} }));

    await store.load('tok');
    const outcome = await store.submitScore(9);

    expect(outcome.ok).toBe(true);
    expect(api.submitPublicScore).toHaveBeenCalledWith('tok', 9);
    expect(store.survey()?.band).toBe('promoter');
  });

  it('adds the text and voice comment to the same answer', async () => {
    api.getPublicSurvey.mockReturnValue(of({ success: true, message: '', data: survey() }));
    api.submitPublicFeedback.mockReturnValue(of({ success: true, message: '', data: {} }));
    await store.load('tok');
    const voice = new Blob(['audio'], { type: 'audio/webm' });

    const outcome = await store.submitFeedback({
      comment_text: 'Late delivery',
      voice,
      voice_duration_seconds: 12,
    });

    expect(outcome.ok).toBe(true);
    expect(api.submitPublicFeedback).toHaveBeenCalledWith('tok', {
      comment_text: 'Late delivery',
      voice,
      voice_duration_seconds: 12,
    });
    expect(store.feedbackSent()).toBe(true);
  });

  it('does not mark the comment as sent when the API refuses it', async () => {
    api.getPublicSurvey.mockReturnValue(of({ success: true, message: '', data: survey() }));
    api.submitPublicFeedback.mockReturnValue(
      throwError(() => new HttpErrorResponse({ status: 422, error: { code: 'comment_required' } })),
    );
    await store.load('tok');

    const outcome = await store.submitFeedback({ comment_text: '' });

    expect(outcome.ok).toBe(false);
    expect(outcome.errorKey).toBe('customerSatisfaction.error.comment_required');
    expect(store.feedbackSent()).toBe(false);
  });

  it('opts the customer out of the surveys', async () => {
    api.optOutPublic.mockReturnValue(of({ success: true, message: '', data: null }));
    api.getPublicSurvey.mockReturnValue(of({ success: true, message: '', data: survey() }));
    await store.load('tok');

    expect((await store.optOut()).ok).toBe(true);
    expect(store.optedOut()).toBe(true);
  });
});
