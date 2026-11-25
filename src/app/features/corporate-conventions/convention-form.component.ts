import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  FormsModule,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CCV_BILLING_CYCLES,
  CCV_PARTNER_TYPES,
  CCV_RULE_TYPES,
  CCV_SUBSIDY_PURPOSES,
  CCV_SUBSIDY_TYPES,
  CCV_VERIFICATION_METHODS,
  CcvBillingCycle,
  CcvConvention,
  CcvConventionPayload,
  CcvDiscountRule,
  CcvIdentifierStats,
  CcvImportResult,
  CcvLookups,
  CcvPartnerType,
  CcvSubsidyPurpose,
  CcvSubsidyType,
  CcvVerificationMethod,
} from '@core';
import { TranslatePipe } from '@shared';
import {
  CcvOutcome,
  cleanPayload,
  conventionToPayload,
  emptyConvention,
  emptyRule,
  identifierHint,
  isValidDomain,
  isValidPattern,
  matrixProblems,
  moveRule,
  normalizeDomain,
  parseIdentifiers,
  renumber,
  sha256Hex,
  sortRules,
} from './corporate-conventions.util';

interface LocalPreviewRow {
  hint: string;
  sha256: string;
}

/**
 * Create / edit form of a convention in four tabs: general and partner data, eligibility and verification (work e-mail domains,
 * card prefix and pattern, promo code, SHA-256 employee list, family members), the priority-ordered discount matrix with the
 * annual cap, and split billing with the employer subsidy.
 */
