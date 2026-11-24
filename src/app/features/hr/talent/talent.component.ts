import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  EmployeeResource,
  HrApiService,
  HrTalentApiService,
  I18nService,
  PermissionsService,
  TrainingCourseResource,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption, crudPage, isRowsQuery } from '../shared/crud/crud.types';
import { reportHttpError } from '../shared/hr-http.util';

type Row = { id: string } & Record<string, unknown>;

/** Talent and training: performance reviews, courses, assignments, certifications. */
@Component({
  selector: 'app-hr-talent',
  styleUrl: './talent.component.scss',
  imports: [NzButtonModule, NzCardModule, NzTabsModule, PageHeaderComponent, TranslatePipe, CrudTableComponent],
  template: `
    <app-page-header [title]="'hrmTalent.title' | translate" [subtitle]="'hrmTalent.subtitle' | translate" />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmTalent.reviews' | translate">
          <app-crud-table [config]="reviewsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTalent.courses' | translate">
          <app-crud-table [config]="coursesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTalent.records' | translate">
          <app-crud-table [config]="recordsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmTalent.certifications' | translate">
          @if (canWrite()) {
            <button nz-button type="button" class="mb-3" [nzLoading]="scanning()" (click)="scanExpiring()">
              {{ 'hrmTalent.scanExpiring' | translate }}
            </button>
          }
          <app-crud-table [config]="certificationsConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
  `,
})
export class TalentComponent implements OnInit {
  private readonly api = inject(HrTalentApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly scanning = signal(false);
  private readonly employees = signal<EmployeeResource[]>([]);
  private readonly courses = signal<TrainingCourseResource[]>([]);
  private readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );
  private readonly courseOptions = computed<CrudOption[]>(() =>
    this.courses().map((c) => ({ value: c.id, label: `${c.course_code} - ${c.title}` })),
  );

