import { Component, input } from '@angular/core';
import { NzCollapseModule } from 'ng-zorro-antd/collapse';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { ApBatch } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { formatIban } from './payables.util';

/**
 * What a payment batch will do: totals, the credit notes netted and the bank transfers grouped by creditor IBAN,
 * each one expandable to the invoices it pays. Shared by the creation wizard and the batch detail.
 */
@Component({
  selector: 'app-payables-batch-summary',
  styleUrl: './payables.scss',
  imports: [
    MoneyPipe,
    TranslatePipe,
    NzCollapseModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    @let b = batch();
    <div class="totals-row">
      <nz-statistic
        [nzTitle]="'AP.TOTAL_GROSS' | translate"
        [nzValue]="b.totals.gross_amount | money: b.currency"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'AP.TOTAL_SET_OFF' | translate"
        [nzValue]="'-' + (b.totals.set_off_amount | money: b.currency)"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'AP.TOTAL_SKONTO' | translate"
        [nzValue]="'-' + (b.totals.skonto_savings | money: b.currency)"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'AP.TOTAL_NET' | translate"
        [nzValue]="b.totals.net_amount | money: b.currency"
      ></nz-statistic>
      <nz-statistic
        [nzTitle]="'AP.TOTAL_TRANSFERS' | translate"
        [nzValue]="b.totals.transfers"
      ></nz-statistic>
    </div>

    <h4 class="section-title">{{ 'AP.SET_OFFS' | translate }}</h4>
    @if (b.set_offs.length === 0) {
      <p class="muted">{{ 'AP.NO_SET_OFFS' | translate }}</p>
    } @else {
      <nz-table
        nzSize="small"
        [nzData]="b.set_offs"
        [nzShowPagination]="false"
        [nzFrontPagination]="false"
      >
        <thead>
          <tr>
            <th>{{ 'AP.SUPPLIER' | translate }}</th>
            <th>{{ 'AP.CREDIT_NOTE' | translate }}</th>
            <th class="num">{{ 'AP.SET_OFF_AMOUNT' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (setOff of b.set_offs; track setOff.credit_note_id) {
            <tr>
              <td>{{ setOff.supplier_name }}</td>
              <td>{{ setOff.credit_note_number }}</td>
              <td class="num negative">-{{ setOff.amount | money: b.currency }}</td>
            </tr>
          }
        </tbody>
      </nz-table>
    }

    <h4 class="section-title">{{ 'AP.TRANSFERS_BY_IBAN' | translate }}</h4>
    @if (b.transfers.length === 0) {
      <p class="muted">{{ 'AP.NO_TRANSFERS' | translate }}</p>
    } @else {
      <nz-collapse>
        @for (group of b.transfers; track group.iban + group.currency) {
          <nz-collapse-panel [nzHeader]="header" [nzActive]="false">
            <ng-template #header>
              <span class="transfer-head">
                <strong>{{ group.supplier_name }}</strong> · {{ iban(group.iban) }} ·
                <nz-tag>{{
                  'AP.TRANSFER_LINES' | translate: { count: group.lines.length }
                }}</nz-tag>
                · {{ group.net_amount | money: group.currency }}
              </span>
            </ng-template>
            <nz-table
              nzSize="small"
              [nzData]="group.lines"
              [nzShowPagination]="false"
              [nzFrontPagination]="false"
            >
              <thead>
                <tr>
                  <th>{{ 'AP.DOCUMENT' | translate }}</th>
                  <th>{{ 'AP.DUE_DATE' | translate }}</th>
                  <th class="num">{{ 'AP.OPEN_AMOUNT' | translate }}</th>
                  <th class="num">{{ 'AP.TOTAL_SKONTO' | translate }}</th>
                  <th class="num">{{ 'AP.PAY_AMOUNT' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (line of group.lines; track line.item_id) {
                  <tr>
                    <td>{{ line.document_number }}</td>
                    <td>{{ line.due_date }}</td>
                    <td class="num">{{ line.open_amount | money: group.currency }}</td>
                    <td class="num">
                      @if (line.skonto_taken) {
                        <nz-tag nzColor="green"
                          >-{{ line.skonto_savings | money: group.currency }}</nz-tag
                        >
                      } @else {
                        <span class="muted">—</span>
                      }
                    </td>
                    <td class="num">{{ line.pay_amount | money: group.currency }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
            <div class="muted small">
              {{ 'AP.TOTAL_GROSS' | translate }}: {{ group.gross_amount | money: group.currency }} ·
              {{ 'AP.TOTAL_SET_OFF' | translate }}: -{{
                group.set_off_amount | money: group.currency
              }}
              · {{ 'AP.TOTAL_NET' | translate }}: {{ group.net_amount | money: group.currency }}
            </div>
          </nz-collapse-panel>
        }
      </nz-collapse>
    }
  `,
})
export class PayablesBatchSummaryComponent {
  readonly batch = input.required<ApBatch>();
  readonly iban = formatIban;
}
