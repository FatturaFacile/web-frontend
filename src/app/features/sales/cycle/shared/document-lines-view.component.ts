import { Component, input } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { CoreDocumentLine } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';

/** Read-only lines table of a sales document with delivered / invoiced quantities when present. */
@Component({
  selector: 'app-document-lines-view',
  imports: [NzTableModule, MoneyPipe, TranslatePipe],
  template: `
    <nz-table #table [nzData]="lines()" nzSize="small" [nzFrontPagination]="false" [nzShowPagination]="false">
      <thead>
        <tr>
          <th>{{ 'SC.LINES.DESCRIPTION' | translate }}</th>
          <th class="num">{{ 'SC.LINES.QUANTITY' | translate }}</th>
          @if (showProgress()) {
            <th class="num">{{ 'SC.LINES.DELIVERED' | translate }}</th>
            <th class="num">{{ 'SC.LINES.INVOICED' | translate }}</th>
          }
          <th class="num">{{ 'SC.LINES.UNIT_PRICE' | translate }}</th>
          <th class="num">{{ 'SC.LINES.TAX_RATE' | translate }}</th>
          <th class="num">{{ 'SC.LINES.TOTAL' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (line of table.data; track line.id ?? $index) {
          <tr>
            <td>{{ line.description }}</td>
            <td class="num">{{ line.quantity }}</td>
            @if (showProgress()) {
              <td class="num">{{ line.quantity_delivered ?? '0' }}</td>
              <td class="num">{{ line.quantity_invoiced ?? '0' }}</td>
            }
            <td class="num">{{ line.unit_price | money: currency() }}</td>
            <td class="num">{{ line.tax_rate }}%</td>
            <td class="num">{{ line.line_total | money: currency() }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class DocumentLinesViewComponent {
  readonly lines = input<CoreDocumentLine[]>([]);
  readonly currency = input('EUR');
  readonly showProgress = input(false);
}