  protected readonly reviewsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTalent.reviews',
    canWrite: this.canWrite(),
    gridList: (query) => crudPage(this.api.getPerformanceReviews(query)),
    create: (payload) => this.api.submitPerformanceReview(payload as never),
    rowActions: [
      {
        labelKey: 'hrmTalent.completeReview',
        writeOnly: true,
        visible: (row) => !row['completed_at'],
        run: (row) => this.api.completeReview(row.id),
      },
    ],
    fields: [
      { key: 'review_number', labelKey: 'hrmTalent.reviewNumber', type: 'text', noForm: true },
      { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', required: true, options: () => this.employeeOptions() },
      { key: 'review_period', labelKey: 'hrmTalent.reviewPeriod', type: 'text', required: true, maxLength: 30 },
      {
        key: 'review_type',
        labelKey: 'hrmCommon.type',
        type: 'select',
        defaultValue: 'annual',
        options: () =>
          ['annual', 'mid_year', 'probation', 'promotion_readiness'].map((value) => ({
            value,
            labelKey: `hrmTalent.reviewType.${value}`,
          })),
      },
      { key: 'goals_score', labelKey: 'hrmTalent.goalsScore', type: 'decimal', required: true, min: 1, max: 5 },
      { key: 'competencies_score', labelKey: 'hrmTalent.competenciesScore', type: 'decimal', required: true, min: 1, max: 5 },
      { key: 'overall_rating', labelKey: 'hrmTalent.overallRating', type: 'text', noForm: true },
      { key: 'promotion_recommended', labelKey: 'hrmTalent.promotionRecommended', type: 'boolean' },
      {
        key: 'successor_readiness',
        labelKey: 'hrmTalent.successorReadiness',
        type: 'select',
        nullable: true,
        options: () =>
          ['ready_now', 'ready_1_2_years', 'not_ready'].map((value) => ({
            value,
            labelKey: `hrmTalent.readiness.${value}`,
          })),
      },
      { key: 'strengths', labelKey: 'hrmTalent.strengths', type: 'textarea', nullable: true, column: false },
      { key: 'improvement_areas', labelKey: 'hrmTalent.improvementAreas', type: 'textarea', nullable: true, column: false },
      { key: 'status', labelKey: 'hrmCommon.statusCol', type: 'text', noForm: true },
    ],
  }));

  protected readonly coursesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTalent.courses',
    canWrite: this.canWrite(),
    gridList: (query) => {
      if (isRowsQuery(query)) {
        this.api.getTrainingCourses().subscribe({ next: (res) => this.courses.set(res.data) });
      }
      return crudPage(this.api.getTrainingCourses(query));
    },
    create: (payload) => this.api.createTrainingCourse(payload as never),
    fields: [
      { key: 'course_code', labelKey: 'hrmCommon.code', type: 'text', required: true, maxLength: 50 },
      { key: 'title', labelKey: 'hrmCommon.title', type: 'text', required: true, maxLength: 255 },
      { key: 'category', labelKey: 'hrmSelfService.category', type: 'text', defaultValue: 'safety' },
      { key: 'provider', labelKey: 'hrmTalent.provider', type: 'text' },
      { key: 'duration_hours', labelKey: 'hrmTalent.durationHours', type: 'decimal' },
      { key: 'cost_per_participant', labelKey: 'hrmTalent.costPerParticipant', type: 'decimal' },
      { key: 'validity_months', labelKey: 'hrmTalent.validityMonths', type: 'integer' },
      { key: 'is_mandatory_compliance', labelKey: 'hrmTalent.mandatory', type: 'boolean' },
    ],
  }));

  protected readonly recordsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTalent.records',
    canWrite: this.canWrite(),
    gridList: (query) => crudPage(this.api.getTrainingRecords(query)),
    create: (payload) => this.api.assignTraining(payload as never),
    rowActions: [
      {
        labelKey: 'hrmTalent.completeTraining',
        writeOnly: true,
        visible: (row) => row['status'] !== 'completed',
        input: { labelKey: 'hrmTalent.score', kind: 'decimal', optional: true },
        run: (row, score) => this.api.completeTrainingRecord(row.id, score),
      },
    ],
    fields: [
      { key: 'enrollment_number', labelKey: 'hrmTalent.enrollmentNumber', type: 'text', noForm: true },
      { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', required: true, options: () => this.employeeOptions() },
      { key: 'course_id', labelKey: 'hrmTalent.course', type: 'select', required: true, options: () => this.courseOptions() },
      { key: 'scheduled_date', labelKey: 'hrmSelfService.scheduledDate', type: 'date', nullable: true, column: false },
      { key: 'override_cost', labelKey: 'hrmTalent.overrideCost', type: 'decimal', nullable: true, column: false },
      { key: 'notes', labelKey: 'hrmCommon.notes', type: 'text', nullable: true, column: false, maxLength: 1000 },
      { key: 'status', labelKey: 'hrmCommon.statusCol', type: 'text', noForm: true },
      { key: 'assigned_date', labelKey: 'hrmTalent.assignedDate', type: 'text', noForm: true },
      { key: 'score', labelKey: 'hrmTalent.score', type: 'text', noForm: true },
    ],
  }));

  protected readonly certificationsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmTalent.certifications',
    canWrite: false,
    gridList: (query) => crudPage(this.api.getCertifications(query)),
    fields: [
      { key: 'code', labelKey: 'hrmCommon.code', type: 'text' },
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text' },
      { key: 'issuing_authority', labelKey: 'hrmTalent.issuingAuthority', type: 'text' },
      { key: 'issue_date', labelKey: 'hrmSelfService.issueDate', type: 'text' },
      { key: 'expiry_date', labelKey: 'hrmSelfService.expiryDate', type: 'text' },
      { key: 'is_mandatory', labelKey: 'hrmTalent.mandatory', type: 'boolean' },
      { key: 'status', labelKey: 'hrmCommon.statusCol', type: 'text' },
    ],
  }));

  ngOnInit(): void {
    this.hrApi.getEmployees({ per_page: 100 }).subscribe({ next: (res) => this.employees.set(res.data) });
    this.api.getTrainingCourses().subscribe({ next: (res) => this.courses.set(res.data) });
  }

  protected scanExpiring(): void {
    this.scanning.set(true);
    this.api.scanExpiringCertifications().subscribe({
      next: (res) => {
        this.scanning.set(false);
        this.message.success(
          this.i18n.translate('hrmTalent.scanDone', { count: res.data.expiring_certifications_alerted }),
        );
      },
      error: (err: unknown) => {
        this.scanning.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
