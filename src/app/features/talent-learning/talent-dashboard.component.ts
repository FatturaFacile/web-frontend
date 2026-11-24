import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TalentLearningApiService, TalentLearningDashboard, TalentPlanningDashboard, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, keyOf, tagColor } from './talent-learning.util';

/** Succession coverage, compensation budget, learning and engagement indicators in one overview. */
@Component({
  selector: 'app-talent-dashboard',
  styleUrl: './talent-learning.scss',
  imports: [DecimalPipe, RouterLink, PageHeaderComponent, TranslatePipe, NzCardModule, NzEmptyModule, NzStatisticModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'TALENT_LEARNING.DASHBOARD_TITLE' | translate" [subtitle]="'TALENT_LEARNING.DASHBOARD_SUBTITLE' | translate"></app-page-header>

    @if (planning(); as data) {
      <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.SUCCESSION' | translate" [nzExtra]="successionLink">
        <div class="stats-grid">
          <nz-statistic [nzTitle]="'TALENT_LEARNING.CRITICAL_POSITIONS' | translate" [nzValue]="data.succession.positions_total"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.COVERAGE_COVERED' | translate" [nzValue]="data.succession.coverage.covered"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.COVERAGE_AT_RISK' | translate" [nzValue]="data.succession.coverage.at_risk"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.COVERAGE_UNCOVERED' | translate" [nzValue]="data.succession.coverage.uncovered"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.HIGH_RISK_OF_LOSS' | translate" [nzValue]="data.succession.high_risk_of_loss_candidates"></nz-statistic>
        </div>
        @if (data.succession.positions_needing_attention.length > 0) {
          <nz-table #attentionTable [nzData]="data.succession.positions_needing_attention" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'TALENT_LEARNING.POSITION' | translate }}</th>
                <th>{{ 'TALENT_LEARNING.CRITICALITY' | translate }}</th>
                <th>{{ 'TALENT_LEARNING.COVERAGE' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of attentionTable.data; track row.id) {
                <tr>
                  <td>{{ row.title }}</td>
                  <td><nz-tag [nzColor]="color(row.criticality)">{{ 'TALENT_LEARNING.LEVEL_' + key(row.criticality) | translate }}</nz-tag></td>
                  <td><nz-tag [nzColor]="color(row.coverage)">{{ 'TALENT_LEARNING.COVERAGE_' + key(row.coverage) | translate }}</nz-tag></td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.COMPENSATION' | translate" [nzExtra]="compensationLink">
        @if (data.compensation.current_cycle; as cycle) {
          <p class="muted">{{ cycle.name }}</p>
          <div class="stats-grid">
            <nz-statistic [nzTitle]="'TALENT_LEARNING.BUDGET_TOTAL' | translate" [nzValue]="(cycle.budget_amount | number: '1.2-2') ?? ''"></nz-statistic>
            <nz-statistic [nzTitle]="'TALENT_LEARNING.BUDGET_COMMITTED' | translate" [nzValue]="(cycle.committed_amount | number: '1.2-2') ?? ''"></nz-statistic>
            <nz-statistic [nzTitle]="'TALENT_LEARNING.BUDGET_REMAINING' | translate" [nzValue]="(cycle.remaining_amount | number: '1.2-2') ?? ''"></nz-statistic>
            <nz-statistic [nzTitle]="'TALENT_LEARNING.PENDING_PROPOSALS' | translate" [nzValue]="cycle.proposals_by_status.submitted"></nz-statistic>
            <nz-statistic [nzTitle]="'TALENT_LEARNING.EXCEPTIONS' | translate" [nzValue]="cycle.exceptions_count"></nz-statistic>
          </div>
        } @else {
          <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_CYCLES' | translate"></nz-empty>
        }
      </nz-card>
    }

    @if (learning(); as data) {
      <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.LEARNING' | translate" [nzExtra]="learningLink">
        <div class="stats-grid">
          <nz-statistic [nzTitle]="'TALENT_LEARNING.PUBLISHED_COURSES' | translate" [nzValue]="data.learning.courses_published"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.ACTIVE_ENROLMENTS' | translate" [nzValue]="data.learning.enrolments_by_status.enrolled + data.learning.enrolments_by_status.in_progress"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.OVERDUE_ENROLMENTS' | translate" [nzValue]="data.learning.overdue_enrolments"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.COMPLETION_RATE' | translate" [nzValue]="((data.learning.completion_rate_percent | number: '1.0-1') ?? '') + ' %'"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.COMPLIANCE_RATE' | translate" [nzValue]="((data.learning.mandatory_compliance_percent | number: '1.0-1') ?? '') + ' %'"></nz-statistic>
          <nz-statistic [nzTitle]="'TALENT_LEARNING.CERTIFICATES_EXPIRING' | translate" [nzValue]="data.learning.certificates_expiring_90_days"></nz-statistic>
        </div>
      </nz-card>

      <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.ENGAGEMENT' | translate" [nzExtra]="engagementLink">
        <div class="stats-grid">
          <nz-statistic [nzTitle]="'TALENT_LEARNING.OPEN_SURVEYS' | translate" [nzValue]="data.surveys_open"></nz-statistic>
          @if (data.engagement; as engagement) {
            <nz-statistic [nzTitle]="'TALENT_LEARNING.LATEST_ENPS' | translate" [nzValue]="engagement.results_visible ? (engagement.enps?.score ?? '-') : '-'"></nz-statistic>
            <nz-statistic [nzTitle]="'TALENT_LEARNING.PARTICIPATION' | translate" [nzValue]="((engagement.participation_rate_percent | number: '1.0-1') ?? '') + ' %'"></nz-statistic>
          }
        </div>
      </nz-card>
    }

    <ng-template #successionLink><a routerLink="/talent-learning/succession">{{ 'TALENT_LEARNING.OPEN' | translate }}</a></ng-template>
    <ng-template #compensationLink><a routerLink="/talent-learning/compensation">{{ 'TALENT_LEARNING.OPEN' | translate }}</a></ng-template>
    <ng-template #learningLink><a routerLink="/talent-learning/courses">{{ 'TALENT_LEARNING.OPEN' | translate }}</a></ng-template>
    <ng-template #engagementLink><a routerLink="/talent-learning/surveys">{{ 'TALENT_LEARNING.OPEN' | translate }}</a></ng-template>
  `,
})
export class TalentDashboardComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly color = tagColor;
  readonly key = keyOf;
  readonly planning = signal<TalentPlanningDashboard | null>(null);
  readonly learning = signal<TalentLearningDashboard | null>(null);

  ngOnInit(): void {
    const fail = (error: unknown): void => {
      this.message.error(apiErrorText(error) ?? this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
    };
    // Members without access to the planning side (pay data) only get the learning side.
    this.api.getPlanningDashboard().subscribe({ next: (response) => this.planning.set(response.data), error: () => this.planning.set(null) });
    this.api.getDashboard().subscribe({ next: (response) => this.learning.set(response.data), error: fail });
  }
}
