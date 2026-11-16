import { Component, computed, DestroyRef, inject, input, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { AbstractControl, FormGroup, ReactiveFormsModule, ValidationErrors } from '@angular/forms';
import { NzAutocompleteModule } from 'ng-zorro-antd/auto-complete';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { catchError, debounceTime, distinctUntilChanged, filter, of, switchMap } from 'rxjs';
import {
  countryOptions,
  CustomsCodesApiService,
  CustomsTaricCode,
  FreeTradeAgreement,
  madeInLabelFor,
  normalizeTaricCode,
  pickLocalized,
  TARIC_CODE_PATTERN,
  TARIC_LEVEL_LABEL,
  TranslateService,
  taricLevelOf,
} from '@core';
import { TranslatePipe } from '@shared';

/** The code is optional, but when typed it must have 6 (HS), 8 (CN) or 10 (TARIC) digits. */
export function taricCodeValidator(control: AbstractControl): ValidationErrors | null {
  const value = normalizeTaricCode(control.value as string | null);
  return value === '' || TARIC_CODE_PATTERN.test(value) ? null : { taricCode: true };
}

/**
 * "Customs & Origin" section of the product form: HS / CN / TARIC code with catalog autocomplete and level badge,
 * country and type of origin, "Made in" label (filled from the country until the user edits it), free trade agreement,
 * EUR.1 flag and origin rule notes. The parent owns the form group (controls named as the API fields).
 */
@Component({
  selector: 'app-product-customs-origin',
  imports: [
    ReactiveFormsModule,
    NzAutocompleteModule,
    NzFormModule,
    NzInputModule,
    NzRadioModule,
    NzSelectModule,
    NzSwitchModule,
    NzTagModule,
    TranslatePipe,
  ],
  template: `
    <div [formGroup]="form()" class="customs-origin">
      <nz-form-item>
        <nz-form-label>{{ 'CUSTOMS_CODES.PRODUCT.TARIC_CODE' | translate }}</nz-form-label>
        <nz-form-control [nzErrorTip]="'CUSTOMS_CODES.VALIDATION.CODE_DIGITS' | translate">
          <div class="code-row">
            <input
              nz-input
              formControlName="taric_code"
              inputmode="numeric"
              maxlength="14"
              [nzAutocomplete]="codeAuto"
              [placeholder]="'CUSTOMS_CODES.PRODUCT.TARIC_PLACEHOLDER' | translate"
              (input)="onCodeInput()"
            />
            @if (level(); as lvl) {
              <nz-tag class="level-badge" nzColor="blue">{{ levelLabel(lvl) }}</nz-tag>
            }
          </div>
          <nz-autocomplete #codeAuto (selectionChange)="onPick($event.nzValue)">
            @for (item of suggestions(); track item.id) {
              <nz-auto-option [nzValue]="item.code" [nzLabel]="item.code">
                <strong>{{ item.code }}</strong>
                <nz-tag class="level-badge">{{ levelLabel(item.level) }}</nz-tag>
                {{ describe(item) }}
              </nz-auto-option>
            }
          </nz-autocomplete>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ 'CUSTOMS_CODES.PRODUCT.COUNTRY' | translate }}</nz-form-label>
        <nz-form-control>
          <nz-select formControlName="country_of_origin" nzShowSearch nzAllowClear>
            @for (country of countries; track country.code) {
              <nz-option [nzValue]="country.code" [nzLabel]="country.name + ' (' + country.code + ')'"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ 'CUSTOMS_CODES.PRODUCT.ORIGIN_TYPE' | translate }}</nz-form-label>
        <nz-form-control>
          <nz-radio-group formControlName="origin_type">
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label nz-radio nzValue="preferential">{{ 'CUSTOMS_CODES.PRODUCT.PREFERENTIAL' | translate }}</label>
            <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
            <label nz-radio nzValue="non_preferential">{{ 'CUSTOMS_CODES.PRODUCT.NON_PREFERENTIAL' | translate }}</label>
          </nz-radio-group>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ 'CUSTOMS_CODES.PRODUCT.MADE_IN_LABEL' | translate }}</nz-form-label>
        <nz-form-control [nzErrorTip]="'COMMON.VALIDATION.INVALID_VALUE' | translate">
          <input nz-input formControlName="made_in_label" maxlength="255" />
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ 'CUSTOMS_CODES.PRODUCT.AGREEMENT' | translate }}</nz-form-label>
        <nz-form-control>
          <nz-select formControlName="preferential_agreement_id" nzShowSearch nzAllowClear>
            @for (agreement of agreements(); track agreement.id) {
              <nz-option [nzValue]="agreement.id" [nzLabel]="agreementLabel(agreement)"></nz-option>
            }
          </nz-select>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ 'CUSTOMS_CODES.PRODUCT.EUR1_REQUIRED' | translate }}</nz-form-label>
        <nz-form-control>
          <nz-switch formControlName="eur1_required"></nz-switch>
        </nz-form-control>
      </nz-form-item>

      <nz-form-item>
        <nz-form-label>{{ 'CUSTOMS_CODES.PRODUCT.RULE_NOTES' | translate }}</nz-form-label>
        <nz-form-control>
          <textarea nz-input formControlName="origin_rule_notes" rows="3"></textarea>
        </nz-form-control>
      </nz-form-item>
    </div>
  `,
  styles: `
    .code-row {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .level-badge {
      margin-inline: 8px;
    }
    .code-row .level-badge {
      margin-inline: 0;
      white-space: nowrap;
    }
    nz-select {
      width: 100%;
    }
  `,
})
export class ProductCustomsOriginComponent implements OnInit {
  private readonly api = inject(CustomsCodesApiService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  /** Group with the customs controls (`taric_code`, `customs_taric_code_id`, `country_of_origin`, ...). */
  readonly form = input.required<FormGroup>();

  protected readonly countries = countryOptions();
  protected readonly suggestions = signal<CustomsTaricCode[]>([]);
  protected readonly agreements = signal<FreeTradeAgreement[]>([]);
  private readonly typedCode = signal('');

  /** Level badge of the code typed so far (null while it is not a valid 6/8/10 digit number). */
  protected readonly level = computed(() => taricLevelOf(normalizeTaricCode(this.typedCode())));

  /** Last label proposed from the country: while the field still holds it (or nothing) a new country replaces it. */
  private lastSuggestedLabel = '';

  ngOnInit(): void {
    const group = this.form();
    this.typedCode.set(String(group.get('taric_code')?.value ?? ''));
    this.lastSuggestedLabel = '';

    group
      .get('taric_code')
      ?.valueChanges.pipe(
        takeUntilDestroyed(this.destroyRef),
        distinctUntilChanged(),
        debounceTime(250),
        filter((value: unknown): value is string => typeof value === 'string' && normalizeTaricCode(value).length >= 2),
        switchMap((value: string) =>
          this.api
            .getTaricCodes({ search: normalizeTaricCode(value), per_page: 10, is_active: true })
            .pipe(catchError(() => of(null))),
        ),
      )
      .subscribe((res) => this.suggestions.set(res?.data ?? []));

    group
      .get('country_of_origin')
      ?.valueChanges.pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe(() => this.onCountryChange());

    this.api
      .getFreeTradeAgreements({ is_active: true, per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef), catchError(() => of(null)))
      .subscribe((res) => this.agreements.set(res?.data ?? []));
  }

  /** The catalog link is dropped as soon as the typed code is edited by hand. */
  protected onCodeInput(): void {
    const control = this.form().get('taric_code');
    this.typedCode.set(String(control?.value ?? ''));
    this.form().get('customs_taric_code_id')?.setValue(null);
  }

  protected onPick(code: string): void {
    const item = this.suggestions().find((s) => s.code === code);
    if (!item) {
      return;
    }
    this.form().patchValue({ taric_code: item.code, customs_taric_code_id: item.id });
    this.typedCode.set(item.code);
  }

  /** Proposes the made-in label of the new country unless the user has typed their own. */
  private onCountryChange(): void {
    const group = this.form();
    const label = group.get('made_in_label');
    const current = String(label?.value ?? '').trim();
    if (current === '' || current === this.lastSuggestedLabel) {
      const suggested = madeInLabelFor(group.get('country_of_origin')?.value as string | null);
      label?.setValue(suggested);
      this.lastSuggestedLabel = suggested;
    }
  }

  protected levelLabel(level: keyof typeof TARIC_LEVEL_LABEL): string {
    return TARIC_LEVEL_LABEL[level];
  }

  protected describe(item: CustomsTaricCode): string {
    return pickLocalized(item.description, this.translate.currentLanguage());
  }

  protected agreementLabel(agreement: FreeTradeAgreement): string {
    const name = pickLocalized(agreement.name, this.translate.currentLanguage());
    return name ? `${agreement.code} - ${name}` : agreement.code;
  }
}
