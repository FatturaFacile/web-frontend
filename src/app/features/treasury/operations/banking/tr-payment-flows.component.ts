import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TreasuryApiService } from '@core/api/treasury-api.service';
import { TreasuryBankingApiService } from '@core/api/treasury-banking-api.service';
import { BankAccountResource } from '@core/models/banking.model';
import { CategoryPurpose, ChargeBearer } from '@core/models/iso20022.model';
import {
  GeneratedPaymentFlow,
  PaymentFlowCode,
  PaymentFlowInfo,
  PaymentFlowLine,
  PaymentFlowPayload,
} from '@core/models/treasury-banking.model';
import { TranslatePipe, downloadBlob } from '@shared';
import { CATEGORY_PURPOSES, CHARGE_BEARERS, splitApiErrors } from './iso-reconciliation.util';
import {
  PaymentLineFeedback,
  TrPaymentLineStatusComponent,
  feedbackFromBatchLines,
} from './tr-payment-line-status.component';
import { PAYMENT_FLOWS, toCents, toIsoDate } from './treasury-banking.util';

const emptyLine = (): PaymentFlowLine => ({
  recipient_name: '',
  recipient_iban: '',
  recipient_bic: '',
  amount: '',
  currency: null,
  remittance_reference: '',
  structured_creditor_ref: '',
});

/**
 * Outgoing payment files: Swiss pain.001.001.09 (IBAN and QR-bill payments with QRR / SCOR references), SEPA
 * pain.001.001.03 and the CBI bonifico flow. The API validates every rule and the XSD; the file is only offered for
 * download, or stored as a draft batch for the approval workflow, when it is valid.
 */
