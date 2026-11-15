import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { TalentLearningApiService, TalentSurvey, TalentSurveyResults, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText } from './talent-learning.util';

/** Aggregated survey results: the API hides everything below the minimum group size and merges small segments. */
@Component({
  selector: 'app-talent-survey-results',
  styleUrl: './talent-learning.scss',
  imports: [DecimalPipe, PageHeaderComponent, TranslatePipe, NzAlertModule, NzCardModule, NzStatisticModule, NzTableModule],
  template: `
    <app-page-header [title]="survey()?.title ?? ('TALENT_LEARNING.SURVEY' | translate)" [subtitle]="'TALENT_LEARNING.RESULTS_SUBTITLE' | translate"></app-page-header>

    @if (results(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'TALENT_LEARNING.RESPONSES' | translate" [nzValue]="data.responses_count"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'TALENT_LEARNING.PARTICIPATION' | translate" [nzValue]="((data.participation_rate_percent | number: '1.0-1') ?? '') + ' %'"></nz-statistic></nz-card>
      </div>

      @if (!data.results_visible) {
        <nz-alert class="main-card" nzType="info" nzShowIcon [nzMessage]="'TALENT_LEARNING.SUPPRESSED_NOTICE' | translate: { min: data.min_group_size }"></nz-alert>
      } @else {
        @if (data.hidden_segments) {
          <nz-alert class="main-card" nzType="info" nzShowIcon [nzMessage]="'TALENT_LEARNING.SEGMENTS_HIDDEN_NOTICE' | translate: { min: data.min_group_size }"></nz-alert>
        }

        <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.QUESTIONS' | translate">
          <nz-table #questionTable [nzData]="data.questions" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'TALENT_LEARNING.QUESTION' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.ANSWERS' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.AVERAGE' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.ENPS' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.PROMOTERS' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.PASSIVES' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.DETRACTORS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (question of questionTable.data; track question.question_id) {
                <tr>
                  <td>
                    {{ question.prompt }}
                    @for (text of question.texts ?? []; track $index) {
                      <div class="muted">{{ text }}</div>
                    }
                  </td>
                  <td class="num">{{ question.answers_count }}</td>
                  <td class="num">{{ question.average === undefined || question.average === null ? '' : (question.average | number: '1.0-2') }}</td>
                  <td class="num">{{ question.enps === undefined || question.enps === null ? '' : (question.enps | number: '1.0-1') }}</td>
                  <td class="num">{{ question.promoters }}</td>
                  <td class="num">{{ question.passives }}</td>
                  <td class="num">{{ question.detractors }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>

        <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.SEGMENTS' | translate">
          <nz-table #segmentTable [nzData]="data.segments" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'TALENT_LEARNING.SEGMENT' | translate }}</th>
                <th class="num">{{ 'TALENT_LEARNING.RESPONSES' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (segment of segmentTable.data; track $index) {
                <tr>
                  <td>{{ segment.is_other ? ('TALENT_LEARNING.SEGMENT_OTHER' | translate) : segment.segment }}</td>
                  <td class="num">{{ segment.responses_count }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        </nz-card>
      }
    }
  `,
})
export class TalentSurveyResultsComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly route = inject(ActivatedRoute);
  private readonly id = this.route.snapshot.paramMap.get('id') ?? '';

  readonly survey = signal<TalentSurvey | null>(null);
  readonly results = signal<TalentSurveyResults | null>(null);

  ngOnInit(): void {
    const fail = (error: unknown): void => {
      this.message.error(apiErrorText(error) ?? this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
    };
    this.api.getSurvey(this.id).subscribe({ next: (response) => this.survey.set(response.data), error: fail });
    this.api.getSurveyResults(this.id).subscribe({ next: (response) => this.results.set(response.data), error: fail });
  }
}
