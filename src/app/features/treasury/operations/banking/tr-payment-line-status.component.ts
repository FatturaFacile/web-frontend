import { Component, input } from '@angular/core';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PaymentBatchLine } from '@core/models/banking.model';
import { Pain002Transaction, PaymentLineOutcome } from '@core/models/iso20022.model';
import { TranslatePipe } from '@shared';
import { reasonKey, statusKey } from './iso-reconciliation.util';

/** One payment line with the answer of the bank: the outcome, the pain.002 status and the rejection reason. */
export interface PaymentLineFeedback {
  reference: string;
  outcome: PaymentLineOutcome;
  /** pain.002 transaction status (ACCP, RJCT, ...), when the bank reported one. */
  statusCode: string | null;
  /** ISO 20022 rejection reason code (AC04, AM04, ...). */
  reasonCode: string | null;
  info: string | null;
}

export function feedbackFromPain002(transactions: readonly Pain002Transaction[]): PaymentLineFeedback[] {
  return transactions.map((transaction) => ({
    reference: transaction.end_to_end_id,
    outcome: transaction.line_status,
    statusCode: transaction.status,
    reasonCode: transaction.reason_code,
    info: transaction.additional_info,
  }));
}

export function feedbackFromBatchLines(lines: readonly PaymentBatchLine[]): PaymentLineFeedback[] {
  return lines.map((line) => {
    const rejected = !!line.error_code || line.status === 'rejected' || line.status === 'failed';
    const executed = !rejected && (line.status === 'executed' || line.status === 'paid');

    return {
      reference: line.end_to_end_id ?? line.recipient_name,
      outcome: rejected ? 'rejected' : executed ? 'executed' : 'pending',
      statusCode: null,
      reasonCode: line.error_code ?? null,
      info: line.error_message ?? null,
    };
  });
}

const OUTCOME_COLORS: Record<PaymentLineOutcome, string> = {
  executed: 'green',
  rejected: 'red',
  pending: 'orange',
};

/** The per line feedback of a payment batch: outcome tag, bank status and the translated ISO reason of a rejection. */
@Component({
  selector: 'app-tr-payment-line-status',
  imports: [NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <nz-table #table nzSize="small" [nzData]="lines()" [nzShowPagination]="false" data-testid="line-status">
      <thead>
        <tr>
          <th>{{ 'treasuryIso.lineStatus.reference' | translate }}</th>
          <th>{{ 'treasuryIso.lineStatus.outcome' | translate }}</th>
          <th>{{ 'treasuryIso.lineStatus.bankStatus' | translate }}</th>
          <th>{{ 'treasuryIso.lineStatus.reason' | translate }}</th>
          <th>{{ 'treasuryIso.lineStatus.info' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (line of table.data; track $index) {
          <tr data-testid="line-status-row">
            <td>{{ line.reference }}</td>
            <td>
              <nz-tag [nzColor]="colors[line.outcome]" data-testid="outcome">
                {{ 'treasuryIso.outcome.' + line.outcome | translate }}
              </nz-tag>
            </td>
            <td>
              @if (line.statusCode; as code) {
                @if (statusLabel(code); as key) {
                  <span [title]="code">{{ key | translate }}</span>
                } @else {
                  {{ code }}
                }
              } @else {
                -
              }
            </td>
            <td data-testid="reason">
              @if (line.reasonCode; as code) {
                <strong>{{ code }}</strong> · {{ reasonLabel(code) | translate }}
              } @else {
                -
              }
            </td>
            <td>{{ line.info ?? '-' }}</td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class TrPaymentLineStatusComponent {
  readonly lines = input.required<readonly PaymentLineFeedback[]>();

  protected readonly colors = OUTCOME_COLORS;
  protected readonly reasonLabel = reasonKey;
  protected readonly statusLabel = statusKey;
}
