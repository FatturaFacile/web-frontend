import { DecimalPipe } from '@angular/common';
import { Component, input } from '@angular/core';
import { InvoiceMatchLine } from '@domain/procurement/invoice-matching.models';
import { MoneyPipe, TranslatePipe } from '@shared';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  cellHighlight,
  highlightClass,
  lineStatusColor,
  lineStatusKey,
  reasonKey,
  rowHighlight,
  VarianceField,
} from './invoice-matching.helpers';

/**
 * Line-by-line comparison of ordered, received, previously invoiced and invoiced quantities and of the ordered
 * against the invoiced unit price. Cells with a variance are highlighted: `variance-out` when it exceeds the
 * tolerance and blocks the payment, `variance-within` when it stays inside the tolerance.
 */
@Component({
  selector: 'app-invoice-match-lines-table',
  imports: [DecimalPipe, MoneyPipe, TranslatePipe, NzEmptyModule, NzTableModule, NzTagModule],
  template: `
    <div class="legend" role="note" data-testid="lines-legend">
      <strong>{{ 'invoiceMatching.legend.title' | translate }}:</strong>
      <span class="swatch">{{ 'invoiceMatching.legend.exact' | translate }}</span>
      <span class="swatch variance-within">{{ 'invoiceMatching.legend.within' | translate }}</span>
      <span class="swatch variance-out">{{ 'invoiceMatching.legend.blocking' | translate }}</span>
    </div>

    <nz-table
      #table
      nzSize="small"
      [nzData]="lines()"
      [nzShowPagination]="false"
      [nzPageSize]="1000"
      [nzScroll]="{ x: '1500px' }"
      [nzNoResult]="empty"
      data-testid="lines-table"
    >
      <thead>
        <tr>
          <th>{{ 'invoiceMatching.column.line' | translate }}</th>
          <th>{{ 'invoiceMatching.column.description' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.orderedQuantity' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.receivedQuantity' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.previouslyInvoicedQuantity' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.invoicedQuantity' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.orderedUnitPrice' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.invoicedUnitPrice' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.quantityVariance' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.priceVariance' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.amountVariance' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.allowedQuantity' | translate }}</th>
          <th class="num">{{ 'invoiceMatching.column.allowedAmount' | translate }}</th>
          <th>{{ 'invoiceMatching.column.status' | translate }}</th>
          <th>{{ 'invoiceMatching.column.reasons' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (line of table.data; track line.id) {
          <tr [class]="rowClass(line)" [attr.data-testid]="'line-row-' + line.id">
            <td>{{ line.line_number }}</td>
            <td>{{ line.description ?? '-' }}</td>
            <td class="num">{{ line.ordered_quantity | number: '1.0-4' }}</td>
            <td class="num">{{ line.received_quantity | number: '1.0-4' }}</td>
            <td class="num">{{ line.previously_invoiced_quantity | number: '1.0-4' }}</td>
            <td class="num">{{ line.invoiced_quantity | number: '1.0-4' }}</td>
            <td class="num">{{ line.ordered_unit_price | money: currency() }}</td>
            <td class="num">{{ line.invoiced_unit_price | money: currency() }}</td>
            <td class="num" [class]="cellClass(line, 'quantity')" data-cell="quantity">
              {{ line.quantity_variance | number: '1.0-4' }}
            </td>
            <td class="num" [class]="cellClass(line, 'price')" data-cell="price">
              {{ line.price_variance | money: currency() }}
              <small>({{ line.price_variance_percent | number: '1.0-2' }}%)</small>
            </td>
            <td class="num" [class]="cellClass(line, 'amount')" data-cell="amount">
              {{ line.amount_variance | money: currency() }}
            </td>
            <td class="num">{{ line.allowed_quantity_variance | number: '1.0-4' }}</td>
            <td class="num">{{ line.allowed_amount_variance | money: currency() }}</td>
            <td [class]="statusCellClass(line)">
              <nz-tag [nzColor]="statusColor(line)">{{
                statusKey(line.status) | translate
              }}</nz-tag>
            </td>
            <td>
              @for (reason of line.reasons; track reason) {
                <nz-tag>{{ reasonText(reason) | translate }}</nz-tag>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
    <ng-template #empty>
      <nz-empty [nzNotFoundContent]="'invoiceMatching.message.noLines' | translate" />
    </ng-template>
  `,
  styles: `
    .legend {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .swatch {
      padding: 2px 8px;
      border: 1px solid var(--ant-color-border, #d9d9d9);
      border-radius: 4px;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .variance-out {
      background: #fff1f0;
      color: #a8071a;
      font-weight: 700;
    }
    .variance-within {
      background: #fffbe6;
      color: #874d00;
    }
  `,
})
export class InvoiceMatchLinesTableComponent {
  readonly lines = input.required<InvoiceMatchLine[]>();
  readonly currency = input('EUR');

  protected readonly statusKey = lineStatusKey;
  protected readonly reasonText = reasonKey;

  protected statusColor(line: InvoiceMatchLine): string {
    return lineStatusColor(line.status);
  }

  protected cellClass(line: InvoiceMatchLine, field: VarianceField): string {
    return highlightClass(cellHighlight(line, field));
  }

  protected rowClass(line: InvoiceMatchLine): string {
    return line.is_blocking ? 'line-blocking' : '';
  }

  protected statusCellClass(line: InvoiceMatchLine): string {
    return highlightClass(rowHighlight(line));
  }
}
