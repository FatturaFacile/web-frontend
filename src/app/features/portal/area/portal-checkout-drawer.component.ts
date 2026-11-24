import { DecimalPipe } from '@angular/common';
import { Component, computed, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { Subscription, switchMap, takeWhile, timer } from 'rxjs';
import { PortalAreaApiService } from '@core/api/portal-area-api.service';
import {
  PortalCheckoutMethod,
  PortalInvoice,
  PortalPaymentMethod,
} from '@core/models/portal-area.models';
import { TranslatePipe, RadioControlDirective } from '@shared';
import { filenameOf, saveBlob } from './portal-download';

/** Methods offered per region. Switzerland: TWINT, card and the QR-bill transfer; Italy and the EU: card, SEPA debit, PayPal. */
const CH_METHODS: readonly PortalPaymentMethod[] = ['twint', 'card', 'qr_transfer'];
const EU_METHODS: readonly PortalPaymentMethod[] = ['card', 'sepa_debit', 'paypal'];

const CHECKOUT_METHOD: Record<PortalPaymentMethod, PortalCheckoutMethod> = {
  card: 'card',
  twint: 'twint',
  qr_transfer: 'qr',
  sepa_debit: 'sepa',
  paypal: 'paypal',
};

/** Maps the drawer's option to the `payment_method` value the backend validates. */
export function checkoutMethodOf(method: PortalPaymentMethod): PortalCheckoutMethod {
  return CHECKOUT_METHOD[method];
}

const POLL_EVERY_MS = 5000;
const POLL_FOR_MS = 180_000;

export function paymentMethodsFor(
  region: string | null | undefined,
  currency: string,
): readonly PortalPaymentMethod[] {
  return region === 'CH' || currency === 'CHF' ? CH_METHODS : EU_METHODS;
}

/**
 * Checkout drawer of one open invoice. The card, TWINT, SEPA and PayPal pages are the hosted page of the tenant's payment
 * gateway: the customer pays there, in a new tab, and this drawer watches the invoice until it turns paid. The QR-bill
 * transfer needs no gateway: the invoice PDF carries the Swiss payment slip.
 */
@Component({
  selector: 'app-portal-checkout-drawer',
  imports: [
    RadioControlDirective,
    DecimalPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzRadioModule,
    TranslatePipe,
  ],
  template: `
    <nz-drawer
      [nzVisible]="invoice() !== null"
      [nzTitle]="'PORTAL_AREA.CHECKOUT_TITLE' | translate"
      nzPlacement="right"
      [nzWidth]="'min(420px, 100vw)'"
      (nzOnClose)="close()"
    >
      <ng-container *nzDrawerContent>
        @if (invoice(); as inv) {
          <p class="amount">{{ inv.currency }} {{ outstanding() | number: '1.2-2' }}</p>
          <p>{{ inv.invoice_number }}</p>

          @if (state() === 'paid') {
            <nz-alert
              nzType="success"
              nzShowIcon
              [nzMessage]="'PORTAL_AREA.PAYMENT_CONFIRMED' | translate"
            />
          } @else {
            <p id="method-label">{{ 'PORTAL_AREA.PAYMENT_METHOD' | translate }}</p>
            <nz-radio-group [(ngModel)]="method" aria-labelledby="method-label" class="methods">
              @for (option of methods(); track option) {
                <label [attr.for]="'portal-checkout-drawer-field-' + $index" appRadioControl nz-radio [nzValue]="option">{{ methodKey(option) | translate }}</label>
              }
            </nz-radio-group>

            @if (state() === 'waiting') {
              <nz-alert
                nzType="info"
                nzShowIcon
                [nzMessage]="'PORTAL_AREA.PAYMENT_PENDING' | translate"
              />
            }
            @if (state() === 'failed') {
              <nz-alert
                nzType="error"
                nzShowIcon
                [nzMessage]="'PORTAL_AREA.LOADING_ERROR' | translate"
              />
            }
            <button
              nz-button
              nzType="primary"
              nzBlock
              type="button"
              [nzLoading]="state() === 'starting'"
              (click)="pay()"
            >
              {{ 'PORTAL_AREA.CONTINUE_PAYMENT' | translate }}
            </button>
          }
        }
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .amount {
      font-size: 28px;
      font-weight: 600;
      margin: 0;
    }
    .methods {
      display: grid;
      gap: 8px;
      margin: 8px 0 16px;
    }
  `,
})
export class PortalCheckoutDrawerComponent {
  private readonly api = inject(PortalAreaApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly invoice = input<PortalInvoice | null>(null);
  readonly region = input<string | null>(null);
  readonly closed = output<{ paid: boolean }>();

  protected method: PortalPaymentMethod = 'card';
  protected readonly state = signal<'idle' | 'starting' | 'waiting' | 'paid' | 'failed'>('idle');
  protected readonly methods = computed(() =>
    paymentMethodsFor(this.region(), this.invoice()?.currency ?? 'EUR'),
  );
  protected readonly outstanding = computed(() => {
    const inv = this.invoice();
    return inv ? Math.max(0, inv.total_gross - inv.total_paid) : 0;
  });

  private poll: Subscription | null = null;

  protected methodKey(method: PortalPaymentMethod): string {
    return {
      card: 'PORTAL_AREA.METHOD_CARD',
      twint: 'PORTAL_AREA.METHOD_TWINT',
      qr_transfer: 'PORTAL_AREA.METHOD_QR',
      sepa_debit: 'PORTAL_AREA.METHOD_SEPA',
      paypal: 'PORTAL_AREA.METHOD_PAYPAL',
    }[method];
  }

  protected pay(): void {
    const inv = this.invoice();
    if (!inv) {
      return;
    }
    this.state.set('starting');

    if (this.method === 'qr_transfer') {
      this.api.download('invoices', inv.id, 'pdf').subscribe({
        next: (response) => {
          saveBlob(
            response.body ?? new Blob(),
            filenameOf(response, `invoice-${inv.invoice_number}.pdf`),
          );
          this.state.set('idle');
        },
        error: () => this.state.set('failed'),
      });
      return;
    }

    this.api.checkout(inv.id, checkoutMethodOf(this.method)).subscribe({
      next: (response) => {
        window.open(response.data.url, '_blank', 'noopener,noreferrer');
        this.state.set('waiting');
        this.watch(inv.id);
      },
      error: () => this.state.set('failed'),
    });
  }

  protected close(): void {
    this.poll?.unsubscribe();
    this.closed.emit({ paid: this.state() === 'paid' });
    this.state.set('idle');
  }

  /** Real-time confirmation: asks for the invoice every few seconds until the gateway webhook has booked the payment. */
  private watch(invoiceId: string): void {
    this.poll?.unsubscribe();
    const deadline = Date.now() + POLL_FOR_MS;
    this.poll = timer(POLL_EVERY_MS, POLL_EVERY_MS)
      .pipe(
        switchMap(() => this.api.invoices()),
        takeWhile(
          (response) => !this.isPaid(response.data, invoiceId) && Date.now() < deadline,
          true,
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (response) => {
          if (this.isPaid(response.data, invoiceId)) {
            this.state.set('paid');
          }
        },
        error: () => undefined,
      });
  }

  private isPaid(invoices: readonly PortalInvoice[], id: string): boolean {
    return invoices.find((invoice) => invoice.id === id)?.payment_status === 'paid';
  }
}
