import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { I18nService } from '@core';
import { TranslatePipe } from '@shared';
import { ProjectBillingApiService } from './project-billing-api.service';
import {
  BillingContract,
  BillingContractPayload,
  BillingModel,
  ContractStatus,
  FiscalJurisdiction,
  RetentionReleaseRule,
} from './project-billing.models';
import {
  CONTRACT_STATUS_KEYS,
  JURISDICTION_KEYS,
  MODEL_KEYS,
  RELEASE_RULE_KEYS,
} from './project-billing.utils';

/** The editable terms of a contract; numbers are null while a field is empty. */
interface ContractDraft {
  billing_model: BillingModel;
  fiscal_jurisdiction: FiscalJurisdiction;
  currency_code: string;
  contract_total_value: number | null;
  advance_payment_percent: number | null;
  advance_payment_amount: number | null;
  retention_guarantee_percent: number | null;
  retention_release_rule: RetentionReleaseRule;
  retention_release_date: string;
  cap_amount: number | null;
  markup_percent: number | null;
  prepaid_hours_allowance: number | null;
  prepaid_amount_allowance: number | null;
  low_balance_alert_threshold_percent: number | null;
  cig: string;
  cup: string;
  contract_reference: string;
  contract_date: string;
}

/** Moves a contract can make from each status; mirrors the API. */
const NEXT_STATUSES: Record<ContractStatus, ContractStatus[]> = {
  draft: ['active', 'closed'],
  active: ['on_hold', 'completed', 'closed'],
  on_hold: ['active', 'closed'],
  completed: ['active', 'closed'],
  closed: [],
};

function emptyDraft(currency: string): ContractDraft {
  return {
    billing_model: 'time_and_materials',
    fiscal_jurisdiction: currency === 'CHF' ? 'CH' : 'IT',
    currency_code: currency,
    contract_total_value: null,
    advance_payment_percent: null,
    advance_payment_amount: null,
    retention_guarantee_percent: null,
    retention_release_rule: 'manual',
    retention_release_date: '',
    cap_amount: null,
    markup_percent: null,
    prepaid_hours_allowance: null,
    prepaid_amount_allowance: null,
    low_balance_alert_threshold_percent: 10,
    cig: '',
    cup: '',
    contract_reference: '',
    contract_date: '',
  };
}

function toDraft(contract: BillingContract): ContractDraft {
  const number = (value: string | null): number | null => (value === null ? null : Number(value));

  return {
    billing_model: contract.billing_model,
    fiscal_jurisdiction: contract.fiscal_jurisdiction,
    currency_code: contract.currency_code,
    contract_total_value: number(contract.contract_total_value),
    advance_payment_percent: number(contract.advance_payment_percent),
    advance_payment_amount: number(contract.advance_payment_amount),
    retention_guarantee_percent: number(contract.retention_guarantee_percent),
    retention_release_rule: contract.retention_release_rule,
    retention_release_date: contract.retention_release_date ?? '',
    cap_amount: number(contract.cap_amount),
    markup_percent: number(contract.markup_percent),
    prepaid_hours_allowance: number(contract.prepaid_hours_allowance),
    prepaid_amount_allowance: number(contract.prepaid_amount_allowance),
    low_balance_alert_threshold_percent: number(contract.low_balance_alert_threshold_percent),
    cig: contract.cig ?? '',
    cup: contract.cup ?? '',
    contract_reference: contract.contract_reference ?? '',
    contract_date: contract.contract_date ?? '',
  };
}

