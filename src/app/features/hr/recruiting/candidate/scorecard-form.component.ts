import { DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { applyEach, form, FormField, max, min, required } from '@angular/forms/signals';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  I18nService,
  InterviewScorecard,
  RecruitingApiService,
  RECOMMENDATIONS,
  Recommendation,
  SCORECARD_STAGES,
  ScorecardPayload,
  ScorecardStage,
} from '@core';
import { TranslatePipe } from '@shared';
import { recruitingErrorKey } from '../shared/recruiting-errors';

interface CriterionModel {
  criterion: string;
  score: number | null;
  comment: string;
}

export interface ScorecardFormModel {
  stage: ScorecardStage;
  criteria: CriterionModel[];
  recommendation: Recommendation | null;
  notes: string;
  interviewed_at: string;
}

const DEFAULT_CRITERIA_KEYS = [
  'hr.recruiting.scorecard.defaultCriteria.technical',
  'hr.recruiting.scorecard.defaultCriteria.communication',
  'hr.recruiting.scorecard.defaultCriteria.teamFit',
];

/** Average of the filled-in scores rounded to 2 decimals, or null. */
export function averageScore(criteria: readonly { score: number | null }[]): number | null {
  const scores = criteria.map((c) => c.score).filter((s): s is number => typeof s === 'number');
  if (!scores.length) {
    return null;
  }
  return Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100;
}

