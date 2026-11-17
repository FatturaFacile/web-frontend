import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import {
  ATS_CONTRACT_TYPES,
  ATS_EMPLOYMENT_TYPES,
  ATS_INTERVIEW_STAGES,
  ATS_RECOMMENDATIONS,
  ATS_REJECTION_REASONS,
  ATS_STAGES,
  AtsApplication,
  AtsContractType,
  AtsCriterionScore,
  AtsEmploymentType,
  AtsMovePayload,
  AtsOfferPayload,
  AtsRecommendation,
  AtsRejectionReason,
  AtsScorecard,
  AtsScorecardPayload,
  AtsStage,
  HrExtraApiService,
  I18nService,
} from '@core';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';

/** Payload of the scorecard form: every criterion needs a name and a score between 1 and 5. */
export function buildScorecardPayload(
  stage: AtsStage,
  criteria: AtsCriterionScore[],
  recommendation: AtsRecommendation,
  notes: string,
): AtsScorecardPayload {
  return {
    stage,
    criteria_scores: criteria
      .filter((c) => c.criterion.trim() !== '')
      .map((c) => ({ criterion: c.criterion.trim(), score: c.score, comment: c.comment?.trim() || null })),
    recommendation,
    notes: notes.trim() || null,
  };
}

/** A rejection must carry a reason code (the API rule is required_if stage = rejected). */
export function buildMovePayload(stage: AtsStage, reason: AtsRejectionReason | null, note: string, sendEmail: boolean): AtsMovePayload {
  return {
    stage,
    send_email: sendEmail,
    rejection_reason_code: stage === 'rejected' ? reason : null,
    rejection_note: stage === 'rejected' ? note.trim() || null : null,
    note: stage === 'rejected' ? null : note.trim() || null,
  };
}

