import {
  Component,
  computed,
  effect,
  inject,
  input,
  model,
  output,
  resource,
  signal,
  untracked,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { CurrencyApiService } from '@core/api/currency-api.service';
import { I18nService } from '@core/i18n/i18n.service';
import {
  CurrencyRate,
  CurrencyRateType,
  ResolvedCurrencyRate,
} from '@core/models/currency-fx.model';
import { TranslatePipe } from '../../pipes/translate.pipe';
import {
  currencyProblemText,
  isCurrencyFailure,
  isValidRate,
  normalizeRate,
} from './currency-rate.util';
import { ManualRateDialogComponent } from './manual-rate-dialog.component';

/** Rate of a document in the functional currency (or a document in the functional currency itself). */
export const SAME_CURRENCY_RATE = '1.000000';

type Resolution = { ok: true; data: ResolvedCurrencyRate } | { ok: false; error: unknown };

/**
 * Currency and exchange-rate field of a document form (Mod 003). The currency comes from the active currencies of the
 * tenant; the rate is resolved from `currencies/rates/resolve` for the document date and stays editable while the
 * document is a draft (`readonly` otherwise). A contract rate carries a badge, a rate of an earlier date a hint, and a
 * missing rate (422 `exchange_rate_missing`) a field error with an action that opens the manual rate dialog.
 * Same-currency documents keep the rate "1.000000" and the rate field is hidden.
 */
@Component({
  selector: 'app-document-currency-rate-field',
  imports: [
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzTagModule,
    ReactiveFormsModule,
    TranslatePipe,
    ManualRateDialogComponent,
  ],
  styles: `
    :host {
      display: block;
    }
    .fx-row {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px 16px;
      align-items: start;
    }
    .fx-field {
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .fx-field > label {
      font-weight: 500;
    }
    .fx-hint {
      color: rgba(0, 0, 0, 0.65);
      font-size: 12px;
    }
    .fx-error {
      color: #cf1322;
      font-size: 12px;
    }
    .fx-actions {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
    }
  `,
  template: `
    <div class="fx-row">
      @if (showCurrency()) {
        <div class="fx-field">
          <label [for]="id + '-currency'">{{
            'FINANCE.CURRENCIES.FIELD.DOCUMENT_CURRENCY' | translate
          }}</label>
          <nz-select
            [nzId]="id + '-currency'"
            [formControl]="currencyControl"
            [nzOptions]="options()"
          ></nz-select>
        </div>
      }
      @if (!sameCurrency()) {
        <div class="fx-field">
          <label [for]="id + '-rate'">{{
            'FINANCE.CURRENCIES.FIELD.EXCHANGE_RATE' | translate
          }}</label>
          <input
            nz-input
            [id]="id + '-rate'"
            inputmode="decimal"
            autocomplete="off"
            [value]="rate() ?? ''"
            [readonly]="readonly()"
            [attr.aria-invalid]="fieldError() !== null"
            [attr.aria-describedby]="id + '-help'"
            (input)="onRateInput($event)"
          />
          <div class="fx-actions" [id]="id + '-help'">
            @if (resolvedRate(); as resolved) {
              @if (resolved.is_contract) {
                <nz-tag nzColor="purple">{{
                  'FINANCE.CURRENCIES.BADGE.CONTRACT' | translate
                }}</nz-tag>
              }
              @if (manual()) {
                <nz-tag nzColor="gold">{{ 'FINANCE.CURRENCIES.BADGE.MANUAL' | translate }}</nz-tag>
              }
              @if (resolved.is_fallback_date) {
                <span class="fx-hint">{{
                  'FINANCE.CURRENCIES.HINT.FALLBACK_DATE' | translate: { date: resolved.valid_on }
                }}</span>
              }
            }
            @if (loading()) {
              <span class="fx-hint">{{ 'FINANCE.CURRENCIES.HINT.RESOLVING' | translate }}</span>
            }
            @if (fieldError(); as error) {
              <span class="fx-error" role="alert">{{ error }}</span>
            }
            @if (rateMissing() && !readonly()) {
              <button nz-button nzSize="small" type="button" (click)="dialogOpen.set(true)">
                {{ 'FINANCE.CURRENCIES.ACTION.ENTER_MANUAL_RATE' | translate }}
              </button>
            }
          </div>
        </div>
      }
    </div>
    <app-manual-rate-dialog
      [(open)]="dialogOpen"
      [base]="currency()"
      [quote]="functional() ?? ''"
      [validOn]="documentDate()"
      [rateType]="rateType()"
      (saved)="onManualSaved($event)"
    />
  `,
})
export class DocumentCurrencyRateFieldComponent {
  private readonly api = inject(CurrencyApiService);
  private readonly i18n = inject(I18nService);
  private static sequence = 0;

  protected readonly id = `fx-rate-${++DocumentCurrencyRateFieldComponent.sequence}`;

  /** Currency of the document. */
  readonly currency = model('');
  /** Document date (`YYYY-MM-DD`): the rate is the one of that day. */
  readonly documentDate = input<string | null>(null);
  /** Rate as a decimal string, resolved automatically or typed by the user. */
  readonly rate = model<string | null>(null);
  /** True once the user typed the rate (the document sends it as an override). */
  readonly manual = model(false);
  /** A document that is not a draft any more shows the stored rate and does not resolve anything. */
  readonly readonly = input(false);
  readonly rateType = input<CurrencyRateType>('mid');
  readonly contractReference = input<string | null>(null);
  /** Functional currency; taken from the currency settings when not given. */
  readonly functionalCurrency = input<string | null>(null);
  readonly showCurrency = input(true);
  /** Emits the resolution (null when there is none) so the form can show the date and source it used. */
  readonly resolved = output<ResolvedCurrencyRate | null>();

  protected readonly dialogOpen = signal(false);
  readonly currencyControl = new FormControl<string>('', { nonNullable: true });

  private readonly settings = resource({
    loader: async () => (await firstValueFrom(this.api.getSettings())).data,
  });

  protected readonly functional = computed(
    () => this.functionalCurrency() ?? this.settings.value()?.functional_currency ?? null,
  );

  protected readonly options = computed(() => {
    const codes = [
      this.functional(),
      ...(this.settings.value()?.active_currencies ?? []),
      this.currency(),
    ].filter((code): code is string => !!code);
    return Array.from(new Set(codes)).map((code) => ({ label: code, value: code }));
  });

  protected readonly sameCurrency = computed(() => {
    const currency = this.currency();
    const functional = this.functional();
    return currency === '' || (functional !== null && currency === functional);
  });

  private readonly resolution = resource({
    params: () => {
      const base = this.currency();
      const quote = this.functional();
      const date = this.documentDate();
      if (this.readonly() || !base || !quote || base === quote || !date) {
        return undefined;
      }
      return {
        base,
        quote,
        date,
        rate_type: this.rateType(),
        contract_reference: this.contractReference(),
      };
    },
    loader: async ({ params }): Promise<Resolution> => {
      try {
        const response = await firstValueFrom(this.api.resolveRate(params));
        return { ok: true, data: response.data };
      } catch (error) {
        return { ok: false, error };
      }
    },
  });

  protected readonly loading = computed(() => this.resolution.isLoading());

  protected readonly resolvedRate = computed<ResolvedCurrencyRate | null>(() => {
    const value = this.resolution.value();
    return value?.ok ? value.data : null;
  });

  /** The API has no rate within the tolerance window for the document date (422 `exchange_rate_missing`). */
  protected readonly rateMissing = computed(() => {
    const value = this.resolution.value();
    return (
      value !== undefined &&
      !value.ok &&
      isCurrencyFailure(value.error, 422, 'exchange_rate_missing')
    );
  });

  private readonly resolutionError = computed<string | null>(() => {
    const value = this.resolution.value();
    if (value === undefined || value.ok) {
      return null;
    }
    if (isCurrencyFailure(value.error, 422, 'exchange_rate_missing')) {
      return this.i18n.translate('ERRORS.EXCHANGE_RATE_MISSING', {
        currency: this.currency(),
        date: this.documentDate() ?? '',
      });
    }
    return currencyProblemText(value.error);
  });

  /** Text under the field: the server message of a failed resolution, or the format error of a typed rate. */
  protected readonly fieldError = computed<string | null>(() => {
    const typed = this.rate();
    if (this.manual() && typed !== null && typed !== '' && !isValidRate(typed)) {
      return this.i18n.translate('FINANCE.CURRENCIES.ERROR.RATE_FORMAT');
    }
    return this.resolutionError();
  });

  constructor() {
    this.currencyControl.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((code) => this.currency.set(code));

    effect(() => {
      const code = this.currency();
      if (this.currencyControl.value !== code) {
        this.currencyControl.setValue(code, { emitEvent: false });
      }
    });
    effect(() => {
      if (this.readonly()) {
        this.currencyControl.disable({ emitEvent: false });
      } else {
        this.currencyControl.enable({ emitEvent: false });
      }
    });

    // Same-currency documents always carry the rate 1.
    effect(() => {
      if (this.sameCurrency() && !this.readonly() && this.functional() !== null) {
        untracked(() => {
          this.rate.set(SAME_CURRENCY_RATE);
          this.manual.set(false);
        });
      }
    });

    // A new resolution replaces the rate and drops a manual edit made for the previous currency or date.
    effect(() => {
      const value = this.resolution.value();
      if (value === undefined) {
        return;
      }
      untracked(() => {
        this.manual.set(false);
        if (value.ok) {
          this.rate.set(value.data.rate);
          this.resolved.emit(value.data);
        } else {
          this.rate.set(null);
          this.resolved.emit(null);
        }
      });
    });
  }

  protected onRateInput(event: Event): void {
    if (this.readonly()) {
      return;
    }
    const value = normalizeRate((event.target as HTMLInputElement).value);
    this.manual.set(true);
    this.rate.set(value === '' ? null : value);
  }

  /** The user saved a manual rate: resolve again, so the field shows the stored rate and its badges. */
  protected onManualSaved(_rate: CurrencyRate): void {
    this.resolution.reload();
  }
}
