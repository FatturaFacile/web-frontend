import { DatePipe, DecimalPipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormControl, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzRadioModule } from 'ng-zorro-antd/radio';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PortalAreaApiService } from '@core/api/portal-area-api.service';
import {
  PortalDeliveryNote,
  PortalInvoice,
  PortalOrder,
  PortalPaymentStatus,
  PortalQuote,
} from '@core/models/portal-area.models';
import { TranslatePipe } from '@shared';
import { PortalCheckoutDrawerComponent } from './portal-checkout-drawer.component';
import { filenameOf, saveBlob } from './portal-download';
import { PortalSessionService } from './portal-session.service';

export type DocumentTab = 'invoices' | 'quotes' | 'orders' | 'delivery-notes';
const TABS: readonly DocumentTab[] = ['invoices', 'quotes', 'orders', 'delivery-notes'];
type StatusFilter = 'all' | PortalPaymentStatus;

/** `/portal/documents`: invoices, quotes, orders with shipments and delivery notes of the signed-in customer. */
@Component({
  selector: 'app-portal-documents',
  imports: [
    DatePipe,
    DecimalPipe,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzModalModule,
    NzRadioModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
    TranslatePipe,
    PortalCheckoutDrawerComponent,
  ],
  template: `
    @if (error()) {
      <nz-alert nzType="error" nzShowIcon [nzMessage]="'PORTAL_AREA.LOADING_ERROR' | translate" />
    }
    <nz-tabs [nzSelectedIndex]="tabIndex()" (nzSelectedIndexChange)="selectTab($event)">
      <nz-tab [nzTitle]="'PORTAL_AREA.TAB_INVOICES' | translate">
        <nz-radio-group
          [ngModel]="statusFilter()"
          (ngModelChange)="filterInvoices($event)"
          class="filter"
        >
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-radio-button nzValue="all">{{ 'PORTAL_AREA.FILTER_ALL' | translate }}</label>
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-radio-button nzValue="unpaid">{{
            'PORTAL_AREA.STATUS_UNPAID' | translate
          }}</label>
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-radio-button nzValue="partially_paid">{{
            'PORTAL_AREA.STATUS_PARTIAL' | translate
          }}</label>
          <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
          <label nz-radio-button nzValue="paid">{{ 'PORTAL_AREA.STATUS_PAID' | translate }}</label>
        </nz-radio-group>
        <nz-table
          #invoicesTable
          [nzData]="invoices()"
          [nzLoading]="loading()"
          nzSize="small"
          [nzScroll]="{ x: '640px' }"
        >
          <thead>
            <tr>
              <th>{{ 'PORTAL_AREA.NUMBER' | translate }}</th>
              <th>{{ 'PORTAL_AREA.DUE_DATE' | translate }}</th>
              <th class="num">{{ 'PORTAL_AREA.TOTAL' | translate }}</th>
              <th>{{ 'PORTAL_AREA.STATUS' | translate }}</th>
              <th>{{ 'PORTAL_AREA.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (invoice of invoicesTable.data; track invoice.id) {
              <tr>
                <td>{{ invoice.invoice_number }}</td>
                <td>{{ invoice.due_date | date: 'mediumDate' }}</td>
                <td class="num">
                  {{ invoice.currency }} {{ invoice.total_gross | number: '1.2-2' }}
                </td>
                <td>
                  <nz-tag [nzColor]="invoice.is_paid ? 'success' : 'warning'">{{
                    statusKey(invoice.payment_status) | translate
                  }}</nz-tag>
                </td>
                <td class="actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="download('invoices', invoice.id, 'pdf', invoice.invoice_number)"
                  >
                    {{ 'PORTAL_AREA.PDF' | translate }}
                  </button>
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="download('invoices', invoice.id, 'xml', invoice.invoice_number)"
                  >
                    {{ 'PORTAL_AREA.XML' | translate }}
                  </button>
                  @if (!invoice.is_paid) {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      (click)="payingInvoice.set(invoice)"
                    >
                      {{ 'PORTAL_AREA.PAY_NOW' | translate }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-tab>

      <nz-tab [nzTitle]="'PORTAL_AREA.TAB_QUOTES' | translate">
        <nz-table
          #quotesTable
          [nzData]="quotes()"
          [nzLoading]="loading()"
          nzSize="small"
          [nzScroll]="{ x: '560px' }"
        >
          <thead>
            <tr>
              <th>{{ 'PORTAL_AREA.NUMBER' | translate }}</th>
              <th>{{ 'PORTAL_AREA.DATE' | translate }}</th>
              <th class="num">{{ 'PORTAL_AREA.TOTAL' | translate }}</th>
              <th>{{ 'PORTAL_AREA.STATUS' | translate }}</th>
              <th>{{ 'PORTAL_AREA.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (quote of quotesTable.data; track quote.id) {
              <tr>
                <td>{{ quote.quote_number }}</td>
                <td>{{ quote.date | date: 'mediumDate' }}</td>
                <td class="num">{{ quote.currency }} {{ quote.total_gross | number: '1.2-2' }}</td>
                <td>
                  <nz-tag>{{ quote.status }}</nz-tag>
                </td>
                <td class="actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="download('quotes', quote.id, 'pdf', quote.quote_number)"
                  >
                    {{ 'PORTAL_AREA.PDF' | translate }}
                  </button>
                  @if (quote.status === 'sent') {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      (click)="decide(quote, 'approve')"
                    >
                      {{ 'PORTAL_AREA.APPROVE' | translate }}
                    </button>
                    <button
                      nz-button
                      nzSize="small"
                      nzDanger
                      type="button"
                      (click)="decide(quote, 'reject')"
                    >
                      {{ 'PORTAL_AREA.REJECT' | translate }}
                    </button>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-tab>

      <nz-tab [nzTitle]="'PORTAL_AREA.TAB_ORDERS' | translate">
        <nz-table
          #ordersTable
          [nzData]="orders()"
          [nzLoading]="loading()"
          nzSize="small"
          [nzScroll]="{ x: '560px' }"
        >
          <thead>
            <tr>
              <th>{{ 'PORTAL_AREA.NUMBER' | translate }}</th>
              <th>{{ 'PORTAL_AREA.DATE' | translate }}</th>
              <th>{{ 'PORTAL_AREA.STATUS' | translate }}</th>
              <th>{{ 'PORTAL_AREA.CARRIER' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (order of ordersTable.data; track order.id) {
              <tr>
                <td>{{ order.order_number }}</td>
                <td>{{ order.date | date: 'mediumDate' }}</td>
                <td>
                  <nz-tag>{{ order.status }}</nz-tag>
                </td>
                <td>
                  @for (shipment of order.shipments ?? []; track shipment.id) {
                    <div>
                      {{ shipment.shipment.carrier_name }}
                      @if (shipment.shipment.tracking_url; as url) {
                        <a [href]="url" target="_blank" rel="noopener noreferrer">{{
                          shipment.shipment.tracking_number
                        }}</a>
                      } @else {
                        {{ shipment.shipment.tracking_number }}
                      }
                    </div>
                  }
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-tab>

      <nz-tab [nzTitle]="'PORTAL_AREA.TAB_DDT' | translate">
        <nz-table
          #notesTable
          [nzData]="deliveryNotes()"
          [nzLoading]="loading()"
          nzSize="small"
          [nzScroll]="{ x: '560px' }"
        >
          <thead>
            <tr>
              <th>{{ 'PORTAL_AREA.NUMBER' | translate }}</th>
              <th>{{ 'PORTAL_AREA.DATE' | translate }}</th>
              <th>{{ 'PORTAL_AREA.CARRIER' | translate }}</th>
              <th>{{ 'PORTAL_AREA.ACTIONS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (note of notesTable.data; track note.id) {
              <tr>
                <td>{{ note.ddt_number }}</td>
                <td>{{ note.date | date: 'mediumDate' }}</td>
                <td>
                  {{ note.shipment.carrier_name }}
                  @if (note.shipment.tracking_url; as url) {
                    <a [href]="url" target="_blank" rel="noopener noreferrer">{{
                      note.shipment.tracking_number
                    }}</a>
                  } @else {
                    {{ note.shipment.tracking_number }}
                  }
                </td>
                <td class="actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="download('delivery-notes', note.id, 'pdf', note.ddt_number)"
                  >
                    {{ 'PORTAL_AREA.PDF' | translate }}
                  </button>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-tab>
    </nz-tabs>

    <nz-modal
      [nzVisible]="decision() !== null"
      [nzTitle]="
        (decision()?.action === 'approve'
          ? 'PORTAL_AREA.APPROVE_TITLE'
          : 'PORTAL_AREA.REJECT_TITLE'
        ) | translate
      "
      [nzOkText]="'PORTAL_AREA.CONFIRM' | translate"
      [nzCancelText]="'PORTAL_AREA.CANCEL' | translate"
      [nzOkLoading]="deciding()"
      [nzOkDisabled]="decision()?.action === 'approve' && signer.invalid"
      (nzOnOk)="confirmDecision()"
      (nzOnCancel)="decision.set(null)"
    >
      <ng-container *nzModalContent>
        @if (decision()?.action === 'approve') {
          <label for="signer">{{ 'PORTAL_AREA.SIGNER_NAME' | translate }}</label>
          <input nz-input id="signer" autocomplete="name" [formControl]="signer" />
        } @else {
          <label for="reason">{{ 'PORTAL_AREA.REJECT_REASON' | translate }}</label>
          <textarea nz-input id="reason" rows="3" [formControl]="reason"></textarea>
        }
      </ng-container>
    </nz-modal>

    <app-portal-checkout-drawer
      [invoice]="payingInvoice()"
      [region]="region()"
      (closed)="onCheckoutClosed($event.paid)"
    />
  `,
  styles: `
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .filter {
      margin-bottom: 12px;
      display: inline-block;
    }
  `,
})
export class PortalDocumentsComponent implements OnInit {
  private readonly api = inject(PortalAreaApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly session = inject(PortalSessionService);

  protected readonly tab = signal<DocumentTab>('invoices');
  protected readonly tabIndex = computed(() => TABS.indexOf(this.tab()));
  protected readonly statusFilter = signal<StatusFilter>('all');
  protected readonly loading = signal(false);
  protected readonly error = signal(false);

  protected readonly invoices = signal<readonly PortalInvoice[]>([]);
  protected readonly quotes = signal<readonly PortalQuote[]>([]);
  protected readonly orders = signal<readonly PortalOrder[]>([]);
  protected readonly deliveryNotes = signal<readonly PortalDeliveryNote[]>([]);

  protected readonly payingInvoice = signal<PortalInvoice | null>(null);
  protected readonly decision = signal<{ quote: PortalQuote; action: 'approve' | 'reject' } | null>(
    null,
  );
  protected readonly deciding = signal(false);
  protected readonly signer = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(2)],
  });
  protected readonly reason = new FormControl('', { nonNullable: true });
  protected readonly region = computed(() => this.session.branding()?.region ?? null);

  ngOnInit(): void {
    const query = this.route.snapshot.queryParamMap;
    const tab = query.get('tab') as DocumentTab | null;
    if (tab && TABS.includes(tab)) {
      this.tab.set(tab);
    }
    const status = query.get('status') as StatusFilter | null;
    if (status && ['unpaid', 'partially_paid', 'paid'].includes(status)) {
      this.statusFilter.set(status);
    }
    this.load(this.tab());
  }

  protected selectTab(index: number): void {
    const tab = TABS[index] ?? 'invoices';
    this.tab.set(tab);
    void this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
      replaceUrl: true,
    });
    this.load(tab);
  }

  protected filterInvoices(value: StatusFilter): void {
    this.statusFilter.set(value);
    this.load('invoices');
  }

  protected statusKey(status: PortalPaymentStatus): string {
    return {
      unpaid: 'PORTAL_AREA.STATUS_UNPAID',
      partially_paid: 'PORTAL_AREA.STATUS_PARTIAL',
      paid: 'PORTAL_AREA.STATUS_PAID',
    }[status];
  }

  protected download(
    kind: 'invoices' | 'quotes' | 'delivery-notes',
    id: string,
    format: 'pdf' | 'xml',
    number: string,
  ): void {
    this.api.download(kind, id, format).subscribe({
      next: (response) =>
        saveBlob(response.body ?? new Blob(), filenameOf(response, `${number}.${format}`)),
      error: () => this.error.set(true),
    });
  }

  protected decide(quote: PortalQuote, action: 'approve' | 'reject'): void {
    this.signer.reset(this.session.customer()?.name ?? '');
    this.reason.reset('');
    this.decision.set({ quote, action });
  }

  protected confirmDecision(): void {
    const current = this.decision();
    if (!current || this.deciding()) {
      return;
    }
    this.deciding.set(true);
    const request =
      current.action === 'approve'
        ? this.api.approveQuote(current.quote.id, { signer_name: this.signer.value.trim() })
        : this.api.rejectQuote(current.quote.id, this.reason.value.trim() || undefined);

    request.subscribe({
      next: () => {
        this.deciding.set(false);
        this.decision.set(null);
        this.load('quotes');
      },
      error: () => {
        this.deciding.set(false);
        this.error.set(true);
      },
    });
  }

  protected onCheckoutClosed(paid: boolean): void {
    this.payingInvoice.set(null);
    if (paid) {
      this.load('invoices');
    }
  }

  private load(tab: DocumentTab): void {
    this.loading.set(true);
    this.error.set(false);
    const done = () => this.loading.set(false);
    const failed = () => {
      this.error.set(true);
      done();
    };

    switch (tab) {
      case 'invoices':
        this.api
          .invoices(
            this.statusFilter() === 'all'
              ? undefined
              : (this.statusFilter() as PortalPaymentStatus),
          )
          .subscribe({
            next: (response) => {
              this.invoices.set(response.data);
              done();
            },
            error: failed,
          });
        break;
      case 'quotes':
        this.api.quotes().subscribe({
          next: (response) => {
            this.quotes.set(response.data);
            done();
          },
          error: failed,
        });
        break;
      case 'orders':
        this.api.orders().subscribe({
          next: (response) => {
            this.orders.set(response.data);
            done();
          },
          error: failed,
        });
        break;
      case 'delivery-notes':
        this.api.deliveryNotes().subscribe({
          next: (response) => {
            this.deliveryNotes.set(response.data);
            done();
          },
          error: failed,
        });
        break;
    }
  }
}