/** Candidate detail of the ATS: profile, CV, stage moves, scorecards, offer, consent, hire. */
@Component({
  selector: 'app-ats-application-drawer',
  imports: [DatePipe, FormsModule, NzButtonModule, NzDescriptionsModule, NzDrawerModule, NzInputModule, NzModalModule, NzSelectModule, NzTagModule, TranslatePipe],
  template: `
    <nz-drawer [nzVisible]="applicationId() !== null" [nzWidth]="640" [nzTitle]="app()?.full_name ?? ''" (nzOnClose)="closed.emit()">
      <ng-container *nzDrawerContent>
        @if (app(); as a) {
          <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
            <nz-descriptions-item [nzTitle]="'hrmAts.stageLabel' | translate">
              <nz-tag>{{ 'hrmAts.stage.' + a.stage | translate }}</nz-tag>
            </nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmRecruiting.email' | translate">{{ a.email }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmRecruiting.phone' | translate">{{ a.phone }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmAts.opening' | translate">{{ a.job_opening_title }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmRecruiting.source' | translate">{{ a.source }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmAts.skills' | translate">{{ a.skills.join(', ') }}</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmAts.averageScore' | translate">{{ a.average_score ?? '-' }} ({{ a.scorecards_count }})</nz-descriptions-item>
            <nz-descriptions-item [nzTitle]="'hrmAts.consentExpires' | translate">{{ a.consent.expires_at | date: 'mediumDate' }}</nz-descriptions-item>
            @if (a.rejection) {
              <nz-descriptions-item [nzTitle]="'hrmAts.rejection' | translate">
                {{ 'hrmAts.rejectionReason.' + a.rejection.reason_code | translate }} {{ a.rejection.note }}
              </nz-descriptions-item>
            }
          </nz-descriptions>

          @if (!a.is_anonymized) {
            <div class="actions">
              @if (a.cv) {
                <button nz-button type="button" (click)="downloadCv(a)">{{ 'hrmAts.downloadCv' | translate }}</button>
                @if (canWrite()) {
                  <button nz-button type="button" (click)="reparse(a)">{{ 'hrmAts.reparseCv' | translate }}</button>
                }
              }
              @if (canWrite() && a.stage !== 'hired' && a.stage !== 'rejected') {
                <nz-select class="w-field-md" [nzPlaceHolder]="'hrmRecruiting.move' | translate" [ngModel]="null" (ngModelChange)="requestMove($event)">
                  @for (s of moveTargets(a); track s) {
                    <nz-option [nzValue]="s" [nzLabel]="('hrmAts.stage.' + s) | translate" />
                  }
                </nz-select>
              }
              @if (canWrite() && a.stage === 'offer_extended') {
                <button nz-button nzType="primary" type="button" (click)="hireOpen.set(true)">{{ 'hrmRecruiting.hire' | translate }}</button>
              }
              @if (canWrite()) {
                <button nz-button type="button" (click)="consentOpen.set(true)">{{ 'hrmAts.extendConsent' | translate }}</button>
                <button nz-button nzDanger type="button" (click)="anonymizeOpen.set(true)">{{ 'hrmAts.anonymize' | translate }}</button>
              }
            </div>

            @if (a.cover_letter) {
              <h4>{{ 'hrmRecruiting.coverNote' | translate }}</h4>
              <p class="pre">{{ a.cover_letter }}</p>
            }
            <h4>{{ 'hrmCommon.notes' | translate }}</h4>
            <textarea nz-input rows="3" [disabled]="!canWrite()" [ngModel]="notes()" (ngModelChange)="notes.set($event)"></textarea>
            @if (canWrite()) {
              <button nz-button nzSize="small" type="button" class="mt-2" (click)="saveNotes(a)">{{ 'COMMON.SAVE' | translate }}</button>
            }

            <h4>{{ 'hrmAts.scorecards' | translate }}</h4>
            @for (s of scorecards(); track s.id) {
              <div class="card">
                <strong>{{ s.interviewer_name }}</strong> - {{ 'hrmAts.stage.' + s.stage | translate }} - {{ s.overall_score }}
                <nz-tag>{{ 'hrmAts.recommendation.' + s.recommendation | translate }}</nz-tag>
                <ul>
                  @for (c of s.criteria_scores; track c.criterion) {
                    <li>{{ c.criterion }}: {{ c.score }}/5 {{ c.comment }}</li>
                  }
                </ul>
              </div>
            }
            @if (canWrite()) {
              <button nz-button type="button" (click)="openScorecard()">{{ 'hrmAts.addScorecard' | translate }}</button>
            }

            <h4>{{ 'hrmAts.offer' | translate }}</h4>
            @if (a.offer; as o) {
              <nz-descriptions nzBordered nzSize="small" [nzColumn]="1">
                <nz-descriptions-item [nzTitle]="'hrmCommon.statusCol' | translate">{{ 'hrmAts.offerStatus.' + o.status | translate }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'hrmAts.proposedSalary' | translate">{{ o.proposed_salary }} {{ o.currency }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'hrmSelfService.hireDate' | translate">{{ o.start_date }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'hrmAts.validUntil' | translate">{{ o.valid_until }}</nz-descriptions-item>
              </nz-descriptions>
              @if (canWrite() && (o.status === 'sent' || o.status === 'draft')) {
                <div class="actions">
                  <button nz-button type="button" (click)="markSigned(o.id)">{{ 'hrmAts.markSigned' | translate }}</button>
                  <button nz-button nzDanger type="button" (click)="declineOffer(o.id)">{{ 'hrmAts.declineOffer' | translate }}</button>
                </div>
              }
            } @else if (canWrite()) {
              <button nz-button type="button" (click)="offerOpen.set(true)">{{ 'hrmAts.createOffer' | translate }}</button>
            }

            <h4>{{ 'hrmAts.history' | translate }}</h4>
            <ul>
              @for (h of a.history; track h.id) {
                <li>{{ h.created_at | date: 'short' }} - {{ 'hrmAts.stage.' + h.to_stage | translate }} {{ h.note }}</li>
              }
            </ul>
          } @else {
            <p>{{ 'hrmAts.anonymized' | translate }}</p>
          }
        }
      </ng-container>
    </nz-drawer>

    <nz-modal [nzVisible]="moveTarget() !== null" [nzTitle]="'hrmRecruiting.move' | translate" [nzOkDisabled]="moveTarget() === 'rejected' && !rejectReason()" (nzOnOk)="confirmMove()" (nzOnCancel)="moveTarget.set(null)">
      <ng-container *nzModalContent>
        @if (moveTarget() === 'rejected') {
          <label for="rej-reason">{{ 'hrmAts.rejection' | translate }}</label>
          <nz-select id="rej-reason" class="w-full" [ngModel]="rejectReason()" (ngModelChange)="rejectReason.set($event)">
            @for (r of rejectionReasons; track r) {
              <nz-option [nzValue]="r" [nzLabel]="('hrmAts.rejectionReason.' + r) | translate" />
            }
          </nz-select>
        }
        <label for="move-note">{{ 'hrmCommon.notes' | translate }}</label>
        <textarea nz-input id="move-note" rows="3" maxlength="2000" [ngModel]="moveNote()" (ngModelChange)="moveNote.set($event)"></textarea>
        <label><input type="checkbox" [ngModel]="sendEmail()" (ngModelChange)="sendEmail.set($event)" /> {{ 'hrmAts.sendEmail' | translate }}</label>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="hireOpen()" [nzTitle]="'hrmRecruiting.hire' | translate" (nzOnOk)="hire()" (nzOnCancel)="hireOpen.set(false)">
      <ng-container *nzModalContent>
        <label for="hire-d">{{ 'hrmSelfService.hireDate' | translate }}</label>
        <input nz-input id="hire-d" type="date" [ngModel]="hireDate()" (ngModelChange)="hireDate.set($event)" />
        <label for="hire-e">{{ 'hrmSelfService.workEmail' | translate }}</label>
        <input nz-input id="hire-e" type="email" maxlength="180" [ngModel]="workEmail()" (ngModelChange)="workEmail.set($event)" />
        <label><input type="checkbox" [ngModel]="startOnboarding()" (ngModelChange)="startOnboarding.set($event)" /> {{ 'hrmAts.startOnboarding' | translate }}</label>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="consentOpen()" [nzTitle]="'hrmAts.extendConsent' | translate" (nzOnOk)="extendConsent()" (nzOnCancel)="consentOpen.set(false)">
      <ng-container *nzModalContent>
        <nz-select class="w-full" [ngModel]="consentMonths()" (ngModelChange)="consentMonths.set($event)">
          <nz-option [nzValue]="6" [nzLabel]="'6 ' + ('hrmAts.months' | translate)" />
          <nz-option [nzValue]="12" [nzLabel]="'12 ' + ('hrmAts.months' | translate)" />
        </nz-select>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="anonymizeOpen()" [nzTitle]="'hrmAts.anonymize' | translate" nzOkDanger (nzOnOk)="anonymize()" (nzOnCancel)="anonymizeOpen.set(false)">
      <ng-container *nzModalContent>{{ 'hrmAts.anonymizeConfirm' | translate }}</ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="scorecardOpen()" [nzTitle]="'hrmAts.addScorecard' | translate" [nzWidth]="640" [nzOkDisabled]="!scorecardValid()" (nzOnOk)="saveScorecard()" (nzOnCancel)="scorecardOpen.set(false)">
      <ng-container *nzModalContent>
        <label for="sc-stage">{{ 'hrmAts.stageLabel' | translate }}</label>
        <nz-select id="sc-stage" class="w-full" [ngModel]="scStage()" (ngModelChange)="scStage.set($event)">
          @for (s of interviewStages; track s) {
            <nz-option [nzValue]="s" [nzLabel]="('hrmAts.stage.' + s) | translate" />
          }
        </nz-select>
        @for (c of criteria(); track $index) {
          <div class="criterion">
            <input nz-input maxlength="120" [placeholder]="'hrmAts.criterion' | translate" [ngModel]="c.criterion" (ngModelChange)="setCriterion($index, 'criterion', $event)" />
            <input nz-input type="number" min="1" max="5" [attr.aria-label]="'hrmAts.score' | translate" [ngModel]="c.score" (ngModelChange)="setCriterion($index, 'score', $event)" />
            <input nz-input maxlength="2000" [placeholder]="'hrmAts.comment' | translate" [ngModel]="c.comment" (ngModelChange)="setCriterion($index, 'comment', $event)" />
          </div>
        }
        <button nz-button nzSize="small" type="button" (click)="addCriterion()">{{ 'hrmAts.addCriterion' | translate }}</button>
        <label for="sc-rec">{{ 'hrmAts.recommendationLabel' | translate }}</label>
        <nz-select id="sc-rec" class="w-full" [ngModel]="scRecommendation()" (ngModelChange)="scRecommendation.set($event)">
          @for (r of recommendations; track r) {
            <nz-option [nzValue]="r" [nzLabel]="('hrmAts.recommendation.' + r) | translate" />
          }
        </nz-select>
        <label for="sc-notes">{{ 'hrmCommon.notes' | translate }}</label>
        <textarea nz-input id="sc-notes" rows="3" [ngModel]="scNotes()" (ngModelChange)="scNotes.set($event)"></textarea>
      </ng-container>
    </nz-modal>

    <nz-modal [nzVisible]="offerOpen()" [nzTitle]="'hrmAts.createOffer' | translate" [nzOkDisabled]="!offerValid()" (nzOnOk)="saveOffer()" (nzOnCancel)="offerOpen.set(false)">
      <ng-container *nzModalContent>
        <label for="of-sal">{{ 'hrmAts.proposedSalary' | translate }}</label>
        <input nz-input id="of-sal" type="number" min="0" [ngModel]="offerSalary()" (ngModelChange)="offerSalary.set($event)" />
        <label for="of-cur">{{ 'hrmAts.currency' | translate }}</label>
        <nz-select id="of-cur" class="w-full" [ngModel]="offerCurrency()" (ngModelChange)="offerCurrency.set($event)">
          <nz-option nzValue="CHF" nzLabel="CHF" />
          <nz-option nzValue="EUR" nzLabel="EUR" />
        </nz-select>
        <label for="of-start">{{ 'hrmSelfService.hireDate' | translate }}</label>
        <input nz-input id="of-start" type="date" [ngModel]="offerStart()" (ngModelChange)="offerStart.set($event)" />
        <label for="of-et">{{ 'hrmLeave.employmentType' | translate }}</label>
        <nz-select id="of-et" class="w-full" [ngModel]="offerEmployment()" (ngModelChange)="offerEmployment.set($event)">
          @for (t of employmentTypes; track t) {
            <nz-option [nzValue]="t" [nzLabel]="('hrmAts.employmentType.' + t) | translate" />
          }
        </nz-select>
        <label for="of-ct">{{ 'hrmAts.contractType' | translate }}</label>
        <nz-select id="of-ct" class="w-full" [ngModel]="offerContract()" (ngModelChange)="offerContract.set($event)">
          @for (t of contractTypes; track t) {
            <nz-option [nzValue]="t" [nzLabel]="('hrmAts.contractTypes.' + t) | translate" />
          }
        </nz-select>
        <label for="of-valid">{{ 'hrmAts.validUntil' | translate }}</label>
        <input nz-input id="of-valid" type="date" [ngModel]="offerValidUntil()" (ngModelChange)="offerValidUntil.set($event)" />
        <label><input type="checkbox" [ngModel]="offerSend()" (ngModelChange)="offerSend.set($event)" /> {{ 'hrmAts.sendOffer' | translate }}</label>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin: 12px 0;
    }
    .card {
      border: 1px solid var(--ant-color-border, #d9d9d9);
      border-radius: 6px;
      padding: 8px;
      margin-bottom: 8px;
    }
    .criterion {
      display: grid;
      grid-template-columns: 2fr 70px 2fr;
      gap: 6px;
      margin: 6px 0;
    }
    .pre {
      white-space: pre-wrap;
    }
    label {
      display: block;
      margin-top: 8px;
    }
  `,
})
export class AtsApplicationDrawerComponent {
  /** Application shown; null keeps the drawer closed. */
  readonly applicationId = input<string | null>(null);
  readonly canWrite = input(false);
  readonly closed = output<void>();
  /** Emitted after any change so that the board / list behind the drawer can reload. */
  readonly changed = output<void>();

