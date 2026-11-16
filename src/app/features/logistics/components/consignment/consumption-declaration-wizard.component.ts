import { CurrencyPipe } from '@angular/common';
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
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  ConsignmentAgreement,
  ConsignmentLedgerWarehouse,
  ConsumptionReport,
  I18nService,
  LogisticsApiService,
  LookupProduct,
} from '@core';
import { TranslatePipe } from '@shared';
import {
  DeclarationLineIssue,
  declarationTotals,
  directionForWarehouseType,
  generatedDocumentKind,
  toIsoDate,
  validateDeclarationLine,
} from '../../logistics.rules';
import { apiErrorMessage } from '../../logistics.ui';

interface DraftLine {
  product_id: string;
  quantity: number;
  unit_price: number;
  tax_rate: number;
}

interface DraftRow {
  index: number;
  line: DraftLine;
  residual: number;
  issues: DeclarationLineIssue[];
  net: number;
  tax: number;
  gross: number;
}

const EMPTY_LINE: DraftLine = { product_id: '', quantity: 1, unit_price: 0, tax_rate: 22 };

/**
 * Periodic consumption declaration wizard. Step 1 picks the period and the consumed quantities (bounded by the stock
 * the third party still holds); step 2 previews the document the API generates in one go (sales invoice for customer
 * consignment, purchase order for vendor consignment) with totals computed from the same lines.
 */
