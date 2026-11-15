import { DecimalPipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TALENT_DELIVERIES, TalentCourse, TalentCourseRequest, TalentDelivery, TalentEmployee, TalentLearningApiService, TalentLearningPath, TranslateService } from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { blankToNull, keyOf, mutationObserver, tagColor } from './talent-learning.util';

/** Course catalog and learning paths (ordered sets of courses) with bulk enrolment. */
@Component({
  selector: 'app-talent-courses',
  styleUrl: './talent-learning.scss',
  imports: [
    DecimalPipe,
    ReactiveFormsModule,
    IconActionDirective,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
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
    <app-page-header [title]="'TALENT_LEARNING.COURSES_TITLE' | translate" [subtitle]="'TALENT_LEARNING.COURSES_SUBTITLE' | translate">
      <button nz-button nzType="primary" (click)="openCourseModal()" appIconAction="create"></button>
    </app-page-header>

    <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.CATALOG' | translate">
      <nz-table #courseTable [nzData]="courses()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.CODE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.TITLE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.DELIVERY' | translate }}</th>
            <th class="num">{{ 'TALENT_LEARNING.DURATION_HOURS' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.MANDATORY' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of courseTable.data; track row.id) {
            <tr>
              <td>{{ row.code }}</td>
              <td>{{ row.title }}</td>
              <td>{{ 'TALENT_LEARNING.DELIVERY_' + key(row.delivery) | translate }}</td>
              <td class="num">{{ row.duration_hours | number: '1.0-2' }}</td>
              <td>@if (row.is_mandatory) { <nz-tag nzColor="red">{{ 'TALENT_LEARNING.MANDATORY' | translate }}</nz-tag> }</td>
              <td><nz-tag [nzColor]="color(row.status)">{{ 'TALENT_LEARNING.STATUS_' + key(row.status) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'draft') {
                    <button nz-button nzType="text" (click)="transitionCourse(row, 'publish')">{{ 'TALENT_LEARNING.PUBLISH' | translate }}</button>
                  }
                  @if (row.status === 'published') {
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.ARCHIVE_CONFIRM' | translate" (nzOnConfirm)="transitionCourse(row, 'archive')">{{ 'TALENT_LEARNING.ARCHIVE' | translate }}</button>
                  }
                  <button nz-button nzType="text" appIconAction="edit" (click)="openCourseModal(row)"></button>
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removeCourse(row)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && courses().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_COURSES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.LEARNING_PATHS' | translate" [nzExtra]="pathAction">
      <nz-table #pathTable [nzData]="paths()" nzSize="small" [nzShowPagination]="false">
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.NAME' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (path of pathTable.data; track path.id) {
            <tr>
              <td>{{ path.name }}</td>
              <td><nz-tag [nzColor]="color(path.status)">{{ 'TALENT_LEARNING.STATUS_' + key(path.status) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  @if (path.status === 'draft') {
                    <button nz-button nzType="text" (click)="transitionPath(path, 'publish')">{{ 'TALENT_LEARNING.PUBLISH' | translate }}</button>
                  }
                  @if (path.status === 'published') {
                    <button nz-button nzType="text" (click)="openEnrol(path)">{{ 'TALENT_LEARNING.ENROL' | translate }}</button>
                    <button nz-button nzType="text" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.ARCHIVE_CONFIRM' | translate" (nzOnConfirm)="transitionPath(path, 'archive')">{{ 'TALENT_LEARNING.ARCHIVE' | translate }}</button>
                  }
                  <button nz-button nzType="text" nzDanger appIconAction="delete" nz-popconfirm [nzPopconfirmTitle]="'TALENT_LEARNING.DELETE_CONFIRM' | translate" (nzOnConfirm)="removePath(path)"></button>
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (paths().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_PATHS' | translate"></nz-empty>
      }
    </nz-card>
    <ng-template #pathAction><button nz-button nzType="primary" (click)="openPathModal()" appIconAction="create"></button></ng-template>

    <nz-modal [(nzVisible)]="courseModalVisible" [nzTitle]="(editing() ? 'TALENT_LEARNING.EDIT_COURSE' : 'TALENT_LEARNING.NEW_COURSE') | translate" (nzOnCancel)="courseModalVisible.set(false)" (nzOnOk)="saveCourse()" okAction="save" [nzOkDisabled]="courseForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="courseForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="course-code">{{ 'TALENT_LEARNING.CODE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="course-code" formControlName="code" maxlength="40" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="course-title">{{ 'TALENT_LEARNING.TITLE' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="course-title" formControlName="title" maxlength="200" /></nz-form-control>
          </nz-form-item>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'TALENT_LEARNING.DELIVERY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select formControlName="delivery">
                  @for (mode of deliveries; track mode) {
                    <nz-option [nzValue]="mode" [nzLabel]="'TALENT_LEARNING.DELIVERY_' + key(mode) | translate"></nz-option>
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="course-hours">{{ 'TALENT_LEARNING.DURATION_HOURS' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="course-hours" type="number" min="0" step="any" formControlName="duration_hours" /></nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="course-validity">{{ 'TALENT_LEARNING.VALIDITY_MONTHS' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="course-validity" type="number" min="1" max="240" formControlName="validity_months" /></nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="course-pass">{{ 'TALENT_LEARNING.PASS_SCORE' | translate }}</nz-form-label>
              <nz-form-control><input nz-input id="course-pass" type="number" min="1" max="100" formControlName="pass_score" /></nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-control><label nz-checkbox formControlName="is_mandatory">{{ 'TALENT_LEARNING.MANDATORY' | translate }}</label></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="course-description">{{ 'TALENT_LEARNING.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="course-description" rows="3" formControlName="description"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="pathModalVisible" [nzTitle]="'TALENT_LEARNING.NEW_PATH' | translate" (nzOnCancel)="pathModalVisible.set(false)" (nzOnOk)="savePath()" okAction="save" [nzOkDisabled]="pathForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="pathForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="path-name">{{ 'TALENT_LEARNING.NAME' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="path-name" formControlName="name" maxlength="150" /></nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TALENT_LEARNING.COURSES' | translate }}</nz-form-label>
            <nz-form-control [nzExtra]="'TALENT_LEARNING.PATH_ORDER_HINT' | translate">
              <nz-select formControlName="course_ids" nzMode="multiple" nzShowSearch>
                @for (course of courses(); track course.id) {
                  <nz-option [nzValue]="course.id" [nzLabel]="course.code + ' - ' + course.title"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="path-description">{{ 'TALENT_LEARNING.DESCRIPTION' | translate }}</nz-form-label>
            <nz-form-control><textarea nz-input id="path-description" rows="3" formControlName="description"></textarea></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal [(nzVisible)]="enrolVisible" [nzTitle]="('TALENT_LEARNING.ENROL' | translate) + ': ' + (enrolTarget()?.name ?? '')" (nzOnCancel)="enrolVisible.set(false)" (nzOnOk)="saveEnrol()" okAction="save" [nzOkDisabled]="enrolForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="enrolForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired>{{ 'TALENT_LEARNING.EMPLOYEES' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select formControlName="employee_ids" nzMode="multiple" nzShowSearch>
                @for (employee of employees(); track employee.id) {
                  <nz-option [nzValue]="employee.id" [nzLabel]="employee.full_name"></nz-option>
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="enrol-due">{{ 'TALENT_LEARNING.DUE_ON' | translate }}</nz-form-label>
            <nz-form-control><input nz-input id="enrol-due" type="date" formControlName="due_on" /></nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TalentCoursesComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly deliveries = TALENT_DELIVERIES;
  readonly color = tagColor;
  readonly key = keyOf;
  readonly courses = signal<TalentCourse[]>([]);
  readonly paths = signal<TalentLearningPath[]>([]);
  readonly employees = signal<TalentEmployee[]>([]);
  readonly loading = signal(false);
  readonly editing = signal<TalentCourse | null>(null);
  readonly enrolTarget = signal<TalentLearningPath | null>(null);
  readonly courseModalVisible = signal(false);
  readonly pathModalVisible = signal(false);
  readonly enrolVisible = signal(false);

  readonly courseForm = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    title: ['', [Validators.required, Validators.maxLength(200)]],
    description: [''],
    delivery: this.fb.control<TalentDelivery>('online'),
    duration_hours: this.fb.control<number | null>(1, Validators.required),
    validity_months: this.fb.control<number | null>(null),
    pass_score: this.fb.control<number | null>(null),
    is_mandatory: [false],
  });

  readonly pathForm = this.fb.group({
    name: ['', [Validators.required, Validators.maxLength(150)]],
    description: [''],
    course_ids: this.fb.control<string[]>([], Validators.required),
  });

  readonly enrolForm = this.fb.group({
    employee_ids: this.fb.control<string[]>([], Validators.required),
    due_on: [''],
  });

  ngOnInit(): void {
    this.api.getEmployeeLookup().subscribe((response) => this.employees.set(response.data));
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getCourses({ per_page: 100 }).subscribe({
      next: (response) => {
        this.courses.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
    this.api.getLearningPaths({ per_page: 100 }).subscribe((response) => this.paths.set(response.data));
  }

  openCourseModal(course: TalentCourse | null = null): void {
    this.editing.set(course);
    this.courseForm.reset({
      code: course?.code ?? '',
      title: course?.title ?? '',
      description: course?.description ?? '',
      delivery: course?.delivery ?? 'online',
      duration_hours: course ? Number(course.duration_hours) : 1,
      validity_months: course?.validity_months ?? null,
      pass_score: course?.pass_score ?? null,
      is_mandatory: course?.is_mandatory ?? false,
    });
    this.courseModalVisible.set(true);
  }

  saveCourse(): void {
    const value = this.courseForm.getRawValue();
    const payload: TalentCourseRequest = {
      code: value.code.trim(),
      title: value.title.trim(),
      description: blankToNull(value.description),
      delivery: value.delivery,
      duration_hours: String(value.duration_hours),
      validity_months: value.validity_months,
      pass_score: value.pass_score,
      is_mandatory: value.is_mandatory,
    };
    const current = this.editing();
    (current ? this.api.updateCourse(current.id, payload) : this.api.createCourse(payload)).subscribe(this.observer(() => this.courseModalVisible.set(false)));
  }

  transitionCourse(course: TalentCourse, action: 'publish' | 'archive'): void {
    this.api.transitionCourse(course.id, action).subscribe(this.observer());
  }

  removeCourse(course: TalentCourse): void {
    this.api.deleteCourse(course.id).subscribe(this.observer());
  }

  openPathModal(): void {
    this.pathForm.reset({ name: '', description: '', course_ids: [] });
    this.pathModalVisible.set(true);
  }

  savePath(): void {
    const value = this.pathForm.getRawValue();
    this.api.createLearningPath({ name: value.name.trim(), description: blankToNull(value.description), course_ids: value.course_ids }).subscribe(this.observer(() => this.pathModalVisible.set(false)));
  }

  transitionPath(path: TalentLearningPath, action: 'publish' | 'archive'): void {
    this.api.transitionLearningPath(path.id, action).subscribe(this.observer());
  }

  openEnrol(path: TalentLearningPath): void {
    this.enrolTarget.set(path);
    this.enrolForm.reset({ employee_ids: [], due_on: '' });
    this.enrolVisible.set(true);
  }

  saveEnrol(): void {
    const path = this.enrolTarget();
    if (!path) {
      return;
    }
    const value = this.enrolForm.getRawValue();
    this.api.enrolInLearningPath(path.id, { employee_ids: value.employee_ids, due_on: blankToNull(value.due_on) }).subscribe(this.observer(() => this.enrolVisible.set(false)));
  }

  removePath(path: TalentLearningPath): void {
    this.api.deleteLearningPath(path.id).subscribe(this.observer());
  }

  private observer(onSuccess?: () => void): { next: () => void; error: (error: unknown) => void } {
    return mutationObserver(this.message, this.translate, () => {
      onSuccess?.();
      this.load();
    });
  }
}
