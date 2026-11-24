import { NgTemplateOutlet } from '@angular/common';
import { Component, input } from '@angular/core';
import { GrIrJournalEntry, InvoiceMatchGrIr } from '@domain/procurement/invoice-matching.models';
import { DateFormatPipe, MoneyPipe, TranslatePipe } from '@shared';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';

/** GR/IR clearing view: balances plus the goods receipt and invoice journal entries with their account lines. */
@Component({
  selector: 'app-invoice-match-gr-ir',
  imports: [
    DateFormatPipe,
    MoneyPipe,
    NgTemplateOutlet,
    TranslatePipe,
    NzCardModule,
    NzEmptyModule,
    NzStatisticModule,
    NzTableModule,
  ],
  template: `
    @if (data(); as gr) {
      <section class="balances" data-testid="gr-ir-balances">
        <nz-card>
          <nz-statistic
            data-testid="gr-ir-expected-clearing"
            [nzTitle]="'invoiceMatching.grIr.expectedClearing' | translate"
            [nzValue]="gr.expected_clearing_amount | money: gr.currency"
          />
        </nz-card>
        <nz-card>
          <nz-statistic
            data-testid="gr-ir-expected-variance"
            [nzTitle]="'invoiceMatching.grIr.expectedVariance' | translate"
            [nzValue]="gr.expected_variance_amount | money: gr.currency"
          />
        </nz-card>
        <nz-card>
          <nz-statistic
            data-testid="gr-ir-accrued"
            [nzTitle]="'invoiceMatching.grIr.accrued' | translate"
            [nzValue]="gr.accrued_amount | money: gr.currency"
          />
        </nz-card>
        <nz-card>
          <nz-statistic
            data-testid="gr-ir-cleared"
            [nzTitle]="'invoiceMatching.grIr.cleared' | translate"
            [nzValue]="gr.cleared_amount | money: gr.currency"
          />
        </nz-card>
        <nz-card>
          <nz-statistic
            data-testid="gr-ir-open"
            [nzTitle]="'invoiceMatching.grIr.openBalance' | translate"
            [nzValue]="gr.open_balance | money: gr.currency"
          />
        </nz-card>
      </section>

      <h3>{{ 'invoiceMatching.grIr.receipts' | translate }}</h3>
      @for (entry of gr.receipts; track entry.journal_entry_id) {
        <nz-card class="entry" nzSize="small" [nzTitle]="receiptTitle" data-testid="gr-ir-receipt">
          <ng-template #receiptTitle>
            {{ entry.receipt_number ?? entry.entry_number ?? '-' }}
            · {{ entry.posting_date | appDate }} ·
            {{ 'invoiceMatching.grIr.clearingAmount' | translate }}:
            {{ entry.clearing_amount | money: gr.currency }}
          </ng-template>
          <ng-container
            [ngTemplateOutlet]="entryLines"
            [ngTemplateOutletContext]="{ entry: entry, currency: gr.currency }"
          />
        </nz-card>
      } @empty {
        <nz-empty [nzNotFoundContent]="'invoiceMatching.grIr.noReceipts' | translate" />
      }

      <h3>{{ 'invoiceMatching.grIr.invoiceEntry' | translate }}</h3>
      @if (gr.invoice; as invoice) {
        <nz-card class="entry" nzSize="small" [nzTitle]="invoiceTitle" data-testid="gr-ir-invoice">
          <ng-template #invoiceTitle>
            {{ invoice.entry_number ?? '-' }} · {{ invoice.posting_date | appDate }}
          </ng-template>
          <ng-container
            [ngTemplateOutlet]="entryLines"
            [ngTemplateOutletContext]="{ entry: invoice, currency: gr.currency }"
          />
        </nz-card>
      } @else {
        <nz-empty [nzNotFoundContent]="'invoiceMatching.grIr.noInvoiceEntry' | translate" />
      }

      <ng-template #entryLines let-entry="entry" let-currency="currency">
        <nz-table
          nzSize="small"
          [nzData]="entryOf(entry).lines"
          [nzShowPagination]="false"
          [nzPageSize]="1000"
        >
          <thead>
            <tr>
              <th>{{ 'invoiceMatching.column.account' | translate }}</th>
              <th>{{ 'invoiceMatching.column.accountName' | translate }}</th>
              <th class="num">{{ 'invoiceMatching.column.debit' | translate }}</th>
              <th class="num">{{ 'invoiceMatching.column.credit' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (line of entryOf(entry).lines; track $index) {
              <tr>
                <td>{{ line.account_code }}</td>
                <td>{{ line.account_name ?? line.description ?? '-' }}</td>
                <td class="num">{{ line.debit_amount | money: currency }}</td>
                <td class="num">{{ line.credit_amount | money: currency }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-template>
    }
  `,
  styles: `
    .balances {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    .entry {
      margin-bottom: 12px;
    }
    .num {
      text-align: right;
    }
  `,
})
export class InvoiceMatchGrIrComponent {
  readonly data = input<InvoiceMatchGrIr | null>(null);

  /** Narrows the loosely typed template context of the shared lines template. */
  protected entryOf(entry: unknown): GrIrJournalEntry {
    return entry as GrIrJournalEntry;
  }
}
