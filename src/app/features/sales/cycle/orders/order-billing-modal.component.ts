import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { Observable } from 'rxjs';
import {
  ApiResponse,
  BillingApiService,
  CoreOrder,
  DownPaymentInvoicePayload,
  I18nService,
  SalesCycleApiService,
} from '@core';
import { ModalActionsDirective, TranslatePipe } from '@shared';
import { apiErrorText } from '../shared/sales-api-helpers';

export type OrderBillingMode = 'partial' | 'down-payment' | 'deposit';

const DECIMAL = /^\d+(\.\d{1,4})?$/;

/** A decimal text that is greater than zero and at most 100 (a percentage the API accepts). */
const isValidPercentage = (value: string): boolean =>
  DECIMAL.test(value) && Number(value) > 0 && Number(value) <= 100;

/** Partial billing (quantities per order line), down-payment invoice (TD02) and deposit invoice of an order. */
@Component({
  selector: 'app-order-billing-modal',
  styleUrl: './order-billing-modal.component.scss',
  imports: [ModalActionsDirective, FormsModule, NzAlertModule, NzInputModule, NzModalModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'SC.BILLING.MODE_' + mode() | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="!valid()"
      (nzOnCancel)="visible.set(false)"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        @if (error()) {
          <nz-alert class="alert" nzType="error" [nzMessage]="error()" nzShowIcon />
        }
        @if (mode() === 'partial') {
          <p>{{ 'SC.BILLING.PARTIAL_HINT' | translate }}</p>
          @for (item of order().items ?? []; track item.id) {
            <div class="row">
              <span class="desc">{{ item.description }}</span>
              <span class="qty">{{ item.quantity_invoiced ?? '0' }} / {{ item.quantity }}</span>
              <input
                nz-input
                inputmode="decimal"
                [attr.aria-label]="'SC.BILLING.QUANTITY_TO_BILL' | translate"
                [placeholder]="'SC.BILLING.QUANTITY_TO_BILL' | translate"
                [ngModel]="quantities()[item.id ?? ''] ?? ''"
                (ngModelChange)="setQuantity(item.id ?? '', $event)"
              />
            </div>
          }
        } @else {
          <label for="bill-percentage">{{ 'SC.BILLING.PERCENTAGE' | translate }}</label>
          <input nz-input id="bill-percentage" inputmode="decimal" [(ngModel)]="percentage" class="field" />
          @if (mode() === 'down-payment') {
            <label for="bill-amount">{{ 'SC.BILLING.AMOUNT' | translate }}</label>
            <input nz-input id="bill-amount" inputmode="decimal" [(ngModel)]="amount" class="field" />
            <p class="hint">{{ 'SC.BILLING.PERCENT_OR_AMOUNT' | translate }}</p>
          }
        }
        <label for="bill-due">{{ 'SC.BILLING.DUE_DATE' | translate }}</label>
        <input nz-input id="bill-due" type="date" [(ngModel)]="dueDate" class="field" />
      </ng-container>
    </nz-modal>
  `,
})
export class OrderBillingModalComponent {
  private readonly salesApi = inject(SalesCycleApiService);
  private readonly billingApi = inject(BillingApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly order = input.required<CoreOrder>();
  readonly mode = input.required<OrderBillingMode>();
  readonly visible = model(false);
  readonly done = output<void>();

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly quantities = signal<Record<string, string>>({});
  protected percentage = '';
  protected amount = '';
  protected dueDate = '';

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.quantities.set({});
        this.percentage = '';
        this.amount = '';
        this.dueDate = '';
        this.error.set('');
      }
    });
  }

  protected setQuantity(id: string, value: string): void {
    this.quantities.update((q) => ({ ...q, [id]: value }));
  }

  protected valid(): boolean {
    if (this.mode() === 'partial') {
      const entered = Object.values(this.quantities()).filter(Boolean);
      return entered.length > 0 && entered.every((q) => DECIMAL.test(q) && Number(q) > 0);
    }
    const percentageOk = isValidPercentage(this.percentage);
    if (this.mode() === 'deposit') {
      return percentageOk;
    }
    return percentageOk !== (DECIMAL.test(this.amount) && Number(this.amount) > 0);
  }

  protected submit(): void {
    if (!this.valid()) {
      return;
    }
    const order = this.order();
    let request: Observable<ApiResponse<unknown>>;
    if (this.mode() === 'partial') {
      const lines = (order.items ?? [])
        .filter((item) => item.id && this.quantities()[item.id])
        .map((item) => ({ sales_order_item_id: item.id, quantity: this.quantities()[item.id ?? ''] }));
      request = this.billingApi.invoiceFromOrder(order.id, { lines, due_date: this.dueDate || null });
    } else if (this.mode() === 'deposit') {
      request = this.salesApi.createOrderDepositInvoice(order.id, this.percentage);
    } else {
      const payload: DownPaymentInvoicePayload = {
        percentage: this.percentage || null,
        amount: this.amount || null,
        due_date: this.dueDate || null,
      };
      request = this.billingApi.createDownPaymentInvoice(order.id, payload);
    }
    this.saving.set(true);
    this.error.set('');
    request.subscribe({
      next: () => {
        this.saving.set(false);
        this.visible.set(false);
        this.message.success(this.i18n.translate('SC.BILLING.INVOICE_CREATED'));
        this.done.emit();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorText(err));
      },
    });
  }
}
