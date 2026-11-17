import { DatePipe, DecimalPipe } from '@angular/common';
import {
  Component,
  computed,
  effect,
  inject,
  input,
  output,
  signal,
  untracked,
} from '@angular/core';
import { form, FormField, min, required } from '@angular/forms/signals';
import { RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CandidateApplication,
  CONTRACT_TYPES,
  RecruitingContractType,
  EMPLOYMENT_TYPES,
  RecruitingEmploymentType,
  HireResult,
  I18nService,
  JobOfferLetter,
  OfferPayload,
  RecruitingApiService,
} from '@core';
import { TranslatePipe } from '@shared';
import { fieldErrors, recruitingErrorCode, recruitingErrorKey } from '../shared/recruiting-errors';
import { OFFER_STATUS_COLORS } from '../shared/recruiting-labels';

export interface OfferFormModel {
  proposed_salary: number | null;
  currency: string;
  start_date: string;
  employment_type: RecruitingEmploymentType;
  contract_type: RecruitingContractType;
  weekly_hours: number | null;
  probation_months: number | null;
  valid_until: string;
  send: boolean;
}

const ACTIVE_OFFER_STATUSES = new Set(['draft', 'sent', 'signed']);

const blankOffer = (): OfferFormModel => ({
  proposed_salary: null,
  currency: 'CHF',
  start_date: '',
  employment_type: 'full_time',
  contract_type: 'permanent',
  weekly_hours: 42,
  probation_months: 3,
  valid_until: '',
  send: true,
});

/**
 * Offer tab: create/send an offer, record signature or decline (manual
 * signature provider), and hire the candidate once the offer is signed.
 */
@Component({
  selector: 'app-offer-panel',
  imports: [
    DatePipe,
    DecimalPipe,
    FormField,
    RouterLink,
    NzAlertModule,
    NzButtonModule,
    NzCheckboxModule,
    NzDescriptionsModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  templateUrl: './offer-panel.component.html',
  styleUrl: './offer-panel.component.scss',
})
export class OfferPanelComponent {
  private readonly api = inject(RecruitingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly application = input.required<CandidateApplication>();
  readonly offerChanged = output<JobOfferLetter>();
  readonly hired = output<HireResult>();
  /** Emitted when the server state may differ from ours (e.g. hire 409). */
  readonly reloadRequested = output<void>();

  readonly statusColors = OFFER_STATUS_COLORS;
  readonly employmentTypes = EMPLOYMENT_TYPES;
  readonly contractTypes = CONTRACT_TYPES;
  readonly currencies = ['CHF', 'EUR'];

  readonly offer = signal<JobOfferLetter | null>(null);
  readonly busy = signal(false);
  readonly submitted = signal(false);
  readonly serverErrors = signal<Record<string, string>>({});
  readonly hireConfirmOpen = signal(false);
  readonly hiring = signal(false);
  readonly hireResult = signal<HireResult | null>(null);
  readonly needsSignature = signal(false);

  readonly model = signal<OfferFormModel>(blankOffer());
  readonly offerForm = form(this.model, (p) => {
    required(p.proposed_salary);
    min(p.proposed_salary, 0);
    required(p.start_date);
    min(p.weekly_hours, 1);
    min(p.probation_months, 0);
  });

  readonly readOnly = computed(() => this.application().is_anonymized);
  readonly terminal = computed(() => {
    const stage = this.application().stage;
    return stage === 'hired' || stage === 'rejected';
  });
  readonly canCreate = computed(() => {
    const current = this.offer();
    return (
      !this.readOnly() &&
      !this.terminal() &&
      (!current || !ACTIVE_OFFER_STATUSES.has(current.status))
    );
  });
  readonly canSign = computed(() => {
    const o = this.offer();
    return !!o && !this.readOnly() && (o.status === 'sent' || o.status === 'draft');
  });
  readonly canHire = computed(
    () => this.offer()?.status === 'signed' && !this.terminal() && !this.readOnly(),
  );

  constructor() {
    effect(() => {
      const app = this.application();
      untracked(() => this.offer.set(app.offer));
    });
  }

  fieldStatus(path: keyof OfferFormModel, invalid: boolean): 'error' | '' {
    return (this.submitted() && invalid) || this.serverErrors()[path] ? 'error' : '';
  }

  fieldTip(path: keyof OfferFormModel): string {
    return this.serverErrors()[path] ?? this.i18n.translate('hr.recruiting.validation.required');
  }

  createOffer(): void {
    if (this.busy() || !this.canCreate()) {
      return;
    }
    this.submitted.set(true);
    if (this.offerForm().invalid()) {
      return;
    }
    const m = this.model();
    const payload: OfferPayload = {
      proposed_salary: m.proposed_salary as number,
      currency: m.currency,
      start_date: m.start_date,
      employment_type: m.employment_type,
      contract_type: m.contract_type,
      weekly_hours: m.weekly_hours ?? undefined,
      probation_months: m.probation_months ?? undefined,
      valid_until: m.valid_until || null,
      send: m.send,
    };
    this.busy.set(true);
    this.serverErrors.set({});
    this.api.createOffer(this.application().id, payload).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.submitted.set(false);
        this.model.set(blankOffer());
        this.setOffer(
          res.data,
          m.send ? 'hr.recruiting.offer.sent' : 'hr.recruiting.offer.draftSaved',
        );
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  markSigned(): void {
    const o = this.offer();
    if (!o || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.markOfferSigned(o.id).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.needsSignature.set(false);
        this.setOffer(res.data, 'hr.recruiting.offer.signedRecorded');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  decline(): void {
    const o = this.offer();
    if (!o || this.busy()) {
      return;
    }
    this.busy.set(true);
    this.api.declineOffer(o.id).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.setOffer(res.data, 'hr.recruiting.offer.declinedRecorded');
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  openHireConfirm(): void {
    if (!this.canHire() || this.hiring()) {
      return;
    }
    this.hireConfirmOpen.set(true);
  }

  /** Calls the hire endpoint once; repeated clicks while pending are ignored. */
  confirmHire(): void {
    if (this.hiring()) {
      return;
    }
    this.hiring.set(true);
    this.api.hire(this.application().id, { start_onboarding: true }).subscribe({
      next: (res) => {
        this.hiring.set(false);
        this.hireConfirmOpen.set(false);
        this.hireResult.set(res.data);
        this.message.success(
          this.i18n.translate('hr.recruiting.hire.success', {
            number: res.data.employee.employee_number,
          }),
        );
        this.hired.emit(res.data);
      },
      error: (err: unknown) => {
        this.hiring.set(false);
        this.hireConfirmOpen.set(false);
        const code = recruitingErrorCode(err);
        if (code === 'offer_not_signed') {
          this.needsSignature.set(true);
        }
        this.message.error(this.i18n.translate(recruitingErrorKey(err)));
        if (code) {
          this.reloadRequested.emit();
        }
      },
    });
  }

  private setOffer(offer: JobOfferLetter, messageKey: string): void {
    this.offer.set(offer);
    this.message.success(this.i18n.translate(messageKey));
    this.offerChanged.emit(offer);
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.serverErrors.set(fieldErrors(err));
    this.message.error(this.i18n.translate(recruitingErrorKey(err)));
  }
}