/** Interview scorecard (dynamic criteria scored 1-5, recommendation). Upserts per stage. */
@Component({
  selector: 'app-scorecard-form',
  imports: [
    DecimalPipe,
    FormField,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzSelectModule,
    TranslatePipe,
  ],
  template: `
    <form
      nz-form
      nzLayout="vertical"
      class="scorecard"
      [attr.aria-label]="'hr.recruiting.scorecard.formTitle' | translate"
      (submit)="$event.preventDefault(); submit()"
    >
      <div class="row">
        <nz-form-item>
          <nz-form-label nzFor="scorecard-stage" nzRequired>{{
            'hr.recruiting.scorecard.stage' | translate
          }}</nz-form-label>
          <nz-form-control>
            <nz-select
              nzId="scorecard-stage"
              [formField]="scoreForm.stage"
              [nzDisabled]="disabled()"
            >
              @for (s of stages; track s) {
                <nz-option [nzValue]="s" [nzLabel]="'hr.recruiting.stages.' + s | translate" />
              }
            </nz-select>
          </nz-form-control>
        </nz-form-item>
        <nz-form-item>
          <nz-form-label nzFor="scorecard-date">{{
            'hr.recruiting.scorecard.interviewedAt' | translate
          }}</nz-form-label>
          <nz-form-control>
            <input
              id="scorecard-date"
              nz-input
              type="date"
              [formField]="scoreForm.interviewed_at"
            />
          </nz-form-control>
        </nz-form-item>
      </div>

      <fieldset class="criteria">
        <legend>{{ 'hr.recruiting.scorecard.criteria' | translate }}</legend>
        @for (c of model().criteria; track $index; let i = $index) {
          <div
            class="criterion"
            role="group"
            [attr.aria-label]="c.criterion || ('hr.recruiting.scorecard.criterion' | translate)"
          >
            <nz-form-item>
              <nz-form-label [nzFor]="'criterion-name-' + i" nzRequired>{{
                'hr.recruiting.scorecard.criterion' | translate
              }}</nz-form-label>
              <nz-form-control
                [nzValidateStatus]="
                  submitted() && scoreForm.criteria[i].criterion().invalid() ? 'error' : ''
                "
                [nzErrorTip]="'hr.recruiting.validation.required' | translate"
              >
                <input
                  [id]="'criterion-name-' + i"
                  nz-input
                  [formField]="scoreForm.criteria[i].criterion"
                />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label [nzFor]="'criterion-score-' + i" nzRequired>{{
                'hr.recruiting.scorecard.score' | translate
              }}</nz-form-label>
              <nz-form-control
                [nzValidateStatus]="
                  submitted() && scoreForm.criteria[i].score().invalid() ? 'error' : ''
                "
                [nzErrorTip]="'hr.recruiting.validation.score' | translate"
              >
                <nz-select
                  class="score-select"
                  [nzId]="'criterion-score-' + i"
                  [formField]="scoreForm.criteria[i].score"
                >
                  @for (v of scoreValues; track v) {
                    <nz-option [nzValue]="v" [nzLabel]="'' + v" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label [nzFor]="'criterion-comment-' + i">{{
                'hr.recruiting.scorecard.comment' | translate
              }}</nz-form-label>
              <nz-form-control>
                <input
                  [id]="'criterion-comment-' + i"
                  nz-input
                  [formField]="scoreForm.criteria[i].comment"
                />
              </nz-form-control>
            </nz-form-item>
            @if (model().criteria.length > 1) {
              <button
                nz-button
                nzType="link"
                nzDanger
                type="button"
                (click)="removeCriterion(i)"
                [attr.aria-label]="'hr.recruiting.scorecard.removeCriterion' | translate"
              >
                <i class="fa-solid fa-trash" aria-hidden="true"></i>
              </button>
            }
          </div>
        }
        <button
          nz-button
          nzType="dashed"
          type="button"
          (click)="addCriterion()"
          [disabled]="disabled()"
        >
          <i class="fa-solid fa-plus" aria-hidden="true"></i>
          {{ 'hr.recruiting.scorecard.addCriterion' | translate }}
        </button>
      </fieldset>

      <p class="average" aria-live="polite">
        {{ 'hr.recruiting.scorecard.average' | translate }}:
        <strong>{{ average() === null ? '-' : (average() | number: '1.2-2') }}</strong>
      </p>

      <nz-form-item>
        <nz-form-label nzFor="scorecard-recommendation" nzRequired>{{
          'hr.recruiting.scorecard.recommendation' | translate
        }}</nz-form-label>
        <nz-form-control
          [nzValidateStatus]="submitted() && scoreForm.recommendation().invalid() ? 'error' : ''"
          [nzErrorTip]="'hr.recruiting.validation.required' | translate"
        >
          <nz-select nzId="scorecard-recommendation" [formField]="scoreForm.recommendation">
            @for (r of recommendations; track r) {
              <nz-option
                [nzValue]="r"
                [nzLabel]="'hr.recruiting.recommendations.' + r | translate"
              />
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label nzFor="scorecard-notes">{{
          'hr.recruiting.scorecard.notes' | translate
        }}</nz-form-label>
        <nz-form-control>
          <textarea id="scorecard-notes" nz-input rows="3" [formField]="scoreForm.notes"></textarea>
        </nz-form-control>
      </nz-form-item>

      <button
        nz-button
        nzType="primary"
        type="submit"
        [nzLoading]="saving()"
        [disabled]="disabled()"
      >
        {{ 'hr.recruiting.scorecard.submit' | translate }}
      </button>
    </form>
  `,
  styles: `
    .row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      column-gap: 16px;
    }
    .criteria {
      border: 0;
      padding: 0;
      margin: 0 0 12px;
    }
    .criteria legend {
      font-weight: 600;
      font-size: 14px;
      border: 0;
      margin-bottom: 8px;
    }
    .criterion {
      display: grid;
      grid-template-columns: minmax(140px, 1fr) auto minmax(140px, 1fr) auto;
      gap: 8px;
      align-items: end;
      border-bottom: 1px solid #f0f0f0;
      margin-bottom: 8px;
    }
    @media (max-width: 720px) {
      .criterion {
        grid-template-columns: 1fr;
      }
    }
    .score-select {
      min-width: 90px;
    }
  `,
})
export class ScorecardFormComponent {
  private readonly api = inject(RecruitingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly applicationId = input.required<string>();
  readonly disabled = input(false);
  /** Existing scorecard of the current user to edit (upsert per stage). */
  readonly existing = input<InterviewScorecard | null>(null);
  readonly saved = output<InterviewScorecard>();

  readonly stages = SCORECARD_STAGES;
  readonly recommendations = RECOMMENDATIONS;
  readonly scoreValues = [1, 2, 3, 4, 5];

  readonly saving = signal(false);
  readonly submitted = signal(false);
  readonly model = signal<ScorecardFormModel>(this.blank());
  readonly scoreForm = form(this.model, (p) => {
    required(p.stage);
    required(p.recommendation);
    applyEach(p.criteria, (c) => {
      required(c.criterion);
      required(c.score);
      min(c.score, 1);
      max(c.score, 5);
    });
  });

  readonly average = computed(() => averageScore(this.model().criteria));

  constructor() {
    effect(() => {
      const card = this.existing();
      untracked(() => this.model.set(card ? this.fromScorecard(card) : this.blank()));
    });
  }

  addCriterion(): void {
    this.model.update((m) => ({
      ...m,
      criteria: [...m.criteria, { criterion: '', score: null, comment: '' }],
    }));
  }

  removeCriterion(index: number): void {
    this.model.update((m) => ({ ...m, criteria: m.criteria.filter((_, i) => i !== index) }));
  }

  submit(): void {
    if (this.disabled() || this.saving()) {
      return;
    }
    this.submitted.set(true);
    if (this.scoreForm().invalid()) {
      return;
    }
    const m = this.model();
    const payload: ScorecardPayload = {
      stage: m.stage,
      criteria_scores: m.criteria.map((c) => ({
        criterion: c.criterion.trim(),
        score: c.score as number,
        comment: c.comment.trim() || null,
      })),
      recommendation: m.recommendation as Recommendation,
      notes: m.notes.trim() || null,
      interviewed_at: m.interviewed_at || null,
    };
    this.saving.set(true);
    this.api.submitScorecard(this.applicationId(), payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.submitted.set(false);
        this.message.success(this.i18n.translate('hr.recruiting.scorecard.saved'));
        this.saved.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.message.error(this.i18n.translate(recruitingErrorKey(err)));
      },
    });
  }

  private blank(): ScorecardFormModel {
    return {
      stage: 'technical_interview',
      criteria: DEFAULT_CRITERIA_KEYS.map((key) => ({
        criterion: this.translatedOrEmpty(key),
        score: null,
        comment: '',
      })),
      recommendation: null,
      notes: '',
      interviewed_at: '',
    };
  }

  private translatedOrEmpty(key: string): string {
    const text = this.i18n.translate(key);
    return text === key ? '' : text;
  }

  private fromScorecard(card: InterviewScorecard): ScorecardFormModel {
    return {
      stage: card.stage,
      criteria: card.criteria_scores.map((c) => ({
        criterion: c.criterion,
        score: c.score,
        comment: c.comment ?? '',
      })),
      recommendation: card.recommendation,
      notes: card.notes ?? '',
      interviewed_at: card.interviewed_at?.slice(0, 10) ?? '',
    };
  }
}
