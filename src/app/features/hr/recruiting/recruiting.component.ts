import { Component, computed, inject, OnInit, signal } from '@angular/core';
import {
  HrTalentApiService,
  JobPostingRecord,
  PermissionsService,
  PipelineStageRecord,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map, tap } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption } from '../shared/crud/crud.types';
import { ApplicationHireComponent } from './application-hire.component';
import { RecruitingSettingsComponent } from './recruiting-settings.component';

type Row = { id: string } & Record<string, unknown>;

/** Recruiting: postings, applications through the pipeline, hiring, retention and onboarding. */
@Component({
  selector: 'app-hr-recruiting',
  imports: [
    NzCardModule,
    NzTabsModule,
    PageHeaderComponent,
    TranslatePipe,
    CrudTableComponent,
    ApplicationHireComponent,
    RecruitingSettingsComponent,
  ],
  template: `
    <app-page-header [title]="'hrmRecruiting.title' | translate" [subtitle]="'hrmRecruiting.subtitle' | translate" />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmRecruiting.postings' | translate">
          <app-crud-table [config]="postingsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmRecruiting.applications' | translate">
          <app-crud-table [config]="applicationsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmRecruiting.settings' | translate">
          <app-recruiting-settings [canWrite]="canWrite()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
    <app-application-hire
      [applicationId]="hireTarget()"
      (closed)="hireTarget.set(null)"
      (hired)="hireTarget.set(null)"
    />
  `,
})
export class RecruitingComponent implements OnInit {
  private readonly api = inject(HrTalentApiService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly hireTarget = signal<string | null>(null);
  private readonly postings = signal<JobPostingRecord[]>([]);
  private readonly stages = signal<PipelineStageRecord[]>([]);
  private readonly postingOptions = computed<CrudOption[]>(() =>
    this.postings().map((p) => ({ value: p.id, label: p.title })),
  );
  private readonly stageOptions = computed<CrudOption[]>(() =>
    this.stages().map((s) => ({ value: s.id, label: s.name })),
  );

  protected readonly postingsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmRecruiting.postings',
    canWrite: this.canWrite(),
    list: () =>
      this.api.getJobPostings().pipe(
        tap((res) => this.postings.set(res.data)),
        map((res) => res.data as unknown as Row[]),
      ),
    create: (payload) => this.api.createJobPosting(payload as never),
    rowActions: [
      {
        labelKey: 'hrmRecruiting.close',
        writeOnly: true,
        visible: (row) => row['status'] === 'open' || row['status'] === 'draft',
        run: (row) => this.api.closeJobPosting(row.id),
      },
    ],
    fields: [
      { key: 'title', labelKey: 'hrmCommon.title', type: 'text', required: true, maxLength: 180 },
      { key: 'description', labelKey: 'hrmCommon.description', type: 'textarea', nullable: true, column: false },
      { key: 'location', labelKey: 'hrmRecruiting.location', type: 'text', nullable: true, maxLength: 120 },
      { key: 'employment_type', labelKey: 'hrmLeave.employmentType', type: 'text', defaultValue: 'full_time' },
      {
        key: 'status',
        labelKey: 'hrmCommon.statusCol',
        type: 'select',
        defaultValue: 'draft',
        options: () => ['draft', 'open'].map((value) => ({ value, labelKey: `hrmCommon.status.${value}` })),
      },
      { key: 'opens_on', labelKey: 'hrmRecruiting.opensOn', type: 'date', nullable: true },
      { key: 'closes_on', labelKey: 'hrmRecruiting.closesOn', type: 'date', nullable: true },
    ],
  }));

  protected readonly applicationsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmRecruiting.applications',
    canWrite: this.canWrite(),
    list: () => {
      this.api.getPipelineStages().subscribe({ next: (res) => this.stages.set(res.data) });
      return this.api.getJobApplications({ per_page: 100 }).pipe(map((res) => res.data as unknown as Row[]));
    },
    create: (payload) => this.api.createJobApplication(payload as never),
    remove: (id) => this.api.deleteJobApplication(id),
    rowActions: [
      {
        labelKey: 'hrmRecruiting.move',
        writeOnly: true,
        visible: (row) => row['status'] === 'active',
        input: { labelKey: 'hrmRecruiting.stage', kind: 'select', options: () => this.stageOptions() },
        run: (row, stageId) => this.api.moveJobApplication(row.id, stageId ?? ''),
      },
      {
        labelKey: 'hrmRecruiting.addNote',
        writeOnly: true,
        input: { labelKey: 'hrmCommon.notes', kind: 'reason' },
        run: (row, note) => this.api.addInterviewNote(row.id, note ?? ''),
      },
      {
        labelKey: 'hrmRecruiting.recordConsent',
        writeOnly: true,
        input: { labelKey: 'hrmRecruiting.consentUntil', kind: 'date' },
        run: (row, date) => this.api.recordConsent(row.id, date ?? ''),
      },
      {
        labelKey: 'hrmRecruiting.reject',
        writeOnly: true,
        visible: (row) => row['status'] === 'active',
        run: (row) => this.api.rejectJobApplication(row.id),
      },
      {
        labelKey: 'hrmRecruiting.hire',
        writeOnly: true,
        visible: (row) => row['status'] === 'active',
        run: (row) => this.hireTarget.set(row.id),
      },
    ],
    fields: [
      {
        key: 'job_posting_id',
        labelKey: 'hrmRecruiting.posting',
        type: 'select',
        required: true,
        createOnly: true,
        options: () => this.postingOptions(),
      },
      { key: 'first_name', labelKey: 'hrmRecruiting.firstName', type: 'text', required: true },
      { key: 'last_name', labelKey: 'hrmRecruiting.lastName', type: 'text', required: true },
      { key: 'email', labelKey: 'hrmRecruiting.email', type: 'text', required: true },
      { key: 'phone', labelKey: 'hrmRecruiting.phone', type: 'text', nullable: true, column: false },
      { key: 'source', labelKey: 'hrmRecruiting.source', type: 'text', nullable: true, column: false },
      { key: 'cover_note', labelKey: 'hrmRecruiting.coverNote', type: 'textarea', nullable: true, column: false },
      { key: 'consent_until', labelKey: 'hrmRecruiting.consentUntil', type: 'date', nullable: true, column: false },
      { key: 'status', labelKey: 'hrmCommon.statusCol', type: 'text', noForm: true },
      { key: 'retention_until', labelKey: 'hrmRecruiting.retentionUntil', type: 'text', noForm: true },
    ],
  }));

  ngOnInit(): void {
    this.api.getJobPostings().subscribe({ next: (res) => this.postings.set(res.data) });
    this.api.getPipelineStages().subscribe({ next: (res) => this.stages.set(res.data) });
  }
}
