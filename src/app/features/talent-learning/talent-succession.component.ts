import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TALENT_CRITICALITIES,
  TALENT_LEVELS,
  TALENT_READINESS_LEVELS,
  TalentCriticality,
  TalentEmployee,
  TalentLearningApiService,
  TalentLevel,
  TalentPositionLookup,
  TalentReadiness,
  TalentSuccessionCandidate,
  TalentSuccessionPosition,
  TranslateService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { blankToNull, keyOf, mutationObserver, tagColor } from './talent-learning.util';

/** Critical positions with their successor candidates, readiness and risk of loss. */
@Component({
  selector: 'app-talent-succession',
  styleUrl: './talent-learning.scss',
  imports: [
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
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
    <app-page-header [title]="'TALENT_LEARNING.SUCCESSION_TITLE' | translate" [subtitle]="'TALENT_LEARNING.SUCCESSION_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openPositionModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="positions()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.POSITION' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.INCUMBENT' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.CRITICALITY' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.VACANCY_RISK' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.COVERAGE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.title }}</td>
              <td>{{ row.incumbent?.full_name }}</td>
              <td><nz-tag [nzColor]="color(row.criticality)">{{ 'TALENT_LEARNING.LEVEL_' + key(row.criticality) | translate }}</nz-tag></td>
              <td><nz-tag [nzColor]="color(row.vacancy_risk)">{{ 'TALENT_LEARNING.LEVEL_' + key(row.vacancy_risk) | translate }}</nz-tag></td>
              <td>@if (row.coverage) { <nz-tag [nzColor]="color(row.coverage)">{{ 'TALENT_LEARNING.COVERAGE_' + key(row.coverage) | translate }}</nz-tag> }</td>
              <td>
                <div class="row-actions">
                  <button nz-button nzType="text" (click)="openCandidates(row)">{{ 'TALENT_LEARNING.SUCCESSORS' | translate }}</button>
                  <button nz-button nzType="text" appIconAction="edit" (click)="openPositionModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removePosition(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && positions().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_POSITIONS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [(nzVisible)]="positionModalVisible" [nzTitle]="(editing() ? 'TALENT_LEARNING.EDIT_POSITION' : 'TALENT_LEARNING.NEW_POSITION') | translate" (nzOnCancel)="positionModalVisible.set(false)" (nzOnOk)="savePosition()" okAction="save" [nzOkDisabled]="positionForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="positionForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label>{{ 'TALENT_LEARNING.HR_POSITION' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="position_id" nzAllowClear nzShowSearch>
                @for (hrPosition of hrPositions(); track hrPosition.id) {
                  <nz-option [nzValue]="hrPosition.id" [nzLabel]="hrPosition.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="position-title">{{ 'TALENT_LEARNING.TITLE' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'TALENT_LEARNING.POSITION_TITLE_HINT' | translate"><input nz-input id="position-title" formControlName="title" maxlength="150" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'TALENT_LEARNING.CRITICALITY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="criticality">
                  @for (level of criticalities; track level) {
                    <nz-option [nzValue]="level" [nzLabel]="'TALENT_LEARNING.LEVEL_' + key(level) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'TALENT_LEARNING.VACANCY_RISK' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="vacancy_risk">
                  @for (level of levels; track level) {
                    <nz-option [nzValue]="level" [nzLabel]="'TALENT_LEARNING.LEVEL_' + key(level) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'TALENT_LEARNING.INCUMBENT' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="incumbent_employee_id" nzAllowClear nzShowSearch>
                @for (employee of employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="position-notes">{{ 'TALENT_LEARNING.NOTES' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="position-notes" rows="3" formControlName="notes"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal appModalActions [(nzVisible)]="candidateModalVisible" [nzTitle]="('TALENT_LEARNING.SUCCESSORS' | translate) + ': ' + (selected()?.title ?? '')" [nzFooter]="null" (nzOnCancel)="candidateModalVisible.set(false)" nzWidth="760px">
      <ng-container *nzModalContent>
        <nz-table #candidateTable [nzData]="selected()?.candidates ?? []" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th class="num">#</th>
              <th>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</th>
              <th>{{ 'TALENT_LEARNING.READINESS' | translate }}</th>
              <th>{{ 'TALENT_LEARNING.POTENTIAL' | translate }}</th>
              <th>{{ 'TALENT_LEARNING.RISK_OF_LOSS' | translate }}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            @for (candidate of candidateTable.data; track candidate.id) {
              <tr>
                <td class="num">{{ candidate.ranking }}</td>
                <td>{{ candidate.employee?.full_name }}</td>
                <td><nz-tag [nzColor]="color(candidate.readiness)">{{ 'TALENT_LEARNING.READINESS_' + key(candidate.readiness) | translate }}</nz-tag></td>
                <td>{{ 'TALENT_LEARNING.LEVEL_' + key(candidate.potential) | translate }}</td>
                <td><nz-tag [nzColor]="color(candidate.risk_of_loss)">{{ 'TALENT_LEARNING.LEVEL_' + key(candidate.risk_of_loss) | translate }}</nz-tag></td>
                <td>
                  <button nz-button nzType="text" appIconAction="edit" (click)="editCandidate(candidate)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeCandidate(candidate)"></button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>

        <form nz-form [formGroup]="candidateForm" nzLayout="vertical" class="main-card">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="employee_id" nzShowSearch [nzDisabled]="editingCandidate() !== null">
                @for (employee of employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'TALENT_LEARNING.READINESS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="readiness">
                  @for (level of readinessLevels; track level) {
                    <nz-option [nzValue]="level" [nzLabel]="'TALENT_LEARNING.READINESS_' + key(level) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'TALENT_LEARNING.POTENTIAL' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="potential">
                  @for (level of levels; track level) {
                    <nz-option [nzValue]="level" [nzLabel]="'TALENT_LEARNING.LEVEL_' + key(level) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'TALENT_LEARNING.RISK_OF_LOSS' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="risk_of_loss">
                  @for (level of levels; track level) {
                    <nz-option [nzValue]="level" [nzLabel]="'TALENT_LEARNING.LEVEL_' + key(level) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="candidate-ranking">{{ 'TALENT_LEARNING.RANKING' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="candidate-ranking" type="number" min="1" max="999" formControlName="ranking" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label nzFor="candidate-plan">{{ 'TALENT_LEARNING.DEVELOPMENT_PLAN' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="candidate-plan" rows="2" formControlName="development_plan"></textarea></nz-form-control>
          </nz-form-item>
          <button nz-button nzType="primary" type="button" [disabled]="candidateForm.invalid" (click)="addCandidate()">{{ (editingCandidate() ? 'TALENT_LEARNING.SAVE_SUCCESSOR' : 'TALENT_LEARNING.ADD_SUCCESSOR') | translate }}</button>
          @if (editingCandidate()) {
            <button nz-button type="button" (click)="cancelCandidateEdit()">{{ 'TALENT_LEARNING.CANCEL' | translate }}</button>
          }
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TalentSuccessionComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly criticalities = TALENT_CRITICALITIES;
  readonly levels = TALENT_LEVELS;
  readonly readinessLevels = TALENT_READINESS_LEVELS;
  readonly color = tagColor;
  readonly key = keyOf;

  readonly positions = signal<TalentSuccessionPosition[]>([]);
  readonly employees = signal<TalentEmployee[]>([]);
  readonly hrPositions = signal<TalentPositionLookup[]>([]);
  readonly loading = signal(false);
  readonly editing = signal<TalentSuccessionPosition | null>(null);
  readonly selected = signal<TalentSuccessionPosition | null>(null);
  readonly positionModalVisible = signal(false);
  readonly candidateModalVisible = signal(false);
  /** Successor loaded in the form: saving updates it instead of adding a new one. */
  readonly editingCandidate = signal<TalentSuccessionCandidate | null>(null);

  readonly positionForm = this.fb.group({
    position_id: this.fb.control<string | null>(null),
    title: ['', [Validators.maxLength(150)]],
    criticality: this.fb.control<TalentCriticality>('medium'),
    vacancy_risk: this.fb.control<TalentLevel>('medium'),
    incumbent_employee_id: this.fb.control<string | null>(null),
    notes: [''],
  });

  readonly candidateForm = this.fb.group({
    employee_id: ['', Validators.required],
    readiness: this.fb.control<TalentReadiness>('ready_1_2_years'),
    risk_of_loss: this.fb.control<TalentLevel>('low'),
    potential: this.fb.control<TalentLevel>('medium'),
    ranking: [1, [Validators.required, Validators.min(1), Validators.max(999)]],
    development_plan: [''],
  });

  ngOnInit(): void {
    this.api.getEmployeeLookup().subscribe((response) => this.employees.set(response.data));
    this.api.getPositionLookup().subscribe((response) => this.hrPositions.set(response.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getSuccessionPositions().subscribe({
      next: (response) => {
        this.positions.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
  }

  openPositionModal(position: TalentSuccessionPosition | null = null): void {
    this.editing.set(position);
    this.positionForm.reset({
      position_id: position?.position_id ?? null,
      title: position?.title ?? '',
      criticality: position?.criticality ?? 'medium',
      vacancy_risk: position?.vacancy_risk ?? 'medium',
      incumbent_employee_id: position?.incumbent_employee_id ?? null,
      notes: position?.notes ?? '',
    });
    this.positionModalVisible.set(true);
  }

  savePosition(): void {
    const value = this.positionForm.getRawValue();
    const current = this.editing();
    const payload = {
      position_id: value.position_id,
      title: blankToNull(value.title),
      incumbent_employee_id: value.incumbent_employee_id,
      criticality: value.criticality,
      vacancy_risk: value.vacancy_risk,
      status: current?.status ?? ('active' as const),
      notes: blankToNull(value.notes),
    };
    const request = current ? this.api.updateSuccessionPosition(current.id, payload) : this.api.createSuccessionPosition(payload);
    request.subscribe(mutationObserver(this.message, this.translate, () => {
      this.positionModalVisible.set(false);
      this.load();
    }));
  }

  removePosition(position: TalentSuccessionPosition): void {
    this.api.deleteSuccessionPosition(position.id).subscribe(mutationObserver(this.message, this.translate, () => this.load()));
  }

  openCandidates(position: TalentSuccessionPosition): void {
    this.candidateForm.reset({ employee_id: '', readiness: 'ready_1_2_years', risk_of_loss: 'low', potential: 'medium', ranking: (position.candidates?.length ?? 0) + 1, development_plan: '' });
    this.refreshSelected(position.id);
    this.candidateModalVisible.set(true);
  }

  addCandidate(): void {
    const position = this.selected();
    if (!position) {
      return;
    }
    const value = this.candidateForm.getRawValue();
    const current = this.editingCandidate();
    if (current) {
      this.api
        .updateCandidate(current.id, {
          readiness: value.readiness,
          risk_of_loss: value.risk_of_loss,
          potential: value.potential,
          ranking: value.ranking,
          development_plan: blankToNull(value.development_plan),
        })
        .subscribe(mutationObserver(this.message, this.translate, () => {
          this.cancelCandidateEdit();
          this.refreshSelected(position.id);
          this.load();
        }));
      return;
    }
    this.api
      .createCandidate(position.id, {
        employee_id: value.employee_id,
        readiness: value.readiness,
        risk_of_loss: value.risk_of_loss,
        potential: value.potential,
        ranking: value.ranking,
        development_plan: blankToNull(value.development_plan),
      })
      .subscribe(mutationObserver(this.message, this.translate, () => {
        this.candidateForm.patchValue({ employee_id: '', ranking: (position.candidates?.length ?? 0) + 2, development_plan: '' });
        this.refreshSelected(position.id);
        this.load();
      }));
  }

  editCandidate(candidate: TalentSuccessionCandidate): void {
    this.editingCandidate.set(candidate);
    this.candidateForm.reset({
      employee_id: candidate.employee_id,
      readiness: candidate.readiness,
      risk_of_loss: candidate.risk_of_loss,
      potential: candidate.potential,
      ranking: candidate.ranking,
      development_plan: candidate.development_plan ?? '',
    });
  }

  cancelCandidateEdit(): void {
    const position = this.selected();
    this.editingCandidate.set(null);
    this.candidateForm.reset({ employee_id: '', readiness: 'ready_1_2_years', risk_of_loss: 'low', potential: 'medium', ranking: (position?.candidates?.length ?? 0) + 1, development_plan: '' });
  }

  removeCandidate(candidate: TalentSuccessionCandidate): void {
    this.api.deleteCandidate(candidate.id).subscribe(mutationObserver(this.message, this.translate, () => {
      this.refreshSelected(candidate.succession_position_id);
      this.load();
    }));
  }

  private refreshSelected(id: string): void {
    this.api.getSuccessionPosition(id).subscribe((response) => this.selected.set(response.data));
  }
}
