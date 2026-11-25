import { Component, DestroyRef, effect, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { SupportedLanguage, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { CsOutcome, scoreColor, scoreRange } from './customer-satisfaction.util';
import { PublicSurveyStore } from './public-survey.store';

const LANGUAGES: readonly SupportedLanguage[] = ['it', 'de', 'fr', 'en'];

/** Longest voice note the page records, in seconds (the API accepts up to 15 minutes). */
export const MAX_VOICE_SECONDS = 180;

/**
 * The public, mobile-first landing page of a survey (`/survey/:token`, no login, no application shell). A click on a score of an
 * email, SMS or WhatsApp message has already stored the answer when this page opens, so it first confirms the rating; then it asks
 * the follow-up question of the band (what went wrong for a detractor, what made it great for a promoter) and takes a text and/or
 * voice comment that is added to the same answer. A visitor without a rating can pick one here. Every text comes from the
 * seeded dictionary, in the language of the survey.
 */
@Component({
  selector: 'app-public-survey',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzSpinModule,
    TranslatePipe,
  ],
  providers: [PublicSurveyStore],
  styles: `
    :host {
      display: block;
      min-height: 100vh;
      background: #f5f7fa;
    }
    .page {
      max-width: 560px;
      margin: 0 auto;
      padding: 16px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
    }
    h1 {
      font-size: 22px;
      margin: 0;
    }
    .card {
      background: #fff;
      border-radius: 12px;
      padding: 20px;
      margin-top: 16px;
      box-shadow: 0 1px 4px rgb(0 0 0 / 8%);
    }
    .scores {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(56px, 1fr));
      gap: 8px;
      margin: 16px 0;
    }
    .score {
      min-height: 52px;
      font-size: 18px;
      font-weight: 600;
      border-radius: 10px;
      border: 2px solid transparent;
      color: #fff;
      cursor: pointer;
    }
    .score.red {
      background: #f5222d;
    }
    .score.gold {
      background: #faad14;
    }
    .score.green {
      background: #52c41a;
    }
    .score:disabled {
      opacity: 0.5;
    }
    .score.chosen {
      border-color: #1f1f1f;
    }
    .thanks {
      text-align: center;
      font-size: 18px;
    }
    .voice {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin: 12px 0;
    }
    .recording {
      color: #cf1322;
      font-weight: 600;
    }
    .optout {
      display: block;
      margin-top: 16px;
      text-align: center;
      font-size: 12px;
    }
  `,
  template: `
    <main class="page">
      <header class="top">
        <h1>{{ 'customerSatisfaction.public.title' | translate }}</h1>
        <nz-select
          class="lang"
          [ngModel]="language()"
          [attr.aria-label]="'customerSatisfaction.public.language' | translate"
          (ngModelChange)="setLanguage($event)"
        >
          @for (code of languages; track code) {
            <nz-option [nzValue]="code" [nzLabel]="code.toUpperCase()"></nz-option>
          }
        </nz-select>
      </header>

      <nz-spin [nzSpinning]="store.loading()">
        @if (linkError(); as key) {
          <nz-alert
            class="card"
            nzType="error"
            nzShowIcon
            data-test="error"
            [nzMessage]="key | translate"
          ></nz-alert>
        } @else if (store.survey(); as survey) {
          @if (!survey.answered) {
            <section class="card" data-test="pick-score">
              <p>{{ 'customerSatisfaction.public.pickScore.' + survey.survey_type | translate }}</p>
              <div
                class="scores"
                role="group"
                [attr.aria-label]="'customerSatisfaction.public.pickScoreLabel' | translate"
              >
                @for (score of scores(survey.survey_type); track score) {
                  <button
                    type="button"
                    class="score"
                    [class]="'score ' + color(survey.survey_type, score)"
                    [disabled]="store.savingScore()"
                    [attr.data-test]="'score-' + score"
                    (click)="pick(score)"
                  >
                    {{ score }}
                  </button>
                }
              </div>
            </section>
          } @else {
            <section class="card" data-test="recorded">
              <p class="thanks">
                {{
                  'customerSatisfaction.public.recorded' | translate: { score: survey.score ?? '' }
                }}
              </p>
            </section>

            @if (!store.feedbackSent()) {
              <section class="card" data-test="follow-up">
                <p data-test="prompt">
                  {{ survey.prompt ?? ('customerSatisfaction.public.defaultPrompt' | translate) }}
                </p>
                <textarea
                  nz-input
                  rows="5"
                  maxlength="4000"
                  data-test="comment"
                  [attr.aria-label]="'customerSatisfaction.public.commentLabel' | translate"
                  [placeholder]="'customerSatisfaction.public.commentPlaceholder' | translate"
                  [(ngModel)]="comment"
                ></textarea>

                @if (survey.allow_voice_comment) {
                  <div class="voice">
                    @if (recording()) {
                      <span class="recording" role="status">{{
                        'customerSatisfaction.public.recording' | translate: { seconds: seconds() }
                      }}</span>
                      <button
                        nz-button
                        type="button"
                        data-test="stop-voice"
                        (click)="stopRecording()"
                      >
                        {{ 'customerSatisfaction.public.stopRecording' | translate }}
                      </button>
                    } @else {
                      @if (canRecord) {
                        <button
                          nz-button
                          type="button"
                          data-test="record"
                          (click)="startRecording()"
                        >
                          {{ 'customerSatisfaction.public.record' | translate }}
                        </button>
                      }
                      <label class="upload">
                        <span class="muted">{{
                          'customerSatisfaction.public.uploadAudio' | translate
                        }}</span>
                        <input
                          type="file"
                          accept="audio/*"
                          data-test="voice-file"
                          [attr.aria-label]="'customerSatisfaction.public.uploadAudio' | translate"
                          (change)="onFile($event)"
                        />
                      </label>
                    }
                    @if (voicePreview(); as preview) {
                      <audio controls [src]="preview" data-test="voice-preview"></audio>
                      <button nz-button nzSize="small" type="button" (click)="discardVoice()">
                        {{ 'customerSatisfaction.public.discardVoice' | translate }}
                      </button>
                    }
                  </div>
                }

                @if (feedbackError(); as failure) {
                  <nz-alert
                    nzType="error"
                    nzShowIcon
                    data-test="feedback-error"
                    [nzMessage]="
                      failure.errorKey ?? 'customerSatisfaction.error.generic'
                        | translate: failure.params
                    "
                  ></nz-alert>
                }
                <p>
                  <button
                    nz-button
                    nzType="primary"
                    nzBlock
                    nzSize="large"
                    type="button"
                    data-test="send-feedback"
                    [disabled]="!canSend()"
                    [nzLoading]="store.savingFeedback()"
                    (click)="send()"
                  >
                    {{ 'customerSatisfaction.public.send' | translate }}
                  </button>
                </p>
              </section>
            } @else {
              <section class="card" data-test="thanks">
                <p class="thanks">{{ 'customerSatisfaction.public.thanks' | translate }}</p>
              </section>
            }
          }

          @if (store.optedOut()) {
            <small class="optout" data-test="opted-out">{{
              'customerSatisfaction.public.optedOut' | translate
            }}</small>
          } @else {
            <button
              nz-button
              nzType="link"
              class="optout"
              type="button"
              data-test="opt-out"
              (click)="optOut()"
            >
              {{ 'customerSatisfaction.public.optOut' | translate }}
            </button>
          }
        }
      </nz-spin>
    </main>
  `,
})
export class PublicSurveyComponent {
  protected readonly store = inject(PublicSurveyStore);
  private readonly route = inject(ActivatedRoute);
  private readonly i18n = inject(TranslateService);

  protected readonly languages = LANGUAGES;
  protected readonly language = this.i18n.currentLanguage;
  protected comment = '';

  protected readonly linkError = signal<string | null>(null);
  protected readonly feedbackError = signal<CsOutcome | null>(null);
  protected readonly recording = signal(false);
  protected readonly seconds = signal(0);
  protected readonly voicePreview = signal<string | null>(null);
  protected readonly canRecord =
    typeof navigator !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    typeof MediaRecorder !== 'undefined';

  private voice: Blob | null = null;
  private voiceSeconds: number | null = null;
  private recorder: MediaRecorder | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    const token = this.route.snapshot.paramMap.get('token') ?? '';
    const failure = this.route.snapshot.queryParamMap.get('error');
    void this.store.load(token).then(() => {
      // A one-click link that could not store the score redirects here with the code of the problem.
      this.linkError.set(
        this.store.errorKey() ??
          (failure && !this.store.survey()?.answered
            ? `customerSatisfaction.error.${failure}`
            : null),
      );
    });

    effect(() => {
      const survey = this.store.survey();
      if (survey !== null) {
        const base = survey.locale.slice(0, 2) as SupportedLanguage;
        if (LANGUAGES.includes(base) && base !== this.i18n.currentLanguage()) {
          void this.i18n.setLanguage(base);
        }
      }
    });

    inject(DestroyRef).onDestroy(() => {
      this.clearTimer();
      this.recorder?.stream.getTracks().forEach((track) => track.stop());
      this.releasePreview();
    });
  }

  protected scores(type: Parameters<typeof scoreRange>[0]): number[] {
    return scoreRange(type);
  }

  protected color(type: Parameters<typeof scoreColor>[0], score: number): string {
    return scoreColor(type, score);
  }

  protected setLanguage(language: SupportedLanguage): void {
    void this.i18n.setLanguage(language);
  }

  protected async pick(score: number): Promise<void> {
    const outcome = await this.store.submitScore(score);
    if (!outcome.ok) {
      this.linkError.set(outcome.errorKey);
    }
  }

  protected canSend(): boolean {
    return this.comment.trim() !== '' || this.voice !== null;
  }

  protected async send(): Promise<void> {
    const outcome = await this.store.submitFeedback({
      comment_text: this.comment.trim() || undefined,
      voice: this.voice,
      voice_duration_seconds: this.voiceSeconds,
    });
    this.feedbackError.set(outcome.ok ? null : outcome);
  }

  protected async optOut(): Promise<void> {
    await this.store.optOut();
  }

  // --- Voice note ---

  protected async startRecording(): Promise<void> {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const chunks: Blob[] = [];
      const recorder = new MediaRecorder(stream);
      this.recorder = recorder;
      recorder.ondataavailable = (event) => chunks.push(event.data);
      recorder.onstop = () => {
        stream.getTracks().forEach((track) => track.stop());
        this.setVoice(
          new Blob(chunks, { type: recorder.mimeType || 'audio/webm' }),
          this.seconds(),
        );
      };
      this.seconds.set(0);
      recorder.start();
      this.recording.set(true);
      this.timer = setInterval(() => {
        this.seconds.update((value) => value + 1);
        if (this.seconds() >= MAX_VOICE_SECONDS) {
          this.stopRecording();
        }
      }, 1000);
    } catch {
      this.feedbackError.set({
        ok: false,
        errorKey: 'customerSatisfaction.error.microphone_unavailable',
        code: 'microphone_unavailable',
        detail: null,
        params: {},
        errors: {},
      });
    }
  }

  protected stopRecording(): void {
    this.clearTimer();
    this.recording.set(false);
    if (this.recorder?.state === 'recording') {
      this.recorder.stop();
    }
  }

  protected onFile(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? null;
    if (file !== null) {
      this.setVoice(file, null);
    }
  }

  protected discardVoice(): void {
    this.voice = null;
    this.voiceSeconds = null;
    this.releasePreview();
    this.voicePreview.set(null);
  }

  private setVoice(blob: Blob, seconds: number | null): void {
    this.releasePreview();
    this.voice = blob;
    this.voiceSeconds = seconds !== null && seconds > 0 ? seconds : null;
    this.voicePreview.set(URL.createObjectURL(blob));
  }

  private releasePreview(): void {
    const current = this.voicePreview();
    if (current !== null) {
      URL.revokeObjectURL(current);
    }
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }
}
