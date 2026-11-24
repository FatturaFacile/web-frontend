import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TalentCompliance, TalentComplianceCourse, TalentLearningApiService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, keyOf, tagColor } from './talent-learning.util';

/** Mandatory-training compliance: who holds a valid certificate of every mandatory course, with the gaps per course. */
@Component({
  selector: 'app-talent-compliance',
  styleUrl: './talent-learning.scss',
  imports: [DecimalPipe, PageHeaderComponent, TranslatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzStatisticModule, NzTableModule, NzTagModule],
  template: `
    <app-page-header [title]="'TALENT_LEARNING.COMPLIANCE_TITLE' | translate" [subtitle]="'TALENT_LEARNING.COMPLIANCE_SUBTITLE' | translate"></app-page-header>

    @if (compliance(); as data) {
      <div class="stats-grid">
        <nz-card><nz-statistic [nzTitle]="'TALENT_LEARNING.MANDATORY_COURSES' | translate" [nzValue]="data.courses.length"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzTitle]="'TALENT_LEARNING.COMPLIANCE_RATE' | translate" [nzValue]="((data.compliance_percent | number: '1.0-1') ?? '') + ' %'"></nz-statistic></nz-card>
      </div>

      <nz-card class="main-card">
        <nz-table #table [nzData]="data.courses" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'TALENT_LEARNING.COURSE' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.EMPLOYEES' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.COMPLIANCE_COMPLIANT' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.COMPLIANCE_IN_PROGRESS' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.COMPLIANCE_OVERDUE' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.COMPLIANCE_EXPIRED' | translate }}</th>
              <th class="num">{{ 'TALENT_LEARNING.COMPLIANCE_MISSING' | translate }}</th>
              <th class="num">%</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.course.id) {
              <tr>
                <td>{{ row.course.code }} - {{ row.course.title }}</td>
                <td class="num">{{ row.employees_total }}</td>
                <td class="num">{{ row.compliant }}</td>
                <td class="num">{{ row.in_progress }}</td>
                <td class="num">{{ row.overdue }}</td>
                <td class="num">{{ row.expired }}</td>
                <td class="num">{{ row.missing }}</td>
                <td class="num">{{ row.compliance_percent | number: '1.0-1' }}</td>
                <td><button nz-button nzType="text" (click)="showGaps(row)">{{ 'TALENT_LEARNING.GAPS' | translate }}</button></td>
              </tr>
            }
          </tbody>
        </nz-table>
        @if (data.courses.length === 0) {
          <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_COMPLIANCE' | translate"></nz-empty>
        }
      </nz-card>
    }

    @if (gaps(); as detail) {
      <nz-card class="main-card" [nzTitle]="('TALENT_LEARNING.GAPS' | translate) + ': ' + detail.course.title">
        <nz-table #gapTable [nzData]="detail.non_compliant ?? []" nzSize="small" [nzPageSize]="25">
          <thead>
            <tr>
              <th>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</th>
              <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
              <th>{{ 'TALENT_LEARNING.DUE_ON' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (gap of gapTable.data; track gap.employee.id) {
              <tr>
                <td>{{ gap.employee.full_name }}</td>
                <td><nz-tag [nzColor]="color(gap.state)">{{ 'TALENT_LEARNING.COMPLIANCE_' + key(gap.state) | translate }}</nz-tag></td>
                <td>{{ gap.due_on }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
})
export class TalentComplianceComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly color = tagColor;
  readonly key = keyOf;
  readonly compliance = signal<TalentCompliance | null>(null);
  readonly gaps = signal<TalentComplianceCourse | null>(null);

  ngOnInit(): void {
    this.api.getCompliance().subscribe({
      next: (response) => this.compliance.set(response.data),
      error: (error: unknown) => {
        this.message.error(apiErrorText(error) ?? this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
  }

  showGaps(course: TalentComplianceCourse): void {
    this.api.getCompliance(course.course.id).subscribe({
      next: (response) => this.gaps.set(response.data.courses[0] ?? null),
      error: (error: unknown) => {
        this.message.error(apiErrorText(error) ?? this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
  }
}
