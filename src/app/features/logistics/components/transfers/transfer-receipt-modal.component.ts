import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  linkedSignal,
  output,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  I18nService,
  LogisticsApiService,
  LookupProduct,
  StockTransferLine,
  StockTransferResource,
} from '@core';
import { TranslatePipe } from '@shared';
import {
  buildReceivePayload,
  computeVariance,
  defaultReceiptInput,
  LineVariance,
  outstandingQty,
  ReceiptIssue,
  ReceiptLineInput,
  toQty,
  validateReceipt,
} from '../../logistics.rules';
import { apiErrorMessage } from '../../logistics.ui';

interface ReceiptRow {
  line: StockTransferLine;
  shipped: number;
  alreadyReceived: number;
  alreadyDamaged: number;
  input: ReceiptLineInput;
  variance: LineVariance;
  issues: ReceiptIssue[];
}

/**
 * Receipt / verification screen of a transfer in transit. Each open line shows shipped, already booked and outstanding
 * units next to the good / damaged inputs of this receipt; variances are highlighted and need a reason. The partial
 * switch records what arrived and leaves the rest in transit.
 */
@Component({
  selector: 'app-transfer-receipt-modal',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transfer-receipt-modal.component.html',
  styles: `
    .toggle {
      display: flex;
      align-items: center;
      gap: 8px;
      margin-bottom: 12px;
    }
    .spacer {
      flex: 1;
    }
    .block {
      margin-bottom: 12px;
    }
    .variance {
      background: var(--ant-color-warning-bg, #fffbe6);
    }
    .invalid {
      background: var(--ant-color-error-bg, #fff2f0);
    }
    .issue {
      color: var(--ant-color-error, #ff4d4f);
      display: block;
      font-size: 12px;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .tags {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
  `,
})
export class TransferReceiptModalComponent {
  private readonly api = inject(LogisticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Transfer to receive (with its lines); `null` keeps the modal closed. */
  readonly transfer = input<StockTransferResource | null>(null);
  readonly products = input<LookupProduct[]>([]);

  readonly closed = output<void>();
  readonly received = output<StockTransferResource>();

  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  /** Partial receipt switch: off means a final receipt that closes the receiving phase. */
  protected readonly partial = linkedSignal<StockTransferResource | null, boolean>({
    source: this.transfer,
    computation: () => false,
  });

  private readonly lines = computed(() =>
    (this.transfer()?.lines ?? []).filter((l) => outstandingQty(l) > 0),
  );

  /** Operator input per line; resets to "everything outstanding arrived, undamaged" for each transfer. */
  protected readonly inputs = linkedSignal<
    StockTransferResource | null,
    Record<string, ReceiptLineInput>
  >({
    source: this.transfer,
    computation: (transfer) =>
      Object.fromEntries(
        (transfer?.lines ?? []).map((line) => [line.id, defaultReceiptInput(line)]),
      ),
  });

  protected readonly validation = computed(() =>
    validateReceipt(this.lines(), this.inputs(), !this.partial()),
  );

  protected readonly rows = computed<ReceiptRow[]>(() => {
    const final = !this.partial();
    const validation = this.validation();
    return this.lines().map((line) => {
      const input = this.inputs()[line.id] ?? defaultReceiptInput(line);
      return {
        line,
        shipped: toQty(line.shipped_qty),
        alreadyReceived: toQty(line.received_qty),
        alreadyDamaged: toQty(line.damaged_qty),
        input,
        variance: computeVariance(line, input, final),
        issues: validation.lineIssues[line.id] ?? [],
      };
    });
  });

  protected productName(id: string): string {
    const p = this.products().find((x) => x.id === id);
    return p ? `${p.sku} — ${p.name}` : id;
  }

  protected setGood(lineId: string, value: number | null): void {
    this.patch(lineId, { good: value ?? 0 });
  }

  protected setDamaged(lineId: string, value: number | null): void {
    this.patch(lineId, { damaged: value ?? 0 });
  }

  protected setReason(lineId: string, reason: string): void {
    this.patch(lineId, { reason });
  }

  /** One click: everything outstanding arrives undamaged. */
  protected receiveAll(): void {
    this.inputs.set(Object.fromEntries(this.lines().map((l) => [l.id, defaultReceiptInput(l)])));
  }

  protected close(): void {
    this.error.set(null);
    this.closed.emit();
  }

  protected confirm(): void {
    const transfer = this.transfer();
    if (!transfer || !this.validation().valid || this.busy()) return;
    const payload = buildReceivePayload(this.lines(), this.inputs(), !this.partial());
    this.busy.set(true);
    this.error.set(null);
    this.api.receiveTransfer(transfer.id, payload.lines ?? [], payload.final).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.message.success(this.i18n.translate('LOGISTICS.TRANSFER.MESSAGES.RECEIVED'));
        this.received.emit(res.data);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err) ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
      },
    });
  }

  private patch(lineId: string, change: Partial<ReceiptLineInput>): void {
    this.inputs.update((all) => ({
      ...all,
      [lineId]: { ...(all[lineId] ?? { good: 0, damaged: 0, reason: '' }), ...change },
    }));
  }
}
