import { Component, input } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { CoreDocumentLine } from '@core';
import { MoneyPipe, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';

/** Read-only lines table of a sales document with delivered / invoiced quantities when present. */
@Component({
  selector: 'app-document-lines-view',
  styleUrl: './document-lines-view.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    NzTableModule, MoneyPipe, TranslatePipe],
  template: `
    <nz-table #table [nzData]="lines()" nzSize="small" [nzFrontPagination]="false" [nzShowPagination]="false">
      <thead>
        <tr>
          <th [nzSortFn]="'description' | gridSort" [nzFilters]="'description' | gridFilterList: table.nzData" [nzFilterFn]="'description' | gridFilterFn">{{ 'SC.LINES.DESCRIPTION' | translate }}</th>
          <th class="num" [nzSortFn]="'quantity' | gridSort" [nzFilters]="'quantity' | gridFilterList: table.nzData" [nzFilterFn]="'quantity' | gridFilterFn">{{ 'SC.LINES.QUANTITY' | translate }}</th>
          @if (showProgress()) {
            <th class="num">{{ 'SC.LINES.DELIVERED' | translate }}</th>
            <th class="num">{{ 'SC.LINES.INVOICED' | translate }}</th>
          }
          <th class="num" [nzSortFn]="'unit_price' | gridSort" [nzFilters]="'unit_price' | gridFilterList: table.nzData" [nzFilterFn]="'unit_price' | gridFilterFn">{{ 'SC.LINES.UNIT_PRICE' | translate }}</th>
          <th class="num" [nzSortFn]="'tax_rate' | gridSort" [nzFilters]="'tax_rate' | gridFilterList: table.nzData" [nzFilterFn]="'tax_rate' | gridFilterFn">{{ 'SC.LINES.TAX_RATE' | translate }}</th>
          <th class="num" [nzSortFn]="'line_total' | gridSort" [nzFilters]="'line_total' | gridFilterList: table.nzData" [nzFilterFn]="'line_total' | gridFilterFn">{{ 'SC.LINES.TOTAL' | translate }}</th>
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
