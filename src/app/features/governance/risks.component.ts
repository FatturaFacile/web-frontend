import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  GovControl,
  GovDashboard,
  GovHeatmapCell,
  GovernanceApiService,
  GovMember,
  GovRisk,
  GovRiskRequest,
  I18nService,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { GovernanceAccess } from './governance-access.service';
import { GovTransitionChoice, GovTransitionModalComponent } from './gov-transition-modal.component';
import {
  GOV_NOTES_REQUIRED,
  GOV_RISK_CATEGORIES,
  GOV_RISK_TRANSITIONS,
  GOV_TREATMENTS,
  govDateOrNull,
  govHeatmapRows,
  govOptions,
  govRatingColor,
  govRatingOfScore,
  govStatusColor,
} from './governance.shared';

/** Risk register with the dashboard figures, the heatmap and the treatment flow of every risk. */
@Component({
  selector: 'app-governance-risks',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    DatePipe,
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzRadioModule,
    NzSelectModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    GovTransitionModalComponent,
  ],
  styles: `
    .gov-kpis {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
      margin-bottom: 16px;
    }
    .gov-layout {
      display: grid;
      grid-template-columns: minmax(320px, 420px) 1fr;
      gap: 16px;
      align-items: start;
    }
    @media (max-width: 1100px) {
      .gov-layout {
        grid-template-columns: 1fr;
      }
    }
    .heatmap {
      border-collapse: separate;
      border-spacing: 3px;
      margin: 0 auto;
    }
    .heatmap th {
      font-weight: 500;
      font-size: 12px;
      text-align: center;
      padding: 2px 4px;
    }
    .heatmap-cell {
      width: 52px;
      height: 44px;
      border: 2px solid transparent;
      border-radius: 6px;
      font-weight: 600;
      cursor: pointer;
      color: #1f1f1f;
    }
    .heatmap-cell.is-selected {
      border-color: #1677ff;
    }
    .heatmap-cell.rating-low {
      background: #d9f7be;
    }
    .heatmap-cell.rating-medium {
      background: #fff1b8;
    }
    .heatmap-cell.rating-high {
      background: #ffd8a8;
    }
    .heatmap-cell.rating-critical {
      background: #ffa39e;
    }
    .heatmap-axis {
      text-align: center;
      font-size: 12px;
      opacity: 0.7;
      margin-top: 4px;
    }
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 12px;
    }
    .toolbar nz-select,
    .toolbar input {
      min-width: 160px;
    }
    .row-actions {
      display: flex;
      gap: 4px;
      flex-wrap: wrap;
    }
    .overdue {
      color: #cf1322;
    }
    .w-full {
      width: 100%;
    }
    .score-preview {
      margin-bottom: 12px;
    }
  `,
  template: `
    <app-page-header [title]="'GOVERNANCE.RISKS.TITLE' | translate" [subtitle]="'GOVERNANCE.RISKS.SUBTITLE' | translate">
      @if (access.canManage()) {
        <button nz-button nzType="primary" appIconAction="create" (click)="openCreate()"></button>
      }
    </app-page-header>

    @if (dashboard(); as board) {
      <div class="gov-kpis">
        <nz-card><nz-statistic [nzValue]="board.risks.total" [nzTitle]="'GOVERNANCE.KPI.OPEN_RISKS' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.risks.by_rating.critical" [nzTitle]="'GOVERNANCE.KPI.CRITICAL_RISKS' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.risks.review_overdue" [nzTitle]="'GOVERNANCE.KPI.REVIEW_OVERDUE' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.findings.open_total" [nzTitle]="'GOVERNANCE.KPI.OPEN_FINDINGS' | translate"></nz-statistic></nz-card>
        <nz-card><nz-statistic [nzValue]="board.actions.overdue" [nzTitle]="'GOVERNANCE.KPI.OVERDUE_ACTIONS' | translate"></nz-statistic></nz-card>
        <nz-card>
          <nz-statistic
            [nzValue]="board.controls.pass_rate === null ? '-' : board.controls.pass_rate + '%'"
            [nzTitle]="'GOVERNANCE.KPI.PASS_RATE' | translate"
          ></nz-statistic>
        </nz-card>
      </div>
    }

    <div class="gov-layout">
      <nz-card [nzTitle]="'GOVERNANCE.HEATMAP.TITLE' | translate">
        <nz-radio-group [ngModel]="basis()" (ngModelChange)="changeBasis($event)" nzButtonStyle="solid" nzSize="small">
          <label nz-radio-button nzValue="residual">{{ 'GOVERNANCE.HEATMAP.RESIDUAL' | translate }}</label>
          <label nz-radio-button nzValue="inherent">{{ 'GOVERNANCE.HEATMAP.INHERENT' | translate }}</label>
        </nz-radio-group>
        <table class="heatmap" [attr.aria-label]="'GOVERNANCE.HEATMAP.TITLE' | translate">
          <thead>
            <tr>
              <th></th>
              @for (impact of scale; track impact) {
                <th>{{ impact }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (row of heatmapRows(); track $index) {
              <tr>
                <th>{{ row[0]?.likelihood }}</th>
                @for (cell of row; track cell.impact) {
                  <td>
                    <button
                      type="button"
                      class="heatmap-cell"
                      [class]="'heatmap-cell rating-' + cell.rating + (isSelected(cell) ? ' is-selected' : '')"
                      [attr.aria-label]="cell.likelihood + ' x ' + cell.impact + ': ' + cell.count"
                      (click)="toggleCell(cell)"
                    >
                      {{ cell.count > 0 ? cell.count : '' }}
                    </button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </table>
        <div class="heatmap-axis">{{ 'GOVERNANCE.HEATMAP.AXES' | translate }}</div>
      </nz-card>

      <nz-card>
        <div class="toolbar">
          <input nz-input [ngModel]="search()" (ngModelChange)="search.set($event)" (keyup.enter)="load()" [placeholder]="'GOVERNANCE.COMMON.SEARCH' | translate" />
          <nz-select [ngModel]="statusFilter()" (ngModelChange)="statusFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.COMMON.STATUS' | translate">
            @for (status of statuses; track status) {
              <nz-option [nzValue]="status" [nzLabel]="'GOVERNANCE.RISK_STATUS.' + status.toUpperCase() | translate"></nz-option>
            }
          </nz-select>
          <nz-select [ngModel]="categoryFilter()" (ngModelChange)="categoryFilter.set($event); load()" nzAllowClear [nzPlaceHolder]="'GOVERNANCE.COMMON.CATEGORY' | translate">
            @for (option of categoryOptions; track option.value) {
              <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
            }
          </nz-select>
          <button nz-button (click)="load()"><i class="fa-solid fa-rotate"></i></button>
        </div>

        <nz-table #riskTable [nzData]="visibleRisks()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="15">
          <thead>
            <tr>
              <th>{{ 'GOVERNANCE.COMMON.CODE' | translate }}</th>
              <th>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</th>
              <th>{{ 'GOVERNANCE.COMMON.CATEGORY' | translate }}</th>
              <th>{{ 'GOVERNANCE.RISKS.INHERENT' | translate }}</th>
              <th>{{ 'GOVERNANCE.RISKS.RESIDUAL' | translate }}</th>
              <th>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</th>
              <th>{{ 'GOVERNANCE.COMMON.STATUS' | translate }}</th>
              <th>{{ 'GOVERNANCE.RISKS.NEXT_REVIEW' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (risk of riskTable.data; track risk.id) {
              <tr>
                <td>{{ risk.code }}</td>
                <td>{{ risk.title }}</td>
                <td>{{ 'GOVERNANCE.CATEGORY.' + risk.category.toUpperCase() | translate }}</td>
                <td><nz-tag [nzColor]="ratingColor(risk.inherent_rating)">{{ risk.inherent_score }}</nz-tag></td>
                <td>
                  @if (risk.residual_score !== null && risk.residual_score !== undefined) {
                    <nz-tag [nzColor]="ratingColor(risk.residual_rating)">{{ risk.residual_score }}</nz-tag>
                  } @else {
                    -
                  }
                </td>
                <td>{{ risk.owner?.name || '-' }}</td>
                <td><nz-tag [nzColor]="statusColor(risk.status)">{{ 'GOVERNANCE.RISK_STATUS.' + risk.status.toUpperCase() | translate }}</nz-tag></td>
                <td [class.overdue]="risk.is_review_overdue">{{ risk.next_review_date ? (risk.next_review_date | date: 'dd/MM/yyyy') : '-' }}</td>
                <td>
                  <div class="row-actions">
                    @if (access.canManage()) {
                      <button nz-button nzSize="small" appIconAction="edit" (click)="openEdit(risk)"></button>
                      <button nz-button nzSize="small" [title]="'GOVERNANCE.RISKS.LINK_CONTROLS' | translate" (click)="openControls(risk)"><i class="fa-solid fa-link"></i></button>
                      @if (nextStatuses(risk).length > 0) {
                        <button nz-button nzSize="small" [title]="'GOVERNANCE.TRANSITION.TITLE' | translate" (click)="openTransition(risk)"><i class="fa-solid fa-right-left"></i></button>
                      }
                      <button
                        nz-button
                        nzSize="small"
                        nzDanger
                        appIconAction="delete"
                        nz-popconfirm
                        [nzPopconfirmTitle]="'GOVERNANCE.COMMON.CONFIRM_DELETE' | translate"
                        (nzOnConfirm)="remove(risk)"
                      ></button>
                    }
                  </div>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    </div>

    <nz-modal
      [(nzVisible)]="formVisible"
      [nzTitle]="(editing() ? 'GOVERNANCE.RISKS.EDIT' : 'GOVERNANCE.RISKS.NEW') | translate"
      okAction="save"
      [nzOkDisabled]="form.invalid"
      nzWidth="720px"
      (nzOnCancel)="formVisible.set(false)"
      (nzOnOk)="save()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="errorTip('title')"><input nz-input formControlName="title" maxlength="190" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.COMMON.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="2" formControlName="description" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.COMMON.CATEGORY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('category')">
                <nz-select formControlName="category" class="w-full">
                  @for (option of categoryOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.COMMON.OWNER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('owner_id')">
                <nz-select formControlName="owner_id" nzAllowClear class="w-full">
                  @for (member of members(); track member.id) {
                    <nz-option [nzValue]="member.id" [nzLabel]="member.name"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.RISKS.LIKELIHOOD' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('likelihood')">
                <nz-select formControlName="likelihood">
                  @for (value of scale; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'' + value"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'GOVERNANCE.RISKS.IMPACT' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('impact')">
                <nz-select formControlName="impact">
                  @for (value of scale; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'' + value"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.RISKS.RESIDUAL_LIKELIHOOD' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('residual_likelihood')">
                <nz-select formControlName="residual_likelihood" nzAllowClear>
                  @for (value of scale; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'' + value"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.RISKS.RESIDUAL_IMPACT' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('residual_impact')">
                <nz-select formControlName="residual_impact" nzAllowClear>
                  @for (value of scale; track value) {
                    <nz-option [nzValue]="value" [nzLabel]="'' + value"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="score-preview">
            {{ 'GOVERNANCE.RISKS.INHERENT' | translate }}:
            <nz-tag [nzColor]="ratingColor(previewRating())">{{ previewScore() }}</nz-tag>
            @if (previewResidualScore() !== null) {
              {{ 'GOVERNANCE.RISKS.RESIDUAL' | translate }}:
              <nz-tag [nzColor]="ratingColor(previewResidualRating())">{{ previewResidualScore() }}</nz-tag>
            }
          </div>
          <div class="toolbar">
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.RISKS.TREATMENT' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="treatment" nzAllowClear class="w-full">
                  @for (option of treatmentOptions; track option.value) {
                    <nz-option [nzValue]="option.value" [nzLabel]="option.labelKey | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'GOVERNANCE.RISKS.NEXT_REVIEW' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="errorTip('next_review_date')"><input nz-input type="date" formControlName="next_review_date" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'GOVERNANCE.RISKS.TREATMENT_NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input rows="2" formControlName="treatment_notes" maxlength="4000"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [(nzVisible)]="controlsVisible"
      [nzTitle]="'GOVERNANCE.RISKS.LINK_CONTROLS' | translate"
      okAction="save"
      (nzOnCancel)="controlsVisible.set(false)"
      (nzOnOk)="saveControls()"
    >
      <ng-container *nzModalContent>
        <nz-select class="w-full" nzMode="multiple" [ngModel]="linkedControlIds()" (ngModelChange)="linkedControlIds.set($event)">
          @for (control of controls(); track control.id) {
            <nz-option [nzValue]="control.id" [nzLabel]="control.code + ' ' + control.title"></nz-option>
          }
        </nz-select>
      </ng-container>
    </nz-modal>

    <app-gov-transition-modal
      [(visible)]="transitionVisible"
      statusKeyPrefix="GOVERNANCE.RISK_STATUS"
      [targets]="transitionTargets()"
      [notesRequiredFor]="notesRequiredFor"
      (confirmed)="applyTransition($event)"
    />
  `,
})
export class GovernanceRisksComponent implements OnInit {
  protected readonly access = inject(GovernanceAccess);
  private readonly api = inject(GovernanceApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly scale = [1, 2, 3, 4, 5];
  protected readonly statuses = Object.keys(GOV_RISK_TRANSITIONS);
  protected readonly categoryOptions = govOptions('GOVERNANCE.CATEGORY', GOV_RISK_CATEGORIES);
  protected readonly treatmentOptions = govOptions('GOVERNANCE.TREATMENT', GOV_TREATMENTS);
  protected readonly notesRequiredFor = GOV_NOTES_REQUIRED['risk'];
  protected readonly ratingColor = govRatingColor;
  protected readonly statusColor = govStatusColor;

  protected readonly risks = signal<GovRisk[]>([]);
  protected readonly loading = signal(false);
  protected readonly dashboard = signal<GovDashboard | null>(null);
  protected readonly members = signal<GovMember[]>([]);
  protected readonly controls = signal<GovControl[]>([]);
  protected readonly basis = signal<'residual' | 'inherent'>('residual');
  protected readonly search = signal('');
  protected readonly statusFilter = signal<string | null>(null);
  protected readonly categoryFilter = signal<string | null>(null);
  protected readonly cellFilter = signal<{ likelihood: number; impact: number } | null>(null);

  protected readonly formVisible = signal(false);
  protected readonly editing = signal<GovRisk | null>(null);
  protected readonly controlsVisible = signal(false);
  protected readonly linkedControlIds = signal<string[]>([]);
  protected readonly transitionVisible = signal(false);
  protected readonly transitionTargets = signal<readonly string[]>([]);
  private readonly selected = signal<GovRisk | null>(null);

  protected readonly heatmapRows = computed(() => govHeatmapRows(this.dashboard()?.risks.heatmap ?? []));

  /** The risks of the list narrowed to the selected cell of the heatmap (on the score the heatmap is drawn with). */
  protected readonly visibleRisks = computed(() => {
    const cell = this.cellFilter();
    if (cell === null) {
      return this.risks();
    }
    const residual = this.basis() === 'residual';
    return this.risks().filter((risk) => {
      const useResidual = residual && risk.residual_likelihood != null && risk.residual_impact != null;
      const likelihood = useResidual ? risk.residual_likelihood : risk.likelihood;
      const impact = useResidual ? risk.residual_impact : risk.impact;
      return likelihood === cell.likelihood && impact === cell.impact && risk.status !== 'closed';
    });
  });

  protected readonly form = this.fb.group({
    title: ['', [Validators.required, Validators.maxLength(190)]],
    description: [''],
    category: ['operational', [Validators.required]],
    likelihood: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    impact: [3, [Validators.required, Validators.min(1), Validators.max(5)]],
    residual_likelihood: [null as number | null],
    residual_impact: [null as number | null],
    treatment: [null as string | null],
    treatment_notes: [''],
    owner_id: [null as string | null],
    next_review_date: [''],
  });

  private readonly formValue = signal(this.form.getRawValue());

  protected readonly previewScore = computed(() => this.formValue().likelihood * this.formValue().impact);
  protected readonly previewRating = computed(() => govRatingOfScore(this.previewScore()));
  protected readonly previewResidualScore = computed(() => {
    const { residual_likelihood, residual_impact } = this.formValue();
    return residual_likelihood && residual_impact ? residual_likelihood * residual_impact : null;
  });
  protected readonly previewResidualRating = computed(() => govRatingOfScore(this.previewResidualScore() ?? 0));

  constructor() {
    this.form.valueChanges.subscribe(() => this.formValue.set(this.form.getRawValue()));
  }

  ngOnInit(): void {
    this.load();
    this.loadDashboard();
    this.api.getMembers().subscribe({ next: (res) => this.members.set(res.data) });
  }

  load(): void {
    this.loading.set(true);
    this.api
      .getRisks({
        per_page: 100,
        status: this.statusFilter() ?? undefined,
        category: this.categoryFilter() ?? undefined,
        search: this.search() || undefined,
      })
      .subscribe({
        next: (res) => {
          this.risks.set(res.data);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  loadDashboard(): void {
    this.api.getDashboard(this.basis()).subscribe({ next: (res) => this.dashboard.set(res.data) });
  }

  changeBasis(basis: 'residual' | 'inherent'): void {
    this.basis.set(basis);
    this.loadDashboard();
  }

  isSelected(cell: GovHeatmapCell): boolean {
    const selected = this.cellFilter();
    return selected !== null && selected.likelihood === cell.likelihood && selected.impact === cell.impact;
  }

  toggleCell(cell: GovHeatmapCell): void {
    this.cellFilter.set(this.isSelected(cell) ? null : { likelihood: cell.likelihood, impact: cell.impact });
  }

  nextStatuses(risk: GovRisk): readonly string[] {
    return GOV_RISK_TRANSITIONS[risk.status];
  }

  errorTip(path: string): string {
    const control = this.form.get(path);
    if (control?.hasError('serverError')) {
      return String(control.errors?.['serverError']);
    }
    return control?.hasError('required') ? this.i18n.translate('COMMON.VALIDATION.REQUIRED') : '';
  }

  openCreate(): void {
    this.editing.set(null);
    this.form.reset({
      title: '',
      description: '',
      category: 'operational',
      likelihood: 3,
      impact: 3,
      residual_likelihood: null,
      residual_impact: null,
      treatment: null,
      treatment_notes: '',
      owner_id: null,
      next_review_date: '',
    });
    this.formVisible.set(true);
  }

  openEdit(risk: GovRisk): void {
    this.editing.set(risk);
    this.form.reset({
      title: risk.title,
      description: risk.description ?? '',
      category: risk.category,
      likelihood: risk.likelihood,
      impact: risk.impact,
      residual_likelihood: risk.residual_likelihood ?? null,
      residual_impact: risk.residual_impact ?? null,
      treatment: risk.treatment ?? null,
      treatment_notes: risk.treatment_notes ?? '',
      owner_id: risk.owner_id ?? null,
      next_review_date: risk.next_review_date ?? '',
    });
    this.formVisible.set(true);
  }

  save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: GovRiskRequest = {
      title: value.title,
      description: value.description || null,
      category: value.category as GovRiskRequest['category'],
      likelihood: value.likelihood,
      impact: value.impact,
      residual_likelihood: value.residual_likelihood,
      residual_impact: value.residual_impact,
      treatment: value.treatment as GovRiskRequest['treatment'],
      treatment_notes: value.treatment_notes || null,
      owner_id: value.owner_id,
      next_review_date: govDateOrNull(value.next_review_date),
    };
    const editing = this.editing();
    const request = editing ? this.api.updateRisk(editing.id, payload) : this.api.createRisk(payload);
    request.subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.formVisible.set(false);
        this.load();
        this.loadDashboard();
      },
      error: (error: unknown) => this.showErrors(error),
    });
  }

  remove(risk: GovRisk): void {
    this.api.deleteRisk(risk.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.DELETED'));
        this.load();
        this.loadDashboard();
      },
      error: (error: unknown) => this.showErrors(error),
    });
  }

  openControls(risk: GovRisk): void {
    this.selected.set(risk);
    this.api.getControls({ per_page: 100, status: 'active' }).subscribe({ next: (res) => this.controls.set(res.data) });
    this.api.getRisk(risk.id).subscribe({
      next: (res) => {
        this.linkedControlIds.set((res.data.controls ?? []).map((control) => control.id));
        this.controls.update((list) => {
          const known = new Set(list.map((control) => control.id));
          return [...list, ...(res.data.controls ?? []).filter((control) => !known.has(control.id))];
        });
        this.controlsVisible.set(true);
      },
    });
  }

  saveControls(): void {
    const risk = this.selected();
    if (risk === null) {
      return;
    }
    this.api.syncRiskControls(risk.id, { control_ids: this.linkedControlIds() }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.controlsVisible.set(false);
      },
      error: (error: unknown) => this.showErrors(error),
    });
  }

  openTransition(risk: GovRisk): void {
    this.selected.set(risk);
    this.transitionTargets.set(this.nextStatuses(risk));
    this.transitionVisible.set(true);
  }

  applyTransition(choice: GovTransitionChoice): void {
    const risk = this.selected();
    if (risk === null) {
      return;
    }
    this.api.transitionRisk(risk.id, { status: choice.status, notes: choice.notes }).subscribe({
      next: () => {
        this.message.success(this.translate.instant('GOVERNANCE.COMMON.SAVED'));
        this.load();
        this.loadDashboard();
      },
      error: (error: unknown) => this.showErrors(error),
    });
  }

  private showErrors(error: unknown): void {
    const unmapped = applyServerErrors(this.form, error);
    const text = unmapped[0] ?? (error as { error?: { message?: string } })?.error?.message;
    if (text) {
      this.message.error(text);
    }
  }
}
