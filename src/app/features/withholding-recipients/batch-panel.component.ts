import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService, WrSimulation } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { SettlementsStore } from './settlements.store';
import {
  emptyPaymentForm,
  inlCoverage,
  isBatchValid,
  isInlBlocking,
  isPaymentFormValid,
  MAX_BATCH_ROWS,
  PaymentFormValue,
  WrOutcome,
} from './withholding-recipients.util';

interface BatchRow {
  key: number;
  form: PaymentFormValue;
  preview: WrSimulation | null;
}

/**
 * Batch posting grid (settle ability): up to 200 payments posted in one call, all or none. Every row can be previewed with the
 * simulator, and a row of an occasional worker without a covering INL communication blocks the whole batch.
 */
@Component({
  selector: 'app-wr-batch-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTagModule,
  ],
  template: `
    <p class="hint">{{ 'withholdingRecipients.batch.hint' | translate: { max: max } }}</p>

    @if (error(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="failure.errorKey ?? '' | translate"
        [nzDescription]="failure.detail ?? ''"
      ></nz-alert>
    }

    <div class="scroll">
      <table class="grid">
        <thead>
          <tr>
            <th scope="col">{{ 'withholdingRecipients.field.recipient' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.grossAmount' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.paymentDate' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.serviceDate' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.field.documentNumber' | translate }}</th>
            <th scope="col">{{ 'withholdingRecipients.batch.result' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (row of rows(); track row.key; let index = $index) {
            <tr>
              <td class="recipient">
                <nz-select
                  nzShowSearch
                  [attr.aria-label]="'withholdingRecipients.field.recipient' | translate"
                  [ngModel]="row.form.recipient_profile_id"
                  (ngModelChange)="pickRecipient(row.key, $event ?? null)"
                >
                  @for (entry of store.activeRecipients(); track entry.id) {
                    <nz-option [nzValue]="entry.id" [nzLabel]="entry.display_name"></nz-option>
                  }
                </nz-select>
              </td>
              <td>
                <nz-input-number
                  [nzMin]="0"
                  [ngModel]="row.form.gross_amount"
                  (ngModelChange)="patch(row.key, { gross_amount: $event })"
                ></nz-input-number>
              </td>
              <td>
                <input
                  nz-input
                  type="date"
                  [attr.aria-label]="'withholdingRecipients.field.paymentDate' | translate"
                  [ngModel]="row.form.payment_date"
                  (ngModelChange)="patch(row.key, { payment_date: $event })"
                />
              </td>
              <td>
                <input
                  nz-input
                  type="date"
                  [attr.aria-label]="'withholdingRecipients.field.serviceDate' | translate"
                  [ngModel]="row.form.service_date"
                  (ngModelChange)="patch(row.key, { service_date: $event })"
                />
              </td>
              <td>
                <input
                  nz-input
                  [attr.aria-label]="'withholdingRecipients.field.documentNumber' | translate"
                  [ngModel]="row.form.document_number"
                  (ngModelChange)="patch(row.key, { document_number: $event })"
                />
              </td>
              <td class="result">
                @if (isRowBlocked(row)) {
                  <nz-tag nzColor="red">{{
                    'withholdingRecipients.batch.inlBlocked' | translate
                  }}</nz-tag>
                }
                @if (row.preview; as result) {
                  <span>
                    {{ 'withholdingRecipients.result.netPayable' | translate }}:
                    <strong>{{ result.net_payable | money: result.currency }}</strong>
                  </span>
                }
              </td>
              <td class="actions">
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [disabled]="!isRowValid(row)"
                  (click)="previewRow(row.key)"
                >
                  {{ 'withholdingRecipients.batch.preview' | translate }}
                </button>
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  (click)="removeRow(row.key)"
                >
                  {{ 'withholdingRecipients.action.delete' | translate }}
                </button>
                <span class="index">{{ index + 1 }}</span>
              </td>
            </tr>
          }
        </tbody>
      </table>
    </div>

    <div class="footer">
      <button nz-button type="button" [disabled]="rows().length >= max" (click)="addRow()">
        {{ 'withholdingRecipients.batch.addRow' | translate }}
      </button>
      <span class="spacer"></span>
      <span class="hint">{{ rows().length }} / {{ max }}</span>
      <button
        nz-button
        nzType="primary"
        type="button"
        [nzLoading]="store.posting()"
        [disabled]="!canPost()"
        (click)="post()"
      >
        {{ 'withholdingRecipients.batch.submit' | translate }}
      </button>
    </div>
  `,
  styles: `
    .hint {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .feedback {
      margin-bottom: 12px;
    }

    .scroll {
      overflow-x: auto;
    }

    .grid {
      width: 100%;
      min-width: 880px;
      border-collapse: collapse;
    }

    .grid th,
    .grid td {
      padding: 6px 4px;
      text-align: left;
      vertical-align: middle;
      font-size: 12px;
      font-weight: normal;
    }

    .recipient {
      min-width: 200px;
    }

    .result {
      min-width: 180px;
    }

    .actions {
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .index {
      min-width: 24px;
      text-align: right;
      color: var(--ant-text-color-secondary, #595959);
    }

    .footer {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-top: 12px;
    }

    .spacer {
      flex: 1;
    }
  `,
})
export class BatchPanelComponent {
  readonly store = inject(SettlementsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly max = MAX_BATCH_ROWS;
  readonly rows = signal<BatchRow[]>([]);
  readonly error = signal<WrOutcome | null>(null);

  private sequence = 0;

  readonly canPost = computed(
    () =>
      isBatchValid(this.rows().map((row) => row.form)) &&
      !this.rows().some((row) => this.isRowBlocked(row)),
  );

  constructor() {
    this.addRow();
  }

  addRow(): void {
    if (this.rows().length >= MAX_BATCH_ROWS) {
      return;
    }
    this.rows.update((rows) => [
      ...rows,
      { key: ++this.sequence, form: emptyPaymentForm(), preview: null },
    ]);
  }

  removeRow(key: number): void {
    this.rows.update((rows) => rows.filter((row) => row.key !== key));
  }

  patch(key: number, change: Partial<PaymentFormValue>): void {
    this.rows.update((rows) =>
      rows.map((row) =>
        row.key === key ? { ...row, form: { ...row.form, ...change }, preview: null } : row,
      ),
    );
  }

  pickRecipient(key: number, id: string | null): void {
    this.patch(key, { recipient_profile_id: id });
    if (id) {
      void this.store.loadCoverage(id);
    }
  }

  isRowValid(row: BatchRow): boolean {
    return isPaymentFormValid(row.form);
  }

  /** An occasional worker row whose service date is not covered by an INL communication sent before the work. */
  isRowBlocked(row: BatchRow): boolean {
    const id = row.form.recipient_profile_id;
    if (!id) {
      return false;
    }
    const recipient = this.store.recipients().find((entry) => entry.id === id);
    const notifications = this.store.inlByRecipient()[id];
    if (!recipient || notifications === undefined) {
      return false;
    }
    return isInlBlocking(
      inlCoverage(recipient.regime, notifications, row.form.service_date || row.form.payment_date),
    );
  }

  async previewRow(key: number): Promise<void> {
    const row = this.rows().find((entry) => entry.key === key);
    if (!row) {
      return;
    }
    const preview = await this.store.preview(row.form);
    this.rows.update((rows) =>
      rows.map((entry) => (entry.key === key ? { ...entry, preview } : entry)),
    );
  }

  async post(): Promise<void> {
    if (!this.canPost()) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.postBatch(this.rows().map((row) => row.form));
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.batchPosted'));
      this.rows.set([]);
      this.addRow();
    } else {
      this.error.set(outcome);
    }
  }
}