  private readonly api = inject(HrExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly interviewStages = ATS_INTERVIEW_STAGES;
  protected readonly recommendations = ATS_RECOMMENDATIONS;
  protected readonly rejectionReasons = ATS_REJECTION_REASONS;
  protected readonly employmentTypes = ATS_EMPLOYMENT_TYPES;
  protected readonly contractTypes = ATS_CONTRACT_TYPES;

  protected readonly app = signal<AtsApplication | null>(null);
  protected readonly scorecards = signal<AtsScorecard[]>([]);
  protected readonly notes = signal('');

  protected readonly moveTarget = signal<AtsStage | null>(null);
  protected readonly rejectReason = signal<AtsRejectionReason | null>(null);
  protected readonly moveNote = signal('');
  protected readonly sendEmail = signal(true);

  protected readonly hireOpen = signal(false);
  protected readonly hireDate = signal('');
  protected readonly workEmail = signal('');
  protected readonly startOnboarding = signal(true);

  protected readonly consentOpen = signal(false);
  protected readonly consentMonths = signal(12);
  protected readonly anonymizeOpen = signal(false);

  protected readonly scorecardOpen = signal(false);
  protected readonly scStage = signal<AtsStage>('hr_screening');
  protected readonly scRecommendation = signal<AtsRecommendation>('hire');
  protected readonly scNotes = signal('');
  protected readonly criteria = signal<AtsCriterionScore[]>([]);
  protected readonly scorecardValid = computed(() => {
    const filled = this.criteria().filter((c) => c.criterion.trim() !== '');
    return filled.length > 0 && filled.every((c) => Number.isInteger(c.score) && c.score >= 1 && c.score <= 5);
  });

  protected readonly offerOpen = signal(false);
  protected readonly offerSalary = signal<number | null>(null);
  protected readonly offerCurrency = signal<'EUR' | 'CHF'>('CHF');
  protected readonly offerStart = signal('');
  protected readonly offerEmployment = signal<AtsEmploymentType>('full_time');
  protected readonly offerContract = signal<AtsContractType>('permanent');
  protected readonly offerValidUntil = signal('');
  protected readonly offerSend = signal(true);
  protected readonly offerValid = computed(() => this.offerSalary() !== null && this.offerSalary()! >= 0 && this.offerStart() !== '');

  constructor() {
    effect(() => {
      const id = this.applicationId();
      this.app.set(null);
      this.scorecards.set([]);
      if (id) {
        this.load(id);
      }
    });
  }

  protected moveTargets(a: AtsApplication): AtsStage[] {
    return ATS_STAGES.filter((s) => s !== a.stage && s !== 'hired');
  }

  private load(id: string): void {
    this.api.getRecruitingApplication(id).subscribe({
      next: (res) => {
        this.app.set(res.data);
        this.notes.set(res.data.notes ?? '');
      },
      error: (err: unknown) => reportHttpError(err, this.message, this.i18n),
    });
    this.api.listRecruitingApplicationScorecards(id).subscribe({ next: (res) => this.scorecards.set(res.data) });
  }

  private done(): void {
    const id = this.applicationId();
    this.changed.emit();
    if (id) {
      this.load(id);
    }
  }

  private fail = (err: unknown): void => reportHttpError(err, this.message, this.i18n);

  protected downloadCv(a: AtsApplication): void {
    this.api.getRecruitingApplicationCv(a.id).subscribe({
      next: (blob) => saveBlob(blob, a.cv?.file_name ?? 'cv'),
      error: this.fail,
    });
  }

  protected reparse(a: AtsApplication): void {
    this.api.reparseCvRecruitingApplication(a.id).subscribe({ next: () => this.done(), error: this.fail });
  }

  protected saveNotes(a: AtsApplication): void {
    this.api.updateRecruitingApplication(a.id, { notes: this.notes() || null }).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('hrmCommon.saved'));
        this.done();
      },
      error: this.fail,
    });
  }

  protected requestMove(stage: AtsStage | null): void {
    if (stage) {
      this.rejectReason.set(null);
      this.moveNote.set('');
      this.moveTarget.set(stage);
    }
  }

  protected confirmMove(): void {
    const id = this.applicationId();
    const stage = this.moveTarget();
    if (!id || !stage) {
      return;
    }
    this.api.moveRecruitingApplication(id, buildMovePayload(stage, this.rejectReason(), this.moveNote(), this.sendEmail())).subscribe({
      next: () => {
        this.moveTarget.set(null);
        this.done();
      },
      error: this.fail,
    });
  }

  protected hire(): void {
    const id = this.applicationId();
    if (!id) {
      return;
    }
    this.api
      .hireRecruitingApplication(id, {
        hire_date: this.hireDate() || null,
        work_email: this.workEmail() || null,
        start_onboarding: this.startOnboarding(),
      })
      .subscribe({
        next: () => {
          this.hireOpen.set(false);
          this.message.success(this.i18n.translate('hrmRecruiting.hired'));
          this.done();
        },
        error: this.fail,
      });
  }

  protected extendConsent(): void {
    const id = this.applicationId();
    if (id) {
      this.api.extendConsentRecruitingApplication(id, { months: this.consentMonths() }).subscribe({
        next: () => {
          this.consentOpen.set(false);
          this.done();
        },
        error: this.fail,
      });
    }
  }

  protected anonymize(): void {
    const id = this.applicationId();
    if (id) {
      this.api.anonymizeRecruitingApplication(id).subscribe({
        next: () => {
          this.anonymizeOpen.set(false);
          this.done();
        },
        error: this.fail,
      });
    }
  }

  protected openScorecard(): void {
    this.criteria.set([{ criterion: '', score: 3, comment: '' }]);
    this.scNotes.set('');
    this.scorecardOpen.set(true);
  }

  protected addCriterion(): void {
    this.criteria.update((list) => [...list, { criterion: '', score: 3, comment: '' }]);
  }

  protected setCriterion(index: number, field: keyof AtsCriterionScore, value: string | number): void {
    this.criteria.update((list) =>
      list.map((c, i) => (i === index ? { ...c, [field]: field === 'score' ? Number(value) : String(value) } : c)),
    );
  }

  protected saveScorecard(): void {
    const id = this.applicationId();
    if (!id) {
      return;
    }
    this.api
      .createRecruitingApplicationScorecard(id, buildScorecardPayload(this.scStage(), this.criteria(), this.scRecommendation(), this.scNotes()))
      .subscribe({
        next: () => {
          this.scorecardOpen.set(false);
          this.done();
        },
        error: this.fail,
      });
  }

  protected saveOffer(): void {
    const id = this.applicationId();
    if (!id) {
      return;
    }
    this.api
      .createRecruitingApplicationOffer(id, {
        proposed_salary: this.offerSalary() ?? 0,
        currency: this.offerCurrency(),
        start_date: this.offerStart(),
        employment_type: this.offerEmployment(),
        contract_type: this.offerContract(),
        valid_until: this.offerValidUntil() || null,
        send: this.offerSend(),
      } satisfies AtsOfferPayload)
      .subscribe({
        next: () => {
          this.offerOpen.set(false);
          this.done();
        },
        error: this.fail,
      });
  }

  protected markSigned(offerId: string): void {
    this.api.markSignedRecruitingOffer(offerId).subscribe({ next: () => this.done(), error: this.fail });
  }

  protected declineOffer(offerId: string): void {
    this.api.declineRecruitingOffer(offerId).subscribe({ next: () => this.done(), error: this.fail });
  }
}
