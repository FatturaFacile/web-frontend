import { DatePipe } from '@angular/common';
import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  SupplierPortalApiService,
  SupplierRfqComparison,
  SupplierRfqComparisonLine,
  SupplierRfqComparisonOffer,
  SupplierRfqSummary,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { RISK_LEVEL_COLORS, RISK_LEVEL_LABELS } from './supplier-portal.utils';

const INVITATION_COLORS: Readonly<Record<string, string>> = { invited: 'default', responded: 'green', declined: 'red' };
const INVITATION_LABELS: Readonly<Record<string, string>> = {
  invited: 'SUPPLIER_PORTAL.INVITATION_INVITED',
  responded: 'SUPPLIER_PORTAL.INVITATION_RESPONDED',
  declined: 'SUPPLIER_PORTAL.INVITATION_DECLINED',
};

/** Answers of the invited suppliers to a request for quotation: who answered, side-by-side prices, risk flags and the recommended quote. */
@Component({
  selector: 'app-supplier-rfq-responses',
  imports: [DatePipe, NzButtonModule, NzCardModule, NzEmptyModule, NzTableModule, NzTagModule, PageHeaderComponent, TranslatePipe],
  template: `
    <app-page-header [title]="'SUPPLIER_PORTAL.PAGE_RFQ_RESPONSES' | translate" [subtitle]="'SUPPLIER_PORTAL.RFQ_SUBTITLE' | translate" />

    <nz-card>
      <nz-table #table [nzData]="rfqs()" [nzLoading]="loading()" [nzShowPagination]="false" nzSize="small">
        <thead>
          <tr>
            <th>{{ 'SUPPLIER_PORTAL.RFQ_NUMBER' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.RFQ_TITLE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.DEADLINE' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.STATUS' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.INVITED' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.ANSWERED' | translate }}</th>
            <th>{{ 'SUPPLIER_PORTAL.DECLINED' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (rfq of table.data; track rfq.id) {
            <tr>
              <td>{{ rfq.rfq_number }}</td>
              <td>{{ rfq.title }}</td>
              <td>{{ rfq.response_deadline | date: 'dd/MM/yyyy' }}</td>
              <td>
                <nz-tag [nzColor]="rfq.is_open ? 'green' : 'default'">{{ (rfq.is_open ? 'SUPPLIER_PORTAL.RFQ_OPEN' : 'SUPPLIER_PORTAL.RFQ_CLOSED') | translate }}</nz-tag>
              </td>
              <td>{{ rfq.invited_count }}</td>
              <td>{{ rfq.responded_count }}</td>
              <td>{{ rfq.declined_count }}</td>
              <td>
                <button nz-button nzSize="small" (click)="compare(rfq)">{{ 'SUPPLIER_PORTAL.COMPARE' | translate }}</button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
    </nz-card>

    @if (comparison(); as data) {
      <nz-card [nzTitle]="data.rfq.rfq_number + ' - ' + data.rfq.title" class="comparison">
        <h4>{{ 'SUPPLIER_PORTAL.QUOTES' | translate }} ({{ data.rfq.currency }})</h4>
        @if (data.quotes.length === 0) {
          <nz-empty [nzNotFoundContent]="'SUPPLIER_PORTAL.NO_QUOTES' | translate"></nz-empty>
        } @else {
          <nz-table #quoteTable [nzData]="data.quotes" [nzShowPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.TOTAL' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.LEAD_TIME_DAYS' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.VALID_UNTIL' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.COVERAGE' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.RISK' | translate }}</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              @for (quote of quoteTable.data; track quote.quote_id) {
                <tr [class.recommended]="quote.quote_id === data.recommended_quote_id">
                  <td>{{ quote.supplier_name }}</td>
                  <td class="amount">{{ quote.total_amount }}</td>
                  <td>{{ quote.lead_time_days }}</td>
                  <td>{{ quote.valid_until | date: 'dd/MM/yyyy' }}</td>
                  <td>
                    <nz-tag [nzColor]="quote.covers_all_lines ? 'green' : 'orange'">{{ quote.lines_quoted }} / {{ data.lines.length }}</nz-tag>
                  </td>
                  <td>
                    <nz-tag [nzColor]="levelColors[quote.risk_level]">{{ levelLabels[quote.risk_level] | translate }}</nz-tag>
                  </td>
                  <td>
                    @if (quote.quote_id === data.recommended_quote_id) {
                      <nz-tag nzColor="blue">{{ 'SUPPLIER_PORTAL.RECOMMENDED' | translate }}</nz-tag>
                    }
                    @if (quote.quote_id === data.awarded_quote_id) {
                      <nz-tag nzColor="green">{{ 'SUPPLIER_PORTAL.AWARDED' | translate }}</nz-tag>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>

          <h4 class="section-title">{{ 'SUPPLIER_PORTAL.UNIT_PRICES' | translate }}</h4>
          <nz-table #lineTable [nzData]="data.lines" [nzShowPagination]="false" nzSize="small">
            <thead>
              <tr>
                <th>{{ 'SUPPLIER_PORTAL.LINE' | translate }}</th>
                <th>{{ 'SUPPLIER_PORTAL.QUANTITY' | translate }}</th>
                @for (quote of data.quotes; track quote.quote_id) {
                  <th>{{ quote.supplier_name }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (line of lineTable.data; track line.rfq_line_id) {
                <tr>
                  <td>{{ line.description }}</td>
                  <td>{{ line.quantity }}</td>
                  @for (quote of data.quotes; track quote.quote_id) {
                    <td class="amount">
                      @if (offerFor(line, quote.quote_id); as offer) {
                        <span [class.best]="offer.unit_price === line.best_unit_price">{{ offer.unit_price }}</span>
                      } @else {
                        <span class="missing">-</span>
                      }
                    </td>
                  }
                </tr>
              }
            </tbody>
          </nz-table>
        }

        <h4 class="section-title">{{ 'SUPPLIER_PORTAL.INVITED_SUPPLIERS' | translate }}</h4>
        <nz-table #invitationTable [nzData]="data.invitations" [nzShowPagination]="false" nzSize="small">
          <thead>
            <tr>
              <th>{{ 'SUPPLIER_PORTAL.SUPPLIER' | translate }}</th>
              <th>{{ 'SUPPLIER_PORTAL.QUALIFICATION_STATUS' | translate }}</th>
              <th>{{ 'SUPPLIER_PORTAL.RISK' | translate }}</th>
              <th>{{ 'SUPPLIER_PORTAL.STATUS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (invitation of invitationTable.data; track invitation.supplier_id) {
              <tr>
                <td>{{ invitation.supplier_name }}</td>
                <td>{{ invitation.qualification_status }}</td>
                <td>
                  <nz-tag [nzColor]="levelColors[invitation.risk_level]">{{ levelLabels[invitation.risk_level] | translate }}</nz-tag>
                </td>
                <td>
                  <nz-tag [nzColor]="invitationColors[invitation.status]">{{ invitationLabels[invitation.status] | translate }}</nz-tag>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
  styles: `
    .comparison {
      margin-top: 16px;
    }
    .section-title {
      margin: 20px 0 8px;
    }
    .amount {
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .best {
      font-weight: 700;
      color: var(--ff-color-success);
    }
    .missing {
      opacity: 0.5;
    }
    tr.recommended td {
      background: var(--ff-color-selected);
    }
  `,
})
export class SupplierRfqResponsesComponent implements OnInit {
  private readonly api = inject(SupplierPortalApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  readonly rfqs = signal<SupplierRfqSummary[]>([]);
  readonly loading = signal(false);
  readonly comparison = signal<SupplierRfqComparison | null>(null);

  readonly levelLabels = RISK_LEVEL_LABELS;
  readonly levelColors = RISK_LEVEL_COLORS;
  readonly invitationColors = INVITATION_COLORS;
  readonly invitationLabels = INVITATION_LABELS;

  ngOnInit(): void {
    this.loading.set(true);
    this.api
      .getRfqResponses()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          this.rfqs.set(response.data);
          this.loading.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR'));
        },
      });
  }

  compare(rfq: SupplierRfqSummary): void {
    this.api
      .getRfqComparison(rfq.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => this.comparison.set(response.data),
        error: () => this.message.error(this.translate.instant('SUPPLIER_PORTAL.ACTION_ERROR')),
      });
  }

  /** The offer of a quote on a line, if that supplier priced it. */
  offerFor(line: SupplierRfqComparisonLine, quoteId: string): SupplierRfqComparisonOffer | null {
    return line.offers.find((offer) => offer.quote_id === quoteId) ?? null;
  }
}
