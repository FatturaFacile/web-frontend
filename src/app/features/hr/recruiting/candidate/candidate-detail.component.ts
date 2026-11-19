import { CdkMenu, CdkMenuItem, CdkMenuTrigger } from '@angular/cdk/menu';
import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { form, FormField, readonly } from '@angular/forms/signals';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable } from 'rxjs';
import {
  CandidateApplication,
  HireResult,
  I18nService,
  InterviewScorecard,
  JobOfferLetter,
  RecruitingApiService,
  RecruitingEnvelope,
  RETENTION_MONTHS,
  RetentionMonths,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { recruitingErrorKey } from '../shared/recruiting-errors';
import { stageLabelKey } from '../shared/recruiting-labels';
import { CvViewerComponent } from './cv-viewer.component';
import { OfferPanelComponent } from './offer-panel.component';
import { ScorecardFormComponent } from './scorecard-form.component';

@Component({
  selector: 'app-candidate-detail',
  imports: [
    CdkMenu,
    CdkMenuItem,
    CdkMenuTrigger,
    DatePipe,
    DecimalPipe,
    FormField,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
    CvViewerComponent,
    OfferPanelComponent,
    ScorecardFormComponent,
  ],
  templateUrl: './candidate-detail.component.html',
  styleUrl: './candidate-detail.component.scss',
})
export class CandidateDetailComponent {
  private readonly api = inject(RecruitingApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly route = inject(ActivatedRoute);
  private readonly destroyRef = inject(DestroyRef);

  readonly retentionOptions = RETENTION_MONTHS;
  readonly stageLabel = stageLabelKey;

  readonly id = signal('');
  readonly loading = signal(false);
  readonly loadError = signal(false);
  readonly application = signal<CandidateApplication | null>(null);
  readonly scorecards = signal<InterviewScorecard[]>([]);
  readonly busy = signal(false);
  readonly notesSaving = signal(false);

  readonly notesModel = signal({ notes: '' });
  readonly notesForm = form(this.notesModel, (p) => {
    readonly(p.notes, () => this.readOnly());
  });

  readonly readOnly = computed(() => this.application()?.is_anonymized ?? true);

  constructor() {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      this.id.set(params.get('id') ?? '');
      this.load();
    });
  }

  load(): void {
    const id = this.id();
    if (!id) {
      return;
    }
    this.loading.set(true);
    this.loadError.set(false);
    this.api
      .getApplication(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.setApplication(res.data);
          this.loading.set(false);
        },
        error: () => {
          this.loadError.set(true);
          this.loading.set(false);
        },
      });
    this.loadScorecards();
  }

  loadScorecards(): void {
    this.api
      .listScorecards(this.id())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.scorecards.set(res.data),
        error: () => this.scorecards.set([]),
      });
  }

  saveNotes(): void {
    const app = this.application();
    if (!app || this.readOnly() || this.notesSaving()) {
      return;
    }
    this.notesSaving.set(true);
    this.api
      .updateApplication(app.id, { notes: this.notesModel().notes.trim() || null })
      .subscribe({
        next: (res) => {
          this.notesSaving.set(false);
          this.setApplication(res.data);
          this.message.success(this.i18n.translate('hr.recruiting.candidate.notesSaved'));
        },
        error: (err: unknown) => {
          this.notesSaving.set(false);
          this.message.error(this.i18n.translate(recruitingErrorKey(err)));
        },
      });
  }

  extendConsent(months: RetentionMonths): void {
    const app = this.application();
    if (!app) return;
    this.runAction(
      this.api.extendConsent(app.id, months),
      'hr.recruiting.candidate.consentExtended',
    );
  }

  reparseCv(): void {
    const app = this.application();
    if (!app) return;
    this.runAction(this.api.reparseCv(app.id), 'hr.recruiting.candidate.reparseQueued');
  }

  confirmAnonymize(): void {
    const app = this.application();
    if (!app || this.readOnly()) return;
    this.modal.confirm({
      nzTitle: this.i18n.translate('hr.recruiting.candidate.anonymizeTitle'),
      nzContent: this.i18n.translate('hr.recruiting.candidate.anonymizeBody', {
        name: app.full_name,
      }),
      nzOkText: this.i18n.translate('hr.recruiting.candidate.anonymize'),
      nzOkDanger: true,
      nzCancelText: this.i18n.translate('common.actions.cancel'),
      nzOnOk: () => {
        this.runAction(this.api.anonymize(app.id), 'hr.recruiting.candidate.anonymized');
      },
    });
  }

  onScorecardSaved(card: InterviewScorecard): void {
    this.scorecards.update((list) => {
      const others = list.filter((c) => c.id !== card.id);
      return [...others, card];
    });
    // Average score on the card is server-computed; refresh the application.
    this.load();
  }

  onOfferChanged(offer: JobOfferLetter): void {
    this.application.update((app) => (app ? { ...app, offer } : app));
    if (offer.status === 'sent' || offer.status === 'draft') {
      // Creating an offer moves the application to `offer_extended`.
      this.load();
    }
  }

  onHired(result: HireResult): void {
    this.setApplication(result.application);
  }

  private runAction(
    request$: Observable<RecruitingEnvelope<CandidateApplication>>,
    successKey: string,
  ): void {
    if (this.busy() || this.readOnly()) {
      return;
    }
    this.busy.set(true);
    request$.subscribe({
      next: (res) => {
        this.busy.set(false);
        this.setApplication(res.data);
        this.message.success(this.i18n.translate(successKey));
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.message.error(this.i18n.translate(recruitingErrorKey(err)));
      },
    });
  }

  private setApplication(app: CandidateApplication): void {
    this.application.set(app);
    this.notesModel.set({ notes: app.notes ?? '' });
  }
}
