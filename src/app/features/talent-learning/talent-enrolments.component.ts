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
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TalentCourse, TalentEmployee, TalentEnrolment, TalentLearningApiService, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { blankToNull, keyOf, mutationObserver, tagColor } from './talent-learning.util';

/** Enrolments with progress tracking, completion (pass score) and the completion certificate. */
@Component({
  selector: 'app-talent-enrolments',
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
    NzProgressModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'TALENT_LEARNING.ENROLMENTS_TITLE' | translate" [subtitle]="'TALENT_LEARNING.ENROLMENTS_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card">
      <nz-table #table [nzData]="enrolments()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.COURSE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.DUE_ON' | translate }}</th>
            <th style="width: 160px">{{ 'TALENT_LEARNING.PROGRESS' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.CERTIFICATE' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.employee?.full_name }}</td>
              <td>{{ row.course?.title }}</td>
              <td [class.row-overdue]="row.is_overdue">{{ row.due_on }}</td>
              <td><nz-progress [nzPercent]="row.progress_percent" nzSize="small"></nz-progress></td>
              <td><nz-tag [nzColor]="color(row.status)">{{ 'TALENT_LEARNING.ENROLMENT_' + key(row.status) | translate }}</nz-tag></td>
              <td>{{ row.certificate?.certificate_number }}</td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'enrolled' || row.status === 'in_progress') {
                    <button nz-button nzType="text" (click)="openProgress(row)">{{ 'TALENT_LEARNING.UPDATE_PROGRESS' | translate }}</button>
                    <button nz-button nzType="text" (click)="openComplete(row)">{{ 'TALENT_LEARNING.COMPLETE' | translate }}</button>
                    <button nz-button nzType="text" nzDanger nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.CANCEL_CONFIRM' | translate" (nzOnConfirm)="cancel(row)">{{ 'TALENT_LEARNING.CANCEL' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && enrolments().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_ENROLMENTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal [(nzVisible)]="modalVisible" [nzTitle]="'TALENT_LEARNING.NEW_ENROLMENT' | translate" (nzOnCancel)="modalVisible.set(false)" (nzOnOk)="save()" okAction="save" [nzOkDisabled]="form.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="form" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TALENT_LEARNING.COURSE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="course_id" nzShowSearch>
                @for (course of courses(); track course.id) {
                  <nz-option [nzValue]="course.id" [nzLabel]="course.code + ' - ' + course.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TALENT_LEARNING.EMPLOYEE' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="employee_id" nzShowSearch>
                @for (employee of employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="enrolment-due">{{ 'TALENT_LEARNING.DUE_ON' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="enrolment-due" type="date" formControlName="due_on" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="progressVisible" [nzTitle]="'TALENT_LEARNING.UPDATE_PROGRESS' | translate" (nzOnCancel)="progressVisible.set(false)" (nzOnOk)="saveProgress()" okAction="save" [nzOkDisabled]="progressForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="progressForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="progress-percent">{{ 'TALENT_LEARNING.PROGRESS' | translate }} (%)</nz-form-label>
            <nz-form-control><input nz-input id="progress-percent" type="number" min="0" max="100" formControlName="progress_percent" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="completeVisible" [nzTitle]="'TALENT_LEARNING.COMPLETE' | translate" (nzOnCancel)="completeVisible.set(false)" (nzOnOk)="saveComplete()" okAction="save" [nzOkDisabled]="completeForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="completeForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzFor="complete-score">{{ 'TALENT_LEARNING.SCORE' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="passScoreHint()"><input nz-input id="complete-score" type="number" min="0" max="100" step="any" formControlName="score" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TalentEnrolmentsComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly color = tagColor;
  readonly key = keyOf;
  readonly enrolments = signal<TalentEnrolment[]>([]);
  readonly courses = signal<TalentCourse[]>([]);
  readonly employees = signal<TalentEmployee[]>([]);
  readonly loading = signal(false);
  readonly modalVisible = signal(false);
  readonly progressVisible = signal(false);
  readonly completeVisible = signal(false);
  readonly target = signal<TalentEnrolment | null>(null);

  readonly form = this.fb.group({
    course_id: ['', Validators.required],
    employee_id: ['', Validators.required],
    due_on: [''],
  });

  readonly progressForm = this.fb.group({
    progress_percent: this.fb.control<number>(0, [Validators.required, Validators.min(0), Validators.max(100)]),
  });

  readonly completeForm = this.fb.group({
    score: this.fb.control<number | null>(null, [Validators.min(0), Validators.max(100)]),
  });

  ngOnInit(): void {
    this.api.getEmployeeLookup().subscribe((response) => this.employees.set(response.data));
    this.api.getCourses({ status: 'published', per_page: 100 }).subscribe((response) => this.courses.set(response.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getEnrolments({ per_page: 100 }).subscribe({
      next: (response) => {
        this.enrolments.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
  }

  passScoreHint(): string {
    const passScore = this.target()?.course?.pass_score ?? null;
    return passScore === null ? '' : this.translate.instant('TALENT_LEARNING.PASS_SCORE_HINT', { score: passScore });
  }

  openModal(): void {
    this.form.reset({ course_id: '', employee_id: '', due_on: '' });
    this.modalVisible.set(true);
  }

  save(): void {
    const value = this.form.getRawValue();
    this.api.createEnrolment({ course_id: value.course_id, employee_id: value.employee_id, due_on: blankToNull(value.due_on) }).subscribe(this.observer(() => this.modalVisible.set(false)));
  }

  openProgress(enrolment: TalentEnrolment): void {
    this.target.set(enrolment);
    this.progressForm.reset({ progress_percent: enrolment.progress_percent });
    this.progressVisible.set(true);
  }

  saveProgress(): void {
    const target = this.target();
    if (!target) {
      return;
    }
    this.api.updateEnrolmentProgress(target.id, this.progressForm.getRawValue().progress_percent).subscribe(this.observer(() => this.progressVisible.set(false)));
  }

  openComplete(enrolment: TalentEnrolment): void {
    this.target.set(enrolment);
    this.completeForm.reset({ score: null });
    this.completeVisible.set(true);
  }

  saveComplete(): void {
    const target = this.target();
    if (!target) {
      return;
    }
    this.api.completeEnrolment(target.id, this.completeForm.getRawValue().score).subscribe(this.observer(() => this.completeVisible.set(false)));
  }

  cancel(enrolment: TalentEnrolment): void {
    this.api.cancelEnrolment(enrolment.id).subscribe(this.observer());
  }

  private observer(onSuccess?: () => void): { next: () => void; error: (error: unknown) => void } {
    return mutationObserver(this.message, this.translate, () => {
      onSuccess?.();
      this.load();
    });
  }
}
