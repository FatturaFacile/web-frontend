import { Component, computed, effect, input, output } from '@angular/core';
import { FormArray, FormBuilder, FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  TND_AWARD_CRITERIA,
  TND_FORMULA_TYPES,
  TND_JURISDICTIONS,
  TND_PROCEDURE_TYPES,
  TND_VAULT_DOC_TYPES,
  TndLookups,
  TndNotice,
  TndNoticePayload,
  TndSoaRequirement,
} from '@core';
import { TranslatePipe } from '@shared';

/** Local date-time input value (`YYYY-MM-DDTHH:mm`) of an ISO instant. */
function toLocalInput(value: string | null): string {
  if (!value) {
    return '';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '';
  }
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function toIso(value: string | null | undefined): string | null {
  return value ? new Date(value).toISOString() : null;
}

function nullable(value: string | null | undefined): string | null {
  const trimmed = (value ?? '').trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * The tender notice form (Mod 169): identification, the Italian traceability codes (CIG, CUP, RUP, dedicated account), the
 * award criterion and formula, the amounts (including the safety and labor costs not subject to discount), the SOA, turnover
 * and certification requirements, and the clarification and submission deadlines.
 */
@Component({
  selector: 'app-tnd-notice-form',
  imports: [NzButtonModule, NzInputModule, NzSelectModule, ReactiveFormsModule, TranslatePipe],
  template: `
    <form [formGroup]="form" class="notice-form" (ngSubmit)="submit()">
      <div class="grid">
        <label class="field wide" for="tnd-nf-title">
          <span>{{ 'tenderManagement.field.title' | translate }}</span>
          <input nz-input id="tnd-nf-title" formControlName="title" maxlength="240" />
        </label>
        <label class="field" for="tnd-nf-jurisdiction">
          <span>{{ 'tenderManagement.field.jurisdiction' | translate }}</span>
          <nz-select nzId="tnd-nf-jurisdiction" formControlName="jurisdiction">
            @for (value of jurisdictions; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.jurisdiction.' + value | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="tnd-nf-procedure">
          <span>{{ 'tenderManagement.field.procedureType' | translate }}</span>
          <nz-select nzId="tnd-nf-procedure" formControlName="procedure_type">
            @for (value of procedures; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.procedureType.' + value | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field wide" for="tnd-nf-authority">
          <span>{{ 'tenderManagement.field.contractingAuthority' | translate }}</span>
          <input nz-input id="tnd-nf-authority" formControlName="contracting_authority_name" maxlength="200" />
        </label>
        @if (isSwiss()) {
          <label class="field" for="tnd-nf-simap">
            <span>{{ 'tenderManagement.field.simapProjectNumber' | translate }}</span>
            <input nz-input id="tnd-nf-simap" formControlName="simap_project_number" maxlength="60" />
          </label>
        }
        @if (isItalian()) {
          <label class="field" for="tnd-nf-cig">
            <span>CIG</span>
            <input nz-input id="tnd-nf-cig" formControlName="cig_code_it" maxlength="10" />
          </label>
          <label class="field" for="tnd-nf-cup">
            <span>CUP</span>
            <input nz-input id="tnd-nf-cup" formControlName="cup_code_it" maxlength="15" />
          </label>
          <label class="field" for="tnd-nf-rup">
            <span>RUP</span>
            <input nz-input id="tnd-nf-rup" formControlName="rup_name" maxlength="160" />
          </label>
          <label class="field" for="tnd-nf-account">
            <span>{{ 'tenderManagement.field.dedicatedAccount' | translate }}</span>
            <input nz-input id="tnd-nf-account" formControlName="dedicated_bank_account_it" maxlength="34" />
          </label>
        }
        <label class="field wide" for="tnd-nf-cpv">
          <span>CPV</span>
          <nz-select nzId="tnd-nf-cpv" formControlName="cpv_category_codes" nzMode="tags" nzTokenSeparators="[',', ' ']"></nz-select>
        </label>
        <label class="field" for="tnd-nf-criterion">
          <span>{{ 'tenderManagement.field.awardCriterion' | translate }}</span>
          <nz-select nzId="tnd-nf-criterion" formControlName="award_criterion">
            @for (value of criteria; track value) {
              <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.awardCriterion.' + value | translate"></nz-option>
            }
          </nz-select>
        </label>
        @if (isOepv()) {
          <label class="field" for="tnd-nf-formula">
            <span>{{ 'tenderManagement.field.formulaType' | translate }}</span>
            <nz-select nzId="tnd-nf-formula" formControlName="formula_type">
              @for (value of formulas; track value) {
                <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.formulaType.' + value | translate"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="tnd-nf-tmax">
            <span>{{ 'tenderManagement.field.technicalMaxScore' | translate }}</span>
            <input nz-input id="tnd-nf-tmax" type="number" min="0" step="0.01" formControlName="technical_max_score" />
          </label>
          <label class="field" for="tnd-nf-emax">
            <span>{{ 'tenderManagement.field.economicMaxScore' | translate }}</span>
            <input nz-input id="tnd-nf-emax" type="number" min="0" step="0.01" formControlName="economic_max_score" />
          </label>
        }
        <label class="field" for="tnd-nf-base">
          <span>{{ 'tenderManagement.field.baseAuctionAmount' | translate }}</span>
          <input nz-input id="tnd-nf-base" type="number" min="0" step="0.01" formControlName="base_auction_amount" />
        </label>
        <label class="field" for="tnd-nf-currency">
          <span>{{ 'tenderManagement.field.currency' | translate }}</span>
          <input nz-input id="tnd-nf-currency" formControlName="currency" maxlength="3" />
        </label>
        <label class="field" for="tnd-nf-safety">
          <span>{{ 'tenderManagement.field.nonSubjectSafetyCosts' | translate }}</span>
          <input nz-input id="tnd-nf-safety" type="number" min="0" step="0.01" formControlName="non_subject_safety_costs_amount" />
        </label>
        <label class="field" for="tnd-nf-labor">
          <span>{{ 'tenderManagement.field.estimatedLaborCost' | translate }}</span>
          <input nz-input id="tnd-nf-labor" type="number" min="0" step="0.01" formControlName="estimated_labor_cost_amount" />
        </label>
        <label class="field" for="tnd-nf-turnover">
          <span>{{ 'tenderManagement.field.requiredMinTurnover' | translate }}</span>
          <input nz-input id="tnd-nf-turnover" type="number" min="0" step="0.01" formControlName="required_min_turnover" />
        </label>
        <label class="field" for="tnd-nf-years">
          <span>{{ 'tenderManagement.field.turnoverYears' | translate }}</span>
          <input nz-input id="tnd-nf-years" type="number" min="1" max="10" formControlName="turnover_reference_years" />
        </label>
        <label class="field" for="tnd-nf-similar-count">
          <span>{{ 'tenderManagement.field.similarProjectsCount' | translate }}</span>
          <input nz-input id="tnd-nf-similar-count" type="number" min="0" formControlName="required_similar_projects_count" />
        </label>
        <label class="field" for="tnd-nf-similar-amount">
          <span>{{ 'tenderManagement.field.similarProjectsAmount' | translate }}</span>
          <input nz-input id="tnd-nf-similar-amount" type="number" min="0" step="0.01" formControlName="required_similar_projects_amount" />
        </label>
        <label class="field wide" for="tnd-nf-certs">
          <span>{{ 'tenderManagement.field.requiredCertifications' | translate }}</span>
          <nz-select nzId="tnd-nf-certs" formControlName="required_certifications" nzMode="multiple">
            @for (value of certificationTypes(); track value) {
              <nz-option [nzValue]="value" [nzLabel]="'tenderManagement.enum.vaultDocType.' + value | translate"></nz-option>
            }
          </nz-select>
        </label>
        <label class="field" for="tnd-nf-publication">
          <span>{{ 'tenderManagement.field.publicationDate' | translate }}</span>
          <input nz-input id="tnd-nf-publication" type="date" formControlName="publication_date" />
        </label>
        <label class="field" for="tnd-nf-clarification">
          <span>{{ 'tenderManagement.field.clarificationDeadline' | translate }}</span>
          <input nz-input id="tnd-nf-clarification" type="datetime-local" formControlName="clarification_deadline_at" />
        </label>
        <label class="field" for="tnd-nf-submission">
          <span>{{ 'tenderManagement.field.submissionDeadline' | translate }}</span>
          <input nz-input id="tnd-nf-submission" type="datetime-local" formControlName="submission_peremptory_deadline_at" />
        </label>
      </div>

      @if (isItalian()) {
        <fieldset class="soa">
          <legend>{{ 'tenderManagement.field.requiredSoa' | translate }}</legend>
          @for (row of soaRows.controls; track row; let i = $index) {
            <div class="soa-row" [formGroup]="row">
              <nz-select formControlName="category" nzShowSearch [nzPlaceHolder]="'tenderManagement.field.soaCategory' | translate">
                @for (category of soaCategories(); track category) {
                  <nz-option [nzValue]="category" [nzLabel]="category"></nz-option>
                }
              </nz-select>
              <nz-select formControlName="classification" [nzPlaceHolder]="'tenderManagement.field.soaClassification' | translate">
                @for (classification of soaClassifications(); track classification) {
                  <nz-option [nzValue]="classification" [nzLabel]="classification"></nz-option>
                }
              </nz-select>
              <button nz-button nzDanger type="button" (click)="soaRows.removeAt(i)">
                {{ 'tenderManagement.action.remove' | translate }}
              </button>
            </div>
          }
          <button nz-button type="button" (click)="addSoa()">
            {{ 'tenderManagement.action.addSoa' | translate }}
          </button>
        </fieldset>
      }

      <label class="field" for="tnd-nf-description">
        <span>{{ 'tenderManagement.field.description' | translate }}</span>
        <textarea nz-input id="tnd-nf-description" rows="3" formControlName="description"></textarea>
      </label>

      <button nz-button nzType="primary" type="submit" [disabled]="form.invalid || busy()">
        {{ 'tenderManagement.action.save' | translate }}
      </button>
    </form>
  `,
  styles: `
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 12px 16px;
      margin-bottom: 12px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .field.wide {
      grid-column: 1 / -1;
    }
    .soa {
      margin-bottom: 12px;
    }
    .soa-row {
      display: grid;
      grid-template-columns: 1fr 1fr auto;
      gap: 8px;
      margin-bottom: 8px;
    }
  `,
})
export class NoticeFormComponent {
  readonly notice = input<TndNotice | null>(null);
  readonly lookups = input<TndLookups | null>(null);
  readonly busy = input(false);
  readonly saved = output<TndNoticePayload>();

  protected readonly jurisdictions = TND_JURISDICTIONS;
  protected readonly procedures = TND_PROCEDURE_TYPES;
  protected readonly criteria = TND_AWARD_CRITERIA;
  protected readonly formulas = TND_FORMULA_TYPES;

  private readonly fb = new FormBuilder();

  protected readonly soaRows = new FormArray<FormGroup<{ category: FormControl<string>; classification: FormControl<string> }>>([]);

  protected readonly form = this.fb.nonNullable.group({
    title: ['', [Validators.required, Validators.maxLength(240)]],
    description: [''],
    jurisdiction: ['IT_Dlgs36_2023_ANAC' as TndNoticePayload['jurisdiction'], Validators.required],
    procedure_type: ['open' as TndNoticePayload['procedure_type'], Validators.required],
    contracting_authority_name: ['', Validators.required],
    simap_project_number: [''],
    cig_code_it: ['', [Validators.pattern(/^[A-Za-z0-9]{10}$|^$/)]],
    cup_code_it: ['', [Validators.pattern(/^[A-Za-z0-9]{15}$|^$/)]],
    rup_name: [''],
    dedicated_bank_account_it: [''],
    cpv_category_codes: [[] as string[]],
    award_criterion: ['LowestPrice' as TndNoticePayload['award_criterion'], Validators.required],
    formula_type: [null as TndNoticePayload['formula_type'] | null],
    technical_max_score: [null as number | null],
    economic_max_score: [null as number | null],
    currency: ['EUR', Validators.required],
    base_auction_amount: [0, [Validators.required, Validators.min(0)]],
    non_subject_safety_costs_amount: [0, Validators.min(0)],
    estimated_labor_cost_amount: [0, Validators.min(0)],
    required_min_turnover: [null as number | null],
    turnover_reference_years: [3],
    required_similar_projects_count: [0],
    required_similar_projects_amount: [null as number | null],
    required_certifications: [[] as string[]],
    publication_date: [''],
    clarification_deadline_at: [''],
    submission_peremptory_deadline_at: [''],
  });

  protected readonly soaCategories = computed(() => this.lookups()?.soa_categories ?? []);
  protected readonly soaClassifications = computed(() => this.lookups()?.soa_classifications ?? []);
  protected readonly certificationTypes = computed(
    () => this.lookups()?.vault_doc_types.map((type) => type.value) ?? [...TND_VAULT_DOC_TYPES],
  );

  private readonly jurisdictionValue = this.form.controls.jurisdiction;
  private readonly criterionValue = this.form.controls.award_criterion;

  protected isItalian(): boolean {
    return this.jurisdictionValue.value === 'IT_Dlgs36_2023_ANAC';
  }

  protected isSwiss(): boolean {
    return this.jurisdictionValue.value === 'CH_SIMAP_LAPub';
  }

  protected isOepv(): boolean {
    return this.criterionValue.value === 'OEPV_MostEconomicallyAdvantageous';
  }

  constructor() {
    effect(() => {
      const notice = this.notice();
      if (!notice) {
        return;
      }
      this.form.patchValue({
        title: notice.title,
        description: notice.description ?? '',
        jurisdiction: notice.jurisdiction,
        procedure_type: notice.procedure_type,
        contracting_authority_name: notice.contracting_authority_name,
        simap_project_number: notice.simap_project_number ?? '',
        cig_code_it: notice.cig_code_it ?? '',
        cup_code_it: notice.cup_code_it ?? '',
        rup_name: notice.rup_name ?? '',
        dedicated_bank_account_it: notice.dedicated_bank_account_it ?? '',
        cpv_category_codes: notice.cpv_category_codes ?? [],
        award_criterion: notice.award_criterion,
        formula_type: notice.formula_type,
        technical_max_score: notice.technical_max_score === null ? null : Number(notice.technical_max_score),
        economic_max_score: notice.economic_max_score === null ? null : Number(notice.economic_max_score),
        currency: notice.currency,
        base_auction_amount: Number(notice.base_auction_amount),
        non_subject_safety_costs_amount: Number(notice.non_subject_safety_costs_amount),
        estimated_labor_cost_amount: Number(notice.estimated_labor_cost_amount),
        required_min_turnover: notice.required_min_turnover === null ? null : Number(notice.required_min_turnover),
        turnover_reference_years: notice.turnover_reference_years,
        required_similar_projects_count: notice.required_similar_projects_count,
        required_similar_projects_amount:
          notice.required_similar_projects_amount === null ? null : Number(notice.required_similar_projects_amount),
        required_certifications: notice.required_certifications ?? [],
        publication_date: notice.publication_date?.slice(0, 10) ?? '',
        clarification_deadline_at: toLocalInput(notice.clarification_deadline_at),
        submission_peremptory_deadline_at: toLocalInput(notice.submission_peremptory_deadline_at),
      });
      this.soaRows.clear();
      for (const requirement of notice.required_soa_categories ?? []) {
        this.addSoa(requirement);
      }
    });
  }

  protected addSoa(requirement?: TndSoaRequirement): void {
    this.soaRows.push(
      this.fb.nonNullable.group({
        category: [requirement?.category ?? '', Validators.required],
        classification: [requirement?.classification ?? '', Validators.required],
      }),
    );
  }

  protected submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const oepv = value.award_criterion === 'OEPV_MostEconomicallyAdvantageous';
    const italian = value.jurisdiction === 'IT_Dlgs36_2023_ANAC';

    this.saved.emit({
      title: value.title.trim(),
      description: nullable(value.description),
      jurisdiction: value.jurisdiction,
      procedure_type: value.procedure_type,
      contracting_authority_name: value.contracting_authority_name.trim(),
      simap_project_number: nullable(value.simap_project_number),
      cig_code_it: italian ? nullable(value.cig_code_it?.toUpperCase()) : null,
      cup_code_it: italian ? nullable(value.cup_code_it?.toUpperCase()) : null,
      rup_name: italian ? nullable(value.rup_name) : null,
      dedicated_bank_account_it: italian ? nullable(value.dedicated_bank_account_it) : null,
      cpv_category_codes: value.cpv_category_codes,
      award_criterion: value.award_criterion,
      formula_type: oepv ? value.formula_type : null,
      technical_max_score: oepv ? value.technical_max_score : null,
      economic_max_score: oepv ? value.economic_max_score : null,
      currency: value.currency.toUpperCase(),
      base_auction_amount: value.base_auction_amount,
      non_subject_safety_costs_amount: value.non_subject_safety_costs_amount,
      estimated_labor_cost_amount: value.estimated_labor_cost_amount,
      required_min_turnover: value.required_min_turnover,
      turnover_reference_years: value.turnover_reference_years,
      required_similar_projects_count: value.required_similar_projects_count,
      required_similar_projects_amount: value.required_similar_projects_amount,
      required_certifications: value.required_certifications,
      required_soa_categories: italian
        ? this.soaRows.getRawValue().filter((row) => row.category && row.classification)
        : [],
      publication_date: nullable(value.publication_date),
      clarification_deadline_at: toIso(value.clarification_deadline_at),
      submission_peremptory_deadline_at: toIso(value.submission_peremptory_deadline_at),
    });
  }
}
