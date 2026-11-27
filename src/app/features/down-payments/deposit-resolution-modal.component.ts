import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  DP_PAYMENT_ACCOUNTS,
  DP_RESOLUTIONS,
  DpDeposit,
  DpPaymentAccount,
  DpRefundMode,
  DpResolution,
  DpResolvePayload,
  TranslateService,
} from '@core';
import { ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { ChainStore } from './chain.store';
import {
  depositStatusColor,
  DpOutcome,
  isEarnestMoney,
  isHeld,
  isoDay,
  needsPayment,
} from './down-payments.util';
import { DpFeedbackComponent } from './feedback.component';
import { DpJurisdictionNoticeComponent } from './jurisdiction-notice.component';

/**
 * A deposit receipt of the chain: the receipt (amount, number, VAT exemption code, virtual stamp duty), the confirmation of its
 * payment, and the three ways a held deposit ends - imputed to the price with VAT, forfeited on breach out of VAT, or refunded (single
 * or, for earnest money only, double under Art. 1385 c.c.) - each with the live accounting impact before anything is posted.
 */
@Component({
  selector: 'app-dp-deposit-modal',
  imports: [
    FormsModule,
    ModalActionsDirective,
    MoneyPipe,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzTableModule,
    NzTagModule,
    DpFeedbackComponent,
    DpJurisdictionNoticeComponent,
    TranslatePipe,
  ],
  styleUrl: './down-payments.scss',
  template: `
    <nz-modal
      appModalActions
      [nzVisible]="visible()"
      [nzWidth]="860"
      [nzTitle]="'down_payments.modal.deposit' | translate"
      [nzFooter]="null"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <app-dp-feedback [outcome]="feedback()" (dismissed)="feedback.set(null)" />
        <app-dp-jurisdiction-notice [jurisdiction]="store.chain()?.jurisdiction ?? null" />

        <nz-descriptions nzBordered nzSize="small" [nzColumn]="2" data-test="receipt">
          <nz-descriptions-item [nzTitle]="'down_payments.field.receiptNumber' | translate">{{
            deposit().receipt_number
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.type' | translate">{{
            'down_payments.depositType.' + deposit().deposit_type | translate
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.amount' | translate">{{
            deposit().amount | money: deposit().currency
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.status' | translate">
            <nz-tag [nzColor]="statusColor(deposit().status)">{{
              'down_payments.depositStatus.' + deposit().status | translate
            }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.vatExemption' | translate">
            <nz-tag data-test="exemption">{{ deposit().vat_exemption_code ?? '-' }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.stampDuty' | translate">
            <span data-test="stamp">
              @if (deposit().marca_da_bollo_applied) {
                {{ 'down_payments.field.stampApplied' | translate }} ({{
                  deposit().marca_da_bollo_amount | money: deposit().currency
                }})
              } @else {
                {{ 'down_payments.field.stampNotDue' | translate }}
              }
            </span>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.issueDate' | translate">{{
            deposit().issue_date ?? '-'
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'down_payments.field.paymentDate' | translate">{{
            deposit().payment_date ?? '-'
          }}</nz-descriptions-item>
          @if (deposit().resolution; as resolved) {
            <nz-descriptions-item
              [nzTitle]="'down_payments.field.resolution' | translate"
              [nzSpan]="2"
            >
              {{ 'down_payments.resolution.' + resolved | translate }} ({{
                deposit().resolved_at ?? '-'
              }})
            </nz-descriptions-item>
          }
        </nz-descriptions>

        @if (unpaid()) {
          <h4 class="section-title">{{ 'down_payments.section.confirmPayment' | translate }}</h4>
          <p class="muted">{{ 'down_payments.hint.confirmDeposit' | translate }}</p>
          <div class="form-grid">
            <label class="field" for="dp-d-paid">
              <span>{{ 'down_payments.field.paidAt' | translate }}</span>
              <nz-date-picker
                nzId="dp-d-paid"
                [ngModel]="paidAt()"
                (ngModelChange)="paidAt.set($event)"
              ></nz-date-picker>
            </label>
            <label class="field" for="dp-d-reference">
              <span>{{ 'down_payments.field.reference' | translate }}</span>
              <input
                nz-input
                id="dp-d-reference"
                maxlength="100"
                [ngModel]="reference()"
                (ngModelChange)="reference.set($event)"
              />
            </label>
            <div class="field">
              <span id="dp-d-account-label">{{
                'down_payments.field.paymentAccount' | translate
              }}</span>
              <nz-radio-group
                aria-labelledby="dp-d-account-label"
                [ngModel]="account()"
                (ngModelChange)="account.set($event)"
              >
                @for (item of accounts; track item) {
                  <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                  <label nz-radio [nzValue]="item">{{
                    'down_payments.paymentAccount.' + item | translate
                  }}</label>
                }
              </nz-radio-group>
            </div>
          </div>
          <p class="actions-bar">
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="confirm-payment"
              [disabled]="paidAt() === null"
              [nzLoading]="store.saving()"
              (click)="confirmPayment()"
            >
              {{ 'down_payments.action.confirmPayment' | translate }}
            </button>
          </p>
        }

        @if (held()) {
          <h4 class="section-title">{{ 'down_payments.section.resolution' | translate }}</h4>
          <p class="muted">{{ 'down_payments.hint.resolution' | translate }}</p>

          <div class="choice-grid" data-test="resolutions">
            @for (item of resolutions; track item) {
              <div
                class="choice"
                role="button"
                tabindex="0"
                [class.selected]="resolution() === item"
                [attr.data-test]="'resolution-' + item"
                (click)="choose(item)"
                (keydown.enter)="choose(item)"
              >
                <div class="choice-title">{{ 'down_payments.resolution.' + item | translate }}</div>
                <div class="muted">{{ 'down_payments.hint.' + item | translate }}</div>
              </div>
            }
          </div>

          @if (resolution() === 'refund') {
            <div class="field">
              <span id="dp-d-refund-label">{{ 'down_payments.field.refundMode' | translate }}</span>
              <nz-radio-group
                aria-labelledby="dp-d-refund-label"
                [ngModel]="refundMode()"
                (ngModelChange)="setRefundMode($event)"
              >
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label nz-radio nzValue="single" data-test="refund-single">{{
                  'down_payments.refundMode.single' | translate
                }}</label>
                <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                <label
                  nz-radio
                  nzValue="double"
                  data-test="refund-double"
                  [nzDisabled]="!earnest()"
                  >{{ 'down_payments.refundMode.double' | translate }}</label
                >
              </nz-radio-group>
              @if (!earnest()) {
                <small class="muted">{{
                  'down_payments.hint.doubleOnlyEarnest' | translate
                }}</small>
              }
            </div>
            <div class="field">
              <span id="dp-d-refund-account-label">{{
                'down_payments.field.paymentAccount' | translate
              }}</span>
              <nz-radio-group
                aria-labelledby="dp-d-refund-account-label"
                [ngModel]="account()"
                (ngModelChange)="account.set($event)"
              >
                @for (item of accounts; track item) {
                  <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
                  <label nz-radio [nzValue]="item">{{
                    'down_payments.paymentAccount.' + item | translate
                  }}</label>
                }
              </nz-radio-group>
            </div>
          }

          @if (resolution() !== null) {
            <div class="form-grid">
              <label class="field" for="dp-d-date">
                <span>{{ 'down_payments.field.date' | translate }}</span>
                <nz-date-picker
                  nzId="dp-d-date"
                  [ngModel]="date()"
                  (ngModelChange)="date.set($event)"
                ></nz-date-picker>
              </label>
              <label class="field" for="dp-d-notes">
                <span>{{ 'down_payments.field.notes' | translate }}</span>
                <textarea
                  nz-input
                  id="dp-d-notes"
                  rows="2"
                  maxlength="2000"
                  [ngModel]="notes()"
                  (ngModelChange)="notes.set($event)"
                ></textarea>
              </label>
            </div>
          }

          @if (store.resolution(); as impact) {
            <div class="preview-box" data-test="impact">
              <h4 class="section-title">
                {{ 'down_payments.section.accountingImpact' | translate }}
              </h4>
              <nz-tag [nzColor]="impact.vat_applies ? 'blue' : 'orange'" data-test="vat-flag">
                {{
                  (impact.vat_applies
                    ? 'down_payments.field.withVat'
                    : 'down_payments.field.outOfVat'
                  ) | translate
                }}
              </nz-tag>
              @if (impact.lines.length === 0) {
                <p class="muted">{{ 'down_payments.hint.noEntry' | translate }}</p>
              } @else {
                <nz-table nzSize="small" [nzData]="impact.lines" [nzShowPagination]="false">
                  <thead>
                    <tr>
                      <th scope="col">{{ 'down_payments.field.account' | translate }}</th>
                      <th scope="col" class="num">{{ 'down_payments.field.debit' | translate }}</th>
                      <th scope="col" class="num">
                        {{ 'down_payments.field.credit' | translate }}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    @for (line of impact.lines; track $index) {
                      <tr>
                        <td>{{ 'down_payments.account.' + line.account | translate }}</td>
                        <td class="num">{{ line.debit | money: deposit().currency }}</td>
                        <td class="num">{{ line.credit | money: deposit().currency }}</td>
                      </tr>
                    }
                  </tbody>
                </nz-table>
              }
              @if (hasPenalty()) {
                <p data-test="penalty">
                  {{ 'down_payments.field.penalty' | translate }}:
                  {{ impact.penalty_amount | money: deposit().currency }}
                </p>
              }
            </div>
          }

          <p class="actions-bar">
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="resolve"
              [disabled]="resolution() === null"
              [nzLoading]="store.saving()"
              (click)="resolve()"
            >
              {{ 'down_payments.action.resolve' | translate }}
            </button>
          </p>
        }

        <p class="actions-bar">
          <button nz-button type="button" (click)="closed.emit()">
            {{ 'down_payments.action.close' | translate }}
          </button>
        </p>
      </ng-container>
    </nz-modal>
  `,
})
export class DepositResolutionModalComponent {
  readonly deposit = input.required<DpDeposit>();
  readonly visible = input.required<boolean>();
  readonly closed = output<void>();

  protected readonly store = inject(ChainStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly resolutions = DP_RESOLUTIONS;
  protected readonly accounts = DP_PAYMENT_ACCOUNTS;
  protected readonly statusColor = depositStatusColor;

  protected readonly resolution = signal<DpResolution | null>(null);
  protected readonly refundMode = signal<DpRefundMode>('single');
  protected readonly account = signal<DpPaymentAccount>('bank');
  protected readonly date = signal<Date | null>(null);
  protected readonly notes = signal('');
  protected readonly paidAt = signal<Date | null>(null);
  protected readonly reference = signal('');
  protected readonly feedback = signal<DpOutcome | null>(null);

  protected readonly unpaid = computed(() => needsPayment(this.deposit()));
  protected readonly held = computed(() => isHeld(this.deposit()));
  protected readonly earnest = computed(() => isEarnestMoney(this.deposit()));
  protected readonly hasPenalty = computed(
    () => Number(this.store.resolution()?.penalty_amount ?? 0) > 0,
  );

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.reset(this.deposit());
      }
    });
  }

  private reset(deposit: DpDeposit): void {
    this.feedback.set(null);
    this.store.clearResolution();
    this.resolution.set(null);
    this.refundMode.set('single');
    this.account.set(deposit.payment_account ?? 'bank');
    this.date.set(null);
    this.notes.set('');
    this.paidAt.set(new Date());
    this.reference.set('');
  }

  private payload(): DpResolvePayload | null {
    const resolution = this.resolution();
    if (resolution === null) {
      return null;
    }
    const day = isoDay(this.date());
    return {
      resolution,
      ...(day ? { date: day } : {}),
      ...(resolution === 'refund'
        ? { refund_mode: this.refundMode(), payment_account: this.account() }
        : {}),
      ...(this.notes().trim() ? { notes: this.notes().trim() } : {}),
    };
  }

  /** Picks the way the deposit ends and shows what it would post. */
  protected choose(resolution: DpResolution): void {
    this.resolution.set(resolution);
    if (resolution === 'refund' && !this.earnest()) {
      this.refundMode.set('single');
    }
    void this.refreshImpact();
  }

  protected setRefundMode(mode: DpRefundMode): void {
    this.refundMode.set(mode);
    void this.refreshImpact();
  }

  private async refreshImpact(): Promise<void> {
    const payload = this.payload();
    if (payload === null) {
      return;
    }
    const outcome = await this.store.previewResolution(this.deposit().id, payload);
    this.feedback.set(outcome.ok ? null : outcome);
  }

  protected async confirmPayment(): Promise<void> {
    const paid = isoDay(this.paidAt());
    if (paid === null) {
      return;
    }
    const outcome = await this.store.confirmDeposit(this.deposit().id, {
      paid_at: paid,
      payment_account: this.account(),
      ...(this.reference().trim() ? { reference: this.reference().trim() } : {}),
    });
    if (outcome.ok) {
      this.message.success(this.i18n.instant('down_payments.message.depositCollected'));
      this.feedback.set(null);
    } else {
      this.feedback.set(outcome);
    }
  }

  protected async resolve(): Promise<void> {
    const payload = this.payload();
    if (payload === null) {
      return;
    }
    const outcome = await this.store.resolve(this.deposit().id, payload);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('down_payments.message.depositResolved'));
      this.closed.emit();
    } else {
      this.feedback.set(outcome);
    }
  }
}