@Component({
  selector: 'app-ccv-convention-form',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzSwitchModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    ReactiveFormsModule,
    TranslatePipe,
  ],
  styleUrl: './corporate-conventions.scss',
  template: `
    @if (error(); as failure) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="form-alert"
        [nzMessage]="failure.errorKey ?? '' | translate: failure.params"
        [nzDescription]="failure.detail"
      ></nz-alert>
    }

    <form [formGroup]="form" (ngSubmit)="submit()" novalidate>
      <nz-tabs>
        <nz-tab [nzTitle]="'corporateConventions.tab.general' | translate">
          <div class="grid">
            <label class="field" for="ccv-code">
              <span>{{ 'corporateConventions.field.code' | translate }}</span>
              <input nz-input id="ccv-code" formControlName="code" maxlength="40" />
            </label>
            <label class="field" for="ccv-name">
              <span>{{ 'corporateConventions.field.name' | translate }}</span>
              <input nz-input id="ccv-name" formControlName="name" maxlength="160" />
            </label>
            <label class="field" for="ccv-partner">
              <span>{{ 'corporateConventions.field.partnerCompanyName' | translate }}</span>
              <input
                nz-input
                id="ccv-partner"
                formControlName="partner_company_name"
                maxlength="160"
              />
            </label>
            <label class="field" for="ccv-type">
              <span>{{ 'corporateConventions.field.partnerType' | translate }}</span>
              <nz-select nzId="ccv-type" formControlName="partner_type">
                @for (type of partnerTypes; track type) {
                  <nz-option
                    [nzValue]="type"
                    [nzLabel]="'corporateConventions.partnerType.' + type | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label class="field" for="ccv-country">
              <span>{{ 'corporateConventions.field.country' | translate }}</span>
              <nz-select nzId="ccv-country" formControlName="country_code">
                <nz-option nzValue="IT" nzLabel="IT · EUR"></nz-option>
                <nz-option nzValue="CH" nzLabel="CH · CHF"></nz-option>
              </nz-select>
            </label>
            @if (values().country_code === 'IT') {
              <label class="field" for="ccv-vat">
                <span>{{ 'corporateConventions.field.vatNumber' | translate }}</span>
                <input nz-input id="ccv-vat" formControlName="partner_vat_number" maxlength="20" />
              </label>
            } @else {
              <label class="field" for="ccv-uid">
                <span>{{ 'corporateConventions.field.uidNumber' | translate }}</span>
                <input nz-input id="ccv-uid" formControlName="partner_uid_number" maxlength="20" />
              </label>
            }
            <label class="field" for="ccv-from">
              <span>{{ 'corporateConventions.field.validFrom' | translate }}</span>
              <input nz-input id="ccv-from" type="date" formControlName="valid_from" />
            </label>
            <label class="field" for="ccv-to">
              <span>{{ 'corporateConventions.field.validTo' | translate }}</span>
              <input nz-input id="ccv-to" type="date" formControlName="valid_to" />
            </label>
            <label class="field" for="ccv-population">
              <span>{{ 'corporateConventions.field.eligiblePopulation' | translate }}</span>
              <nz-input-number
                nzId="ccv-population"
                formControlName="eligible_population"
                [nzMin]="1"
                [nzStep]="1"
              ></nz-input-number>
            </label>
          </div>

          <h4>{{ 'corporateConventions.section.hrContact' | translate }}</h4>
          <div class="grid">
            <label class="field" for="ccv-hr-name">
              <span>{{ 'corporateConventions.field.hrContactName' | translate }}</span>
              <input nz-input id="ccv-hr-name" formControlName="hr_contact_name" />
            </label>
            <label class="field" for="ccv-hr-email">
              <span>{{ 'corporateConventions.field.hrContactEmail' | translate }}</span>
              <input nz-input id="ccv-hr-email" type="email" formControlName="hr_contact_email" />
            </label>
            <label class="field" for="ccv-hr-phone">
              <span>{{ 'corporateConventions.field.hrContactPhone' | translate }}</span>
              <input nz-input id="ccv-hr-phone" formControlName="hr_contact_phone" />
            </label>
          </div>

          <h4>{{ 'corporateConventions.section.landingPage' | translate }}</h4>
          <div class="grid">
            <label class="field" for="ccv-slug">
              <span>{{ 'corporateConventions.field.slug' | translate }}</span>
              <input nz-input id="ccv-slug" formControlName="slug" maxlength="120" />
              <small>{{ 'corporateConventions.hint.slug' | translate }}</small>
            </label>
            <label class="field" for="ccv-color">
              <span>{{ 'corporateConventions.field.primaryColor' | translate }}</span>
              <input nz-input id="ccv-color" type="color" formControlName="primary_color" />
            </label>
            <label class="field" for="ccv-welcome">
              <span>{{ 'corporateConventions.field.welcomeMessageKey' | translate }}</span>
              <input
                nz-input
                id="ccv-welcome"
                formControlName="welcome_message_key"
                maxlength="120"
              />
              <small>{{ 'corporateConventions.hint.welcomeMessageKey' | translate }}</small>
            </label>
          </div>
          @if (convention(); as stored) {
            <div class="files">
              <label class="field" for="ccv-contract">
                <span>
                  {{ 'corporateConventions.field.contract' | translate }}
                  @if (stored.has_contract_document) {
                    <nz-tag nzColor="green">{{
                      'corporateConventions.label.uploaded' | translate
                    }}</nz-tag>
                  }
                </span>
                <input
                  id="ccv-contract"
                  type="file"
                  accept="application/pdf"
                  (change)="pickContract($event)"
                />
              </label>
              <label class="field" for="ccv-logo">
                <span>
                  {{ 'corporateConventions.field.logo' | translate }}
                  @if (stored.has_logo) {
                    <nz-tag nzColor="green">{{
                      'corporateConventions.label.uploaded' | translate
                    }}</nz-tag>
                  }
                </span>
                <input
                  id="ccv-logo"
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  (change)="pickLogo($event)"
                />
              </label>
            </div>
          } @else {
            <p class="hint">{{ 'corporateConventions.hint.filesAfterSave' | translate }}</p>
          }
        </nz-tab>

        <nz-tab [nzTitle]="'corporateConventions.tab.eligibility' | translate">
          <label class="field" for="ccv-methods">
            <span>{{ 'corporateConventions.field.verificationMethods' | translate }}</span>
            <nz-select nzId="ccv-methods" nzMode="multiple" formControlName="verification_methods">
              @for (method of methods; track method) {
                <nz-option
                  [nzValue]="method"
                  [nzLabel]="'corporateConventions.verification.' + method | translate"
                ></nz-option>
              }
            </nz-select>
          </label>

          @if (usesMethod('WORK_EMAIL_OTP')) {
            <label class="field" for="ccv-domains">
              <span>{{ 'corporateConventions.field.emailDomains' | translate }}</span>
              <nz-select
                nzId="ccv-domains"
                nzMode="tags"
                formControlName="allowed_email_domains"
                [nzTokenSeparators]="[',', ' ', ';']"
                [nzPlaceHolder]="'corporateConventions.placeholder.emailDomains' | translate"
              ></nz-select>
              @if (invalidDomains().length > 0) {
                <small class="error"
                  >{{ 'corporateConventions.hint.invalidDomains' | translate }}:
                  {{ invalidDomains().join(', ') }}</small
                >
              }
            </label>
          }

          @if (usesMethod('MEMBERSHIP_CARD_PREFIX')) {
            <div class="grid">
              <label class="field" for="ccv-prefix">
                <span>{{ 'corporateConventions.field.cardPrefix' | translate }}</span>
                <input
                  nz-input
                  id="ccv-prefix"
                  formControlName="card_number_prefix"
                  maxlength="40"
                />
              </label>
              <label class="field" for="ccv-regex">
                <span>{{ 'corporateConventions.field.cardRegex' | translate }}</span>
                <input
                  nz-input
                  id="ccv-regex"
                  formControlName="card_number_regex"
                  maxlength="190"
                />
                @if (!patternValid()) {
                  <small class="error">{{
                    'corporateConventions.error.convention_card_regex_invalid' | translate
                  }}</small>
                }
              </label>
            </div>
          }

          @if (usesMethod('PROMO_CODE')) {
            <label class="field" for="ccv-promo">
              <span>{{ 'corporateConventions.field.promoCode' | translate }}</span>
              <input
                nz-input
                id="ccv-promo"
                formControlName="static_convention_code"
                maxlength="60"
              />
            </label>
          }

          @if (usesMethod('HASHED_EMPLOYEE_LIST')) {
            <div class="hash-import">
              <h4>{{ 'corporateConventions.section.employeeList' | translate }}</h4>
              <p class="hint">{{ 'corporateConventions.hint.employeeList' | translate }}</p>
              @if (stats(); as counts) {
                <p>
                  <nz-tag nzColor="blue"
                    >{{ 'corporateConventions.label.listSize' | translate }}:
                    {{ counts.total }}</nz-tag
                  >
                  <nz-tag nzColor="green"
                    >{{ 'corporateConventions.label.listUsed' | translate }}:
                    {{ counts.used }}</nz-tag
                  >
                </p>
              }
              @if (convention()) {
                <textarea
                  nz-input
                  rows="5"
                  [ngModel]="pasted()"
                  [ngModelOptions]="{ standalone: true }"
                  (ngModelChange)="pasted.set($event)"
                  [placeholder]="'corporateConventions.placeholder.employeeList' | translate"
                ></textarea>
                <input
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  (change)="pickList($event)"
                />
                <div class="actions">
                  <button
                    nz-button
                    type="button"
                    [disabled]="identifiers().length === 0"
                    (click)="previewHashes()"
                  >
                    {{ 'corporateConventions.action.previewHashes' | translate }}
                  </button>
                  <button
                    nz-button
                    type="button"
                    nzType="primary"
                    [disabled]="identifiers().length === 0 || saving()"
                    (click)="importList()"
                  >
                    {{ 'corporateConventions.action.importList' | translate }} ({{
                      identifiers().length
                    }})
                  </button>
                </div>
                @if (localPreview().length > 0) {
                  <nz-table
                    #previewTable
                    nzSize="small"
                    [nzData]="localPreview()"
                    [nzShowPagination]="false"
                  >
                    <thead>
                      <tr>
                        <th>{{ 'corporateConventions.column.identifier' | translate }}</th>
                        <th>SHA-256</th>
                      </tr>
                    </thead>
                    <tbody>
                      @for (row of previewTable.data; track row.sha256) {
                        <tr>
                          <td>{{ row.hint }}</td>
                          <td class="mono">{{ row.sha256 }}</td>
                        </tr>
                      }
                    </tbody>
                  </nz-table>
                }
                @if (importResult(); as result) {
                  <nz-alert
                    nzType="info"
                    nzShowIcon
                    [nzMessage]="
                      'corporateConventions.label.importResult'
                        | translate
                          : {
                              imported: result.imported,
                              duplicates: result.duplicates,
                              invalid: result.invalid,
                              received: result.received,
                            }
                    "
                  ></nz-alert>
                }
              } @else {
                <p class="hint">{{ 'corporateConventions.hint.filesAfterSave' | translate }}</p>
              }
            </div>
          }

          <h4>{{ 'corporateConventions.section.family' | translate }}</h4>
          <div class="grid">
            <label class="switch" for="ccv-family">
              <nz-switch nzId="ccv-family" formControlName="allow_family_members"></nz-switch>
              <span>{{ 'corporateConventions.field.allowFamily' | translate }}</span>
            </label>
            @if (values().allow_family_members) {
              <label class="field" for="ccv-family-max">
                <span>{{ 'corporateConventions.field.maxFamily' | translate }}</span>
                <nz-input-number
                  nzId="ccv-family-max"
                  formControlName="max_family_members"
                  [nzMin]="1"
                  [nzMax]="20"
                ></nz-input-number>
              </label>
            }
          </div>
        </nz-tab>

        <nz-tab [nzTitle]="'corporateConventions.tab.matrix' | translate">
          <p class="hint">{{ 'corporateConventions.hint.matrix' | translate }}</p>
          <nz-table #matrixTable nzSize="small" [nzData]="rules()" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>#</th>
                <th>{{ 'corporateConventions.column.ruleType' | translate }}</th>
                <th>{{ 'corporateConventions.column.target' | translate }}</th>
                <th>{{ 'corporateConventions.column.discount' | translate }}</th>
                <th>{{ 'corporateConventions.column.minCart' | translate }}</th>
                <th>{{ 'corporateConventions.column.excludePromo' | translate }}</th>
                <th>{{ 'corporateConventions.column.cumulative' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (rule of matrixTable.data; track $index; let i = $index) {
                <tr>
                  <td>{{ rule.priority }}</td>
                  <td>
                    <nz-select
                      [ngModel]="rule.rule_type"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="updateRule(i, { rule_type: $event })"
                    >
                      @for (type of ruleTypes; track type) {
                        <nz-option
                          [nzValue]="type"
                          [nzLabel]="'corporateConventions.ruleType.' + type | translate"
                        ></nz-option>
                      }
                    </nz-select>
                  </td>
                  <td>
                    @if (rule.rule_type === 'PRICE_LIST') {
                      <nz-select
                        [ngModel]="rule.target_price_list_id"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="updateRule(i, { target_price_list_id: $event })"
                        [nzPlaceHolder]="'corporateConventions.placeholder.priceList' | translate"
                      >
                        @for (list of lookups()?.price_lists ?? []; track list.id) {
                          <nz-option [nzValue]="list.id" [nzLabel]="list.name"></nz-option>
                        }
                      </nz-select>
                    } @else if (
                      rule.rule_type === 'CATEGORY_PERCENTAGE' ||
                      rule.rule_type === 'PRODUCT_FAMILY_PERCENTAGE'
                    ) {
                      <nz-select
                        [ngModel]="rule.target_category_id"
                        [ngModelOptions]="{ standalone: true }"
                        (ngModelChange)="updateRule(i, { target_category_id: $event })"
                        [nzPlaceHolder]="'corporateConventions.placeholder.category' | translate"
                      >
                        @for (category of lookups()?.categories ?? []; track category.id) {
                          <nz-option [nzValue]="category.id" [nzLabel]="category.name"></nz-option>
                        }
                      </nz-select>
                    } @else {
                      <span class="muted">{{
                        'corporateConventions.label.allProducts' | translate
                      }}</span>
                    }
                  </td>
                  <td>
                    <nz-input-number
                      [ngModel]="rule.discount_percentage"
                      [ngModelOptions]="{ standalone: true }"
                      [nzMin]="0"
                      [nzMax]="100"
                      [nzStep]="0.5"
                      (ngModelChange)="updateRule(i, { discount_percentage: $event ?? 0 })"
                    ></nz-input-number>
                  </td>
                  <td>
                    <nz-input-number
                      [ngModel]="rule.min_cart_amount"
                      [ngModelOptions]="{ standalone: true }"
                      [nzMin]="0"
                      (ngModelChange)="updateRule(i, { min_cart_amount: $event })"
                    ></nz-input-number>
                  </td>
                  <td>
                    <nz-switch
                      [ngModel]="rule.exclude_promotional_items"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="updateRule(i, { exclude_promotional_items: $event })"
                    ></nz-switch>
                  </td>
                  <td>
                    <nz-switch
                      [ngModel]="rule.cumulative_with_other_discounts"
                      [ngModelOptions]="{ standalone: true }"
                      (ngModelChange)="updateRule(i, { cumulative_with_other_discounts: $event })"
                    ></nz-switch>
                  </td>
                  <td class="row-actions">
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [disabled]="i === 0"
                      (click)="move(i, -1)"
                      [attr.aria-label]="'corporateConventions.action.moveUp' | translate"
                    >
                      ↑
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      type="button"
                      [disabled]="i === rules().length - 1"
                      (click)="move(i, 1)"
                      [attr.aria-label]="'corporateConventions.action.moveDown' | translate"
                    >
                      ↓
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      (click)="removeRule(i)"
                      [attr.aria-label]="'corporateConventions.action.removeRule' | translate"
                    >
                      ×
                    </button>
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
          <div class="actions">
            <button nz-button type="button" (click)="addRule()">
              {{ 'corporateConventions.action.addRule' | translate }}
            </button>
          </div>
          @for (problem of problems(); track $index) {
            <small class="error">{{
              'corporateConventions.error.' + problem.code
                | translate: { row: problem.row, priority: problem.row, target: '' }
            }}</small>
          }
          <label class="field cap" for="ccv-cap">
            <span>{{ 'corporateConventions.field.annualCap' | translate }}</span>
            <nz-input-number
              nzId="ccv-cap"
              formControlName="annual_spending_cap_per_beneficiary"
              [nzMin]="0"
              [nzStep]="50"
            ></nz-input-number>
            <small>{{ 'corporateConventions.hint.annualCap' | translate }}</small>
          </label>
        </nz-tab>

        <nz-tab [nzTitle]="'corporateConventions.tab.billing' | translate">
          <label class="switch" for="ccv-subsidy">
            <nz-switch nzId="ccv-subsidy" formControlName="employer_subsidy_enabled"></nz-switch>
            <span>{{ 'corporateConventions.field.subsidyEnabled' | translate }}</span>
          </label>
          @if (values().employer_subsidy_enabled) {
            <div class="grid">
              <label class="field" for="ccv-subsidy-type">
                <span>{{ 'corporateConventions.field.subsidyType' | translate }}</span>
                <nz-select nzId="ccv-subsidy-type" formControlName="employer_subsidy_type">
                  @for (type of subsidyTypes; track type) {
                    <nz-option
                      [nzValue]="type"
                      [nzLabel]="'corporateConventions.subsidyType.' + type | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="ccv-subsidy-value">
                <span>{{ 'corporateConventions.field.subsidyValue' | translate }}</span>
                <nz-input-number
                  nzId="ccv-subsidy-value"
                  formControlName="employer_subsidy_value"
                  [nzMin]="0"
                  [nzStep]="1"
                ></nz-input-number>
              </label>
              <label class="field" for="ccv-subsidy-cap">
                <span>{{ 'corporateConventions.field.subsidyAnnualCap' | translate }}</span>
                <nz-input-number
                  nzId="ccv-subsidy-cap"
                  formControlName="employer_subsidy_annual_cap"
                  [nzMin]="0"
                  [nzStep]="50"
                ></nz-input-number>
              </label>
              <label class="field" for="ccv-subsidy-purpose">
                <span>{{ 'corporateConventions.field.subsidyPurpose' | translate }}</span>
                <nz-select nzId="ccv-subsidy-purpose" formControlName="subsidy_purpose">
                  @for (purpose of purposes; track purpose) {
                    <nz-option
                      [nzValue]="purpose"
                      [nzLabel]="'corporateConventions.subsidyPurpose.' + purpose | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
            </div>
          }
          <div class="grid">
            <label class="field" for="ccv-cycle">
              <span>{{ 'corporateConventions.field.billingCycle' | translate }}</span>
              <nz-select nzId="ccv-cycle" formControlName="billing_cycle">
                @for (cycle of cycles; track cycle) {
                  <nz-option
                    [nzValue]="cycle"
                    [nzLabel]="'corporateConventions.billingCycle.' + cycle | translate"
                  ></nz-option>
                }
              </nz-select>
            </label>
            <label class="switch" for="ccv-anon">
              <nz-switch nzId="ccv-anon" formControlName="split_billing_anonymized"></nz-switch>
              <span>{{ 'corporateConventions.field.anonymized' | translate }}</span>
            </label>
          </div>
          <p class="hint">{{ 'corporateConventions.hint.anonymized' | translate }}</p>
        </nz-tab>
      </nz-tabs>

      <div class="form-footer">
        <button nz-button type="button" (click)="cancelled.emit()">
          {{ 'corporateConventions.action.cancel' | translate }}
        </button>
        <button
          nz-button
          nzType="primary"
          type="submit"
          [nzLoading]="saving()"
          [disabled]="!canSubmit()"
        >
          {{ 'corporateConventions.action.save' | translate }}
        </button>
      </div>
    </form>
  `,
})
export class ConventionFormComponent {
  private readonly fb = inject(NonNullableFormBuilder);

