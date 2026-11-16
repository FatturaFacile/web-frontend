import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  output,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  CARRIAGE_TERMS,
  CarriageTerms,
  I18nService,
  LogisticsApiService,
  LookupProduct,
  LookupWarehouse,
  StockTransferResource,
  TRANSPORT_BY,
  LogisticsTransportBy,
} from '@core';
import { TranslatePipe } from '@shared';
import {
  buildShipPayload,
  carrierRequired,
  ddtShowsPrices,
  ddtTypeForPurpose,
  draftsInterCompanyInvoice,
  ShipFormValue,
  transportReasonForPurpose,
} from '../../logistics.rules';
import {
  apiErrorMessage,
  carriageKey,
  ddtTypeKey,
  reasonKey,
  transferPurposeKey,
  transportByKey,
} from '../../logistics.ui';

/**
 * Dispatch wizard of an approved transfer. Step 1 collects the carrier and transport data, step 2 previews the fiscal
 * DDT the API generates on shipping (transport reason derived from the purpose) and, for inter-company transfers, warns
 * about the sales invoice that is drafted with it.
 */
@Component({
  selector: 'app-transfer-dispatch-drawer',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './transfer-dispatch-drawer.component.html',
  styles: `
    .stepper {
      margin-bottom: 24px;
    }
    .footer {
      display: flex;
      gap: 8px;
      margin-top: 24px;
    }
    .block {
      margin-bottom: 16px;
    }
  `,
})
export class TransferDispatchDrawerComponent {
  private readonly api = inject(LogisticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;

  /** The approved transfer to dispatch; `null` keeps the drawer closed. */
  readonly transfer = input<StockTransferResource | null>(null);
  readonly warehouses = input<LookupWarehouse[]>([]);
  readonly products = input<LookupProduct[]>([]);

  readonly closed = output<void>();
  readonly shipped = output<StockTransferResource>();

  protected readonly step = signal(0);
  protected readonly busy = signal(false);
  protected readonly error = signal<string | null>(null);

  protected readonly form = this.fb.group({
    transport_by: this.fb.control<LogisticsTransportBy>('carrier', Validators.required),
    carrier_name: this.fb.control(''),
    carrier_license_plate: this.fb.control('', Validators.maxLength(30)),
    carriage_terms: this.fb.control<CarriageTerms>('free', Validators.required),
    goods_appearance: this.fb.control('', Validators.maxLength(100)),
    packages_count: this.fb.control<number | null>(null),
    gross_weight_kg: this.fb.control<number | null>(null),
  });
  private readonly value = toSignal(this.form.valueChanges, {
    initialValue: this.form.getRawValue(),
  });

  protected readonly transportByOptions = computed(() =>
    TRANSPORT_BY.map((v) => ({ value: v, label: this.i18n.translate(transportByKey(v)) })),
  );
  protected readonly carriageOptions = computed(() =>
    CARRIAGE_TERMS.map((v) => ({ value: v, label: this.i18n.translate(carriageKey(v)) })),
  );

  protected readonly purposeKey = transferPurposeKey;
  protected readonly ddtTypeKey = ddtTypeKey;
  protected readonly reasonKey = reasonKey;
  protected readonly carriageKey = carriageKey;
  protected readonly transportByKey = transportByKey;

  protected readonly reason = computed(() => {
    const t = this.transfer();
    return t ? transportReasonForPurpose(t.purpose) : null;
  });
  protected readonly ddtType = computed(() => {
    const t = this.transfer();
    return t ? ddtTypeForPurpose(t.purpose) : null;
  });
  protected readonly showsPrices = computed(() => {
    const t = this.transfer();
    return t ? ddtShowsPrices(t.purpose) : false;
  });
  protected readonly interCompany = computed(() => {
    const t = this.transfer();
    return t ? draftsInterCompanyInvoice(t) : false;
  });
  protected readonly carrierMissing = computed(() => {
    const v = this.value();
    return carrierRequired(v.transport_by ?? 'carrier') && (v.carrier_name ?? '').trim() === '';
  });
  protected readonly canContinue = computed(() => this.form.valid && !this.carrierMissing());
  protected readonly summary = computed(() => buildShipPayload(this.shipValue()));

  protected warehouseName(id: string): string {
    const w = this.warehouses().find((x) => x.id === id);
    return w ? `${w.code} — ${w.name}` : id;
  }

  protected productName(id: string): string {
    const p = this.products().find((x) => x.id === id);
    return p ? `${p.sku} — ${p.name}` : id;
  }

  protected next(): void {
    if (this.canContinue()) this.step.set(1);
  }

  protected back(): void {
    this.step.set(0);
  }

  protected close(): void {
    this.reset();
    this.closed.emit();
  }

  protected confirm(): void {
    const transfer = this.transfer();
    if (!transfer || !this.canContinue() || this.busy()) return;
    this.busy.set(true);
    this.error.set(null);
    this.api.shipTransfer(transfer.id, buildShipPayload(this.shipValue())).subscribe({
      next: (res) => {
        this.busy.set(false);
        this.message.success(this.i18n.translate('LOGISTICS.TRANSFER.MESSAGES.SHIPPED'));
        this.reset();
        this.shipped.emit(res.data);
      },
      error: (err: unknown) => {
        this.busy.set(false);
        this.error.set(apiErrorMessage(err) ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
      },
    });
  }

  private shipValue(): ShipFormValue {
    const v = this.value();
    return {
      transport_by: v.transport_by ?? 'carrier',
      carrier_name: v.carrier_name ?? '',
      carrier_license_plate: v.carrier_license_plate ?? '',
      carriage_terms: v.carriage_terms ?? 'free',
      goods_appearance: v.goods_appearance ?? '',
      packages_count: v.packages_count ?? null,
      gross_weight_kg: v.gross_weight_kg ?? null,
    };
  }

  private reset(): void {
    this.step.set(0);
    this.error.set(null);
    this.form.reset({
      transport_by: 'carrier',
      carriage_terms: 'free',
      carrier_name: '',
      carrier_license_plate: '',
      goods_appearance: '',
      packages_count: null,
      gross_weight_kg: null,
    });
  }
}
