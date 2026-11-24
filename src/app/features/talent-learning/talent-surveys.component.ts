import { Component, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TALENT_QUESTION_TYPES, TalentLearningApiService, TalentQuestionType, TalentSurvey, TalentSurveyRequest, TalentSurveyStatus, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { blankToNull, keyOf, mutationObserver, tagColor } from './talent-learning.util';

/** Engagement survey definitions, publication and anonymous answering. */
@Component({
  selector: 'app-talent-surveys',
  styleUrl: './talent-learning.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'TALENT_LEARNING.SURVEYS_TITLE' | translate" [subtitle]="'TALENT_LEARNING.SURVEYS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <div class="toolbar">
      <nz-select style="width: 200px" nzAllowClear [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); changeFilter()" [nzPlaceHolder]="'TALENT_LEARNING.STATUS' | translate">
        @for (value of statuses; track value) {
          <nz-option [nzValue]="value" [nzLabel]="'TALENT_LEARNING.STATUS_' + key(value) | translate"></nz-option>
        }
      </nz-select>
    </div>

    <nz-card class="main-card">
      <nz-table
        #table
        [nzData]="surveys()"
        [nzLoading]="loading()"
        nzSize="small"
        [nzFrontPagination]="false"
        [nzTotal]="total()"
        [nzPageIndex]="page()"
        [nzPageSize]="pageSize"
        (nzPageIndexChange)="changePage($event)"
      >
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.TITLE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STARTS_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.ENDS_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.ANONYMOUS' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td><a [routerLink]="['/talent-learning/surveys', row.id]">{{ row.title }}</a></td>
              <td>{{ row.opens_on }}</td>
              <td>{{ row.closes_on }}</td>
              <td>{{ (row.is_anonymous ? 'TALENT_LEARNING.YES' : 'TALENT_LEARNING.NO') | translate }}</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ 'TALENT_LEARNING.STATUS_' + key(row.status) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" (click)="transition(row, 'open')">{{ 'TALENT_LEARNING.OPEN_ACTION' | translate }}</button>
                    <button nz-button nzType="text" appIconAction="edit" (click)="openEdit(row)"></button>
                    <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="remove(row)"></button>
                  }
                  @if (row.status === 'open') {
                    @if (!row.has_answered) {
                      <button nz-button nzType="text" (click)="openAnswer(row)">{{ 'TALENT_LEARNING.ANSWER' | translate }}</button>
                    }
                    <a nz-button nzType="text" [routerLink]="['/talent-learning/surveys', row.id]">{{ 'TALENT_LEARNING.RESULTS' | translate }}</a>
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.CLOSE_CONFIRM' | translate" (nzOnConfirm)="transition(row, 'close')">{{ 'TALENT_LEARNING.CLOSE_ACTION' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && surveys().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_SURVEYS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="modalVisible" [nzTitle]="(editing() ? 'TALENT_LEARNING.EDIT_SURVEY' : 'TALENT_LEARNING.NEW_SURVEY') | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid" nzWidth="720px">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="survey-title">{{ 'TALENT_LEARNING.TITLE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="survey-title" formControlName="title" maxlength="200" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="survey-start">{{ 'TALENT_LEARNING.STARTS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="survey-start" type="date" formControlName="opens_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="survey-end">{{ 'TALENT_LEARNING.ENDS_ON' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="survey-end" type="date" formControlName="closes_on" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="survey-min">{{ 'TALENT_LEARNING.MIN_GROUP_SIZE' | translate }}</nz-form-label>
              <nz-form-control [nzExtra]="'TALENT_LEARNING.MIN_GROUP_SIZE_HINT' | translate"><input nz-input id="survey-min" type="number" min="3" max="50" formControlName="min_group_size" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control><label for="talent-surveys-is-anonymous" nzId="talent-surveys-is-anonymous" nz-checkbox formControlName="is_anonymous">{{ 'TALENT_LEARNING.ANONYMOUS' | translate }}</label></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="survey-description">{{ 'TALENT_LEARNING.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="survey-description" rows="2" formControlName="description"></textarea></nz-form-control>
          </nz-form-item>

          <h4>{{ 'TALENT_LEARNING.QUESTIONS' | translate }}</h4>
          <div formArrayName="questions">
            @for (question of questions.controls; track $index; let i = $index) {
              <div [formGroupName]="i" class="question-row">
                <input nz-input formControlName="prompt" maxlength="1000" [attr.aria-label]="'TALENT_LEARNING.QUESTION' | translate" />
                <nz-select formControlName="question_type">
                  @for (type of questionTypes; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="'TALENT_LEARNING.QUESTION_' + key(type) | translate"></nz-option>
                  }
                </nz-select>
                <button nz-button nzType="text" nzDanger type="button" appIconAction="delete" (click)="removeQuestion(i)"></button>
              </div>
            }
          </div>
          <button nz-button type="button" (click)="addQuestion()">{{ 'TALENT_LEARNING.ADD_QUESTION' | translate }}</button>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="answerVisible" [nzTitle]="answering()?.title ?? ''" (nzOnCancel)="answerVisible.set(false)" (nzOnOk)="submitAnswer()" okAction="save">
      <ng-container *nzModalContent>
        <p class="muted">{{ 'TALENT_LEARNING.ANONYMOUS_NOTICE' | translate }}</p>
        @for (question of answering()?.questions ?? []; track question.id) {
          <nz-form-item>
            <nz-form-label [nzRequired]="question.is_required">{{ question.prompt }}</nz-form-label>
            <nz-form-control>
              @if (question.question_type === 'text') {
                <textarea nz-input rows="2" [ngModel]="textAnswers()[question.id] ?? ''" (ngModelChange)="setText(question.id, $event)"></textarea>
              } @else {
                <input nz-input type="number" [min]="question.question_type === 'enps' ? 0 : 1" [max]="question.question_type === 'enps' ? 10 : 5" [ngModel]="valueAnswers()[question.id] ?? null" (ngModelChange)="setValue(question.id, $event)" />
              }
            </nz-form-control>
          </nz-form-item>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class TalentSurveysComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly questionTypes = TALENT_QUESTION_TYPES;
  readonly color = tagColor;
  readonly key = keyOf;
  readonly statuses: readonly TalentSurveyStatus[] = ['draft', 'open', 'closed'];
  readonly pageSize = 25;
  readonly surveys = signal<TalentSurvey[]>([]);
  readonly statusFilter = signal<TalentSurveyStatus | null>(null);
  readonly page = signal(1);
  readonly total = signal(0);
  readonly editing = signal<TalentSurvey | null>(null);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly answerVisible = signal(false);
  readonly answering = signal<TalentSurvey | null>(null);
  readonly valueAnswers = signal<Record<string, number | null>>({});
  readonly textAnswers = signal<Record<string, string>>({});

  readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    is_anonymous: [true],
    opens_on: [''],
    closes_on: [''],
    min_group_size: [5, [Validators.required, Validators.min(3), Validators.max(50)]],
    questions: this.fb.array([this.newQuestion()], Validators.minLength(1)),
  });

  get questions(): FormArray {
    return this.form.controls.questions;
  }

  ngOnInit(): void {
    this.load();
  }

  changeFilter(): void {
    this.page.set(1);
    this.load();
  }

  changePage(page: number): void {
    this.page.set(page);
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getSurveys({ status: this.statusFilter() ?? undefined, page: this.page(), per_page: this.pageSize }).subscribe({
      next: (response) => {
        this.surveys.set(response.data);
        this.total.set(response.meta?.total ?? response.data.length);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
  }

  addQuestion(): void {
    this.questions.push(this.newQuestion());
  }

  removeQuestion(index: number): void {
    this.questions.removeAt(index);
  }

  openModal(): void {
    this.editing.set(null);
    this.form.reset({ title: '', description: '', is_anonymous: true, opens_on: '', closes_on: '', min_group_size: 5 });
    this.questions.clear();
    this.questions.push(this.newQuestion());
    this.modalVisible.set(true);
  }

  /** Loads the questions of a draft survey (the list does not carry them) and opens it for editing. */
  openEdit(survey: TalentSurvey): void {
    this.api.getSurvey(survey.id).subscribe((response) => {
      const data = response.data;
      this.editing.set(data);
      this.form.reset({
        title: data.title,
        description: data.description ?? '',
        is_anonymous: data.is_anonymous,
        opens_on: data.opens_on ?? '',
        closes_on: data.closes_on ?? '',
        min_group_size: data.min_group_size,
      });
      this.questions.clear();
      for (const question of [...(data.questions ?? [])].sort((left, right) => left.position - right.position)) {
        const group = this.newQuestion();
        group.patchValue({ prompt: question.prompt, question_type: question.question_type, is_required: question.is_required });
        this.questions.push(group);
      }
      if (this.questions.length === 0) {
        this.questions.push(this.newQuestion());
      }
      this.modalVisible.set(true);
    });
  }

  save(): void {
    const value = this.form.getRawValue();
    const payload: TalentSurveyRequest = {
      title: value.title.trim(),
      description: blankToNull(value.description),
      is_anonymous: value.is_anonymous,
      opens_on: blankToNull(value.opens_on),
      closes_on: blankToNull(value.closes_on),
      min_group_size: value.min_group_size,
      questions: (value.questions as { prompt: string; question_type: TalentQuestionType; is_required: boolean }[]).map((question) => ({ prompt: question.prompt.trim(), question_type: question.question_type, is_required: question.is_required })),
    };
    const current = this.editing();
    (current ? this.api.updateSurvey(current.id, payload) : this.api.createSurvey(payload)).subscribe(this.observer(() => this.modalVisible.set(false)));
  }

  transition(survey: TalentSurvey, action: 'open' | 'close'): void {
    (action === 'open' ? this.api.openSurvey(survey.id) : this.api.closeSurvey(survey.id)).subscribe(this.observer());
  }

  remove(survey: TalentSurvey): void {
    this.api.deleteSurvey(survey.id).subscribe(this.observer());
  }

  openAnswer(survey: TalentSurvey): void {
    this.valueAnswers.set({});
    this.textAnswers.set({});
    this.api.getSurvey(survey.id).subscribe((response) => {
      this.answering.set(response.data);
      this.answerVisible.set(true);
    });
  }

  setValue(questionId: string, value: number | null): void {
    this.valueAnswers.update((answers) => ({ ...answers, [questionId]: value }));
  }

  setText(questionId: string, value: string): void {
    this.textAnswers.update((answers) => ({ ...answers, [questionId]: value }));
  }

  submitAnswer(): void {
    const survey = this.answering();
    if (!survey) {
      return;
    }
    const answers = (survey.questions ?? []).map((question) => ({
      question_id: question.id,
      value: question.question_type === 'text' ? null : (this.valueAnswers()[question.id] ?? null),
      text: question.question_type === 'text' ? blankToNull(this.textAnswers()[question.id]) : null,
    }));
    this.api.submitSurveyResponse(survey.id, answers).subscribe(this.observer(() => this.answerVisible.set(false)));
  }

  private newQuestion() {
    return this.fb.group({
      prompt: ['', [Validators.required, Validators.maxLength(1000)]],
      question_type: this.fb.control<TalentQuestionType>('rating'),
      is_required: [true],
    });
  }

  private observer(onSuccess?: () => void): { next: () => void; error: (error: unknown) => void } {
    return mutationObserver(this.message, this.translate, () => {
      onSuccess?.();
      this.load();
    });
  }
}
