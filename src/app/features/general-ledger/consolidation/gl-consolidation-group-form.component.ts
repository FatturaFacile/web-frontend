import { Component, effect, inject, input, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import {
  applyServerErrors,
  ConsolidationGroup,
  ConsolidationGroupPayload,
  EliminationDifferencePolicy,
  FairValueFirstYearRule,
  GeneralLedgerConsolidationApiService,
  GoodwillMethod,
  GoodwillTranslation,
  I18nService,
  NegativeGoodwillTreatment,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { nullable } from './gl-consolidation.util';

/** Create or edit modal of a consolidation group: currency, synthetic account codes and the accounting policies of the runs. */
@Component({
  selector: 'app-gl-consolidation-group-form',
  styleUrl: './gl-consolidation.scss',
  imports: [
    ModalActionsDirective,
    ReactiveFormsModule,
    NzAlertModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzSwitchModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="(group() ? 'GL.CONS_GROUP_EDIT' : 'GL.CONS_GROUP_NEW') | translate"
      nzWidth="760px"
      [nzOkLoading]="saving()"
      (nzOnOk)="save()"
      (nzOnCancel)="closed.emit()"
      okAction="save"
    >
      <ng-container *nzModalContent>
        <app-gl-error-alert [error]="error()" />
        @for (message of formErrors(); track message) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="message" />
        }
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cg-name">{{ 'GL.COL_NAME' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.name.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <input id="cg-name" nz-input formControlName="name" maxlength="190" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired nzFor="cg-currency">{{ 'GL.CONS_GROUP_CURRENCY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.group_currency.errors?.['serverError'] ?? ('GL.REQUIRED' | translate)">
                <input id="cg-currency" nz-input formControlName="group_currency" maxlength="3" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cg-trans">{{ 'GL.CONS_CODE_TRANSLATION_RESERVE' | translate }}</nz-form-label>
              <nz-form-control>
                <input id="cg-trans" nz-input formControlName="translation_reserve_code" maxlength="40" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-diff">{{ 'GL.CONS_CODE_DIFFERENCE' | translate }}</nz-form-label>
              <nz-form-control>
                <input id="cg-diff" nz-input formControlName="consolidation_difference_code" maxlength="40" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cg-eq-result">{{ 'GL.CONS_CODE_EQUITY_RESULT' | translate }}</nz-form-label>
              <nz-form-control>
                <input id="cg-eq-result" nz-input formControlName="equity_method_result_code" maxlength="40" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-eq-reserve">{{ 'GL.CONS_CODE_EQUITY_RESERVE' | translate }}</nz-form-label>
              <nz-form-control>
                <input id="cg-eq-reserve" nz-input formControlName="equity_method_reserve_code" maxlength="40" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cg-policy">{{ 'GL.CONS_ELIMINATION_POLICY' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cg-policy" formControlName="elimination_difference_policy">
                  @for (policy of policies; track policy) {
                    <nz-option [nzValue]="policy" [nzLabel]="'GL.CONS_POLICY_' + policy.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-gw-method">{{ 'GL.CONS_GOODWILL_METHOD' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cg-gw-method" formControlName="goodwill_method">
                  @for (method of goodwillMethods; track method) {
                    <nz-option [nzValue]="method" [nzLabel]="'GL.CONS_GW_METHOD_' + method.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-gw-years">{{ 'GL.CONS_GOODWILL_YEARS' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.goodwill_amortisation_years.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="cg-gw-years" formControlName="goodwill_amortisation_years" [nzMin]="1" [nzMax]="100" [nzPrecision]="0" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cg-fv-rule">{{ 'GL.CONS_FV_FIRST_YEAR' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cg-fv-rule" formControlName="fair_value_first_year_rule">
                  @for (rule of firstYearRules; track rule) {
                    <nz-option [nzValue]="rule" [nzLabel]="'GL.CONS_FV_RULE_' + rule.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-neg-gw">{{ 'GL.CONS_NEGATIVE_GOODWILL' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cg-neg-gw" formControlName="negative_goodwill_treatment">
                  @for (treatment of negativeTreatments; track treatment) {
                    <nz-option [nzValue]="treatment" [nzLabel]="'GL.CONS_NEG_GW_' + treatment.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-gw-trans">{{ 'GL.CONS_GOODWILL_TRANSLATION' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-select id="cg-gw-trans" formControlName="goodwill_translation">
                  @for (translation of goodwillTranslations; track translation) {
                    <nz-option [nzValue]="translation" [nzLabel]="'GL.CONS_GW_TRANSLATION_' + translation.toUpperCase() | translate" />
                  }
                </nz-select>
              </nz-form-control>
            </nz-form-item>
          </div>
          <div class="form-row">
            <nz-form-item>
              <nz-form-label nzFor="cg-map">{{ 'GL.CONS_REQUIRE_MAPPING' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-switch id="cg-map" formControlName="require_account_mapping" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-dt">{{ 'GL.CONS_DEFERRED_TAX_UNREALISED' | translate }}</nz-form-label>
              <nz-form-control>
                <nz-switch id="cg-dt" formControlName="deferred_tax_on_unrealised_profit" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzFor="cg-dt-rate">{{ 'GL.CONS_UNREALISED_TAX_RATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="form.controls.unrealised_profit_tax_rate.errors?.['serverError'] ?? ''">
                <nz-input-number class="w-full" id="cg-dt-rate" formControlName="unrealised_profit_tax_rate" [nzMin]="0" [nzMax]="100" [nzPrecision]="4" />
              </nz-form-control>
            </nz-form-item>
            @if (group()) {
              <nz-form-item>
                <nz-form-label nzFor="cg-active">{{ 'GL.CONS_ACTIVE' | translate }}</nz-form-label>
                <nz-form-control>
                  <nz-switch id="cg-active" formControlName="is_active" />
                </nz-form-control>
              </nz-form-item>
            }
          </div>
          <nz-form-item>
            <nz-form-label nzFor="cg-notes">{{ 'GL.NOTES' | translate }}</nz-form-label>
            <nz-form-control>
              <textarea id="cg-notes" nz-input rows="3" maxlength="5000" formControlName="notes"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class GlConsolidationGroupFormComponent {
  private readonly api = inject(GeneralLedgerConsolidationApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** The group to edit, or null to create one. */
  readonly group = input<ConsolidationGroup | null>(null);
  readonly open = input(false);
  readonly saved = output<ConsolidationGroup>();
  readonly closed = output<void>();

  protected readonly policies: EliminationDifferencePolicy[] = ['keep_difference', 'post_to_difference_account'];
  protected readonly goodwillMethods: GoodwillMethod[] = ['none', 'straight_line', 'impairment_only'];
  protected readonly firstYearRules: FairValueFirstYearRule[] = ['pro_rata', 'full_year'];
  protected readonly negativeTreatments: NegativeGoodwillTreatment[] = ['consolidation_reserve', 'immediate_income'];
  protected readonly goodwillTranslations: GoodwillTranslation[] = ['historical', 'closing'];

  protected readonly saving = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(190)]),
    group_currency: this.fb.control('EUR', [Validators.required, Validators.minLength(3), Validators.maxLength(3)]),
    translation_reserve_code: this.fb.control('', Validators.maxLength(40)),
    consolidation_difference_code: this.fb.control('', Validators.maxLength(40)),
    equity_method_result_code: this.fb.control('', Validators.maxLength(40)),
    equity_method_reserve_code: this.fb.control('', Validators.maxLength(40)),
    elimination_difference_policy: this.fb.control<EliminationDifferencePolicy>('keep_difference'),
    goodwill_method: this.fb.control<GoodwillMethod>('none'),
    goodwill_amortisation_years: this.fb.control<number | null>(null),
    require_account_mapping: this.fb.control(false),
    deferred_tax_on_unrealised_profit: this.fb.control(false),
    unrealised_profit_tax_rate: this.fb.control<number | null>(null),
    fair_value_first_year_rule: this.fb.control<FairValueFirstYearRule>('pro_rata'),
    negative_goodwill_treatment: this.fb.control<NegativeGoodwillTreatment>('consolidation_reserve'),
    goodwill_translation: this.fb.control<GoodwillTranslation>('historical'),
    is_active: this.fb.control(true),
    notes: this.fb.control('', Validators.maxLength(5000)),
  });

  constructor() {
    effect(() => {
      if (!this.open()) {
        return;
      }
      const group = this.group();
      this.error.set(null);
      this.formErrors.set([]);
      this.form.reset({
        name: group?.name ?? '',
        group_currency: group?.group_currency ?? 'EUR',
        translation_reserve_code: group?.translation_reserve_code ?? '',
        consolidation_difference_code: group?.consolidation_difference_code ?? '',
        equity_method_result_code: group?.equity_method_result_code ?? '',
        equity_method_reserve_code: group?.equity_method_reserve_code ?? '',
        elimination_difference_policy: group?.elimination_difference_policy ?? 'keep_difference',
        goodwill_method: group?.goodwill_method ?? 'none',
        goodwill_amortisation_years: group?.goodwill_amortisation_years ?? null,
        require_account_mapping: group?.require_account_mapping ?? false,
        deferred_tax_on_unrealised_profit: group?.deferred_tax_on_unrealised_profit ?? false,
        unrealised_profit_tax_rate: group?.unrealised_profit_tax_rate == null ? null : Number(group.unrealised_profit_tax_rate),
        fair_value_first_year_rule: group?.fair_value_first_year_rule ?? 'pro_rata',
        negative_goodwill_treatment: group?.negative_goodwill_treatment ?? 'consolidation_reserve',
        goodwill_translation: group?.goodwill_translation ?? 'historical',
        is_active: group?.is_active ?? true,
        notes: group?.notes ?? '',
      });
    });
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const editing = this.group();
    const payload: ConsolidationGroupPayload = {
      name: value.name,
      group_currency: value.group_currency.toUpperCase(),
      elimination_difference_policy: value.elimination_difference_policy,
      goodwill_method: value.goodwill_method,
      goodwill_amortisation_years: value.goodwill_amortisation_years,
      require_account_mapping: value.require_account_mapping,
      deferred_tax_on_unrealised_profit: value.deferred_tax_on_unrealised_profit,
      unrealised_profit_tax_rate: value.unrealised_profit_tax_rate,
      fair_value_first_year_rule: value.fair_value_first_year_rule,
      negative_goodwill_treatment: value.negative_goodwill_treatment,
      goodwill_translation: value.goodwill_translation,
      notes: nullable(value.notes),
    };
    // The API takes the codes as strings: an empty one is left out and keeps the default of the group.
    const codes = {
      translation_reserve_code: value.translation_reserve_code,
      consolidation_difference_code: value.consolidation_difference_code,
      equity_method_result_code: value.equity_method_result_code,
      equity_method_reserve_code: value.equity_method_reserve_code,
    };
    for (const [key, code] of Object.entries(codes)) {
      if (code !== '') {
        (payload as Record<string, unknown>)[key] = code;
      }
    }
    if (editing) {
      payload.is_active = value.is_active;
    }
    this.saving.set(true);
    const request = editing ? this.api.updateGroup(editing.id, payload) : this.api.createGroup(payload);
    request.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.CONS_SAVED'));
        this.saved.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }
}