  readonly convention = input<CcvConvention | null>(null);
  readonly lookups = input<CcvLookups | null>(null);
  readonly stats = input<CcvIdentifierStats | null>(null);
  readonly importResult = input<CcvImportResult | null>(null);
  readonly saving = input(false);
  readonly error = input<CcvOutcome | null>(null);

  readonly submitted = output<CcvConventionPayload>();
  readonly cancelled = output<void>();
  readonly importRequested = output<{ identifiers: string[]; dryRun: boolean }>();
  readonly contractSelected = output<File>();
  readonly logoSelected = output<File>();

  protected readonly partnerTypes: readonly CcvPartnerType[] = CCV_PARTNER_TYPES;
  protected readonly methods: readonly CcvVerificationMethod[] = CCV_VERIFICATION_METHODS;
  protected readonly ruleTypes = CCV_RULE_TYPES;
  protected readonly subsidyTypes: readonly CcvSubsidyType[] = CCV_SUBSIDY_TYPES;
  protected readonly purposes: readonly CcvSubsidyPurpose[] = CCV_SUBSIDY_PURPOSES;
  protected readonly cycles: readonly CcvBillingCycle[] = CCV_BILLING_CYCLES;

  protected readonly form = this.fb.group({
    code: ['', [Validators.required, Validators.maxLength(40)]],
    slug: [''],
    name: ['', [Validators.required, Validators.maxLength(160)]],
    partner_company_name: ['', [Validators.required, Validators.maxLength(160)]],
    partner_vat_number: [''],
    partner_uid_number: [''],
    partner_type: this.fb.control<CcvPartnerType>('CORPORATE'),
    country_code: this.fb.control<'IT' | 'CH'>('IT'),
    valid_from: ['', Validators.required],
    valid_to: [''],
    eligible_population: this.fb.control<number | null>(null),
    hr_contact_name: [''],
    hr_contact_email: ['', Validators.email],
    hr_contact_phone: [''],
    verification_methods: this.fb.control<CcvVerificationMethod[]>(['WORK_EMAIL_OTP']),
    allowed_email_domains: this.fb.control<string[]>([]),
    card_number_prefix: [''],
    card_number_regex: [''],
    static_convention_code: [''],
    allow_family_members: [false],
    max_family_members: [0],
    annual_spending_cap_per_beneficiary: this.fb.control<number | null>(null),
    employer_subsidy_enabled: [false],
    employer_subsidy_type: this.fb.control<CcvSubsidyType | null>(null),
    employer_subsidy_value: this.fb.control<number | null>(null),
    employer_subsidy_annual_cap: this.fb.control<number | null>(null),
    subsidy_purpose: this.fb.control<CcvSubsidyPurpose>('GENERAL'),
    split_billing_anonymized: [true],
    billing_cycle: this.fb.control<CcvBillingCycle>('MONTHLY'),
    primary_color: ['#1f4e79'],
    welcome_message_key: [''],
  });

