import { signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { of, throwError } from 'rxjs';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CsPublicSurvey, CustomerSatisfactionApiService, TranslateService } from '@core';
import { PublicSurveyComponent } from './public-survey.component';

const survey = (overrides: Partial<CsPublicSurvey> = {}): CsPublicSurvey => ({
  survey_type: 'nps',
  scale: { min: 0, max: 10 },
  locale: 'en',
  answered: true,
  score: 3,
  band: 'detractor',
  prompt: 'We are sorry. What went wrong?',
  prompts: {
    low: 'We are sorry. What went wrong?',
    mid: 'What could be better?',
    high: 'What did you like?',
  },
  allow_voice_comment: true,
  has_comment: false,
  voice_max_kb: 10240,
  ...overrides,
});

describe('PublicSurveyComponent', () => {
  const api = {
    getPublicSurvey: vi.fn(),
    submitPublicScore: vi.fn(),
    submitPublicFeedback: vi.fn(),
    optOutPublic: vi.fn(),
  };

  async function render(
    data: CsPublicSurvey | null,
  ): Promise<ComponentFixture<PublicSurveyComponent>> {
    api.getPublicSurvey.mockReturnValue(
      data === null
        ? throwError(() => ({ status: 410 }))
        : of({ success: true, message: '', data }),
    );
    const fixture = TestBed.createComponent(PublicSurveyComponent);
    await fixture.whenStable();
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();
    return fixture;
  }

  const find = (fixture: ComponentFixture<unknown>, name: string) =>
    (fixture.nativeElement as HTMLElement).querySelector(`[data-test="${name}"]`);

  beforeEach(() => {
    Object.values(api).forEach((mock) => mock.mockReset());
    TestBed.configureTestingModule({
      providers: [
        { provide: CustomerSatisfactionApiService, useValue: api },
        {
          provide: ActivatedRoute,
          useValue: {
            snapshot: {
              paramMap: convertToParamMap({ token: 'tok' }),
              queryParamMap: convertToParamMap({}),
            },
          },
        },
        {
          provide: TranslateService,
          useValue: {
            currentLanguage: signal('en'),
            setLanguage: vi.fn(),
            translate: (key: string) => key,
            instant: (key: string) => key,
          },
        },
      ],
    });
  });

  it('confirms the rating the one-click link already stored and asks the follow-up question of the band', async () => {
    const fixture = await render(survey());

    expect(find(fixture, 'recorded')).not.toBeNull();
    expect(find(fixture, 'pick-score')).toBeNull();
    expect(find(fixture, 'prompt')?.textContent).toContain('We are sorry. What went wrong?');
  });

  it('lets a visitor without a rating pick one on the scale of the survey', async () => {
    api.submitPublicScore.mockReturnValue(of({ success: true, message: '', data: {} }));
    const fixture = await render(
      survey({ answered: false, score: null, band: null, prompt: null }),
    );

    expect(fixture.nativeElement.querySelectorAll('[data-test^="score-"]')).toHaveLength(11);

    (find(fixture, 'score-9') as HTMLButtonElement).click();

    expect(api.submitPublicScore).toHaveBeenCalledWith('tok', 9);
  });

  it('keeps the send button off until a comment is written, then adds it to the same answer', async () => {
    api.submitPublicFeedback.mockReturnValue(of({ success: true, message: '', data: {} }));
    const fixture = await render(survey());
    const send = find(fixture, 'send-feedback') as HTMLButtonElement;
    expect(send.disabled).toBe(true);

    const area = find(fixture, 'comment') as HTMLTextAreaElement;
    area.value = 'The delivery was late';
    area.dispatchEvent(new Event('input'));
    fixture.detectChanges();
    expect((find(fixture, 'send-feedback') as HTMLButtonElement).disabled).toBe(false);

    (find(fixture, 'send-feedback') as HTMLButtonElement).click();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(api.submitPublicFeedback).toHaveBeenCalledWith('tok', {
      comment_text: 'The delivery was late',
      voice: null,
      voice_duration_seconds: null,
    });
    expect(find(fixture, 'thanks')).not.toBeNull();
  });

  it('offers the voice note only when the survey allows it', async () => {
    const withVoice = await render(survey());
    expect(find(withVoice, 'voice-file')).not.toBeNull();

    const withoutVoice = await render(survey({ allow_voice_comment: false }));
    expect(find(withoutVoice, 'voice-file')).toBeNull();
  });

  it('shows the thank-you step straight away when a comment is already stored', async () => {
    const fixture = await render(survey({ has_comment: true }));

    expect(find(fixture, 'thanks')).not.toBeNull();
    expect(find(fixture, 'follow-up')).toBeNull();
  });

  it('shows the error of an invalid or expired link instead of the survey', async () => {
    const fixture = await render(null);

    expect(find(fixture, 'error')).not.toBeNull();
    expect(find(fixture, 'recorded')).toBeNull();
  });
});
