import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { DocumentFlowDrawerComponent } from '../../procurement/srm/document-flow-drawer.component';
import { DateFormatPipe, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  approvalStatusColor,
  invoiceDocumentTypeKey,
  isCreditNote,
  paymentStatusColor,
} from './supplier-invoice-detail.helpers';
import { ForeignVatSplitBadgeComponent } from '../../foreign-vat-refund/foreign-vat-split-badge.component';
import { SelfInvoiceClassificationBadgeComponent } from '../../esterometro/self-invoice-classification-badge.component';
import { SupplierInvoiceDetailStore } from './supplier-invoice-detail.store';

/**
 * Standalone page of a supplier invoice (`/purchases/invoices/:id`): fiscal header (VAT, withholding tax, stamp duty),
 * lines with cost account and competence, 3-way match history, approval steps and the procure-to-pay document flow.
 */
@Component({
  selector: 'app-supplier-invoice-detail-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [SupplierInvoiceDetailStore],
  imports: [
    DateFormatPipe,
    DecimalPipe,
    DocumentFlowDrawerComponent,
    ForeignVatSplitBadgeComponent,
    SelfInvoiceClassificationBadgeComponent,
    MoneyPipe,
    PageHeaderComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzEmptyModule,
    NzSpinModule,
    NzTableModule,
    NzTabsModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="store.invoice()?.invoice_number || ('srm.invoice.title' | translate)"
      [subtitle]="'srm.invoice.subtitle' | translate"
    >
      <a nz-button routerLink="/purchases/invoices">{{ 'srm.invoice.back' | translate }}</a>
      @if (store.invoice(); as flowInvoice) {
        <app-document-flow-drawer type="supplier_invoice" [documentId]="flowInvoice.id" />
      }
    </app-page-header>

    @if (store.error(); as error) {
      <nz-alert
        nzType="error"
        nzShowIcon
        [nzMessage]="'srm.invoice.loadError' | translate"
        [nzDescription]="error"
      />
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.invoice(); as invoice) {
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="3" data-testid="invoice-header">
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.supplier' | translate">
            {{ invoice.supplier_name || invoice.supplier_id || '-' }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.documentType' | translate">
            {{ documentType(invoice.document_type) | translate }}
            @if (creditNote(invoice.document_type)) {
              <nz-tag nzColor="orange">{{ 'srm.invoice.creditNote' | translate }}</nz-tag>
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.date' | translate">
            {{ invoice.date | appDate }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.dueDate' | translate">
            {{ invoice.due_date | appDate }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.sdiFile' | translate">
            {{ invoice.sdi_file_name || '-' }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.purchaseOrder' | translate">
            @if (invoice.purchase_order_id) {
              <a [routerLink]="['/procurement/purchase-orders', invoice.purchase_order_id]">{{
                'srm.flow.type.purchase_order' | translate
              }}</a>
            } @else {
              -
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.net' | translate">
            {{ invoice.total_net | money: invoice.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.tax' | translate">
            {{ invoice.total_tax | money: invoice.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.total' | translate">
            <strong>{{ invoice.total_amount | money: invoice.currency }}</strong>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.withholding' | translate">
            {{ invoice.withholding_tax_amount | money: invoice.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.stampDuty' | translate">
            {{ invoice.stamp_duty_amount | money: invoice.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.splitPayment' | translate">
            @if (splitPayment(invoice.split_payment_tax_amount)) {
              <nz-tag nzColor="purple">{{ 'srm.invoice.splitPaymentTag' | translate }}</nz-tag>
              {{ invoice.split_payment_tax_amount | money: invoice.currency }}
            } @else {
              {{ 'srm.invoice.no' | translate }}
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.currency' | translate">
            {{ invoice.currency }}
            @if (invoice.exchange_rate && invoice.exchange_rate !== '1.000000') {
              <small>({{ invoice.exchange_rate }})</small>
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.paymentStatus' | translate">
            <nz-tag [nzColor]="paymentColor(invoice.payment_status)">{{
              'srm.invoice.payment.' + (invoice.payment_status || 'unpaid') | translate
            }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.paid' | translate">
            {{ invoice.total_paid | money: invoice.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.outstanding' | translate">
            {{ store.outstanding() | money: invoice.currency }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.approval' | translate">
            @if (invoice.approval_status) {
              <nz-tag [nzColor]="approvalColor(invoice.approval_status)">{{
                'srm.invoice.approval.' + invoice.approval_status | translate
              }}</nz-tag>
            } @else {
              -
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.matchStatus' | translate">
            @if (store.currentRun(); as run) {
              <a [routerLink]="['/procurement/invoice-matching', run.id]">
                <nz-tag [nzColor]="run.is_blocking ? 'red' : 'green'">{{
                  'invoiceMatching.status.' + run.status | translate
                }}</nz-tag>
              </a>
            } @else {
              {{ 'srm.invoice.notMatched' | translate }}
            }
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'srm.invoice.field.reverseCharge' | translate">
            {{ (invoice.reverse_charge ? 'srm.invoice.yes' : 'srm.invoice.no') | translate }}
          </nz-descriptions-item>
        </nz-descriptions>
        <app-foreign-vat-split-badge
          [country]="invoice.supplier_country ?? null"
          [vatAmount]="foreignVatAmount(invoice.total_tax)"
          [description]="invoice.supplier_name ?? null"
        />
        <app-self-invoice-classification-badge [passiveInvoiceId]="invoice.id" />

        <nz-tabs class="tabs">
          <nz-tab [nzTitle]="'srm.invoice.tab.lines' | translate">
            <nz-table
              [nzData]="store.lines()"
              [nzShowPagination]="false"
              nzSize="small"
              [nzNoResult]="'srm.invoice.noLines' | translate"
              data-testid="invoice-lines"
            >
              <thead>
                <tr>
                  <th>#</th>
                  <th>{{ 'srm.invoice.col.description' | translate }}</th>
                  <th class="num">{{ 'srm.invoice.col.quantity' | translate }}</th>
                  <th class="num">{{ 'srm.invoice.col.unitPrice' | translate }}</th>
                  <th class="num">{{ 'srm.invoice.col.vat' | translate }}</th>
                  <th class="num">{{ 'srm.invoice.col.total' | translate }}</th>
                  <th>{{ 'srm.invoice.col.competence' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of store.lines(); track line.id) {
                  <tr>
                    <td>{{ line.line_number }}</td>
                    <td>{{ line.description }}</td>
                    <td class="num">{{ line.quantity | number: '1.0-4' }}</td>
                    <td class="num">{{ line.unit_price | money: invoice.currency }}</td>
                    <td class="num">{{ line.tax_rate | number: '1.0-2' }}%</td>
                    <td class="num">{{ line.line_total | money: invoice.currency }}</td>
                    <td>
                      @if (line.competence_start_date || line.competence_end_date) {
                        {{ line.competence_start_date | appDate }} –
                        {{ line.competence_end_date | appDate }}
                      } @else {
                        -
                      }
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <nz-tab [nzTitle]="'srm.invoice.tab.matching' | translate">
            <nz-table
              [nzData]="store.matchRuns()"
              [nzShowPagination]="false"
              nzSize="small"
              [nzNoResult]="'srm.invoice.noMatchRuns' | translate"
              data-testid="invoice-match-runs"
            >
              <thead>
                <tr>
                  <th>{{ 'srm.invoice.col.evaluatedAt' | translate }}</th>
                  <th>{{ 'srm.flow.type.purchase_order' | translate }}</th>
                  <th>{{ 'srm.invoice.col.status' | translate }}</th>
                  <th class="num">{{ 'srm.invoice.col.variance' | translate }}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                @for (run of store.matchRuns(); track run.id) {
                  <tr>
                    <td>{{ run.evaluated_at | appDate }}</td>
                    <td>{{ run.po_number || '-' }}</td>
                    <td>
                      <nz-tag [nzColor]="run.is_blocking ? 'red' : 'green'">{{
                        'invoiceMatching.status.' + run.status | translate
                      }}</nz-tag>
                      @if (run.is_current) {
                        <nz-tag nzColor="geekblue">{{ 'srm.flow.current' | translate }}</nz-tag>
                      }
                    </td>
                    <td class="num">{{ run.variance_amount | money: run.currency }}</td>
                    <td>
                      <a [routerLink]="['/procurement/invoice-matching', run.id]">{{
                        'srm.invoice.openMatching' | translate
                      }}</a>
                    </td>
                  </tr>
                }
              </tbody>
            </nz-table>
          </nz-tab>

          <nz-tab [nzTitle]="'srm.invoice.tab.approval' | translate">
            @if (store.approval(); as approval) {
              <p>
                <nz-tag [nzColor]="approvalColor(approval.approval_status)">{{
                  'srm.invoice.approval.' + approval.approval_status | translate
                }}</nz-tag>
                @if (isBlocked(approval.is_payment_blocked)) {
                  <nz-tag nzColor="red">{{ 'srm.invoice.paymentBlocked' | translate }}</nz-tag>
                }
                @if (approval.decided_at) {
                  <small>{{ approval.decided_at | appDate }}</small>
                }
              </p>
              <nz-table
                [nzData]="approval.steps"
                [nzShowPagination]="false"
                nzSize="small"
                [nzNoResult]="'srm.invoice.noApprovalSteps' | translate"
              >
                <thead>
                  <tr>
                    <th>{{ 'srm.invoice.col.tier' | translate }}</th>
                    <th>{{ 'srm.invoice.col.role' | translate }}</th>
                    <th>{{ 'srm.invoice.col.status' | translate }}</th>
                  </tr>
                </thead>
                <tbody>
                  @for (step of approval.steps; track step.id) {
                    <tr>
                      <td>{{ step.tier_level }}</td>
                      <td>{{ step.assigned_role || '-' }}</td>
                      <td>{{ step.status }}</td>
                    </tr>
                  }
                </tbody>
              </nz-table>
            } @else {
              <nz-empty [nzNotFoundContent]="'srm.invoice.noApprovalSteps' | translate" />
            }
          </nz-tab>
        </nz-tabs>
      }
    </nz-spin>
  `,
  styles: `
    .tabs {
      margin-top: 16px;
    }
    .num {
      text-align: right;
    }
  `,
})
export class SupplierInvoiceDetailPageComponent {
  protected readonly store = inject(SupplierInvoiceDetailStore);
  private readonly params = toSignal(inject(ActivatedRoute).paramMap, { requireSync: true });

  constructor() {
    effect(() => {
      const id = this.params().get('id');
      if (id) {
        this.store.load(id);
      }
    });
  }

  /** VAT of the invoice as a number for the foreign VAT badge. */
  protected foreignVatAmount(tax: string | null | undefined): number {
    return tax === null || tax === undefined || tax === '' ? 0 : Math.abs(Number(tax));
  }

  protected documentType(code: string | null | undefined): string {
    return invoiceDocumentTypeKey(code);
  }

  protected creditNote(code: string | null | undefined): boolean {
    return isCreditNote(code);
  }

  protected paymentColor(status: string | null | undefined): string {
    return paymentStatusColor(status);
  }

  protected approvalColor(status: string | null | undefined): string {
    return approvalStatusColor(status);
  }

  protected splitPayment(amount: string | null | undefined): boolean {
    return Number(amount ?? 0) > 0;
  }

  protected isBlocked(value: boolean | string): boolean {
    return value === true || value === 'true' || value === '1';
  }
}
