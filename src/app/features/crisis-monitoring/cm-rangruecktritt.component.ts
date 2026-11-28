import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CrisisBasis, CrisisLoan, CrisisLoanPayload, CrisisLocale, TranslateService } from '@core';
import { downloadBlob, MoneyPipe, TranslatePipe } from '@shared';
import { CrisisMonitoringStore, CrisisOutcome } from './crisis-monitoring.store';
import {
  CRISIS_BASES,
  CRISIS_CREDITOR_TYPES,
  CRISIS_INTEREST_TREATMENTS,
  CRISIS_LOAN_SCOPES,
  CRISIS_LOAN_STATUSES,
  CRISIS_LOCALES,
  emptyLoan,
  isLoanValid,
  todayIso,
} from './crisis-monitoring.util';

const CALCULATOR_DEBOUNCE_MS = 400;

interface LoanFormValue {
  creditor_name: string;
  creditor_type: CrisisLoanPayload['creditor_type'];
  principal: string;
  interest_rate: string;
  interest_treatment: CrisisLoanPayload['interest_treatment'];
  agreement_date: string;
  effective_from: string;
  deferral_end_date: string;
  scope: CrisisLoanPayload['scope'];
  status: CrisisLoanPayload['status'];
  notes: string;
}

/** Rangruecktritt manager: the subordinated loans, the add/edit modal, agreement PDFs and the live required-subordination calculator. */
@Component({
  selector: 'app-cm-rangruecktritt',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    MoneyPipe,
    TranslatePipe,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  styleUrl: './crisis-monitoring.scss',
  template: `
    <div class="cm-split">
      <nz-card
        [nzTitle]="'crisis.loans.title' | translate"
        [nzExtra]="addAction"
        data-testid="cm-loans"
      >
        <ng-template #addAction>
          @if (canWrite()) {
            <button
              nz-button
              nzType="primary"
              nzSize="small"
              data-testid="cm-add-loan"
              (click)="openModal(null)"
            >
              {{ 'crisis.loans.add' | translate }}
            </button>
          }
        </ng-template>

        <div class="cm-field">
          <label for="cm-agreement-locale">{{ 'crisis.loans.agreementLocale' | translate }}</label>
          <nz-select
            nzId="cm-agreement-locale"
            [ngModel]="agreementLocale()"
            (ngModelChange)="agreementLocale.set($event)"
          >
            @for (code of locales; track code) {
              <nz-option [nzValue]="code" [nzLabel]="'crisis.locale.' + code | translate" />
            }
          </nz-select>
        </div>

        @if (store.loans().length === 0) {
          <nz-empty [nzNotFoundContent]="'crisis.loans.empty' | translate" />
        } @else {
          <nz-table
            #loanTable
            nzSize="small"
            [nzData]="store.loans()"
            [nzShowPagination]="false"
            [nzScroll]="{ x: '720px' }"
          >
            <thead>
              <tr>
                <th>{{ 'crisis.loans.col.creditor' | translate }}</th>
                <th class="cm-num">{{ 'crisis.loans.col.principal' | translate }}</th>
                <th class="cm-num">{{ 'crisis.loans.col.rate' | translate }}</th>
                <th>{{ 'crisis.loans.col.scope' | translate }}</th>
                <th>{{ 'crisis.loans.col.status' | translate }}</th>
                <th class="cm-num">{{ 'crisis.loans.col.claim' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (loan of loanTable.data; track loan.id) {
                <tr [class.cm-muted]="loan.status === 'released'">
                  <td>
                    {{ loan.creditor_name }}
                    <div class="cm-note">
                      {{ 'crisis.loans.creditorType.' + loan.creditor_type | translate }}
                    </div>
                  </td>
                  <td class="cm-num">{{ loan.principal | money: store.currency() }}</td>
                  <td class="cm-num">{{ loan.interest_rate }}%</td>
                  <td>{{ 'crisis.loans.scope.' + loan.scope | translate }}</td>
                  <td>
                    <nz-tag [nzColor]="loan.status === 'active' ? 'success' : 'default'">
                      {{ 'crisis.loans.status.' + loan.status | translate }}
                    </nz-tag>
                  </td>
                  <td class="cm-num">{{ loan.claim_at_horizon | money: store.currency() }}</td>
                  <td>
                    <div class="cm-actions">
                      <button
                        nz-button
                        nzSize="small"
                        [disabled]="store.downloading()"
                        (click)="downloadAgreement(loan)"
                      >
                        {{ 'crisis.loans.agreement' | translate }}
                      </button>
                      @if (canWrite()) {
                        <button nz-button nzSize="small" (click)="openModal(loan)">
                          {{ 'crisis.loans.edit' | translate }}
                        </button>
                        <button
                          nz-button
                          nzSize="small"
                          nzDanger
                          nz-popconfirm
                          [nzPopconfirmTitle]="'crisis.loans.deleteConfirm' | translate"
                          (nzOnConfirm)="remove(loan.id)"
                        >
                          {{ 'crisis.loans.delete' | translate }}
                        </button>
                      }
                    </div>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </nz-card>

      <nz-card [nzTitle]="'crisis.calc.title' | translate" data-testid="cm-calculator">
        <p class="cm-note">{{ 'crisis.calc.hint' | translate }}</p>
        <nz-spin [nzSpinning]="store.requirementLoading()">
          <div class="cm-field">
            <label for="cm-calc-horizon">{{ 'crisis.calc.horizon' | translate }}</label>
            <nz-input-number
              nzId="cm-calc-horizon"
              [nzMin]="1"
              [nzMax]="36"
              [nzStep]="1"
              [ngModel]="horizonMonths()"
              (ngModelChange)="setHorizon($event)"
            />
          </div>
          <div class="cm-field">
            <label for="cm-calc-rate">{{ 'crisis.calc.rate' | translate }}</label>
            <nz-input-number
              nzId="cm-calc-rate"
              [nzMin]="0"
              [nzMax]="100"
              [nzStep]="0.25"
              [ngModel]="interestRate()"
              (ngModelChange)="setRate($event)"
            />
          </div>
          <div class="cm-field">
            <label for="cm-calc-basis">{{ 'crisis.calc.basis' | translate }}</label>
            <nz-select nzId="cm-calc-basis" [ngModel]="basis()" (ngModelChange)="setBasis($event)">
              @for (code of bases; track code) {
                <nz-option [nzValue]="code" [nzLabel]="'crisis.basis.' + code | translate" />
              }
            </nz-select>
          </div>

          @if (store.requirement(); as requirement) {
            <div data-testid="cm-requirement">
              <div class="cm-kv">
                <span>{{ 'crisis.calc.shortfall' | translate }}</span>
                <span>{{ requirement.shortfall | money: store.currency() }}</span>
              </div>
              <div class="cm-kv">
                <span>{{ 'crisis.calc.covered' | translate }}</span>
                <span>{{ requirement.active_claims_covered | money: store.currency() }}</span>
              </div>
              <div class="cm-kv">
                <span>{{ 'crisis.calc.remaining' | translate }}</span>
                <span>{{ requirement.remaining_shortfall | money: store.currency() }}</span>
              </div>
              <div class="cm-kv">
                <span>{{ 'crisis.calc.requiredClaim' | translate }}</span>
                <strong data-testid="cm-required-claim">
                  {{ requirement.required_claim_amount | money: store.currency() }}
                </strong>
              </div>
              <div class="cm-kv">
                <span>{{ 'crisis.calc.requiredPrincipal' | translate }}</span>
                <strong data-testid="cm-required-principal">
                  {{ requirement.required_principal_amount | money: store.currency() }}
                </strong>
              </div>
              <div class="cm-kv">
                <span>{{ 'crisis.calc.assumedRate' | translate }}</span>
                <span>{{ requirement.assumed_rate }}%</span>
              </div>
              <nz-tag
                [nzColor]="requirement.court_notification_required ? 'error' : 'success'"
                data-testid="cm-court-flag"
              >
                {{
                  (requirement.court_notification_required
                    ? 'crisis.calc.courtRequired'
                    : 'crisis.calc.courtNotRequired'
                  ) | translate
                }}
              </nz-tag>
            </div>
          }
        </nz-spin>
      </nz-card>
    </div>

    <nz-modal
      [nzVisible]="modalOpen()"
      [nzTitle]="'crisis.loans.formTitle' | translate"
      [nzOkText]="'crisis.loans.save' | translate"
      [nzCancelText]="'crisis.loans.cancel' | translate"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="!formValid()"
      (nzOnOk)="saveLoan()"
      (nzOnCancel)="modalOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <form [formGroup]="form" class="cm-form-grid" data-testid="cm-loan-form">
          <div class="cm-field">
            <label for="cm-loan-creditor">{{ 'crisis.loans.col.creditor' | translate }}</label>
            <input nz-input id="cm-loan-creditor" maxlength="160" formControlName="creditor_name" />
          </div>
          <div class="cm-field">
            <label for="cm-loan-type">{{ 'crisis.loans.col.creditorType' | translate }}</label>
            <nz-select nzId="cm-loan-type" formControlName="creditor_type">
              @for (code of creditorTypes; track code) {
                <nz-option
                  [nzValue]="code"
                  [nzLabel]="'crisis.loans.creditorType.' + code | translate"
                />
              }
            </nz-select>
          </div>
          <div class="cm-field">
            <label for="cm-loan-principal">{{ 'crisis.loans.col.principal' | translate }}</label>
            <input
              nz-input
              id="cm-loan-principal"
              inputmode="decimal"
              formControlName="principal"
            />
          </div>
          <div class="cm-field">
            <label for="cm-loan-rate">{{ 'crisis.loans.col.rate' | translate }}</label>
            <input nz-input id="cm-loan-rate" inputmode="decimal" formControlName="interest_rate" />
          </div>
          <div class="cm-field">
            <label for="cm-loan-treatment">{{ 'crisis.loans.col.treatment' | translate }}</label>
            <nz-select nzId="cm-loan-treatment" formControlName="interest_treatment">
              @for (code of treatments; track code) {
                <nz-option
                  [nzValue]="code"
                  [nzLabel]="'crisis.loans.treatment.' + code | translate"
                />
              }
            </nz-select>
          </div>
          <div class="cm-field">
            <label for="cm-loan-scope">{{ 'crisis.loans.col.scope' | translate }}</label>
            <nz-select nzId="cm-loan-scope" formControlName="scope">
              @for (code of scopes; track code) {
                <nz-option [nzValue]="code" [nzLabel]="'crisis.loans.scope.' + code | translate" />
              }
            </nz-select>
          </div>
          <div class="cm-field">
            <label for="cm-loan-agreement">{{ 'crisis.loans.agreementDate' | translate }}</label>
            <input nz-input id="cm-loan-agreement" type="date" formControlName="agreement_date" />
          </div>
          <div class="cm-field">
            <label for="cm-loan-effective">{{ 'crisis.loans.effectiveFrom' | translate }}</label>
            <input nz-input id="cm-loan-effective" type="date" formControlName="effective_from" />
          </div>
          <div class="cm-field">
            <label for="cm-loan-deferral">{{ 'crisis.loans.deferralEnd' | translate }}</label>
            <input nz-input id="cm-loan-deferral" type="date" formControlName="deferral_end_date" />
          </div>
          <div class="cm-field">
            <label for="cm-loan-status">{{ 'crisis.loans.col.status' | translate }}</label>
            <nz-select nzId="cm-loan-status" formControlName="status">
              @for (code of statuses; track code) {
                <nz-option [nzValue]="code" [nzLabel]="'crisis.loans.status.' + code | translate" />
              }
            </nz-select>
          </div>
          <div class="cm-field">
            <label for="cm-loan-notes">{{ 'crisis.loans.notes' | translate }}</label>
            <textarea nz-input id="cm-loan-notes" rows="3" formControlName="notes"></textarea>
          </div>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class CmRangruecktrittComponent implements OnInit {
  protected readonly store = inject(CrisisMonitoringStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly fb = inject(FormBuilder).nonNullable;

  protected readonly locales = CRISIS_LOCALES;
  protected readonly bases = CRISIS_BASES;
  protected readonly creditorTypes = CRISIS_CREDITOR_TYPES;
  protected readonly treatments = CRISIS_INTEREST_TREATMENTS;
  protected readonly scopes = CRISIS_LOAN_SCOPES;
  protected readonly statuses = CRISIS_LOAN_STATUSES;

  /** Whether the user may maintain the loans; the screen passes it down from the permission check. */
  readonly canWrite = input(true);
  protected readonly agreementLocale = signal<CrisisLocale>('en');
  protected readonly modalOpen = signal(false);
  protected readonly editingId = signal<string | null>(null);

  protected readonly horizonMonths = signal(12);
  protected readonly interestRate = signal<number | null>(null);
  protected readonly basis = signal<CrisisBasis>('going_concern');

  protected readonly form = this.fb.group({
    creditor_name: ['', [Validators.required, Validators.maxLength(160)]],
    creditor_type: this.fb.control<CrisisLoanPayload['creditor_type']>('shareholder'),
    principal: ['', Validators.required],
    interest_rate: ['0.00', Validators.required],
    interest_treatment: this.fb.control<CrisisLoanPayload['interest_treatment']>('deferred'),
    agreement_date: ['', Validators.required],
    effective_from: ['', Validators.required],
    deferral_end_date: [''],
    scope: this.fb.control<CrisisLoanPayload['scope']>('principal_and_interest'),
    status: this.fb.control<CrisisLoanPayload['status']>('draft'),
    notes: [''],
  });
  private readonly formSnapshot = signal(this.form.getRawValue());
  protected readonly formValid = computed(() => isLoanValid(this.toPayload(this.formSnapshot())));

  private timer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.form.valueChanges.subscribe(() => this.formSnapshot.set(this.form.getRawValue()));
    inject(DestroyRef).onDestroy(() => {
      if (this.timer !== null) {
        clearTimeout(this.timer);
      }
    });
  }

  ngOnInit(): void {
    const language = this.i18n.currentLanguage();

    if ((CRISIS_LOCALES as readonly string[]).includes(language)) {
      this.agreementLocale.set(language as CrisisLocale);
    }
    void this.calculate();
  }

  protected setHorizon(value: number | null): void {
    this.horizonMonths.set(value ?? 12);
    this.scheduleCalculation();
  }

  protected setRate(value: number | null): void {
    this.interestRate.set(value);
    this.scheduleCalculation();
  }

  protected setBasis(value: CrisisBasis): void {
    this.basis.set(value);
    this.scheduleCalculation();
  }

  private scheduleCalculation(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
    }
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.calculate();
    }, CALCULATOR_DEBOUNCE_MS);
  }

  private async calculate(): Promise<void> {
    const rate = this.interestRate();
    const outcome = await this.store.calculateRequirement(
      this.horizonMonths(),
      rate === null ? null : String(rate),
      this.basis(),
    );

    if (!outcome.ok) {
      this.message.error(this.i18n.translate(outcome.error ?? 'crisis.error.generic'));
    }
  }

  protected openModal(existing: CrisisLoan | null): void {
    this.editingId.set(existing?.id ?? null);
    const loan: CrisisLoanPayload = existing ?? emptyLoan(todayIso());

    this.form.reset({
      creditor_name: loan.creditor_name,
      creditor_type: loan.creditor_type,
      principal: loan.principal,
      interest_rate: loan.interest_rate,
      interest_treatment: loan.interest_treatment,
      agreement_date: loan.agreement_date,
      effective_from: loan.effective_from,
      deferral_end_date: loan.deferral_end_date ?? '',
      scope: loan.scope,
      status: loan.status,
      notes: loan.notes ?? '',
    });
    this.formSnapshot.set(this.form.getRawValue());
    this.modalOpen.set(true);
  }

  private toPayload(value: LoanFormValue): CrisisLoanPayload {
    return {
      creditor_name: value.creditor_name,
      creditor_type: value.creditor_type,
      principal: value.principal,
      interest_rate: value.interest_rate,
      interest_treatment: value.interest_treatment,
      agreement_date: value.agreement_date,
      effective_from: value.effective_from,
      deferral_end_date: value.deferral_end_date === '' ? null : value.deferral_end_date,
      scope: value.scope,
      status: value.status,
      notes: value.notes.trim() === '' ? null : value.notes,
    };
  }

  protected async saveLoan(): Promise<void> {
    const payload = this.toPayload(this.form.getRawValue());

    if (!isLoanValid(payload)) {
      return;
    }
    const outcome = await this.store.saveLoan(this.editingId(), payload);

    if (outcome.ok) {
      this.modalOpen.set(false);
      void this.calculate();
    }
    this.report(outcome, 'crisis.loans.saved');
  }

  protected async remove(id: string): Promise<void> {
    const outcome = await this.store.deleteLoan(id);

    if (outcome.ok) {
      void this.calculate();
    }
    this.report(outcome, 'crisis.loans.deleted');
  }

  protected async downloadAgreement(loan: CrisisLoan): Promise<void> {
    const result = await this.store.downloadAgreement(loan, this.agreementLocale());

    if (result.ok && result.blob !== null) {
      downloadBlob(result.blob, result.filename);
    } else {
      this.message.error(this.i18n.translate(result.error ?? 'crisis.error.generic'));
    }
  }

  private report(outcome: CrisisOutcome, successKey: string): void {
    if (outcome.ok) {
      this.message.success(this.i18n.translate(successKey));
    } else {
      this.message.error(this.i18n.translate(outcome.error ?? 'crisis.error.generic'));
    }
  }
}
