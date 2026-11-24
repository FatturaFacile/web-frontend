import { Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService, PermissionsService } from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';
import { uuidFormat } from '@shared/utils/uuid-validator';
import { ProjectPortfolioApiService } from './portfolio-api.service';
import {
  BaselineVariance,
  BILLING_MODELS,
  PROJECT_STATUSES,
  PROJECT_TYPES,
  Project,
  ProjectBaseline,
  ProjectPayload,
  ProjectStatus,
  ProjectTemplate,
  ProjectType,
} from './portfolio.models';
import {
  BILLING_MODEL_KEYS,
  CIG_PATTERN,
  CUP_PATTERN,
  portfolioKpis,
  PROJECT_TYPE_KEYS,
  STATUS_COLORS,
  STATUS_KEYS,
} from './portfolio.utils';

type Context = 'IT' | 'CH';

/**
 * Project portfolio overview (Mod 078): KPIs, filters, create / edit with the Italian CUP and CIG codes (shown for the
 * IT context only), creation from a template (#186), status changes, and baseline capture with its variance report.
 */
@Component({
  selector: 'app-portfolio-overview',
  styleUrl: './portfolio-overview.component.scss',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header [title]="'PORTFOLIO.TITLE' | translate" [subtitle]="'PORTFOLIO.SUBTITLE' | translate" />

    <div class="pf-actions">
      @if (canWrite) {
        <button nz-button nzType="primary" type="button" data-testid="pf-new" (click)="openCreate()">{{ 'PORTFOLIO.NEW_PROJECT' | translate }}</button>
        <button nz-button type="button" data-testid="pf-from-template" (click)="openTemplate()">{{ 'PORTFOLIO.FROM_TEMPLATE' | translate }}</button>
      }
    </div>

    @if (error()) {
      <nz-alert class="mb-4" nzType="error" nzShowIcon [nzMessage]="'PORTFOLIO.LOAD_ERROR' | translate" />
    }

    <div class="pf-kpis" data-testid="pf-kpis">
      <nz-card nzSize="small" [nzTitle]="'PORTFOLIO.KPI_PROJECTS' | translate">
        <div class="pf-kpi" data-testid="pf-kpi-total">{{ kpis().total }}</div>
        <span class="pf-muted">{{ 'PORTFOLIO.KPI_ACTIVE' | translate }}: {{ kpis().active }} · {{ 'PORTFOLIO.KPI_ON_HOLD' | translate }}: {{ kpis().onHold }} · {{ 'PORTFOLIO.KPI_COMPLETED' | translate }}: {{ kpis().completed }}</span>
      </nz-card>
      <nz-card nzSize="small" [nzTitle]="'PORTFOLIO.KPI_PLANNED_COST' | translate">
        <div class="pf-kpi">{{ kpis().plannedCost | money }}</div>
      </nz-card>
      <nz-card nzSize="small" [nzTitle]="'PORTFOLIO.KPI_ACTUAL_COST' | translate">
        <div class="pf-kpi">{{ kpis().actualCost | money }}</div>
      </nz-card>
      <nz-card nzSize="small" [nzTitle]="'PORTFOLIO.KPI_PLANNED_REVENUE' | translate">
        <div class="pf-kpi">{{ kpis().plannedRevenue | money }}</div>
      </nz-card>
      <nz-card nzSize="small" [nzTitle]="'PORTFOLIO.KPI_PROGRESS' | translate">
        <nz-progress [nzPercent]="kpis().averageProgress" nzSize="small" />
      </nz-card>
    </div>

    <div class="pf-filters">
      <input
        nz-input
        data-testid="pf-search"
        [placeholder]="'PORTFOLIO.SEARCH' | translate"
        [ngModel]="search()"
        (ngModelChange)="search.set($event)"
        (keyup.enter)="reload()"
      />
      <nz-select data-testid="pf-status-filter" nzAllowClear [nzPlaceHolder]="'PORTFOLIO.FILTER_STATUS' | translate" [ngModel]="statusFilter()" (ngModelChange)="setStatusFilter($event)">
        @for (status of statuses; track status) {
          <nz-option [nzValue]="status" [nzLabel]="statusKeys[status] | translate" />
        }
      </nz-select>
      <nz-select data-testid="pf-type-filter" nzAllowClear [nzPlaceHolder]="'PORTFOLIO.FILTER_TYPE' | translate" [ngModel]="typeFilter()" (ngModelChange)="setTypeFilter($event)">
        @for (type of types; track type) {
          <nz-option [nzValue]="type" [nzLabel]="typeKeys[type] | translate" />
        }
      </nz-select>
      <button nz-button type="button" data-testid="pf-apply" (click)="reload()">{{ 'PORTFOLIO.APPLY' | translate }}</button>
    </div>

    <nz-spin [nzSpinning]="loading()">
      @if (projects().length === 0 && !loading()) {
        <nz-empty data-testid="pf-empty" [nzNotFoundContent]="'PORTFOLIO.EMPTY' | translate" />
      } @else {
        <nz-table #table nzSize="small" [nzData]="projects()" [nzShowPagination]="projects().length > 10" [nzPageSize]="10" data-testid="pf-table">
          <thead>
            <tr>
              <th>{{ 'PORTFOLIO.COL_CODE' | translate }}</th>
              <th>{{ 'PORTFOLIO.COL_NAME' | translate }}</th>
              <th>{{ 'PORTFOLIO.COL_TYPE' | translate }}</th>
              <th>{{ 'PORTFOLIO.COL_STATUS' | translate }}</th>
              <th>{{ 'PORTFOLIO.COL_DATES' | translate }}</th>
              <th>{{ 'PORTFOLIO.COL_PROGRESS' | translate }}</th>
              <th class="pf-num">{{ 'PORTFOLIO.COL_PLANNED_COST' | translate }}</th>
              <th class="pf-num">{{ 'PORTFOLIO.COL_ACTUAL_COST' | translate }}</th>
              <th>{{ 'PORTFOLIO.COL_ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (project of table.data; track project.id) {
              <tr [attr.data-testid]="'pf-row-' + project.id">
                <td>
                  {{ project.projectCode }}
                  @if (project.cupCode) {
                    <div class="pf-muted">CUP {{ project.cupCode }}</div>
                  }
                  @if (project.cigCode) {
                    <div class="pf-muted">CIG {{ project.cigCode }}</div>
                  }
                </td>
                <td>{{ project.name }}</td>
                <td>{{ typeKeys[project.projectType] | translate }}</td>
                <td>
                  <nz-tag [nzColor]="statusColors[project.status]">{{ statusKeys[project.status] | translate }}</nz-tag>
                </td>
                <td>{{ project.startDate ?? '-' }} → {{ project.targetEndDate ?? '-' }}</td>
                <td><nz-progress [nzPercent]="project.percentComplete" nzSize="small" /></td>
                <td class="pf-num">{{ project.plannedCost | money }}</td>
                <td class="pf-num">{{ project.actualCost | money }}</td>
                <td class="pf-row-actions">
                  <a [routerLink]="['/projects', project.id, 'wbs']" [attr.data-testid]="'pf-open-' + project.id">{{ 'PORTFOLIO.OPEN_WBS' | translate }}</a>
                  <a [routerLink]="['/projects', project.id, 'kanban']">{{ 'PORTFOLIO.OPEN_KANBAN' | translate }}</a>
                  <button nz-button nzSize="small" type="button" (click)="openBaselines(project)">{{ 'PORTFOLIO.BASELINES' | translate }}</button>
                  @if (canWrite) {
                    <button nz-button nzSize="small" type="button" [attr.data-testid]="'pf-edit-' + project.id" (click)="openEdit(project)">{{ 'PORTFOLIO.EDIT' | translate }}</button>
                    <nz-select
                      nzSize="small"
                      class="pf-status-select"
                      [attr.data-testid]="'pf-status-' + project.id"
                      [ngModel]="project.status"
                      (ngModelChange)="changeStatus(project, $event)"
                    >
                      @for (status of statuses; track status) {
                        <nz-option [nzValue]="status" [nzLabel]="statusKeys[status] | translate" />
                      }
                    </nz-select>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="projectModalOpen()"
      [nzTitle]="(editing() ? 'PORTFOLIO.EDIT_PROJECT' : 'PORTFOLIO.NEW_PROJECT') | translate"
      [nzOkText]="'PORTFOLIO.SAVE' | translate"
      [nzCancelText]="'PORTFOLIO.CANCEL' | translate"
      [nzOkDisabled]="projectForm.invalid"
      [nzOkLoading]="saving()"
      nzWidth="720px"
      (nzOnOk)="saveProject()"
      (nzOnCancel)="projectModalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="projectForm" data-testid="pf-project-form">
          <div class="pf-grid">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PORTFOLIO.F_CODE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="projectCode" data-testid="pf-f-code" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'PORTFOLIO.F_NAME' | translate }}</nz-form-label>
              <nz-form-control><input nz-input formControlName="name" data-testid="pf-f-name" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_CONTEXT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="context" data-testid="pf-f-context">
                  <nz-option nzValue="IT" [nzLabel]="'PORTFOLIO.CONTEXT_IT' | translate" />
                  <nz-option nzValue="CH" [nzLabel]="'PORTFOLIO.CONTEXT_CH' | translate" />
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_LEGAL_ENTITY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_UUID' | translate"><input nz-input formControlName="legalEntityId" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_CUSTOMER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_UUID' | translate"><input nz-input formControlName="customerId" data-testid="pf-f-customer" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_MANAGER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_UUID' | translate"><input nz-input formControlName="projectManagerId" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_TYPE' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="projectType">
                  @for (type of types; track type) {
                    <nz-option [nzValue]="type" [nzLabel]="typeKeys[type] | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_BILLING' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="billingModel">
                  @for (model of billingModels; track model) {
                    <nz-option [nzValue]="model" [nzLabel]="billingKeys[model] | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_COST_CENTER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_UUID' | translate"><input nz-input formControlName="costCenterId" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_START' | translate }}</nz-form-label>
              <nz-form-control><input nz-input type="date" formControlName="startDate" data-testid="pf-f-start" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'PORTFOLIO.F_END' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_END_BEFORE_START' | translate"><input nz-input type="date" formControlName="targetEndDate" /></nz-form-control>
            </nz-form-item>
            @if (context() === 'IT') {
              <nz-form-item>
                <nz-form-label>CUP</nz-form-label>
                <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_CUP' | translate"><input nz-input formControlName="cupCode" maxlength="15" data-testid="pf-f-cup" /></nz-form-control>
              </nz-form-item>
              <nz-form-item>
                <nz-form-label>CIG</nz-form-label>
                <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_CIG' | translate"><input nz-input formControlName="cigCode" maxlength="10" data-testid="pf-f-cig" /></nz-form-control>
              </nz-form-item>
            }
          </div>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="templateModalOpen()"
      [nzTitle]="'PORTFOLIO.FROM_TEMPLATE' | translate"
      [nzOkText]="'PORTFOLIO.CREATE' | translate"
      [nzCancelText]="'PORTFOLIO.CANCEL' | translate"
      [nzOkDisabled]="templateForm.invalid"
      [nzOkLoading]="saving()"
      (nzOnOk)="createFromTemplate()"
      (nzOnCancel)="templateModalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="templateForm" data-testid="pf-template-form">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PORTFOLIO.F_TEMPLATE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="templateId" data-testid="pf-t-template" [nzPlaceHolder]="'PORTFOLIO.F_TEMPLATE' | translate">
                @for (template of templates(); track template.id) {
                  <nz-option [nzValue]="template.id" [nzLabel]="template.name" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PORTFOLIO.F_CODE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="projectCode" data-testid="pf-t-code" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PORTFOLIO.F_NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input formControlName="name" data-testid="pf-t-name" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PORTFOLIO.F_CUSTOMER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_UUID' | translate"><input nz-input formControlName="customerId" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'PORTFOLIO.F_MANAGER' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'PORTFOLIO.ERR_UUID' | translate"><input nz-input formControlName="projectManagerId" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'PORTFOLIO.F_START' | translate }}</nz-form-label>
            <nz-form-control><input nz-input type="date" formControlName="startDate" data-testid="pf-t-start" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="baselineProject() !== null"
      [nzTitle]="'PORTFOLIO.BASELINES' | translate"
      [nzFooter]="null"
      nzWidth="760px"
      (nzOnCancel)="closeBaselines()"
    >
      <ng-container *nzModalContent>
        @if (canWrite) {
          <div class="pf-baseline-capture">
            <input nz-input data-testid="pf-baseline-name" [placeholder]="'PORTFOLIO.BASELINE_NAME' | translate" [ngModel]="baselineName()" (ngModelChange)="baselineName.set($event)" />
            <button nz-button nzType="primary" type="button" data-testid="pf-baseline-capture" [disabled]="baselineName().trim() === ''" [nzLoading]="saving()" (click)="captureBaseline()">
              {{ 'PORTFOLIO.CAPTURE_BASELINE' | translate }}
            </button>
          </div>
        }
        @if (baselines().length === 0) {
          <nz-empty [nzNotFoundContent]="'PORTFOLIO.NO_BASELINES' | translate" />
        } @else {
          <nz-table nzSize="small" [nzData]="baselines()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ 'PORTFOLIO.COL_NAME' | translate }}</th>
                <th>{{ 'PORTFOLIO.CAPTURED_AT' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (baseline of baselines(); track baseline.id) {
                <tr>
                  <td>{{ baseline.baselineNumber }}</td>
                  <td>{{ baseline.name }}</td>
                  <td>{{ baseline.capturedAt }}</td>
                  <td><button nz-button nzSize="small" type="button" [attr.data-testid]="'pf-variance-' + baseline.id" (click)="showVariance(baseline)">{{ 'PORTFOLIO.VARIANCE' | translate }}</button></td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
        @if (variance(); as report) {
          <h4 class="pf-variance-title">
            {{ 'PORTFOLIO.VARIANCE' | translate }} ·
            {{ 'PORTFOLIO.PROJECT_END_VARIANCE' | translate }}: <span data-testid="pf-end-variance">{{ report.projectEndVarianceDays }}</span> {{ 'PORTFOLIO.DAYS' | translate }}
          </h4>
          <nz-table nzSize="small" [nzData]="report.rows" [nzShowPagination]="false" data-testid="pf-variance-table">
            <thead>
              <tr>
                <th>WBS</th>
                <th>{{ 'PORTFOLIO.COL_NAME' | translate }}</th>
                <th class="pf-num">{{ 'PORTFOLIO.VAR_START' | translate }}</th>
                <th class="pf-num">{{ 'PORTFOLIO.VAR_END' | translate }}</th>
                <th class="pf-num">{{ 'PORTFOLIO.VAR_HOURS' | translate }}</th>
                <th class="pf-num">{{ 'PORTFOLIO.VAR_COST' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of report.rows; track row.nodeId) {
                <tr>
                  <td>{{ row.wbsCode }}</td>
                  <td>{{ row.title }}</td>
                  <td class="pf-num" [class.pf-late]="row.startVarianceDays > 0">{{ row.startVarianceDays }}</td>
                  <td class="pf-num" [class.pf-late]="row.endVarianceDays > 0">{{ row.endVarianceDays }}</td>
                  <td class="pf-num">{{ row.plannedHoursVariance }}</td>
                  <td class="pf-num">{{ row.plannedCostVariance | money }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class PortfolioOverviewComponent implements OnInit {
  private readonly api = inject(ProjectPortfolioApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly canWrite = inject(PermissionsService).canWrite('projects');

  protected readonly statuses = PROJECT_STATUSES;
  protected readonly types = PROJECT_TYPES;
  protected readonly billingModels = BILLING_MODELS;
  protected readonly statusKeys = STATUS_KEYS;
  protected readonly statusColors = STATUS_COLORS;
  protected readonly typeKeys = PROJECT_TYPE_KEYS;
  protected readonly billingKeys = BILLING_MODEL_KEYS;

  readonly projects = signal<Project[]>([]);
  readonly loading = signal(false);
  readonly saving = signal(false);
  readonly error = signal(false);

  readonly search = signal('');
  readonly statusFilter = signal<ProjectStatus | null>(null);
  readonly typeFilter = signal<ProjectType | null>(null);

  readonly kpis = computed(() => portfolioKpis(this.projects()));

  readonly projectModalOpen = signal(false);
  readonly editing = signal<Project | null>(null);
  readonly templateModalOpen = signal(false);
  readonly templates = signal<ProjectTemplate[]>([]);

  readonly baselineProject = signal<Project | null>(null);
  readonly baselines = signal<ProjectBaseline[]>([]);
  readonly baselineName = signal('');
  readonly variance = signal<BaselineVariance | null>(null);

  readonly projectForm = this.fb.group({
    projectCode: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    context: this.fb.control<Context>('IT'),
    legalEntityId: this.fb.control('', [uuidFormat]),
    customerId: this.fb.control('', [uuidFormat]),
    projectManagerId: this.fb.control('', [uuidFormat]),
    projectType: this.fb.control<ProjectType>('ClientBillable', [Validators.required]),
    billingModel: this.fb.control<(typeof BILLING_MODELS)[number]>('TimeAndMaterials', [Validators.required]),
    costCenterId: this.fb.control('', [uuidFormat]),
    startDate: this.fb.control(''),
    targetEndDate: this.fb.control('', [endsNotBefore('startDate')]),
    cupCode: this.fb.control('', [Validators.pattern(CUP_PATTERN)]),
    cigCode: this.fb.control('', [Validators.pattern(CIG_PATTERN)]),
  });

  readonly templateForm = this.fb.group({
    templateId: this.fb.control('', [Validators.required]),
    projectCode: this.fb.control('', [Validators.required, Validators.maxLength(100)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    customerId: this.fb.control('', [uuidFormat]),
    projectManagerId: this.fb.control('', [uuidFormat]),
    startDate: this.fb.control('', [Validators.required]),
  });

  /** The jurisdiction of the form: CUP and CIG exist for Italian public contracts only. */
  protected readonly context = signal<Context>('IT');

  constructor() {
    revalidateOnStartChange(this.projectForm, 'startDate', 'targetEndDate', this.destroyRef);

    this.projectForm.controls.context.valueChanges.pipe(takeUntilDestroyed()).subscribe((context) => {
      this.context.set(context);

      if (context === 'CH') {
        this.projectForm.patchValue({ cupCode: '', cigCode: '' });
      }
    });
  }

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.error.set(false);

    this.api
      .portfolio({ status: this.statusFilter(), projectType: this.typeFilter(), search: this.search().trim() })
      .subscribe({
        next: (response) => {
          this.projects.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.error.set(true);
        },
      });
  }

  setStatusFilter(status: ProjectStatus | null): void {
    this.statusFilter.set(status);
    this.reload();
  }

  setTypeFilter(type: ProjectType | null): void {
    this.typeFilter.set(type);
    this.reload();
  }

  openCreate(): void {
    this.editing.set(null);
    this.projectForm.reset();
    this.context.set('IT');
    this.projectModalOpen.set(true);
  }

  openEdit(project: Project): void {
    this.editing.set(project);
    const context: Context = project.cupCode || project.cigCode ? 'IT' : this.context();
    this.context.set(context);
    this.projectForm.reset({
      projectCode: project.projectCode,
      name: project.name,
      context,
      legalEntityId: project.legalEntityId ?? '',
      customerId: project.customerId ?? '',
      projectManagerId: project.projectManagerId ?? '',
      projectType: project.projectType,
      billingModel: project.billingModel,
      costCenterId: project.costCenterId ?? '',
      startDate: project.startDate ?? '',
      targetEndDate: project.targetEndDate ?? '',
      cupCode: project.cupCode ?? '',
      cigCode: project.cigCode ?? '',
    });
    this.projectModalOpen.set(true);
  }

  saveProject(): void {
    if (this.projectForm.invalid) {
      this.projectForm.markAllAsTouched();

      return;
    }

    const value = this.projectForm.getRawValue();
    const italian = value.context === 'IT';
    const payload: ProjectPayload = {
      projectCode: value.projectCode.trim(),
      name: value.name.trim(),
      legalEntityId: value.legalEntityId || null,
      customerId: value.customerId || null,
      projectManagerId: value.projectManagerId || null,
      projectType: value.projectType,
      billingModel: value.billingModel,
      costCenterId: value.costCenterId || null,
      startDate: value.startDate || null,
      targetEndDate: value.targetEndDate || null,
      cupCode: italian && value.cupCode ? value.cupCode.toUpperCase() : null,
      cigCode: italian && value.cigCode ? value.cigCode.toUpperCase() : null,
    };
    const current = this.editing();

    this.saving.set(true);
    (current === null ? this.api.create(payload) : this.api.update(current.id, payload)).subscribe({
      next: () => {
        this.saving.set(false);
        this.projectModalOpen.set(false);
        this.message.success(this.i18n.translate('PORTFOLIO.SAVED'));
        this.reload();
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.i18n.translate('PORTFOLIO.SAVE_ERROR'));
      },
    });
  }

  openTemplate(): void {
    this.templateForm.reset();
    this.templateModalOpen.set(true);

    if (this.templates().length === 0) {
      this.api.templates().subscribe({
        next: (response) => this.templates.set(response.data),
        error: () => this.message.error(this.i18n.translate('PORTFOLIO.LOAD_ERROR')),
      });
    }
  }

  createFromTemplate(): void {
    if (this.templateForm.invalid) {
      this.templateForm.markAllAsTouched();

      return;
    }

    const value = this.templateForm.getRawValue();
    this.saving.set(true);
    this.api
      .createFromTemplate({
        templateId: value.templateId,
        projectCode: value.projectCode.trim(),
        name: value.name.trim(),
        customerId: value.customerId || null,
        projectManagerId: value.projectManagerId || null,
        startDate: value.startDate,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.templateModalOpen.set(false);
          this.message.success(this.i18n.translate('PORTFOLIO.CREATED_FROM_TEMPLATE'));
          this.reload();
        },
        error: () => {
          this.saving.set(false);
          this.message.error(this.i18n.translate('PORTFOLIO.SAVE_ERROR'));
        },
      });
  }

  changeStatus(project: Project, status: ProjectStatus): void {
    if (status === project.status) {
      return;
    }

    this.api.changeStatus(project.id, status).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('PORTFOLIO.STATUS_CHANGED'));
        this.reload();
      },
      error: () => {
        this.message.error(this.i18n.translate('PORTFOLIO.SAVE_ERROR'));
        this.reload();
      },
    });
  }

  openBaselines(project: Project): void {
    this.baselineProject.set(project);
    this.baselines.set([]);
    this.variance.set(null);
    this.baselineName.set('');
    this.loadBaselines(project.id);
  }

  closeBaselines(): void {
    this.baselineProject.set(null);
  }

  captureBaseline(): void {
    const project = this.baselineProject();

    if (project === null || this.baselineName().trim() === '') {
      return;
    }

    this.saving.set(true);
    this.api.captureBaseline(project.id, this.baselineName().trim()).subscribe({
      next: () => {
        this.saving.set(false);
        this.baselineName.set('');
        this.message.success(this.i18n.translate('PORTFOLIO.BASELINE_CAPTURED'));
        this.loadBaselines(project.id);
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.i18n.translate('PORTFOLIO.SAVE_ERROR'));
      },
    });
  }

  showVariance(baseline: ProjectBaseline): void {
    const project = this.baselineProject();

    if (project === null) {
      return;
    }

    this.api.variance(project.id, baseline.id).subscribe({
      next: (response) => this.variance.set(response.data),
      error: () => this.message.error(this.i18n.translate('PORTFOLIO.LOAD_ERROR')),
    });
  }

  private loadBaselines(projectId: string): void {
    this.api.baselines(projectId).subscribe({
      next: (response) => this.baselines.set(response.data),
      error: () => this.message.error(this.i18n.translate('PORTFOLIO.LOAD_ERROR')),
    });
  }
}
