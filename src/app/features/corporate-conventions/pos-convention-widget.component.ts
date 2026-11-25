import {
  Component,
  computed,
  effect,
  inject,
  input,
  OnInit,
  output,
  signal,
  untracked,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CcvCartLine,
  CcvCheckoutResult,
  CcvSourceDocumentType,
  CcvWelfareCategory,
  CcvWelfareProvider,
  CcvWelfareRedemption,
} from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { PosConventionStore } from './pos-convention.store';
import { CcvOutcome, shareOf, toNumber, voucherSplit } from './corporate-conventions.util';

/**
 * Convention and welfare widget for the web POS and the order checkout, shown in a drawer. The cashier scans or types the QR
 * payload of a pass, an e-mail, a card number or a matricola; the widget shows who the customer is and what is left of the annual
 * cap, previews the split of the cart (total → convention discount → employer quota → employee payable), commits it, and records
 * the welfare vouchers (IT Art. 51 TUIR providers, CH Reka / Lunch-Check) paid on the sale with the merchant fee.
 * The host passes the cart lines, the currency and the id of the sale document, and listens to `applied` and `voucherRedeemed`.
 */
@Component({
  selector: 'app-ccv-pos-widget',
  imports: [
    FormsModule,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzInputModule,
    NzInputNumberModule,
    NzProgressModule,
    NzSelectModule,
    NzTagModule,
    TranslatePipe,
  ],
  providers: [PosConventionStore],
  styleUrl: './corporate-conventions.scss',
  template: `
    <nz-drawer
      [nzVisible]="visible()"
      [nzWidth]="520"
      [nzTitle]="'corporateConventions.pos.title' | translate"
      (nzOnClose)="closed.emit()"
    >
      <ng-container *nzDrawerContent>
        <div class="pos-lookup">
          <label class="field" for="ccv-pos-identifier">
            <span>{{ 'corporateConventions.pos.identifier' | translate }}</span>
            <input
              nz-input
              id="ccv-pos-identifier"
              [ngModel]="identifier()"
              (ngModelChange)="identifier.set($event)"
              (keydown.enter)="verify()"
              [placeholder]="'corporateConventions.pos.identifierPlaceholder' | translate"
              autocomplete="off"
            />
          </label>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.verifying()"
            [disabled]="identifier().trim() === ''"
            (click)="verify()"
          >
            {{ 'corporateConventions.action.verify' | translate }}
          </button>
        </div>

        @if (feedback(); as failure) {
          <nz-alert
            nzType="error"
            nzShowIcon
            class="form-alert"
            [nzMessage]="failure.errorKey ?? '' | translate: failure.params"
            [nzDescription]="failure.detail"
          ></nz-alert>
        }

        @if (store.enrollment(); as enrollment) {
          <section class="pos-customer">
            <h4>{{ enrollment.full_name }}</h4>
            <p class="muted">
              {{ enrollment.convention_name }} ·
              {{
                'corporateConventions.beneficiaryType.' + enrollment.beneficiary_type | translate
              }}
            </p>
            @if (enrollment.annual_spending_cap !== null) {
              <nz-progress
                [nzPercent]="capUsedPercent()"
                nzSize="small"
                [nzStatus]="store.capReached() ? 'exception' : 'active'"
                [nzFormat]="capFormat"
              ></nz-progress>
              <small>
                {{ 'corporateConventions.pos.capRemaining' | translate }}:
                {{ enrollment.annual_cap_remaining | money: currency() }}
              </small>
            }
            @if (enrollment.employer_subsidy_cap_remaining !== null) {
              <small class="block">
                {{ 'corporateConventions.pos.subsidyRemaining' | translate }}:
                {{ enrollment.employer_subsidy_cap_remaining | money: currency() }}
              </small>
            }
          </section>

          @if (store.totals(); as totals) {
            <table class="split-table" aria-live="polite">
              <tbody>
                <tr>
                  <th scope="row">{{ 'corporateConventions.pos.total' | translate }}</th>
                  <td>{{ totals.total_gross_amount | money: currency() }}</td>
                </tr>
                <tr>
                  <th scope="row">
                    {{ 'corporateConventions.pos.conventionDiscount' | translate }}
                  </th>
                  <td class="negative-text">
                    − {{ totals.convention_discount_amount | money: currency() }}
                  </td>
                </tr>
                <tr>
                  <th scope="row">{{ 'corporateConventions.pos.employerQuota' | translate }}</th>
                  <td class="negative-text">
                    − {{ totals.employer_subsidy_amount | money: currency() }}
                  </td>
                </tr>
                <tr class="grand">
                  <th scope="row">{{ 'corporateConventions.pos.employeePayable' | translate }}</th>
                  <td>{{ totals.employee_paid_amount | money: currency() }}</td>
                </tr>
              </tbody>
            </table>
            @if (store.capReached()) {
              <nz-alert
                nzType="warning"
                nzShowIcon
                [nzMessage]="'corporateConventions.pos.capReached' | translate"
              ></nz-alert>
            }
            @if (store.checkout() === null) {
              <button
                nz-button
                nzType="primary"
                nzBlock
                type="button"
                [nzLoading]="store.committing()"
                [disabled]="documentId() === null"
                (click)="apply()"
              >
                {{ 'corporateConventions.pos.apply' | translate }}
              </button>
            } @else {
              <nz-alert
                nzType="success"
                nzShowIcon
                [nzMessage]="'corporateConventions.pos.applied' | translate"
              ></nz-alert>
            }
          } @else if (store.pricingBusy()) {
            <p class="muted">{{ 'corporateConventions.pos.calculating' | translate }}</p>
          }

          <section class="pos-welfare">
            <h4>{{ 'corporateConventions.pos.welfareTitle' | translate }}</h4>
            <p class="muted">
              {{ 'corporateConventions.jurisdiction.' + jurisdiction() | translate }}
            </p>
            <div class="grid">
              <label class="field" for="ccv-pos-provider">
                <span>{{ 'corporateConventions.column.provider' | translate }}</span>
                <nz-select
                  nzId="ccv-pos-provider"
                  [ngModel]="provider()"
                  (ngModelChange)="onProvider($event)"
                >
                  @for (option of providers(); track option.provider) {
                    <nz-option
                      [nzValue]="option.provider"
                      [nzLabel]="'corporateConventions.provider.' + option.provider | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="ccv-pos-category">
                <span>{{ 'corporateConventions.column.category' | translate }}</span>
                <nz-select
                  nzId="ccv-pos-category"
                  [ngModel]="category()"
                  (ngModelChange)="category.set($event)"
                >
                  @for (option of categories(); track option) {
                    <nz-option
                      [nzValue]="option"
                      [nzLabel]="'corporateConventions.welfareCategory.' + option | translate"
                    ></nz-option>
                  }
                </nz-select>
              </label>
              <label class="field" for="ccv-pos-code">
                <span>{{ 'corporateConventions.pos.voucherCode' | translate }}</span>
                <input
                  nz-input
                  id="ccv-pos-code"
                  [ngModel]="voucherCode()"
                  (ngModelChange)="voucherCode.set($event)"
                  autocomplete="off"
                />
              </label>
              <label class="field" for="ccv-pos-amount">
                <span>{{ 'corporateConventions.pos.voucherAmount' | translate }}</span>
                <nz-input-number
                  nzId="ccv-pos-amount"
                  [ngModel]="voucherAmount()"
                  (ngModelChange)="voucherAmount.set($event)"
                  [nzMin]="0"
                  [nzStep]="1"
                ></nz-input-number>
              </label>
              <label class="field" for="ccv-pos-fee">
                <span>{{ 'corporateConventions.pos.feePercentage' | translate }}</span>
                <nz-input-number
                  nzId="ccv-pos-fee"
                  [ngModel]="feePercentage()"
                  (ngModelChange)="feePercentage.set($event)"
                  [nzMin]="0"
                  [nzMax]="99.99"
                  [nzStep]="0.5"
                ></nz-input-number>
              </label>
            </div>
            @if (hasAmount()) {
              <p class="muted">
                {{ 'corporateConventions.pos.merchantFee' | translate }}:
                {{ split().fee | money: currency() }} ·
                {{ 'corporateConventions.pos.netReceivable' | translate }}:
                {{ split().net | money: currency() }}
              </p>
            }
            <button
              nz-button
              type="button"
              [nzLoading]="store.redeeming()"
              [disabled]="!canRedeem()"
              (click)="redeem()"
            >
              {{ 'corporateConventions.pos.redeem' | translate }}
            </button>
            @for (voucher of store.redemptions(); track voucher.id) {
              <p>
                <nz-tag nzColor="green">{{
                  'corporateConventions.provider.' + voucher.provider | translate
                }}</nz-tag>
                <span class="mono">{{ voucher.voucher_code_masked }}</span>
                {{ voucher.gross_voucher_amount | money: voucher.currency }}
              </p>
            }
          </section>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class PosConventionWidgetComponent implements OnInit {
  protected readonly store = inject(PosConventionStore);

  /** Whether the drawer is open. */
  readonly visible = input(false);
  /** The lines of the cart to price under the pass. */
  readonly lines = input.required<readonly CcvCartLine[]>();
  readonly currency = input<string>('EUR');
  /** Type and id of the sale document the convention and the vouchers are recorded against (needed to apply and to redeem). */
  readonly documentType = input<CcvSourceDocumentType>('POS_RECEIPT');
  readonly documentId = input<string | null>(null);
  readonly employeeDocumentId = input<string | null>(null);

  readonly closed = output<void>();
  readonly applied = output<CcvCheckoutResult>();
  readonly voucherRedeemed = output<CcvWelfareRedemption>();

  protected readonly identifier = signal('');
  protected readonly feedback = signal<CcvOutcome | null>(null);
  protected readonly provider = signal<CcvWelfareProvider | null>(null);
  protected readonly category = signal<CcvWelfareCategory | null>(null);
  protected readonly voucherCode = signal('');
  protected readonly voucherAmount = signal<number | null>(null);
  protected readonly feePercentage = signal<number>(0);

  protected readonly jurisdiction = computed(() => this.store.jurisdictionFor(this.currency()));
  protected readonly providers = computed(() => this.store.providersFor(this.jurisdiction()));
  protected readonly categories = computed(
    () => this.providers().find((option) => option.provider === this.provider())?.categories ?? [],
  );
  protected readonly hasAmount = computed(() => (this.voucherAmount() ?? 0) > 0);
  protected readonly split = computed(() =>
    voucherSplit(this.voucherAmount() ?? 0, this.feePercentage()),
  );
  protected readonly canRedeem = computed(
    () =>
      this.documentId() !== null &&
      this.provider() !== null &&
      this.category() !== null &&
      this.voucherCode().trim().length >= 4 &&
      this.hasAmount() &&
      !this.store.redeeming(),
  );
  protected readonly capUsedPercent = computed(() => {
    const enrollment = this.store.enrollment();
    return enrollment?.annual_spending_cap
      ? Math.round(shareOf(enrollment.annual_used_amount, enrollment.annual_spending_cap))
      : 0;
  });
  protected readonly capFormat = (percent: number): string => `${percent}%`;

  constructor() {
    // The split follows the cart: every change of the lines or the currency re-prices it under the pass.
    effect(() => {
      const lines = [...this.lines()];
      const currency = this.currency();
      untracked(() => void this.store.price(lines, currency));
    });
  }

  ngOnInit(): void {
    void this.store.init();
  }

  protected async verify(): Promise<void> {
    const outcome = await this.store.verify(this.identifier().trim());
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      await this.store.price([...this.lines()], this.currency());
    }
  }

  protected onProvider(provider: CcvWelfareProvider | null): void {
    this.provider.set(provider);
    const option = this.providers().find((candidate) => candidate.provider === provider);
    this.feePercentage.set(toNumber(option?.default_fee_percentage));
    this.category.set(option?.categories[0] ?? null);
  }

  protected async apply(): Promise<void> {
    const documentId = this.documentId();
    if (documentId === null) {
      return;
    }
    const outcome = await this.store.commit(
      [...this.lines()],
      this.documentType(),
      documentId,
      this.currency(),
      this.employeeDocumentId(),
    );
    this.feedback.set(outcome.ok ? null : outcome);
    const result = this.store.checkout();
    if (outcome.ok && result !== null) {
      this.applied.emit(result);
    }
  }

  protected async redeem(): Promise<void> {
    const documentId = this.documentId();
    const provider = this.provider();
    const category = this.category();
    const amount = this.voucherAmount();
    if (documentId === null || provider === null || category === null || amount === null) {
      return;
    }
    const outcome = await this.store.redeem({
      source_document_type: this.documentType(),
      source_document_id: documentId,
      enrollment_id: this.store.enrollment()?.id ?? null,
      jurisdiction: this.jurisdiction(),
      provider,
      welfare_category: category,
      voucher_code: this.voucherCode().trim(),
      currency: this.currency(),
      gross_voucher_amount: amount,
      merchant_fee_percentage: this.feePercentage(),
    });
    this.feedback.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      const redemptions = this.store.redemptions();
      this.voucherRedeemed.emit(redemptions[redemptions.length - 1]);
      this.voucherCode.set('');
      this.voucherAmount.set(null);
    }
  }
}
