import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe, RadioControlDirective } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { AuditAnswer } from './hse.models';
import { HseStore } from './hse.store';

/** The ten points of the MSSL / ASA (CFST 6508) self-assessment; the texts live in the backend seeder. */
export const AUDIT_POINT_KEYS: readonly string[] = [
  'HSE.AUDIT_POINT_1',
  'HSE.AUDIT_POINT_2',
  'HSE.AUDIT_POINT_3',
  'HSE.AUDIT_POINT_4',
  'HSE.AUDIT_POINT_5',
  'HSE.AUDIT_POINT_6',
  'HSE.AUDIT_POINT_7',
  'HSE.AUDIT_POINT_8',
  'HSE.AUDIT_POINT_9',
  'HSE.AUDIT_POINT_10',
];

const ANSWERS: { value: AuditAnswer; key: string }[] = [
  { value: 'yes', key: 'HSE.AUDIT_ANSWER_YES' },
  { value: 'partial', key: 'HSE.AUDIT_ANSWER_PARTIAL' },
  { value: 'no', key: 'HSE.AUDIT_ANSWER_NO' },
];

/**
 * DVR and audit workspace (`/hse/audits`): the 10-point MSSL / ASA self-assessment, which scores the answers and opens a
 * corrective action for every point that is not fully met, and the register of DVR revisions with the signatures of the
 * employer, RSPP, RLS and competent physician.
 */
@Component({
  selector: 'app-hse-audits-page',
  styleUrl: './hse.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    RadioControlDirective,
    DatePipe,
    ReactiveFormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzRadioModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <app-page-header [title]="'HSE.AUDIT_TITLE' | translate" [subtitle]="'HSE.NAV' | translate">
    </app-page-header>

    <nz-card [nzTitle]="'HSE.AUDIT_MSSL' | translate" nzSize="small">
      <form [formGroup]="auditForm" (ngSubmit)="saveAudit()" data-testid="audit-form">
        <input nz-input type="date" formControlName="auditDate" data-testid="audit-date" />
        @for (point of points; track point.index) {
          <div class="audit-point" [attr.data-testid]="'point-' + point.index">
            <span>{{ point.index }}. {{ point.key | translate }}</span>
            <nz-radio-group [formControlName]="'answer' + point.index">
              @for (answer of answers; track answer.value) {
                <label [attr.for]="'hse-audit-' + point.index + '-' + answer.value" appRadioControl nz-radio [nzValue]="answer.value">{{ answer.key | translate }}</label>
              }
            </nz-radio-group>
          </div>
        }
        <button
          nz-button
          nzType="primary"
          type="submit"
          data-testid="save-audit"
          [nzLoading]="store.busy()"
          [disabled]="auditForm.invalid"
        >
          {{ 'HSE.AUDIT_SAVE' | translate }}
        </button>
      </form>

      <nz-table nzSize="small" [nzData]="store.audits().mssl_audits" [nzShowPagination]="false">
        <tbody>
          @for (audit of store.audits().mssl_audits; track audit.id) {
            <tr [attr.data-testid]="'audit-' + audit.id">
              <td>{{ audit.audit_date | date: 'mediumDate' }}</td>
              <td>{{ 'HSE.AUDIT_SCORE' | translate: { score: audit.score_percent } }}</td>
              <td>
                <nz-tag>{{ audit.corrective_actions.length }}</nz-tag>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    <nz-card [nzTitle]="'HSE.AUDIT_DVR' | translate" nzSize="small" class="dvr-card">
      <form [formGroup]="dvrForm" (ngSubmit)="registerDvr()" data-testid="dvr-form">
        <input nz-input type="date" formControlName="issuedAt" data-testid="dvr-issued" />
        <input nz-input type="date" formControlName="reviewDueAt" data-testid="dvr-review" />
        <input
          nz-input
          formControlName="signedBy"
          [placeholder]="'HSE.AUDIT_SIGNATORIES' | translate"
          data-testid="dvr-signers"
        />
        <button
          nz-button
          nzType="primary"
          type="submit"
          data-testid="register-dvr"
          [nzLoading]="store.busy()"
          [disabled]="dvrForm.invalid"
        >
          {{ 'HSE.AUDIT_DVR_REGISTER' | translate }}
        </button>
      </form>

      <nz-table nzSize="small" [nzData]="store.audits().dvr_revisions" [nzShowPagination]="false">
        <tbody>
          @for (revision of store.audits().dvr_revisions; track revision.id) {
            <tr [attr.data-testid]="'dvr-' + revision.id">
              <td>#{{ revision.revision_number }}</td>
              <td>{{ revision.issued_at | date: 'mediumDate' }}</td>
              <td>{{ revision.review_due_at | date: 'mediumDate' }}</td>
              <td>{{ revision.signatures.length }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>
  `,
})
export class HseAuditsPageComponent implements OnInit {
  protected readonly store = inject(HseStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly fb = inject(NonNullableFormBuilder);

  protected readonly answers = ANSWERS;
  protected readonly points = AUDIT_POINT_KEYS.map((key, position) => ({
    key,
    index: position + 1,
  }));
  protected readonly loaded = signal(false);

  protected readonly auditForm = this.fb.group({
    auditDate: [today(), Validators.required],
    answer1: ['yes' as AuditAnswer],
    answer2: ['yes' as AuditAnswer],
    answer3: ['yes' as AuditAnswer],
    answer4: ['yes' as AuditAnswer],
    answer5: ['yes' as AuditAnswer],
    answer6: ['yes' as AuditAnswer],
    answer7: ['yes' as AuditAnswer],
    answer8: ['yes' as AuditAnswer],
    answer9: ['yes' as AuditAnswer],
    answer10: ['yes' as AuditAnswer],
  });

  protected readonly dvrForm = this.fb.group({
    issuedAt: [today(), Validators.required],
    reviewDueAt: [''],
    signedBy: [''],
  });

  ngOnInit(): void {
    this.store.loadAudits().subscribe({
      next: () => this.loaded.set(true),
      error: () => this.message.error(this.i18n.instant('HSE.LOAD_ERROR')),
    });
  }

  /** Every point that is not fully met gets a corrective action to complete in the CAPA board. */
  protected saveAudit(): void {
    if (this.auditForm.invalid) {
      return;
    }

    const value = this.auditForm.getRawValue() as Record<string, string>;
    const answers = this.points.map((point) => value['answer' + point.index] as AuditAnswer);
    const corrective = this.points
      .filter((point) => answers[point.index - 1] !== 'yes')
      .map((point) => ({ point: point.index, description: this.i18n.instant(point.key) }));

    this.store
      .saveMsslAudit({ audit_date: value['auditDate'], answers, corrective_actions: corrective })
      .subscribe({
        error: (error: HttpErrorResponse) => this.reportError(error),
      });
  }

  protected registerDvr(): void {
    if (this.dvrForm.invalid) {
      return;
    }

    const value = this.dvrForm.getRawValue();
    const signers = value.signedBy
      .split(',')
      .map((name) => name.trim())
      .filter((name) => name !== '');

    this.store
      .registerDvr({
        issued_at: value.issuedAt,
        review_due_at: value.reviewDueAt || null,
        signatures: signers.map((signed_by) => ({ signed_by, signed_at: value.issuedAt })),
      })
      .subscribe({ error: (error: HttpErrorResponse) => this.reportError(error) });
  }

  private reportError(error: HttpErrorResponse): void {
    this.message.error(
      (error.error as { detail?: string } | null)?.detail ?? this.i18n.instant('HSE.SAVE_ERROR'),
    );
  }
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}