@Component({
  selector: 'app-consumption-declaration-wizard',
  imports: [
    CurrencyPipe,
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDescriptionsModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consumption-declaration-wizard.component.html',
  styles: `
    .stepper,
    .block {
      margin-bottom: 16px;
    }
    .field {
      display: block;
      margin-bottom: 4px;
      font-weight: 500;
    }
    .wide {
      width: 100%;
    }
    .num {
      text-align: right;
      white-space: nowrap;
    }
    .issue {
      color: var(--ant-color-error, #ff4d4f);
      display: block;
      font-size: 12px;
    }
    .invalid {
      background: var(--ant-color-error-bg, #fff2f0);
    }
    .totals {
      margin-top: 12px;
      text-align: right;
    }
  `,
})
export class ConsumptionDeclarationWizardComponent {
  private readonly api = inject(LogisticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Warehouse the consumption is declared on; `null` keeps the wizard closed. */
  readonly warehouse = input<ConsignmentLedgerWarehouse | null>(null);
  readonly products = input<LookupProduct[]>([]);
  /** Active agreements; only those of the warehouse are offered. */
  readonly agreements = input<ConsignmentAgreement[]>([]);

  readonly closed = output<void>();
  readonly declared = output<ConsumptionReport>();

  protected readonly step = linkedSignal<ConsignmentLedgerWarehouse | null, number>({
    source: this.warehouse,
    computation: () => 0,
  });
  protected readonly period = linkedSignal<ConsignmentLedgerWarehouse | null, Date[]>({
    source: this.warehouse,
    computation: () => [],
  });
  protected readonly agreementId = linkedSignal<ConsignmentLedgerWarehouse | null, string | null>({
    source: this.warehouse,
    computation: () => null,
  });
  protected readonly notes = linkedSignal<ConsignmentLedgerWarehouse | null, string>({
    source: this.warehouse,
    computation: () => '',
  });
  protected readonly lines = linkedSignal<ConsignmentLedgerWarehouse | null, DraftLine[]>({
    source: this.warehouse,
    computation: () => [{ ...EMPTY_LINE }],
  });
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly direction = computed(() => {
    const w = this.warehouse();
    return w ? directionForWarehouseType(w.warehouse_type) : null;
  });
  protected readonly documentKind = computed(() => {
    const direction = this.direction();
    return direction ? generatedDocumentKind(direction) : null;
  });

  protected readonly productOptions = computed(() =>
    (this.warehouse()?.rows ?? [])
      .filter((r) => r.residual_qty > 0)
      .map((r) => ({ value: r.product_id, label: `${r.sku ?? ''} — ${r.name ?? ''}` })),
  );
  protected readonly agreementOptions = computed(() => {
    const w = this.warehouse();
    return this.agreements()
      .filter((a) => a.status === 'active' && a.warehouse_id === w?.warehouse_id)
      .map((a) => ({ value: a.id, label: a.agreement_number }));
  });

  /** Lines with their stock limit, issues and amounts: everything the template shows is derived here. */
  protected readonly rows = computed<DraftRow[]>(() => {
    const ledger = this.warehouse()?.rows ?? [];
    const lines = this.lines();
    const totals = declarationTotals(lines);
    return lines.map((line, index) => {
      const residual = ledger.find((r) => r.product_id === line.product_id)?.residual_qty ?? 0;
      return {
        index,
        line,
        residual,
        issues: line.product_id === '' ? [] : validateDeclarationLine(line.quantity, residual),
        ...totals.lines[index],
      };
    });
  });
  protected readonly totals = computed(() => declarationTotals(this.lines()));
  protected readonly stepOneValid = computed(
    () =>
      this.period().length === 2 &&
      this.lines().length > 0 &&
      this.lines().every((l) => l.product_id !== '') &&
      this.rows().every((r) => r.issues.length === 0),
  );
  protected readonly periodLabel = computed(() => {
    const [start, end] = this.period();
    return start && end ? `${toIsoDate(start)} → ${toIsoDate(end)}` : '';
  });
  protected readonly agreementLabel = computed(
    () => this.agreementOptions().find((o) => o.value === this.agreementId())?.label ?? null,
  );

  protected productLabel(id: string): string {
    return this.productOptions().find((o) => o.value === id)?.label ?? id;
  }

  protected setProduct(index: number, productId: string | null): void {
    const product = this.products().find((p) => p.id === productId);
    const direction = this.direction();
    this.patch(index, {
      product_id: productId ?? '',
      // Same defaults the API applies: sale price towards customers, cost price towards vendors.
      unit_price: product
        ? Number(direction === 'vendor' ? product.cost_price : product.sale_price)
        : 0,
      tax_rate: product ? Number(product.tax_rate) : 22,
    });
  }

  protected setNumber(
    index: number,
    field: 'quantity' | 'unit_price' | 'tax_rate',
    value: number | null,
  ): void {
    this.patch(index, { [field]: value ?? 0 });
  }

  protected addLine(): void {
    this.lines.update((all) => [...all, { ...EMPTY_LINE }]);
  }

  protected removeLine(index: number): void {
    this.lines.update((all) => (all.length > 1 ? all.filter((_, i) => i !== index) : all));
  }

  protected next(): void {
    if (this.stepOneValid()) this.step.set(1);
  }

  protected back(): void {
    this.step.set(0);
  }

  protected close(): void {
    this.error.set(null);
    this.closed.emit();
  }

  protected confirm(): void {
    const warehouse = this.warehouse();
    const [start, end] = this.period();
    if (!warehouse || !start || !end || !this.stepOneValid() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    const notes = this.notes().trim();
    this.api
      .createDeclaration({
        warehouse_id: warehouse.warehouse_id,
        agreement_id: this.agreementId() ?? undefined,
        period_start: toIsoDate(start),
        period_end: toIsoDate(end),
        notes: notes === '' ? undefined : notes,
        lines: this.lines().map((l) => ({
          product_id: l.product_id,
          quantity: l.quantity,
          unit_price: l.unit_price,
          tax_rate: l.tax_rate,
        })),
      })
      .subscribe({
        next: (res) => {
          this.busy.set(false);
          this.message.success(
            this.i18n.translate(
              res.data.direction === 'customer'
                ? 'LOGISTICS.CONSIGNMENT.INVOICE_CREATED'
                : 'LOGISTICS.CONSIGNMENT.PO_CREATED',
            ),
          );
          this.declared.emit(res.data);
        },
        error: (err: unknown) => {
          this.busy.set(false);
          this.error.set(apiErrorMessage(err) ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
        },
      });
  }

  private patch(index: number, change: Partial<DraftLine>): void {
    this.lines.update((all) => all.map((l, i) => (i === index ? { ...l, ...change } : l)));
  }
}
