import { Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TalentCertificate, TalentEnrolment, TalentLearningApiService, TranslateService } from '@core';
import { ModalActionsDirective, PageHeaderComponent, TranslatePipe } from '@shared';
import { apiErrorText, keyOf, mutationObserver, tagColor } from './talent-learning.util';

/** Self-service of a learner: her own enrolments, the progress she records and her certificates. */
@Component({
  selector: 'app-talent-my-learning',
  styleUrl: './talent-learning.scss',
  imports: [
    ReactiveFormsModule,
    ModalActionsDirective,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'TALENT_LEARNING.MY_LEARNING_TITLE' | translate" [subtitle]="'TALENT_LEARNING.MY_LEARNING_SUBTITLE' | translate"></app-page-header>

    <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.MY_ENROLMENTS' | translate">
      <nz-table #table [nzData]="enrolments()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.COURSE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.DUE_ON' | translate }}</th>
            <th style="width: 160px">{{ 'TALENT_LEARNING.PROGRESS' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.STATUS' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>{{ row.course?.title }}</td>
              <td [class.row-overdue]="row.is_overdue">{{ row.due_on }}</td>
              <td><nz-progress [nzPercent]="row.progress_percent" nzSize="small"></nz-progress></td>
              <td><nz-tag [nzColor]="color(row.status)">{{ 'TALENT_LEARNING.ENROLMENT_' + key(row.status) | translate }}</nz-tag></td>
              <td>
                <div class="row-actions">
                  @if (row.status === 'enrolled' || row.status === 'in_progress') {
                    <button nz-button nzType="text" (click)="openProgress(row)">{{ 'TALENT_LEARNING.UPDATE_PROGRESS' | translate }}</button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && enrolments().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_MY_ENROLMENTS' | translate"></nz-empty>
      }
    </nz-card>

    <nz-card class="main-card" [nzTitle]="'TALENT_LEARNING.MY_CERTIFICATES' | translate">
      <nz-table #certTable [nzData]="certificates()" [nzLoading]="loading()" nzSize="small" [nzPageSize]="25">
        <thead>
          <tr>
            <th>{{ 'TALENT_LEARNING.CERTIFICATE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.COURSE' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.ISSUED_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.EXPIRES_ON' | translate }}</th>
            <th>{{ 'TALENT_LEARNING.VALIDITY' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of certTable.data; track row.id) {
            <tr>
              <td>{{ row.certificate_number }}</td>
              <td>{{ row.course?.title }}</td>
              <td>{{ row.issued_on }}</td>
              <td>{{ row.expires_on ?? '-' }}</td>
              <td>
                <nz-tag [nzColor]="row.is_valid ? 'green' : 'red'">{{ (row.is_valid ? 'TALENT_LEARNING.VALIDITY_VALID' : 'TALENT_LEARNING.VALIDITY_EXPIRED') | translate }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && certificates().length === 0) {
        <nz-empty [nzNotFoundContent]="'TALENT_LEARNING.NO_CERTIFICATES' | translate"></nz-empty>
      }
    </nz-card>

    <nz-modal appModalActions [nzVisible]="progressVisible()" [nzTitle]="'TALENT_LEARNING.UPDATE_PROGRESS' | translate" (nzOnCancel)="progressVisible.set(false)" (nzOnOk)="saveProgress()" okAction="save" [nzOkDisabled]="progressForm.invalid">
      <ng-container *nzModalContent>
        <form nz-form [formGroup]="progressForm" nzLayout="vertical">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="my-progress-percent">{{ 'TALENT_LEARNING.PROGRESS' | translate }} (%)</nz-form-label>
            <nz-form-control [nzExtra]="'TALENT_LEARNING.MY_PROGRESS_HINT' | translate">
              <input nz-input id="my-progress-percent" type="number" min="0" max="99" formControlName="progress_percent" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class TalentMyLearningComponent implements OnInit {
  private readonly api = inject(TalentLearningApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly color = tagColor;
  readonly key = keyOf;
  readonly enrolments = signal<TalentEnrolment[]>([]);
  readonly certificates = signal<TalentCertificate[]>([]);
  readonly loading = signal(false);
  readonly progressVisible = signal(false);
  readonly target = signal<TalentEnrolment | null>(null);

  /** Completion is recorded by a learning manager, so a learner can reach 99 percent at most. */
  readonly progressForm = this.fb.group({
    progress_percent: this.fb.control<number>(0, [Validators.required, Validators.min(0), Validators.max(99)]),
  });

  ngOnInit(): void {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.api.getMyEnrolments().subscribe({
      next: (response) => {
        this.enrolments.set(response.data);
        this.loading.set(false);
      },
      error: (error: unknown) => {
        this.loading.set(false);
        this.message.error(apiErrorText(error) ?? this.translate.instant('TALENT_LEARNING.ACTION_ERROR'));
      },
    });
    this.api.getMyCertificates().subscribe({ next: (response) => this.certificates.set(response.data), error: () => this.certificates.set([]) });
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
    this.api.updateMyEnrolmentProgress(target.id, this.progressForm.getRawValue().progress_percent).subscribe(
      mutationObserver(this.message, this.translate, () => {
        this.progressVisible.set(false);
        this.load();
      }),
    );
  }
}