/** Terms of the billing contract of a project (Mod 081) and its status life cycle. */
@Component({
  selector: 'app-billing-contract-form',
  imports: [
    FormsModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    @if (contract(); as current) {
      <p>
        <nz-tag data-testid="contract-status">{{
          statusKey(current.billing_status) | translate
        }}</nz-tag>
        <span class="bf-muted">{{
          'PROJECT_BILLING.VERSION' | translate: { version: current.version }
        }}</span>
      </p>
    } @else {
      <p class="bf-muted" data-testid="contract-missing">
        {{ 'PROJECT_BILLING.NO_CONTRACT' | translate }}
      </p>
    }

    <div class="bf-grid" data-testid="contract-form">
      <label for="billing-contract-form-field-12" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_MODEL' | translate }}</span>
        <nz-select nzId="billing-contract-form-field-12"
          data-testid="contract-model"
          [ngModel]="draft().billing_model"
          (ngModelChange)="patch('billing_model', $event)"
          [nzDisabled]="!canWrite()"
        >
          @for (model of models; track model) {
            <nz-option [nzValue]="model" [nzLabel]="modelKey(model) | translate" />
          }
        </nz-select>
      </label>
      <label for="billing-contract-form-field-11" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_JURISDICTION' | translate }}</span>
        <nz-select nzId="billing-contract-form-field-11"
          [ngModel]="draft().fiscal_jurisdiction"
          (ngModelChange)="patch('fiscal_jurisdiction', $event)"
          [nzDisabled]="!canWrite()"
        >
          @for (jurisdiction of jurisdictions; track jurisdiction) {
            <nz-option
              [nzValue]="jurisdiction"
              [nzLabel]="jurisdictionKey(jurisdiction) | translate"
            />
          }
        </nz-select>
      </label>
      <label for="billing-contract-form-field-10" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_VALUE' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-10"
          data-testid="contract-value"
          [ngModel]="draft().contract_total_value"
          (ngModelChange)="patch('contract_total_value', $event)"
          [nzMin]="0"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-9" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_ADVANCE_PERCENT' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-9"
          [ngModel]="draft().advance_payment_percent"
          (ngModelChange)="patch('advance_payment_percent', $event)"
          [nzMin]="0"
          [nzMax]="100"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-8" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_ADVANCE_AMOUNT' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-8"
          [ngModel]="draft().advance_payment_amount"
          (ngModelChange)="patch('advance_payment_amount', $event)"
          [nzMin]="0"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-7" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_RETENTION_PERCENT' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-7"
          data-testid="contract-retention"
          [ngModel]="draft().retention_guarantee_percent"
          (ngModelChange)="patch('retention_guarantee_percent', $event)"
          [nzMin]="0"
          [nzMax]="100"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-6" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_RELEASE_RULE' | translate }}</span>
        <nz-select nzId="billing-contract-form-field-6"
          [ngModel]="draft().retention_release_rule"
          (ngModelChange)="patch('retention_release_rule', $event)"
          [nzDisabled]="!canWrite()"
        >
          @for (rule of rules; track rule) {
            <nz-option [nzValue]="rule" [nzLabel]="ruleKey(rule) | translate" />
          }
        </nz-select>
      </label>

      <label class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_RELEASE_DATE' | translate }}</span>
        <input
          nz-input
          type="date"
          [ngModel]="draft().retention_release_date"
          (ngModelChange)="patch('retention_release_date', $event)"
          [disabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-5" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_CAP' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-5"
          [ngModel]="draft().cap_amount"
          (ngModelChange)="patch('cap_amount', $event)"
          [nzMin]="0"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-4" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_MARKUP' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-4"
          [ngModel]="draft().markup_percent"
          (ngModelChange)="patch('markup_percent', $event)"
          [nzMin]="0"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-3" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_PREPAID_HOURS' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-3"
          [ngModel]="draft().prepaid_hours_allowance"
          (ngModelChange)="patch('prepaid_hours_allowance', $event)"
          [nzMin]="0"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field-2" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_PREPAID_AMOUNT' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field-2"
          [ngModel]="draft().prepaid_amount_allowance"
          (ngModelChange)="patch('prepaid_amount_allowance', $event)"
          [nzMin]="0"
          [nzDisabled]="!canWrite()"
        />
      </label>
      <label for="billing-contract-form-field" class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_LOW_BALANCE' | translate }}</span>
        <nz-input-number nzId="billing-contract-form-field"
          [ngModel]="draft().low_balance_alert_threshold_percent"
          (ngModelChange)="patch('low_balance_alert_threshold_percent', $event)"
          [nzMin]="0"
          [nzMax]="100"
          [nzDisabled]="!canWrite()"
        />
      </label>
      @if (draft().fiscal_jurisdiction === 'IT') {
        <label class="bf-field">
          <span>{{ 'PROJECT_BILLING.FIELD_CIG' | translate }}</span>
          <input
            nz-input
            maxlength="10"
            data-testid="contract-cig"
            [ngModel]="draft().cig"
            (ngModelChange)="patch('cig', $event)"
            [disabled]="!canWrite()"
          />
        </label>

        <label class="bf-field">
          <span>{{ 'PROJECT_BILLING.FIELD_CUP' | translate }}</span>
          <input
            nz-input
            maxlength="15"
            [ngModel]="draft().cup"
            (ngModelChange)="patch('cup', $event)"
            [disabled]="!canWrite()"
          />
        </label>
      }

      <label class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_REFERENCE' | translate }}</span>
        <input
          nz-input
          maxlength="100"
          [ngModel]="draft().contract_reference"
          (ngModelChange)="patch('contract_reference', $event)"
          [disabled]="!canWrite()"
        />
      </label>

      <label class="bf-field">
        <span>{{ 'PROJECT_BILLING.FIELD_CONTRACT_DATE' | translate }}</span>
        <input
          nz-input
          type="date"
          [ngModel]="draft().contract_date"
          (ngModelChange)="patch('contract_date', $event)"
          [disabled]="!canWrite()"
        />
      </label>
    </div>

    @if (canWrite()) {
      <div class="bf-actions">
        <button
          nz-button
          nzType="primary"
          type="button"
          data-testid="contract-save"
          [nzLoading]="busy()"
          (click)="save()"
        >
          {{ 'PROJECT_BILLING.SAVE' | translate }}
        </button>
        @for (status of nextStatuses(); track status) {
          <button
            nz-button
            type="button"
            [attr.data-testid]="'contract-to-' + status"
            [disabled]="busy()"
            (click)="move(status)"
          >
            {{ statusKey(status) | translate }}
          </button>
        }
      </div>
    }
  `,
})
export class BillingContractFormComponent {
  private readonly api = inject(ProjectBillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly projectId = input.required<string>();
  readonly contract = input<BillingContract | null>(null);
  readonly currency = input('EUR');
  readonly canWrite = input(false);
  readonly changed = output<BillingContract>();

  protected readonly models: BillingModel[] = [
    'time_and_materials',
    'fixed_milestone',
    'prepaid_retainer',
    'sal_progress',
    'hybrid',
  ];
  protected readonly jurisdictions: FiscalJurisdiction[] = ['IT', 'CH'];
  protected readonly rules: RetentionReleaseRule[] = [
    'manual',
    'on_acceptance',
    'on_warranty_expiry',
    'on_milestone',
  ];
  protected readonly draft = signal<ContractDraft>(emptyDraft('EUR'));
  protected readonly busy = signal(false);
  protected readonly nextStatuses = computed(
    () => NEXT_STATUSES[this.contract()?.billing_status ?? 'closed'] ?? [],
  );

  constructor() {
    effect(() => {
      const current = this.contract();
      this.draft.set(current === null ? emptyDraft(this.currency()) : toDraft(current));
    });
  }

  protected modelKey(model: BillingModel): string {
    return MODEL_KEYS[model];
  }

  protected jurisdictionKey(jurisdiction: FiscalJurisdiction): string {
    return JURISDICTION_KEYS[jurisdiction];
  }

  protected ruleKey(rule: RetentionReleaseRule): string {
    return RELEASE_RULE_KEYS[rule];
  }

  protected statusKey(status: ContractStatus): string {
    return CONTRACT_STATUS_KEYS[status];
  }

  protected patch<K extends keyof ContractDraft>(key: K, value: ContractDraft[K]): void {
    this.draft.update((current) => ({ ...current, [key]: value }));
  }

  protected save(): void {
    this.busy.set(true);
    this.api.saveContract(this.projectId(), this.payload()).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.message.success(this.i18n.translate('PROJECT_BILLING.SAVED'));
        this.changed.emit(response.data);
      },
      error: () => {
        this.busy.set(false);
        this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
      },
    });
  }

  protected move(status: ContractStatus): void {
    this.busy.set(true);
    this.api
      .changeContractStatus(this.projectId(), status, this.contract()?.version ?? null)
      .subscribe({
        next: (response) => {
          this.busy.set(false);
          this.changed.emit(response.data);
        },
        error: () => {
          this.busy.set(false);
          this.message.error(this.i18n.translate('PROJECT_BILLING.SAVE_ERROR'));
        },
      });
  }

  /** The payload of the form; blank texts become null and an existing contract carries the version it was read at. */
  private payload(): BillingContractPayload {
    const d = this.draft();
    const text = (value: string): string | null => (value.trim() === '' ? null : value.trim());

    return {
      billing_model: d.billing_model,
      fiscal_jurisdiction: d.fiscal_jurisdiction,
      currency_code: d.currency_code,
      contract_total_value: d.contract_total_value,
      advance_payment_percent: d.advance_payment_percent,
      advance_payment_amount: d.advance_payment_amount,
      retention_guarantee_percent: d.retention_guarantee_percent,
      retention_release_rule: d.retention_release_rule,
      retention_release_date: text(d.retention_release_date),
      cap_amount: d.cap_amount,
      markup_percent: d.markup_percent,
      prepaid_hours_allowance: d.prepaid_hours_allowance,
      prepaid_amount_allowance: d.prepaid_amount_allowance,
      low_balance_alert_threshold_percent: d.low_balance_alert_threshold_percent,
      cig: text(d.cig),
      cup: text(d.cup),
      contract_reference: text(d.contract_reference),
      contract_date: text(d.contract_date),
      expected_version: this.contract()?.version ?? null,
    };
  }
}