@Component({
  selector: 'app-tr-payment-flows',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzDatePickerModule,
    NzGridModule,
    NzInputModule,
    NzSelectModule,
    NzStatisticModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    TrPaymentLineStatusComponent,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'tbk.flows.title' | translate">
      <nz-steps [nzCurrent]="step()" nzSize="small" class="steps">
        <nz-step [nzTitle]="'tbk.flows.step.setup' | translate" />
        <nz-step [nzTitle]="'tbk.flows.step.payments' | translate" />
        <nz-step [nzTitle]="'tbk.flows.step.validate' | translate" />
        <nz-step [nzTitle]="'tbk.flows.step.deliver' | translate" />
      </nz-steps>

      <div nz-row [nzGutter]="16">
        <div nz-col [nzXs]="24" [nzMd]="8">
          <label class="field" for="tbk-flow">
            <span>{{ 'tbk.flows.flow' | translate }}</span>
            <nz-select
              nzId="tbk-flow"
              [ngModel]="flow()"
              (ngModelChange)="selectFlow($event)"
              data-testid="flow"
            >
              @for (code of flowCodes; track code) {
                <nz-option [nzValue]="code" [nzLabel]="'tbk.flow.' + code | translate" />
              }
            </nz-select>
          </label>
        </div>
        <div nz-col [nzXs]="24" [nzMd]="8">
          <label class="field" for="tbk-account">
            <span>{{ 'tbk.flows.account' | translate }}</span>
            <nz-select
              nzId="tbk-account"
              [ngModel]="bankAccountId()"
              (ngModelChange)="bankAccountId.set($event)"
              data-testid="account"
            >
              @for (account of accounts(); track account.id) {
                <nz-option
                  [nzValue]="account.id"
                  [nzLabel]="
                    account.bank_name + ' · ' + account.iban + ' (' + account.currency + ')'
                  "
                />
              }
            </nz-select>
          </label>
        </div>
        <div nz-col [nzXs]="24" [nzMd]="4">
          <label class="field" for="tbk-date">
            <span>{{ 'tbk.flows.executionDate' | translate }}</span>
            <nz-date-picker
              nzId="tbk-date"
              nzFormat="yyyy-MM-dd"
              [ngModel]="executionDate()"
              (ngModelChange)="setDate($event)"
              data-testid="date"
            />
          </label>
        </div>
        <div nz-col [nzXs]="24" [nzMd]="4">
          <label class="field" for="tbk-currency">
            <span>{{ 'tbk.flows.currency' | translate }}</span>
            <nz-select
              nzId="tbk-currency"
              [ngModel]="currency()"
              (ngModelChange)="currency.set($event)"
              data-testid="currency"
            >
              @for (code of currencies(); track code) {
                <nz-option [nzValue]="code" [nzLabel]="code" />
              }
            </nz-select>
          </label>
        </div>
      </div>

      <div nz-row [nzGutter]="16">
        <div nz-col [nzXs]="24" [nzMd]="8">
          <label class="field" for="tbk-purpose">
            <span>{{ 'treasuryIso.flows.categoryPurpose' | translate }}</span>
            <nz-select
              nzId="tbk-purpose"
              nzAllowClear
              [ngModel]="categoryPurpose()"
              (ngModelChange)="categoryPurpose.set($event ?? null)"
              data-testid="category-purpose"
            >
              @for (code of purposes; track code) {
                <nz-option [nzValue]="code" [nzLabel]="code + ' · ' + ('treasuryIso.purpose.' + code | translate)" />
              }
            </nz-select>
          </label>
        </div>
        <div nz-col [nzXs]="24" [nzMd]="8">
          <label class="field" for="tbk-bearer">
            <span>{{ 'treasuryIso.flows.chargeBearer' | translate }}</span>
            <nz-select
              nzId="tbk-bearer"
              nzAllowClear
              [ngModel]="chargeBearer()"
              (ngModelChange)="chargeBearer.set($event ?? null)"
              data-testid="charge-bearer"
            >
              @for (code of bearers; track code) {
                <nz-option [nzValue]="code" [nzLabel]="code + ' · ' + ('treasuryIso.bearer.' + code | translate)" />
              }
            </nz-select>
          </label>
        </div>
      </div>

      @if (info()?.requires_cuc) {
        <label class="field cuc" for="tbk-cuc">
          <span>{{ 'tbk.flows.cuc' | translate }}</span>
          <input
            nz-input
            id="tbk-cuc"
            maxlength="8"
            [ngModel]="cuc()"
            (ngModelChange)="cuc.set(($event ?? '').toUpperCase())"
            data-testid="cuc"
          />
        </label>
      }

      <p class="hint">{{ 'tbk.flowHint.' + flow() | translate }}</p>
    </nz-card>

    <nz-card class="gap" [nzTitle]="'tbk.flows.payments' | translate">
      <nz-table
        #table
        [nzData]="lines()"
        [nzShowPagination]="false"
        nzSize="small"
        [nzScroll]="{ x: '1000px' }"
      >
        <thead>
          <tr>
            <th>{{ 'tbk.flows.creditor' | translate }}</th>
            <th>IBAN</th>
            <th>{{ 'tbk.flows.amount' | translate }}</th>
            <th>{{ 'tbk.flows.reference' | translate }}</th>
            <th>{{ 'tbk.flows.remittance' | translate }}</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          @for (line of table.data; track $index; let i = $index) {
            <tr>
              <td>
                <input
                  nz-input
                  [attr.aria-label]="'tbk.flows.creditor' | translate"
                  [ngModel]="line.recipient_name"
                  (ngModelChange)="patch(i, { recipient_name: $event })"
                />
              </td>
              <td>
                <input
                  nz-input
                  aria-label="IBAN"
                  [ngModel]="line.recipient_iban"
                  (ngModelChange)="patch(i, { recipient_iban: $event })"
                />
              </td>
              <td>
                <input
                  nz-input
                  inputmode="decimal"
                  [attr.aria-label]="'tbk.flows.amount' | translate"
                  [ngModel]="line.amount"
                  (ngModelChange)="patch(i, { amount: $event })"
                />
              </td>
              <td>
                <input
                  nz-input
                  [attr.aria-label]="'tbk.flows.reference' | translate"
                  [ngModel]="line.structured_creditor_ref"
                  (ngModelChange)="patch(i, { structured_creditor_ref: $event })"
                />
              </td>
              <td>
                <input
                  nz-input
                  [attr.aria-label]="'tbk.flows.remittance' | translate"
                  [ngModel]="line.remittance_reference"
                  (ngModelChange)="patch(i, { remittance_reference: $event })"
                />
              </td>
              <td>
                <button
                  nz-button
                  nzType="link"
                  nzDanger
                  type="button"
                  (click)="removeLine(i)"
                  [disabled]="lines().length === 1"
                >
                  {{ 'tbk.common.remove' | translate }}
                </button>
              </td>
            </tr>
            @if (lineErrors()[i]; as messages) {
              <tr class="line-error" data-testid="line-errors">
                <td colspan="6">
                  <ul>
                    @for (message of messages; track message) {
                      <li>{{ message }}</li>
                    }
                  </ul>
                </td>
              </tr>
            }
          }
        </tbody>
      </nz-table>
      <button nz-button type="button" class="add" (click)="addLine()" data-testid="add-line">
        {{ 'tbk.flows.addPayment' | translate }}
      </button>
      <span class="total"
        >{{ 'tbk.flows.total' | translate }}: <strong data-testid="total">{{ total() }}</strong>
        {{ currency() }}</span
      >
    </nz-card>

    @if (errors().length > 0) {
      <nz-alert
        class="gap"
        nzType="error"
        nzShowIcon
        [nzMessage]="'tbk.flows.invalid' | translate"
        [nzDescription]="errorList"
        data-testid="errors"
      />
      <ng-template #errorList>
        <ul>
          @for (message of errors(); track message) {
            <li>{{ message }}</li>
          }
        </ul>
      </ng-template>
    }

    <div class="actions">
      <button
        nz-button
        nzType="primary"
        type="button"
        [nzLoading]="loading()"
        [disabled]="!canSubmit()"
        (click)="preview()"
        data-testid="preview"
      >
        {{ 'tbk.flows.validate' | translate }}
      </button>
      <button
        nz-button
        type="button"
        [nzLoading]="saving()"
        [disabled]="!generated()"
        (click)="createBatch()"
        data-testid="create-batch"
      >
        {{ 'tbk.flows.createBatch' | translate }}
      </button>
      <button
        nz-button
        type="button"
        [disabled]="!generated()"
        (click)="download()"
        data-testid="download"
      >
        {{ 'tbk.flows.download' | translate }}
      </button>
    </div>

    @if (createdBatch(); as batch) {
      <nz-alert
        class="gap"
        nzType="success"
        nzShowIcon
        [nzMessage]="'tbk.flows.batchCreated' | translate"
        [nzDescription]="batch"
        data-testid="batch-created"
      />
    }

    @if (batchFeedback().length > 0) {
      <nz-card class="gap" [nzTitle]="'treasuryIso.flows.feedback' | translate" data-testid="batch-feedback">
        <app-tr-payment-line-status [lines]="batchFeedback()" />
      </nz-card>
    }

    @if (generated(); as file) {
      <nz-card class="gap" [nzTitle]="'tbk.flows.generated' | translate" data-testid="generated">
        <div nz-row [nzGutter]="16">
          <div nz-col [nzSpan]="6">
            <nz-statistic
              [nzTitle]="'tbk.flows.transactions' | translate"
              [nzValue]="file.transactions"
            />
          </div>
          <div nz-col [nzSpan]="6">
            <nz-statistic
              [nzTitle]="'tbk.flows.controlSum' | translate"
              [nzValue]="file.control_sum + ' ' + file.currency"
            />
          </div>
          <div nz-col [nzSpan]="6">
            <nz-statistic
              [nzTitle]="'tbk.flows.version' | translate"
              [nzValue]="'pain.001.001.' + file.pain_version"
            />
          </div>
          <div nz-col [nzSpan]="6">
            <nz-tag nzColor="green">{{ 'tbk.flows.schemaValid' | translate }}</nz-tag>
          </div>
        </div>
        <p class="hash">SHA-256: {{ file.sha256 }}</p>
        <textarea
          nz-input
          readonly
          rows="10"
          class="xml"
          [value]="file.xml ?? ''"
          [attr.aria-label]="'tbk.flows.xml' | translate"
        ></textarea>
      </nz-card>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .steps,
    .gap {
      margin-bottom: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      margin-bottom: 12px;
    }
    .cuc {
      max-width: 240px;
    }
    .hint {
      color: rgba(0, 0, 0, 0.55);
      margin: 0;
    }
    .add {
      margin-top: 12px;
    }
    .line-error {
      color: #cf1322;
    }
    .total {
      margin-left: 16px;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .hash {
      font-family: monospace;
      word-break: break-all;
    }
    .xml {
      font-family: monospace;
      font-size: 12px;
    }
  `,
})
export class TrPaymentFlowsComponent implements OnInit {
  private readonly api = inject(TreasuryBankingApiService);
  private readonly treasury = inject(TreasuryApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly flowCodes = PAYMENT_FLOWS;
  protected readonly purposes = CATEGORY_PURPOSES;
  protected readonly bearers = CHARGE_BEARERS;
  protected readonly flows = signal<PaymentFlowInfo[]>([]);
  protected readonly accounts = signal<BankAccountResource[]>([]);
  protected readonly flow = signal<PaymentFlowCode>('ch_pain001_09');
  protected readonly bankAccountId = signal<string | null>(null);
  protected readonly executionDate = signal<Date | null>(null);
  protected readonly currency = signal<string>('CHF');
  protected readonly cuc = signal('');
  protected readonly lines = signal<PaymentFlowLine[]>([emptyLine()]);
  protected readonly generated = signal<GeneratedPaymentFlow | null>(null);
  protected readonly categoryPurpose = signal<CategoryPurpose | null>(null);
  protected readonly chargeBearer = signal<ChargeBearer | null>(null);
  protected readonly errors = signal<string[]>([]);
  /** 422 messages of one line (`lines.N.invoice_id`, `lines.N.end_to_end_id`), by line index. */
  protected readonly lineErrors = signal<Record<number, string[]>>({});
  protected readonly batchFeedback = signal<PaymentLineFeedback[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly createdBatch = signal<string | null>(null);

  protected readonly info = computed(
    () => this.flows().find((f) => f.flow === this.flow()) ?? null,
  );
  protected readonly currencies = computed(() => this.info()?.currencies ?? ['EUR', 'CHF']);
  protected readonly total = computed(() => {
    const cents = this.lines().reduce(
      (sum, line) => sum + (Number.isNaN(toCents(line.amount)) ? 0 : toCents(line.amount)),
      0,
    );

    return `${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
  });
  protected readonly canSubmit = computed(
    () =>
      !!this.bankAccountId() &&
      !!this.executionDate() &&
      this.lines().every(
        (line) =>
          line.recipient_name.trim() !== '' &&
          line.recipient_iban.trim() !== '' &&
          toCents(line.amount) > 0,
      ) &&
      (!this.info()?.requires_cuc || this.cuc().length === 8),
  );
  protected readonly step = computed(() => {
    if (this.createdBatch() || this.generated()) {
      return this.createdBatch() ? 3 : 2;
    }

    return this.lines().some((line) => line.recipient_iban.trim() !== '') ? 1 : 0;
  });

  ngOnInit(): void {
    this.api
      .getPaymentFlows()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.flows.set(res.data));
    this.treasury
      .getBankAccounts()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((res) => this.accounts.set(res.data.filter((account) => account.is_active)));
  }

  protected selectFlow(flow: PaymentFlowCode): void {
    this.flow.set(flow);
    this.currency.set(this.currencies()[0] ?? 'EUR');
    this.reset();
  }

  protected setDate(date: Date | null): void {
    this.executionDate.set(date);
    this.reset();
  }

  protected patch(index: number, change: Partial<PaymentFlowLine>): void {
    this.lines.update((lines) =>
      lines.map((line, i) => (i === index ? { ...line, ...change } : line)),
    );
    this.reset();
  }

  protected addLine(): void {
    this.lines.update((lines) => [...lines, emptyLine()]);
  }

  protected removeLine(index: number): void {
    this.lines.update((lines) => lines.filter((_, i) => i !== index));
    this.reset();
  }

  protected preview(): void {
    const payload = this.payload();

    if (!payload) {
      return;
    }

    this.loading.set(true);
    this.errors.set([]);
    this.lineErrors.set({});
    this.api
      .previewPaymentFlow(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.loading.set(false);
          this.generated.set(res.data);
        },
        error: (error: unknown) => {
          this.loading.set(false);
          this.generated.set(null);
          this.showErrors(error);
        },
      });
  }

  protected createBatch(): void {
    const payload = this.payload();

    if (!payload) {
      return;
    }

    this.saving.set(true);
    this.api
      .createPaymentFlowBatch(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.saving.set(false);
          this.createdBatch.set(res.data.batch_reference ?? res.data.id);
          this.batchFeedback.set(feedbackFromBatchLines(res.data.lines ?? []).filter((line) => line.reasonCode !== null));
        },
        error: (error: unknown) => {
          this.saving.set(false);
          this.showErrors(error);
        },
      });
  }

  protected download(): void {
    const file = this.generated();

    if (file?.xml) {
      downloadBlob(new Blob([file.xml], { type: 'application/xml' }), file.filename);
    }
  }

  private reset(): void {
    this.generated.set(null);
    this.createdBatch.set(null);
    this.errors.set([]);
    this.lineErrors.set({});
    this.batchFeedback.set([]);
  }

  private showErrors(error: unknown): void {
    const { general, lines } = splitApiErrors(error);

    this.errors.set(general);
    this.lineErrors.set(lines);
  }

  private payload(): PaymentFlowPayload | null {
    const date = this.executionDate();
    const account = this.bankAccountId();

    if (!date || !account) {
      return null;
    }

    return {
      flow: this.flow(),
      bank_account_id: account,
      execution_date: toIsoDate(date),
      currency: this.currency(),
      cuc: this.info()?.requires_cuc ? this.cuc() : null,
      category_purpose: this.categoryPurpose(),
      charge_bearer: this.chargeBearer(),
      lines: this.lines().map((line) => ({
        ...line,
        recipient_bic: line.recipient_bic || null,
        structured_creditor_ref: line.structured_creditor_ref || null,
        remittance_reference: line.remittance_reference || null,
      })),
    };
  }
}
