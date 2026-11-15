import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  InventoryApiService,
  ProductItem,
  RetailApiService,
  RetailPaymentMethod,
  RetailPosSession,
  RetailRefundMethod,
  RetailTicket,
  RetailTicketLinePayload,
  RetailTicketPreview,
  TranslateService,
} from '@core';
import { MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';

/** A line of the ticket being built: a catalogue product (priced by the server) or a free line. */
export interface CashierLine {
  key: number;
  productId: string | null;
  description: string;
  quantity: number;
  unitPrice: number;
  taxRate: number;
}

export interface CashierPayment {
  method: RetailPaymentMethod;
  amount: number;
}

const toCents = (value: number | string): number => Math.round(Number(value) * 100);

/**
 * Cashier screen of the fiscal till: ticket lines picked from the catalogue or typed, promotions applied by the
 * server, payments split by method, and returns or the refund of a whole sale.
 */
@Component({
  selector: 'app-retail-cashier',
  imports: [FormsModule, MoneyPipe, NzButtonModule, NzCardModule, NzInputModule, NzInputNumberModule, NzSelectModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'RES.PAGE.RETAIL_CASHIER' | translate" />

    @if (!session()) {
      <nz-card><p>{{ 'RETAIL_CASHIER.NO_SESSION' | translate }}</p></nz-card>
    } @else {
      <nz-card [nzTitle]="'RETAIL_CASHIER.TICKET' | translate">
        <p>{{ 'RETAIL_CASHIER.SESSION' | translate }}: {{ session()!.id }}</p>

        <nz-select
          class="cashier-search"
          nzShowSearch
          nzServerSearch
          [nzPlaceHolder]="'RETAIL_CASHIER.SEARCH_PRODUCT' | translate"
          [ngModel]="null"
          (nzOnSearch)="searchProducts($event)"
          (ngModelChange)="addProduct($event)"
        >
          @for (product of products(); track product.id) {
            <nz-option [nzValue]="product" [nzLabel]="product.name + ' (' + product.sku + ')'" />
          }
        </nz-select>

        <div class="cashier-free-line">
          <input nz-input [placeholder]="'RETAIL_CASHIER.DESCRIPTION' | translate" [ngModel]="freeDescription()" (ngModelChange)="freeDescription.set($event)" />
          <nz-input-number [ngModel]="freePrice()" (ngModelChange)="freePrice.set($event ?? 0)" [nzMin]="0" [nzPlaceHolder]="'RETAIL_CASHIER.UNIT_PRICE' | translate" />
          <nz-input-number [ngModel]="freeTaxRate()" (ngModelChange)="freeTaxRate.set($event ?? 0)" [nzMin]="0" [nzMax]="100" [nzPlaceHolder]="'RETAIL_CASHIER.TAX_RATE' | translate" />
          <button nz-button type="button" (click)="addFreeLine()">{{ 'RETAIL_CASHIER.ADD_LINE' | translate }}</button>
        </div>

        @if (lines().length === 0) {
          <p>{{ 'RETAIL_CASHIER.EMPTY_TICKET' | translate }}</p>
        } @else {
          <nz-table #linesTable [nzData]="lines()" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'RETAIL_CASHIER.DESCRIPTION' | translate }}</th>
                <th>{{ 'RETAIL_CASHIER.QUANTITY' | translate }}</th>
                <th>{{ 'RETAIL_CASHIER.UNIT_PRICE' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (line of linesTable.data; track line.key) {
                <tr>
                  <td>{{ line.description }}</td>
                  <td><nz-input-number [ngModel]="line.quantity" (ngModelChange)="setQuantity(line.key, $event)" [nzMin]="1" /></td>
                  <td>{{ line.productId ? '' : (line.unitPrice | money) }}</td>
                  <td><button nz-button nzType="link" type="button" (click)="removeLine(line.key)">&times;</button></td>
                </tr>
              }
            </tbody>
          </nz-table>
        }

        @if (preview(); as quote) {
          <h4>{{ 'RETAIL_CASHIER.PROMOTIONS_APPLIED' | translate }}</h4>
          @for (promotion of quote.promotions; track promotion.code) {
            <nz-tag>{{ promotion.name }}: -{{ promotion.discount_net | money }}</nz-tag>
          } @empty {
            <span>{{ 'RETAIL_CASHIER.NO_PROMOTIONS' | translate }}</span>
          }
          <p>{{ 'RETAIL_CASHIER.DISCOUNT' | translate }}: {{ quote.discount_total | money }}</p>
          <h3>{{ 'RETAIL_CASHIER.TOTAL' | translate }}: {{ quote.total_gross | money }}</h3>
        }

        <h4>{{ 'RETAIL_CASHIER.PAYMENTS' | translate }}</h4>
        <div class="cashier-payment-form">
          <nz-select [ngModel]="paymentMethod()" (ngModelChange)="paymentMethod.set($event)">
            @for (method of paymentMethods; track method) {
              <nz-option [nzValue]="method" [nzLabel]="methodLabel(method) | translate" />
            }
          </nz-select>
          <nz-input-number [ngModel]="paymentAmount()" (ngModelChange)="paymentAmount.set($event ?? 0)" [nzMin]="0" [nzPrecision]="2" />
          <button nz-button type="button" (click)="addPayment()">{{ 'RETAIL_CASHIER.ADD_PAYMENT' | translate }}</button>
        </div>
        @for (payment of payments(); track $index) {
          <nz-tag nzMode="closeable" (nzOnClose)="removePayment($index)">{{ methodLabel(payment.method) | translate }}: {{ payment.amount | money }}</nz-tag>
        }
        <p>{{ 'RETAIL_CASHIER.REMAINING' | translate }}: {{ remaining() | money }} &middot; {{ 'RETAIL_CASHIER.CHANGE' | translate }}: {{ change() | money }}</p>

        <button nz-button nzType="primary" type="button" [disabled]="!canCharge()" [nzLoading]="busy()" (click)="charge()">{{ 'RETAIL_CASHIER.CHARGE' | translate }}</button>
        <button nz-button type="button" (click)="clearTicket()">{{ 'RETAIL_CASHIER.CLEAR' | translate }}</button>
        @if (lastTicket(); as ticket) {
          <p>{{ 'RETAIL_CASHIER.TICKET_DONE' | translate }}: {{ ticket.receipt_number }}</p>
        }
      </nz-card>

      <nz-card [nzTitle]="'RETAIL_CASHIER.RETURNS' | translate">
        <div class="cashier-payment-form">
          <input nz-input [placeholder]="'RETAIL_CASHIER.SALE_ID' | translate" [ngModel]="saleId()" (ngModelChange)="saleId.set($event)" />
          <button nz-button type="button" (click)="loadSale()">{{ 'RETAIL_CASHIER.LOAD_SALE' | translate }}</button>
          @if (lastTicket()) {
            <button nz-button type="button" (click)="useLastTicket()">{{ 'RETAIL_CASHIER.LAST_SALE' | translate }}</button>
          }
        </div>

        @if (sale(); as loaded) {
          <nz-table #returnTable [nzData]="loaded.items" nzSize="small" [nzShowPagination]="false">
            <thead>
              <tr>
                <th>{{ 'RETAIL_CASHIER.DESCRIPTION' | translate }}</th>
                <th>{{ 'RETAIL_CASHIER.RETURNABLE' | translate }}</th>
                <th>{{ 'RETAIL_CASHIER.RETURN_QUANTITY' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (item of returnTable.data; track item.id) {
                <tr>
                  <td>{{ item.description }}</td>
                  <td>{{ item.returnable_quantity }}</td>
                  <td>
                    @if (isReturnable(item.returnable_quantity)) {
                      <nz-input-number [ngModel]="returnQuantities()[item.id] ?? 0" (ngModelChange)="setReturnQuantity(item.id, $event)" [nzMin]="0" [nzMax]="+item.returnable_quantity!" />
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          <div class="cashier-payment-form">
            <nz-select [ngModel]="refundMethod()" (ngModelChange)="refundMethod.set($event)">
              @for (method of refundMethods; track method) {
                <nz-option [nzValue]="method" [nzLabel]="methodLabel(method) | translate" />
              }
            </nz-select>
            <input nz-input [placeholder]="'RETAIL_CASHIER.REASON' | translate" [ngModel]="reason()" (ngModelChange)="reason.set($event)" />
            <button nz-button type="button" [nzLoading]="busy()" (click)="returnSelected()">{{ 'RETAIL_CASHIER.RETURN_SELECTED' | translate }}</button>
            <button nz-button nzType="primary" nzDanger type="button" [nzLoading]="busy()" (click)="refundWhole()">{{ 'RETAIL_CASHIER.REFUND_WHOLE' | translate }}</button>
          </div>
        }
      </nz-card>
    }
  `,
  styles: `
    .cashier-search { width: 100%; margin-bottom: 12px; }
    .cashier-free-line, .cashier-payment-form { display: flex; gap: 8px; margin-bottom: 12px; align-items: center; flex-wrap: wrap; }
  `,
})
export class CashierPage implements OnInit {
  private readonly api = inject(RetailApiService);
  private readonly inventory = inject(InventoryApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly paymentMethods: RetailPaymentMethod[] = ['cash', 'card', 'voucher', 'bank_transfer', 'mobile', 'other'];
  readonly refundMethods: RetailRefundMethod[] = ['cash', 'card', 'other'];

  readonly session = signal<RetailPosSession | null>(null);
  readonly products = signal<ProductItem[]>([]);
  readonly lines = signal<CashierLine[]>([]);
  readonly preview = signal<RetailTicketPreview | null>(null);
  readonly payments = signal<CashierPayment[]>([]);
  readonly lastTicket = signal<RetailTicket | null>(null);
  readonly busy = signal(false);

  readonly freeDescription = signal('');
  readonly freePrice = signal(0);
  readonly freeTaxRate = signal(22);
  readonly paymentMethod = signal<RetailPaymentMethod>('cash');
  readonly paymentAmount = signal(0);

  readonly saleId = signal('');
  readonly sale = signal<RetailTicket | null>(null);
  readonly returnQuantities = signal<Record<string, number>>({});
  readonly refundMethod = signal<RetailRefundMethod>('cash');
  readonly reason = signal('');

  private nextKey = 1;

  /** Cents still to pay once the payments entered so far are subtracted from the ticket total. */
  readonly remainingCents = computed(() => {
    const total = toCents(this.preview()?.total_gross ?? 0);
    const paid = this.payments().reduce((sum, payment) => sum + toCents(payment.amount), 0);
    return Math.max(0, total - paid);
  });
  readonly remaining = computed(() => this.remainingCents() / 100);
  readonly change = computed(() => {
    const total = toCents(this.preview()?.total_gross ?? 0);
    const cash = this.payments().filter((payment) => payment.method === 'cash').reduce((sum, payment) => sum + toCents(payment.amount), 0);
    const paid = this.payments().reduce((sum, payment) => sum + toCents(payment.amount), 0);
    return Math.min(cash, Math.max(0, paid - total)) / 100;
  });
  readonly canCharge = computed(() => this.session() !== null && this.preview() !== null && this.lines().length > 0 && this.remainingCents() === 0 && !this.busy());

  ngOnInit(): void {
    this.api.getPosSessions().subscribe({
      next: (response) => this.session.set(response.data.data.find((candidate) => candidate.status === 'open') ?? null),
    });
  }

  searchProducts(term: string): void {
    this.inventory.getProducts({ search: term, per_page: 15 }).subscribe({ next: (response) => this.products.set(response.data) });
  }

  addProduct(product: ProductItem | null): void {
    if (product === null) {
      return;
    }

    this.lines.update((lines) => [...lines, { key: this.nextKey++, productId: product.id, description: product.name, quantity: 1, unitPrice: Number(product.sale_price), taxRate: Number(product.tax_rate) }]);
    this.refreshPreview();
  }

  addFreeLine(): void {
    const description = this.freeDescription().trim();

    if (description === '') {
      return;
    }

    this.lines.update((lines) => [...lines, { key: this.nextKey++, productId: null, description, quantity: 1, unitPrice: this.freePrice(), taxRate: this.freeTaxRate() }]);
    this.freeDescription.set('');
    this.freePrice.set(0);
    this.refreshPreview();
  }

  setQuantity(key: number, quantity: number | null): void {
    this.lines.update((lines) => lines.map((line) => (line.key === key ? { ...line, quantity: Math.max(1, quantity ?? 1) } : line)));
    this.refreshPreview();
  }

  removeLine(key: number): void {
    this.lines.update((lines) => lines.filter((line) => line.key !== key));
    this.refreshPreview();
  }

  addPayment(): void {
    const amount = this.paymentAmount();

    if (amount <= 0) {
      return;
    }

    this.payments.update((payments) => [...payments, { method: this.paymentMethod(), amount }]);
    this.paymentAmount.set(0);
  }

  removePayment(index: number): void {
    this.payments.update((payments) => payments.filter((_, position) => position !== index));
  }

  methodLabel(method: string): string {
    return `RETAIL_CASHIER.METHOD_${method.toUpperCase()}`;
  }

  /** Prices the ticket on the server, which applies the active promotions. */
  refreshPreview(): void {
    if (this.lines().length === 0) {
      this.preview.set(null);
      return;
    }

    this.api.previewTicket(this.ticketItems()).subscribe({
      next: (response) => this.preview.set(response.data),
      error: () => this.message.error(this.translate.instant('RETAIL_CASHIER.PREVIEW_FAILED')),
    });
  }

  charge(): void {
    const session = this.session();

    if (session === null || !this.canCharge()) {
      return;
    }

    this.busy.set(true);
    this.api.createTicket({ pos_session_id: session.id, items: this.ticketItems(), payments: this.payments().map((payment) => ({ method: payment.method, amount: payment.amount })) }).subscribe({
      next: (response) => {
        this.busy.set(false);
        this.lastTicket.set(response.data);
        this.message.success(this.translate.instant('RETAIL_CASHIER.TICKET_DONE'));
        this.clearTicket();
      },
      error: () => this.busy.set(false),
    });
  }

  clearTicket(): void {
    this.lines.set([]);
    this.payments.set([]);
    this.preview.set(null);
  }

  useLastTicket(): void {
    const ticket = this.lastTicket();

    if (ticket !== null) {
      this.saleId.set(ticket.id);
      this.loadSale();
    }
  }

  loadSale(): void {
    const id = this.saleId().trim();

    if (id === '') {
      return;
    }

    this.api.getTicket(id).subscribe({
      next: (response) => {
        this.sale.set(response.data);
        this.returnQuantities.set({});
      },
    });
  }

  isReturnable(quantity: string | undefined): boolean {
    return Number(quantity ?? 0) > 0;
  }

  setReturnQuantity(itemId: string, quantity: number | null): void {
    this.returnQuantities.update((quantities) => ({ ...quantities, [itemId]: quantity ?? 0 }));
  }

  returnSelected(): void {
    const session = this.session();
    const sale = this.sale();
    const lines = Object.entries(this.returnQuantities())
      .filter(([, quantity]) => quantity > 0)
      .map(([itemId, quantity]) => ({ pos_sale_item_id: itemId, quantity }));

    if (session === null || sale === null) {
      return;
    }

    if (lines.length === 0) {
      this.message.warning(this.translate.instant('RETAIL_CASHIER.NOTHING_TO_RETURN'));
      return;
    }

    this.busy.set(true);
    this.api.createReturn(sale.id, { pos_session_id: session.id, lines, refund_method: this.refundMethod(), reason: this.reason() || null }).subscribe({
      next: () => this.afterReturn(sale.id),
      error: () => this.busy.set(false),
    });
  }

  refundWhole(): void {
    const session = this.session();
    const sale = this.sale();

    if (session === null || sale === null) {
      return;
    }

    this.busy.set(true);
    this.api.refundSale(sale.id, { pos_session_id: session.id, refund_method: this.refundMethod(), reason: this.reason() || null }).subscribe({
      next: () => this.afterReturn(sale.id),
      error: () => this.busy.set(false),
    });
  }

  private afterReturn(saleId: string): void {
    this.busy.set(false);
    this.message.success(this.translate.instant('RETAIL_CASHIER.RETURN_DONE'));
    this.saleId.set(saleId);
    this.loadSale();
  }

  private ticketItems(): RetailTicketLinePayload[] {
    return this.lines().map((line) =>
      line.productId !== null
        ? { product_id: line.productId, quantity: line.quantity }
        : { description: line.description, quantity: line.quantity, unit_price: line.unitPrice, tax_rate: line.taxRate },
    );
  }
}