  protected readonly values = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });
  protected readonly rules = signal<CcvDiscountRule[]>([emptyRule(10)]);
  protected readonly pasted = signal('');
  protected readonly localPreview = signal<LocalPreviewRow[]>([]);

  protected readonly identifiers = computed(() => parseIdentifiers(this.pasted()));
  protected readonly problems = computed(() => matrixProblems(this.rules()));
  protected readonly invalidDomains = computed(() =>
    (this.values().allowed_email_domains ?? []).filter((domain) => !isValidDomain(domain)),
  );
  protected readonly patternValid = computed(() => {
    const pattern = this.values().card_number_regex ?? '';
    return pattern === '' || isValidPattern(pattern);
  });
  protected readonly canSubmit = computed(
    () =>
      this.form.valid &&
      this.rules().length > 0 &&
      this.problems().length === 0 &&
      this.invalidDomains().length === 0 &&
      this.patternValid() &&
      (this.values().verification_methods ?? []).length > 0 &&
      !this.saving(),
  );

  constructor() {
    effect(() => {
      const stored = this.convention();
      const payload = stored === null ? emptyConvention() : conventionToPayload(stored);
      const { discount_rules: rules, ...fields } = payload;
      this.form.reset({
        ...fields,
        slug: fields.slug ?? '',
        partner_vat_number: fields.partner_vat_number ?? '',
        partner_uid_number: fields.partner_uid_number ?? '',
        valid_to: fields.valid_to ?? '',
        hr_contact_name: fields.hr_contact_name ?? '',
        hr_contact_email: fields.hr_contact_email ?? '',
        hr_contact_phone: fields.hr_contact_phone ?? '',
        card_number_prefix: fields.card_number_prefix ?? '',
        card_number_regex: fields.card_number_regex ?? '',
        static_convention_code: fields.static_convention_code ?? '',
        primary_color: fields.primary_color ?? '#1f4e79',
        welcome_message_key: fields.welcome_message_key ?? '',
      });
      this.rules.set(sortRules(rules));
      this.pasted.set('');
      this.localPreview.set([]);
    });
  }

  protected usesMethod(method: CcvVerificationMethod): boolean {
    return (this.values().verification_methods ?? []).includes(method);
  }

  protected updateRule(index: number, patch: Partial<CcvDiscountRule>): void {
    this.rules.update((rules) =>
      rules.map((rule, i) => (i === index ? { ...rule, ...patch } : rule)),
    );
  }

  protected addRule(): void {
    this.rules.update((rules) => renumber([...rules, emptyRule(0)]));
  }

  protected removeRule(index: number): void {
    this.rules.update((rules) => renumber(rules.filter((_, i) => i !== index)));
  }

  protected move(index: number, delta: -1 | 1): void {
    this.rules.update((rules) => moveRule(rules, index, delta));
  }

  protected async previewHashes(): Promise<void> {
    const sample = this.identifiers().slice(0, 5);
    this.localPreview.set(
      await Promise.all(
        sample.map(async (identifier) => ({
          hint: identifierHint(identifier),
          sha256: await sha256Hex(identifier),
        })),
      ),
    );
    this.importRequested.emit({ identifiers: this.identifiers(), dryRun: true });
  }

  protected importList(): void {
    this.importRequested.emit({ identifiers: this.identifiers(), dryRun: false });
    this.pasted.set('');
    this.localPreview.set([]);
  }

  protected async pickList(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (file) {
      this.pasted.set(await file.text());
    }
  }

  protected pickContract(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (file) {
      this.contractSelected.emit(file);
    }
  }

  protected pickLogo(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    if (file) {
      this.logoSelected.emit(file);
    }
  }

  /** The payload of the form: domains normalised, the data of unused methods dropped, rules numbered in the order shown. */
  protected payload(): CcvConventionPayload {
    const raw = this.form.getRawValue();
    return cleanPayload({
      ...raw,
      slug: raw.slug === '' ? null : raw.slug,
      partner_vat_number: raw.partner_vat_number === '' ? null : raw.partner_vat_number,
      partner_uid_number: raw.partner_uid_number === '' ? null : raw.partner_uid_number,
      currency: raw.country_code === 'CH' ? 'CHF' : 'EUR',
      valid_to: raw.valid_to === '' ? null : raw.valid_to,
      hr_contact_name: raw.hr_contact_name === '' ? null : raw.hr_contact_name,
      hr_contact_email: raw.hr_contact_email === '' ? null : raw.hr_contact_email,
      hr_contact_phone: raw.hr_contact_phone === '' ? null : raw.hr_contact_phone,
      card_number_prefix: raw.card_number_prefix === '' ? null : raw.card_number_prefix,
      card_number_regex: raw.card_number_regex === '' ? null : raw.card_number_regex,
      static_convention_code: raw.static_convention_code === '' ? null : raw.static_convention_code,
      welcome_message_key: raw.welcome_message_key === '' ? null : raw.welcome_message_key,
      allowed_email_domains: raw.allowed_email_domains.map(normalizeDomain),
      discount_rules: renumber(sortRules(this.rules())),
    });
  }

  protected submit(): void {
    if (this.canSubmit()) {
      this.submitted.emit(this.payload());
    }
  }
}
