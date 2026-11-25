import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  TndConvertPayload,
  TndNoticePayload,
  TndOfferPayload,
  TndParticipationPayload,
  TndParticipationStatus,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { ConversionModalComponent } from './conversion-modal.component';
import { DeadlineCountdownComponent } from './deadline-countdown.component';
import { EnvelopesPanelComponent, EnvelopeUpload } from './envelopes-panel.component';
import { GoNoGoMatrixComponent } from './go-no-go-matrix.component';
import { NoticeFormComponent } from './notice-form.component';
import { OfferSimulatorComponent } from './offer-simulator.component';
import { TenderDetailStore } from './tender-detail.store';
import {
  issueKey,
  jurisdictionBadge,
  jurisdictionColor,
  statusColor,
  TndOutcome,
} from './tender-management.util';
import { heldReductionKeys } from './tender-offer-calculator';

/**
 * The detail of a tender dossier (Mod 169): requirements, Go/No-Go matrix, the three envelopes, the economic offer simulator,
 * the status actions, the submission and the conversion of an awarded tender into a contract and a project.
 */
@Component({
  selector: 'app-tnd-detail',
  imports: [
    ConversionModalComponent,
    DeadlineCountdownComponent,
    EnvelopesPanelComponent,
    GoNoGoMatrixComponent,
    MoneyPipe,
    NoticeFormComponent,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzModalModule,
    NzSpinModule,
    NzTabsModule,
    NzTagModule,
    OfferSimulatorComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [TenderDetailStore],
  template: `
    <app-page-header [title]="(store.notice()?.title ?? 'PAGE_TITLE.TENDER_MANAGEMENT_DETAIL') | translate"></app-page-header>

    @if (store.error(); as error) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (feedback(); as key) {
      <nz-alert class="feedback" nzType="error" nzShowIcon nzCloseable [nzMessage]="key | translate: feedbackParams()" (nzOnClose)="feedback.set(null)"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.detail(); as dossier) {
        <header class="head">
          <nz-tag [nzColor]="jurisdictionColor(dossier.notice.jurisdiction)">{{ badge(dossier.notice.jurisdiction) }}</nz-tag>
          <nz-tag [nzColor]="color(dossier.status)">{{ 'tenderManagement.enum.participationStatus.' + dossier.status | translate }}</nz-tag>
          <span>{{ dossier.notice.contracting_authority_name }}</span>
          <strong>{{ dossier.notice.base_auction_amount | money: dossier.notice.currency }}</strong>
          <span>{{ 'tenderManagement.field.submissionDeadline' | translate }}:</span>
          <app-tnd-countdown [deadline]="dossier.notice.submission_peremptory_deadline_at"></app-tnd-countdown>
          @if (dossier.notice.clarification_deadline_at) {
            <span>{{ 'tenderManagement.field.clarificationDeadline' | translate }}:</span>
            <app-tnd-countdown [deadline]="dossier.notice.clarification_deadline_at"></app-tnd-countdown>
          }
        </header>

        <div class="actions">
          @for (target of store.allowedTransitions(); track target) {
            <button nz-button type="button" [disabled]="store.saving()" (click)="transition(target)">
              {{ 'tenderManagement.action.moveToStatus' | translate: { status: ('tenderManagement.enum.participationStatus.' + target | translate) } }}
            </button>
          }
          @if (dossier.status === 'PreparingEnvelopes') {
            <button nz-button nzType="primary" type="button" [disabled]="!store.gate().canSubmit || store.saving()" (click)="submit()">
              {{ 'tenderManagement.action.submitTender' | translate }}
            </button>
            @if (!store.gate().canSubmit) {
              <span class="hint">{{ 'tenderManagement.envelopes.submitBlocked' | translate }}</span>
            }
          }
          @if (dossier.status === 'AwardedWon' && !dossier.converted_contract_id) {
            <button nz-button nzType="primary" type="button" (click)="openConvert()">
              {{ 'tenderManagement.action.convertAward' | translate }}
            </button>
          }
          @if (dossier.converted_contract_id) {
            <nz-tag nzColor="green">{{ 'tenderManagement.convert.alreadyConverted' | translate }}</nz-tag>
          }
        </div>

        @for (issue of store.gate().blocking; track $index) {
          <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="issueText(issue) | translate: issue.params ?? {}"></nz-alert>
        }

        <nz-tabs>
          <nz-tab [nzTitle]="'tenderManagement.tab.overview' | translate">
            <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.procedureType' | translate">
                {{ 'tenderManagement.enum.procedureType.' + dossier.notice.procedure_type | translate }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.awardCriterion' | translate">
                {{ 'tenderManagement.enum.awardCriterion.' + dossier.notice.award_criterion | translate }}
                @if (dossier.notice.formula_type) {
                  ({{ 'tenderManagement.enum.formulaType.' + dossier.notice.formula_type | translate }})
                }
              </nz-descriptions-item>
              @if (store.country() === 'IT') {
                <nz-descriptions-item nzTitle="CIG">{{ dossier.notice.cig_code_it ?? '–' }}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="CUP">{{ dossier.notice.cup_code_it ?? '–' }}</nz-descriptions-item>
                <nz-descriptions-item nzTitle="RUP">{{ dossier.notice.rup_name ?? '–' }}</nz-descriptions-item>
                <nz-descriptions-item [nzTitle]="'tenderManagement.field.dedicatedAccount' | translate">{{ dossier.notice.dedicated_bank_account_it ?? '–' }}</nz-descriptions-item>
              }
              @if (store.country() === 'CH') {
                <nz-descriptions-item [nzTitle]="'tenderManagement.field.simapProjectNumber' | translate">{{ dossier.notice.simap_project_number ?? '–' }}</nz-descriptions-item>
              }
              <nz-descriptions-item nzTitle="CPV">{{ (dossier.notice.cpv_category_codes ?? []).join(', ') || '–' }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.nonSubjectSafetyCosts' | translate">{{ dossier.notice.non_subject_safety_costs_amount | money: dossier.notice.currency }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.estimatedLaborCost' | translate">{{ dossier.notice.estimated_labor_cost_amount | money: dossier.notice.currency }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.requiredMinTurnover' | translate">
                {{ dossier.notice.required_min_turnover ? (dossier.notice.required_min_turnover | money: dossier.notice.currency) : '–' }}
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.similarProjectsCount' | translate">{{ dossier.notice.required_similar_projects_count }}</nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.requiredSoa' | translate" [nzSpan]="2">
                @for (soa of dossier.notice.required_soa_categories; track soa.category) {
                  <nz-tag>{{ soa.category }} · {{ soa.classification }}</nz-tag>
                } @empty {
                  –
                }
              </nz-descriptions-item>
              <nz-descriptions-item [nzTitle]="'tenderManagement.field.requiredCertifications' | translate" [nzSpan]="2">
                @for (type of dossier.notice.required_certifications; track type) {
                  <nz-tag>{{ 'tenderManagement.enum.vaultDocType.' + type | translate }}</nz-tag>
                } @empty {
                  –
                }
              </nz-descriptions-item>
            </nz-descriptions>
            <button nz-button class="edit" type="button" (click)="editing.set(true)">
              {{ 'tenderManagement.action.editRequirements' | translate }}
            </button>
          </nz-tab>

          <nz-tab [nzTitle]="'tenderManagement.tab.goNoGo' | translate">
            <app-tnd-go-no-go-matrix
              [eligibility]="store.eligibility()"
              [detail]="dossier"
              [busy]="store.saving()"
              (evaluate)="evaluate()"
              (saved)="saveParticipation($event)"
            ></app-tnd-go-no-go-matrix>
          </nz-tab>

          <nz-tab [nzTitle]="'tenderManagement.tab.envelopes' | translate">
            <app-tnd-envelopes-panel
              [readiness]="store.readiness()"
              [jurisdiction]="dossier.notice.jurisdiction"
              [edgue]="store.edgue()"
              [busy]="store.saving() || store.busyEnvelope() !== null"
              (upload)="upload($event)"
              (remove)="removeDocument($event.envelope, $event.docKey)"
              (seed)="seed($event)"
              (generateEdgue)="generateEdgue()"
              (downloadEdgue)="downloadEdgue($event)"
            ></app-tnd-envelopes-panel>
          </nz-tab>

          <nz-tab [nzTitle]="'tenderManagement.tab.offer' | translate">
            <app-tnd-offer-simulator
              [detail]="dossier"
              [bondRates]="store.bondRates()"
              [heldKeys]="heldKeys()"
              [allowedBasePercentages]="store.lookups()?.bid_bond?.allowed_base_percentages ?? ['1.00', '2.00']"
              [history]="store.competitorDiscounts()"
              [server]="store.offer()"
              [defaults]="scoringDefaults()"
              [busy]="store.saving()"
              (calculate)="calculate($event)"
            ></app-tnd-offer-simulator>
          </nz-tab>
        </nz-tabs>

        <nz-modal
          [nzVisible]="editing()"
          nzWidth="900px"
          [nzTitle]="'tenderManagement.action.editRequirements' | translate"
          [nzFooter]="null"
          (nzOnCancel)="editing.set(false)"
        >
          <ng-container *nzModalContent>
            <app-tnd-notice-form
              [notice]="dossier.notice"
              [lookups]="store.lookups()"
              [busy]="store.saving()"
              (saved)="saveNotice($event)"
            ></app-tnd-notice-form>
          </ng-container>
        </nz-modal>

        <app-tnd-conversion-modal
          [visible]="converting()"
          [notice]="dossier.notice"
          [busy]="store.saving()"
          [result]="store.conversion()"
          [errorKey]="convertError()"
          [errorParams]="convertParams()"
          (confirmed)="convert($event)"
          (closed)="converting.set(false)"
        ></app-tnd-conversion-modal>
      }
    </nz-spin>
  `,
  styles: `
    .head {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
      margin-bottom: 12px;
    }
    .feedback {
      margin-bottom: 8px;
    }
    .hint {
      opacity: 0.7;
    }
    .edit {
      margin-top: 12px;
    }
  `,
})
export class TenderDetailComponent implements OnInit {
  protected readonly store = inject(TenderDetailStore);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly editing = signal(false);
  protected readonly converting = signal(false);
  protected readonly feedback = signal<string | null>(null);
  protected readonly feedbackParams = signal<Record<string, string | number>>({});
  protected readonly convertError = signal<string | null>(null);
  protected readonly convertParams = signal<Record<string, string | number>>({});

  protected readonly color = statusColor;
  protected readonly jurisdictionColor = jurisdictionColor;
  protected readonly badge = jurisdictionBadge;

  protected readonly heldKeys = computed(() =>
    heldReductionKeys(this.store.heldDocuments(), this.store.reductionKeyByType()),
  );
  protected readonly scoringDefaults = computed(() => ({
    technical: this.store.lookups()?.scoring.technical_max_default ?? '70',
    economic: this.store.lookups()?.scoring.economic_max_default ?? '30',
  }));

  private get id(): string {
    return this.route.snapshot.paramMap.get('id') ?? '';
  }

  ngOnInit(): void {
    void this.store.load(this.id);
  }

  protected issueText(issue: { code: string }): string {
    return issueKey(issue);
  }

  /** Shows a failure at the top of the page, or the success text as a toast. */
  private report(outcome: TndOutcome, success?: string): boolean {
    if (!outcome.ok) {
      this.feedback.set(outcome.errorKey);
      this.feedbackParams.set(outcome.errorParams);
      return false;
    }
    this.feedback.set(null);
    if (success) {
      this.message.success(this.i18n.instant(success));
    }
    return true;
  }

  protected async transition(status: TndParticipationStatus): Promise<void> {
    this.report(await this.store.transition(this.id, status), 'tenderManagement.message.statusChanged');
  }

  protected async evaluate(): Promise<void> {
    this.report(await this.store.evaluate(this.id), 'tenderManagement.message.evaluated');
  }

  protected async saveParticipation(payload: TndParticipationPayload): Promise<void> {
    this.report(await this.store.saveParticipation(this.id, payload), 'tenderManagement.message.saved');
  }

  protected async saveNotice(payload: TndNoticePayload): Promise<void> {
    const notice = this.store.notice();
    if (!notice) {
      return;
    }
    if (this.report(await this.store.saveNotice(this.id, notice.id, payload), 'tenderManagement.message.saved')) {
      this.editing.set(false);
    }
  }

  protected async upload(event: EnvelopeUpload): Promise<void> {
    this.report(
      await this.store.uploadDocument(this.id, event.envelope, event.docKey, event.file),
      'tenderManagement.message.uploaded',
    );
  }

  protected async removeDocument(envelope: EnvelopeUpload['envelope'], docKey: string): Promise<void> {
    this.report(await this.store.removeDocument(this.id, envelope, docKey));
  }

  protected async seed(envelope: EnvelopeUpload['envelope']): Promise<void> {
    this.report(await this.store.seedChecklist(this.id, envelope));
  }

  protected async generateEdgue(): Promise<void> {
    this.report(await this.store.loadEdgue(this.id), 'tenderManagement.message.edgueGenerated');
  }

  protected async downloadEdgue(format: 'xml' | 'pdf'): Promise<void> {
    const outcome = await this.store.downloadEdgue(this.id, format);
    if (!this.report(outcome) || !outcome.blob) {
      return;
    }
    const url = URL.createObjectURL(outcome.blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `edgue-${this.id}.${format}`;
    link.click();
    URL.revokeObjectURL(url);
  }

  protected async calculate(payload: TndOfferPayload): Promise<void> {
    this.report(
      await this.store.calculateOffer(this.id, payload),
      payload.persist ? 'tenderManagement.message.offerSaved' : undefined,
    );
  }

  protected async submit(): Promise<void> {
    this.report(await this.store.submit(this.id), 'tenderManagement.message.submitted');
  }

  protected openConvert(): void {
    this.convertError.set(null);
    this.converting.set(true);
  }

  protected async convert(payload: TndConvertPayload): Promise<void> {
    const outcome = await this.store.convert(this.id, payload);
    this.convertError.set(outcome.errorKey);
    this.convertParams.set(outcome.errorParams);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('tenderManagement.message.converted'));
    }
  }
}
