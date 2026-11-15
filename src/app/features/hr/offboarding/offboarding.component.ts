import { Component, computed, inject, OnInit, signal, viewChildren } from '@angular/core';
import {
  EmployeeResource,
  ExitReasonOption,
  HrApiService,
  HrWorkforceApiService,
  OffboardingTemplateRecord,
  PaginatedResponse,
  PermissionsService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { map, Observable } from 'rxjs';
import { CrudTableComponent } from '../shared/crud/crud-table.component';
import { CrudConfig, CrudOption, CrudRow, crudPage, isRowsQuery } from '../shared/crud/crud.types';
import { OffboardingChecklistComponent } from './offboarding-checklist.component';
import { parseTemplateTasks } from './offboarding-template.util';

type Row = { id: string } & Record<string, unknown>;

interface NamedEmployee {
  full_name?: string;
}

/** Adds the name of the nested employee to the rows, so that a table column can show it. */
function withEmployeeName<T extends { employee?: NamedEmployee | null }>(page: Observable<PaginatedResponse<T>>): Observable<PaginatedResponse<CrudRow>> {
  return page.pipe(
    map((res) => ({
      ...res,
      data: res.data.map((row) => ({ ...row, employee_name: row.employee?.full_name ?? '' })),
    })),
  ) as unknown as Observable<PaginatedResponse<CrudRow>>;
}

/** Offboarding: checklists of the leaving employees, templates and exit interviews. */
@Component({
  selector: 'app-hr-offboarding',
  styleUrl: './offboarding.component.scss',
  imports: [NzCardModule, NzTabsModule, PageHeaderComponent, TranslatePipe, CrudTableComponent, OffboardingChecklistComponent],
  template: `
    <app-page-header [title]="'hrmOffboarding.title' | translate" [subtitle]="'hrmOffboarding.subtitle' | translate" />
    <nz-card>
      <nz-tabs>
        <nz-tab [nzTitle]="'hrmOffboarding.checklists' | translate">
          <app-crud-table [config]="checklistsConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmOffboarding.templates' | translate">
          <p class="offboarding__hint">{{ 'hrmOffboarding.tasksHint' | translate }}</p>
          <app-crud-table [config]="templatesConfig()" />
        </nz-tab>
        <nz-tab [nzTitle]="'hrmOffboarding.exitInterviews' | translate">
          <app-crud-table [config]="interviewsConfig()" />
        </nz-tab>
      </nz-tabs>
    </nz-card>
    <app-offboarding-checklist
      [checklistId]="detailTarget()"
      [canWrite]="canWrite()"
      (closed)="detailTarget.set(null)"
      (changed)="reloadTables()"
    />
  `,
})
export class OffboardingComponent implements OnInit {
  private readonly api = inject(HrWorkforceApiService);
  private readonly hrApi = inject(HrApiService);
  private readonly permissions = inject(PermissionsService);
  private readonly tables = viewChildren(CrudTableComponent);

  protected readonly canWrite = computed(() => this.permissions.canWrite('hr'));
  protected readonly detailTarget = signal<string | null>(null);
  private readonly employees = signal<EmployeeResource[]>([]);
  private readonly templates = signal<OffboardingTemplateRecord[]>([]);
  private readonly reasons = signal<ExitReasonOption[]>([]);

  private readonly employeeOptions = computed<CrudOption[]>(() =>
    this.employees().map((e) => ({ value: e.id, label: `${e.employee_number} - ${e.full_name}` })),
  );
  private readonly templateOptions = computed<CrudOption[]>(() => this.templates().map((t) => ({ value: t.id, label: t.name })));
  private readonly reasonOptions = computed<CrudOption[]>(() =>
    this.reasons().map((r) => ({ value: r.code, labelKey: `hrmOffboarding.reason.${r.code}` })),
  );

  protected readonly checklistsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmOffboarding.checklists',
    canWrite: this.canWrite(),
    gridList: (query) => {
      if (isRowsQuery(query)) {
        this.loadLookups();
      }
      return withEmployeeName(this.api.getOffboardingChecklists(query));
    },
    create: (payload) => this.api.startOffboarding(payload as never),
    rowActions: [{ labelKey: 'hrmOffboarding.tasks', run: (row) => this.detailTarget.set(row.id) }],
    fields: [
      { key: 'employee_name', labelKey: 'hrmCommon.employee', type: 'text', noForm: true, noGrid: true },
      { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', required: true, column: false, options: () => this.employeeOptions() },
      { key: 'template_id', labelKey: 'hrmOffboarding.template', type: 'select', nullable: true, column: false, options: () => this.templateOptions() },
      { key: 'reference_date', labelKey: 'hrmOffboarding.referenceDate', type: 'text', noForm: true },
      { key: 'completed_at', labelKey: 'hrmOffboarding.completedAt', type: 'text', noForm: true },
    ],
  }));

  protected readonly templatesConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmOffboarding.templates',
    canWrite: this.canWrite(),
    gridList: (query) => crudPage(this.api.getOffboardingTemplates(query)),
    create: (payload) => this.api.createOffboardingTemplate(this.templatePayload(payload)),
    remove: (id) => this.api.deleteOffboardingTemplate(id),
    fields: [
      { key: 'name', labelKey: 'hrmCommon.name', type: 'text', required: true, maxLength: 120 },
      { key: 'tasks_text', labelKey: 'hrmOffboarding.tasks', type: 'textarea', required: true, column: false },
    ],
  }));

  protected readonly interviewsConfig = computed<CrudConfig<Row>>(() => ({
    titleKey: 'hrmOffboarding.exitInterviews',
    canWrite: this.canWrite(),
    gridList: (query) => withEmployeeName(this.api.getExitInterviews(query)),
    create: (payload) => this.api.recordExitInterview(payload as never),
    fields: [
      { key: 'employee_name', labelKey: 'hrmCommon.employee', type: 'text', noForm: true, noGrid: true },
      { key: 'employee_id', labelKey: 'hrmCommon.employee', type: 'select', required: true, column: false, options: () => this.employeeOptions() },
      { key: 'conducted_on', labelKey: 'hrmOffboarding.conductedOn', type: 'date', required: true },
      { key: 'reason_code', labelKey: 'hrmOffboarding.reasonCode', type: 'select', required: true, options: () => this.reasonOptions() },
      { key: 'satisfaction_rating', labelKey: 'hrmOffboarding.satisfaction', type: 'integer', nullable: true, min: 1, max: 5 },
      { key: 'would_recommend', labelKey: 'hrmOffboarding.wouldRecommend', type: 'boolean' },
      { key: 'eligible_for_rehire', labelKey: 'hrmOffboarding.eligibleForRehire', type: 'boolean' },
      { key: 'feedback', labelKey: 'hrmOffboarding.feedback', type: 'textarea', nullable: true, column: false, maxLength: 10000 },
    ],
  }));

  ngOnInit(): void {
    this.loadLookups();
    this.api.getExitReasonCodes().subscribe({ next: (res) => this.reasons.set(res.data) });
  }

  protected reloadTables(): void {
    this.tables().forEach((table) => table.reload());
  }

  private templatePayload(payload: Record<string, unknown>): { name: string; tasks: ReturnType<typeof parseTemplateTasks> } {
    return { name: String(payload['name'] ?? ''), tasks: parseTemplateTasks(String(payload['tasks_text'] ?? '')) };
  }

  /** The select options of the forms need every row, not the filtered page of the grid. */
  private loadLookups(): void {
    this.api.getOffboardingTemplates().subscribe({ next: (res) => this.templates.set(res.data) });
    this.hrApi.getEmployees({ per_page: 100 }).subscribe({ next: (res) => this.employees.set(res.data) });
  }
}
