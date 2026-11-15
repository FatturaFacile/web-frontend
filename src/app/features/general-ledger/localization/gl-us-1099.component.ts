import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  GeneralLedgerApiService,
  I18nService,
  PermissionsService,
  US_1099_BOXES,
  US_1099_TIN_TYPES,
  Us1099Form,
  Us1099Payment,
  Us1099Recipient,
  Us1099Summary,
  Us1099SupplierPayment,
  Us1099TinType,
} from '@core';
import { IconActionDirective, MoneyPipe, TranslatePipe } from '@shared';

/** 1099 data capture: recipients, the payments made to them and the yearly summary by form and box. */
@Component({
  selector: 'app-gl-us-1099',
  styleUrl: './gl-localization.scss',
  imports: [
    FormsModule,
    IconActionDirective,
    NzButtonModule,
    NzCardModule,
    NzCheckboxModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-tabs>
      <nz-tab [nzTitle]="'GL.T1099_RECIPIENTS' | translate">
        <nz-table nzSize="small" [nzData]="recipients()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GL.T1099_NAME' | translate }}</th>
              <th>{{ 'GL.T1099_TIN_TYPE' | translate }}</th>
              <th>{{ 'GL.T1099_TIN_LAST4' | translate }}</th>
              <th>{{ 'GL.T1099_DEFAULT_FORM' | translate }}</th>
              <th>{{ 'GL.T1099_W9' | translate }}</th>
              <th>{{ 'GL.T1099_EXEMPT' | translate }}</th>
              @if (canWrite) {
                <th>{{ 'GL.US_ACTIONS' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (recipient of recipients(); track recipient.id) {
              <tr>
                <td>{{ recipient.name }}</td>
                <td>{{ recipient.tin_type.toUpperCase() }}</td>
                <td>{{ recipient.tin_last4 ? '***' + recipient.tin_last4 : '' }}</td>
                <td>{{ recipient.default_form }}</td>
                <td>{{ recipient.w9_received_on }}</td>
                <td>{{ (recipient.is_exempt ? 'COMMON.YES' : 'COMMON.NO') | translate }}</td>
                @if (canWrite) {
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      type="button"
                      appIconAction="edit"
                      (click)="editRecipient(recipient)"
                    ></button>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'GL.T1099_DELETE_RECIPIENT_CONFIRM' | translate"
                      (nzOnConfirm)="removeRecipient(recipient)"
                    ></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>

        @if (canWrite) {
          <nz-card
            class="section"
            [nzTitle]="(editingRecipientId() ? 'GL.T1099_EDIT_RECIPIENT' : 'GL.T1099_ADD_RECIPIENT') | translate"
          >
            <div class="filters">
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.T1099_NAME' | translate"
                [placeholder]="'GL.T1099_NAME' | translate"
                [(ngModel)]="recipientName"
                maxlength="190"
              />
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.T1099_TIN_TYPE' | translate"
                [(ngModel)]="recipientTinType"
              >
                @for (type of tinTypes; track type) {
                  <nz-option [nzValue]="type" [nzLabel]="type.toUpperCase()" />
                }
              </nz-select>
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.T1099_TIN' | translate"
                [placeholder]="(editingRecipientId() ? 'GL.T1099_TIN_KEEP' : 'GL.T1099_TIN') | translate"
                [(ngModel)]="recipientTin"
                maxlength="11"
                autocomplete="off"
              />
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.T1099_DEFAULT_FORM' | translate"
                [(ngModel)]="recipientForm"
              >
                @for (form of forms; track form) {
                  <nz-option [nzValue]="form" [nzLabel]="form" />
                }
              </nz-select>
              <label for="t1099-w9">{{ 'GL.T1099_W9' | translate }}</label>
              <input
                class="date-input"
                id="t1099-w9"
                nz-input
                type="date"
                [(ngModel)]="recipientW9"
              />
              <!-- nz-checkbox renders its own input inside the label -->
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-checkbox [(ngModel)]="recipientExempt">{{
                'GL.T1099_EXEMPT' | translate
              }}</label>
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!recipientValid()"
                [nzLoading]="saving()"
                (click)="saveRecipient()"
              >
                {{ (editingRecipientId() ? 'GL.US_SAVE' : 'GL.T1099_ADD') | translate }}
              </button>
              @if (editingRecipientId()) {
                <button nz-button type="button" (click)="resetRecipientForm()">
                  {{ 'GL.US_CANCEL_EDIT' | translate }}
                </button>
              }
            </div>
            @if (recipientTin && !tinValid()) {
              <span class="ant-form-item-explain-error" role="alert">{{
                'GL.T1099_TIN_INVALID' | translate
              }}</span>
            }
          </nz-card>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'GL.T1099_PAYMENTS' | translate">
        <div class="filters">
          <label for="t1099-payments-year">{{ 'GL.T1099_YEAR' | translate }}</label>
          <nz-input-number
            id="t1099-payments-year"
            [nzMin]="2000"
            [nzMax]="2100"
            [nzPrecision]="0"
            [(ngModel)]="paymentsYear"
            (ngModelChange)="loadPayments()"
          />
        </div>
        <nz-table nzSize="small" [nzData]="payments()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'GL.T1099_RECIPIENT' | translate }}</th>
              <th>{{ 'GL.T1099_PAID_ON' | translate }}</th>
              <th class="num">{{ 'GL.T1099_AMOUNT' | translate }}</th>
              <th>{{ 'GL.T1099_FORM' | translate }} / {{ 'GL.T1099_BOX' | translate }}</th>
              <th>{{ 'GL.T1099_REFERENCE' | translate }}</th>
              <th></th>
              @if (canWrite) {
                <th>{{ 'GL.US_ACTIONS' | translate }}</th>
              }
            </tr>
          </thead>
          <tbody>
            @for (payment of payments(); track payment.id) {
              <tr>
                <td>{{ recipientNameOf(payment.recipient_id) }}</td>
                <td>{{ payment.paid_on.slice(0, 10) }}</td>
                <td class="num">{{ payment.amount | money: 'USD' }}</td>
                <td>{{ payment.form_type }} / {{ payment.box }}</td>
                <td>{{ payment.reference }}</td>
                <td>
                  @if (payment.supplier_payment_id) {
                    <nz-tag nzColor="processing">{{ 'GL.T1099_LINKED' | translate }}</nz-tag>
                  }
                </td>
                @if (canWrite) {
                  <td>
                    <button
                      nz-button
                      nzType="text"
                      type="button"
                      appIconAction="edit"
                      (click)="editPayment(payment)"
                    ></button>
                    <button
                      nz-button
                      nzType="text"
                      nzDanger
                      type="button"
                      appIconAction="delete"
                      nz-popconfirm
                      [nzPopconfirmTitle]="'GL.US_DELETE_CONFIRM' | translate"
                      (nzOnConfirm)="removePayment(payment)"
                    ></button>
                  </td>
                }
              </tr>
            }
          </tbody>
        </nz-table>

        @if (canWrite) {
          <nz-card
            class="section"
            [nzTitle]="(editingPaymentId() ? 'GL.T1099_EDIT_PAYMENT' : 'GL.T1099_ADD_PAYMENT') | translate"
          >
            @if (!editingPaymentId()) {
              <p>{{ 'GL.T1099_SUPPLIER_PAYMENT_HINT' | translate }}</p>
              <div class="filters">
                <nz-select
                  class="select-sm"
                  nzAllowClear
                  nzShowSearch
                  [attr.aria-label]="'GL.T1099_SUPPLIER_PAYMENT' | translate"
                  [nzPlaceHolder]="'GL.T1099_SUPPLIER_PAYMENT' | translate"
                  [(ngModel)]="supplierPaymentId"
                  (ngModelChange)="onSupplierPaymentChange()"
                >
                  @for (candidate of supplierPayments(); track candidate.id) {
                    <nz-option [nzValue]="candidate.id" [nzLabel]="supplierPaymentLabel(candidate)" />
                  }
                </nz-select>
              </div>
            }
            <div class="filters">
              @if (!editingPaymentId()) {
                <nz-select
                  class="select-sm"
                  [attr.aria-label]="'GL.T1099_RECIPIENT' | translate"
                  [nzPlaceHolder]="'GL.T1099_RECIPIENT' | translate"
                  [(ngModel)]="paymentRecipientId"
                >
                  @for (recipient of recipients(); track recipient.id) {
                    <nz-option [nzValue]="recipient.id" [nzLabel]="recipient.name" />
                  }
                </nz-select>
              }
              <label for="t1099-paid">{{ 'GL.T1099_PAID_ON' | translate }}</label>
              <input
                class="date-input"
                id="t1099-paid"
                nz-input
                type="date"
                [(ngModel)]="paymentDate"
              />
              <nz-input-number
                [nzMin]="0.01"
                [nzPrecision]="2"
                [nzPlaceHolder]="'GL.T1099_AMOUNT' | translate"
                [(ngModel)]="paymentAmount"
              />
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.T1099_FORM' | translate"
                [(ngModel)]="paymentForm"
                (ngModelChange)="onFormChange()"
              >
                @for (form of forms; track form) {
                  <nz-option [nzValue]="form" [nzLabel]="form" />
                }
              </nz-select>
              <nz-select
                class="select-sm"
                [attr.aria-label]="'GL.T1099_BOX' | translate"
                [(ngModel)]="paymentBox"
              >
                @for (box of boxesOfForm(); track box) {
                  <nz-option [nzValue]="box" [nzLabel]="box" />
                }
              </nz-select>
              <input
                nz-input
                class="field"
                [attr.aria-label]="'GL.T1099_REFERENCE' | translate"
                [placeholder]="'GL.T1099_REFERENCE' | translate"
                [(ngModel)]="paymentReference"
                maxlength="120"
              />
              <button
                nz-button
                nzType="primary"
                type="button"
                [disabled]="!paymentValid()"
                [nzLoading]="saving()"
                (click)="savePayment()"
              >
                {{ (editingPaymentId() ? 'GL.US_SAVE' : 'GL.T1099_ADD') | translate }}
              </button>
              @if (editingPaymentId()) {
                <button nz-button type="button" (click)="resetPaymentForm()">
                  {{ 'GL.US_CANCEL_EDIT' | translate }}
                </button>
              }
            </div>
          </nz-card>
        }
      </nz-tab>

      <nz-tab [nzTitle]="'GL.T1099_SUMMARY' | translate">
        <div class="filters">
          <label for="t1099-year">{{ 'GL.T1099_YEAR' | translate }}</label>
          <nz-input-number
            id="t1099-year"
            [nzMin]="2000"
            [nzMax]="2100"
            [nzPrecision]="0"
            [(ngModel)]="year"
          />
          <button
            nz-button
            nzType="primary"
            type="button"
            [disabled]="year === null"
            [nzLoading]="loadingSummary()"
            (click)="loadSummary()"
          >
            {{ 'GL.RUN_REPORT' | translate }}
          </button>
        </div>
        @if (summary(); as report) {
          <p>{{ 'GL.T1099_THRESHOLD' | translate }}: {{ report.threshold | money: 'USD' }}</p>
          <nz-table nzSize="small" [nzData]="report.recipients" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'GL.T1099_NAME' | translate }}</th>
                <th>{{ 'GL.T1099_FORM' | translate }} / {{ 'GL.T1099_BOX' | translate }}</th>
                <th class="num">{{ 'GL.T1099_AMOUNT' | translate }}</th>
                <th>{{ 'GL.T1099_STATUS' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of report.recipients; track row.recipient_id) {
                @for (box of row.boxes; track box.form_type + box.box) {
                  <tr>
                    <td>{{ row.name }}</td>
                    <td>{{ box.form_type }} / {{ box.box }}</td>
                    <td class="num">{{ box.amount | money: 'USD' }}</td>
                    <td>
                      @if (row.reportable && box.meets_threshold) {
                        <nz-tag nzColor="processing">{{
                          'GL.T1099_REPORTABLE' | translate
                        }}</nz-tag>
                      }
                      @if (row.missing_tin) {
                        <nz-tag nzColor="error">{{ 'GL.T1099_MISSING_TIN' | translate }}</nz-tag>
                      }
                      @if (row.missing_w9) {
                        <nz-tag nzColor="warning">{{ 'GL.T1099_MISSING_W9' | translate }}</nz-tag>
                      }
                    </td>
                  </tr>
                }
              }
            </tbody>
          </nz-table>
        }
      </nz-tab>
    </nz-tabs>
  `,
})
export class GlUs1099Component implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly tinTypes = US_1099_TIN_TYPES;
  protected readonly forms = Object.keys(US_1099_BOXES) as Us1099Form[];
  protected readonly recipients = signal<Us1099Recipient[]>([]);
  protected readonly payments = signal<Us1099Payment[]>([]);
  protected readonly supplierPayments = signal<Us1099SupplierPayment[]>([]);
  protected readonly summary = signal<Us1099Summary | null>(null);
  protected readonly saving = signal(false);
  protected readonly loadingSummary = signal(false);
  protected readonly editingRecipientId = signal<string | null>(null);
  protected readonly editingPaymentId = signal<string | null>(null);

  protected recipientName = '';
  protected recipientTinType: Us1099TinType = 'ein';
  protected recipientTin = '';
  protected recipientForm: Us1099Form = '1099-NEC';
  protected recipientW9 = '';
  protected recipientExempt = false;

  protected paymentRecipientId: string | null = null;
  protected supplierPaymentId: string | null = null;
  protected paymentDate = '';
  protected paymentAmount: number | null = null;
  protected paymentForm: Us1099Form = '1099-NEC';
  protected paymentBox = '1';
  protected paymentReference = '';

  protected year: number | null = new Date().getFullYear();
  protected paymentsYear: number | null = new Date().getFullYear();

  ngOnInit(): void {
    this.loadRecipients();
    this.loadPayments();
    this.loadSupplierPayments();
  }

  protected boxesOfForm(): readonly string[] {
    return US_1099_BOXES[this.paymentForm];
  }

  protected onFormChange(): void {
    this.paymentBox = this.boxesOfForm()[0];
  }

  protected recipientNameOf(id: string): string {
    return this.recipients().find((item) => item.id === id)?.name ?? id;
  }

  protected supplierPaymentLabel(candidate: Us1099SupplierPayment): string {
    return `${candidate.paid_at} - ${candidate.invoice_number ?? candidate.passive_invoice_id} - ${candidate.amount} ${candidate.currency}`;
  }

  /** The supplier payment fixes the date and the amount: they are shown and sent from it. */
  protected onSupplierPaymentChange(): void {
    const candidate = this.supplierPayments().find((item) => item.id === this.supplierPaymentId);
    if (!candidate) {
      return;
    }
    this.paymentDate = candidate.paid_at;
    this.paymentAmount = Number(candidate.amount);
    this.paymentReference = candidate.reference ?? '';
  }

  /** Mirrors the API pattern: EIN `12-3456789` or SSN `123-45-6789`, dashes optional. */
  protected tinValid(): boolean {
    return /^\d{2}-?\d{7}$|^\d{3}-?\d{2}-?\d{4}$/.test(this.recipientTin);
  }

  protected recipientValid(): boolean {
    return !!this.recipientName.trim() && (!this.recipientTin || this.tinValid());
  }

  protected paymentValid(): boolean {
    const hasRecipient = !!this.editingPaymentId() || !!this.paymentRecipientId;

    return hasRecipient && !!this.paymentDate && this.paymentAmount !== null && this.paymentAmount > 0;
  }

  protected editRecipient(recipient: Us1099Recipient): void {
    this.editingRecipientId.set(recipient.id);
    this.recipientName = recipient.name;
    this.recipientTinType = recipient.tin_type;
    this.recipientTin = '';
    this.recipientForm = recipient.default_form;
    this.recipientW9 = recipient.w9_received_on ?? '';
    this.recipientExempt = recipient.is_exempt;
  }

  protected resetRecipientForm(): void {
    this.editingRecipientId.set(null);
    this.recipientName = '';
    this.recipientTinType = 'ein';
    this.recipientTin = '';
    this.recipientForm = '1099-NEC';
    this.recipientW9 = '';
    this.recipientExempt = false;
  }

  protected saveRecipient(): void {
    if (!this.recipientValid()) {
      return;
    }
    const editingId = this.editingRecipientId();
    this.saving.set(true);
    const request = editingId
      ? this.api.updateUs1099Recipient(editingId, {
          name: this.recipientName.trim(),
          tin_type: this.recipientTinType,
          // The stored number is never returned: it is replaced only when a new one is typed.
          ...(this.recipientTin ? { tin: this.recipientTin } : {}),
          default_form: this.recipientForm,
          is_exempt: this.recipientExempt,
          w9_received_on: this.recipientW9 || null,
        })
      : this.api.createUs1099Recipient({
          name: this.recipientName.trim(),
          tin_type: this.recipientTinType,
          tin: this.recipientTin || null,
          default_form: this.recipientForm,
          is_exempt: this.recipientExempt,
          w9_received_on: this.recipientW9 || null,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.T1099_SAVED'));
        this.resetRecipientForm();
        this.loadRecipients();
      },
      error: () => this.saving.set(false),
    });
  }

  protected removeRecipient(recipient: Us1099Recipient): void {
    this.api.deleteUs1099Recipient(recipient.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.US_DELETED'));
        if (this.editingRecipientId() === recipient.id) {
          this.resetRecipientForm();
        }
        this.loadRecipients();
        this.loadPayments();
      },
    });
  }

  protected editPayment(payment: Us1099Payment): void {
    this.editingPaymentId.set(payment.id);
    this.paymentRecipientId = payment.recipient_id;
    this.paymentDate = payment.paid_on.slice(0, 10);
    this.paymentAmount = Number(payment.amount);
    this.paymentForm = payment.form_type;
    this.paymentBox = payment.box;
    this.paymentReference = payment.reference ?? '';
  }

  protected resetPaymentForm(): void {
    this.editingPaymentId.set(null);
    this.paymentRecipientId = null;
    this.supplierPaymentId = null;
    this.paymentDate = '';
    this.paymentAmount = null;
    this.paymentForm = '1099-NEC';
    this.paymentBox = '1';
    this.paymentReference = '';
  }

  protected savePayment(): void {
    if (!this.paymentValid() || this.paymentAmount === null) {
      return;
    }
    const editingId = this.editingPaymentId();
    this.saving.set(true);
    const request = editingId
      ? this.api.updateUs1099Payment(editingId, {
          paid_on: this.paymentDate,
          amount: this.paymentAmount,
          form_type: this.paymentForm,
          box: this.paymentBox,
          reference: this.paymentReference.trim() || null,
        })
      : this.api.createUs1099Payment({
          recipient_id: this.paymentRecipientId ?? '',
          supplier_payment_id: this.supplierPaymentId,
          paid_on: this.paymentDate,
          amount: this.paymentAmount,
          form_type: this.paymentForm,
          box: this.paymentBox,
          reference: this.paymentReference.trim() || null,
        });

    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.message.success(this.i18n.translate('GL.T1099_SAVED'));
        this.resetPaymentForm();
        this.loadPayments();
        this.loadSupplierPayments();
      },
      error: () => this.saving.set(false),
    });
  }

  protected removePayment(payment: Us1099Payment): void {
    this.api.deleteUs1099Payment(payment.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.US_DELETED'));
        if (this.editingPaymentId() === payment.id) {
          this.resetPaymentForm();
        }
        this.loadPayments();
        this.loadSupplierPayments();
      },
    });
  }

  protected loadPayments(): void {
    this.api
      .getUs1099Payments(this.paymentsYear === null ? undefined : { year: this.paymentsYear })
      .subscribe({ next: (res) => this.payments.set(res.data) });
  }

  protected loadSummary(): void {
    if (this.year === null) {
      return;
    }
    this.loadingSummary.set(true);
    this.api.getUs1099Summary(this.year).subscribe({
      next: (res) => {
        this.loadingSummary.set(false);
        this.summary.set(res.data);
      },
      error: () => this.loadingSummary.set(false),
    });
  }

  private loadRecipients(): void {
    this.api.getUs1099Recipients().subscribe({ next: (res) => this.recipients.set(res.data) });
  }

  private loadSupplierPayments(): void {
    this.api.getUs1099SupplierPayments().subscribe({ next: (res) => this.supplierPayments.set(res.data) });
  }
}
