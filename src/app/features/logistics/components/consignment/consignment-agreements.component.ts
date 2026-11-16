import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  AuthStore,
  CONSIGNMENT_BILLING_FREQUENCIES,
  ConsignmentAgreement,
  ConsignmentBillingFrequency,
  I18nService,
  LOGISTICS_PERMISSIONS,
  LogisticsApiService,
  LookupPartner,
  LookupWarehouse,
} from '@core';
import { TranslatePipe } from '@shared';
import { toIsoDate } from '../../logistics.rules';
import { apiErrorMessage } from '../../logistics.ui';

/** Agreements governing goods at customers (we consign) and vendor goods held by us: list, create and terminate. */
@Component({
  selector: 'app-consignment-agreements',
  imports: [
    DatePipe,
    ReactiveFormsModule,
    NzButtonModule,
    NzDatePickerModule,
    NzDrawerModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    TranslatePipe,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './consignment-agreements.component.html',
  styles: `
    .toolbar {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 12px;
    }
    .footer {
      margin-top: 24px;
    }
  `,
})
export class ConsignmentAgreementsComponent implements OnInit {
  private readonly api = inject(LogisticsApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly fb = inject(FormBuilder).nonNullable;
  protected readonly auth = inject(AuthStore);

  protected readonly perm = LOGISTICS_PERMISSIONS;
  protected readonly agreements = signal<ConsignmentAgreement[]>([]);
  protected readonly warehouses = signal<LookupWarehouse[]>([]);
  protected readonly partners = signal<LookupPartner[]>([]);
  protected readonly loading = signal(false);
  protected readonly busy = signal(false);
  protected readonly createVisible = signal(false);

  protected readonly form = this.fb.group({
    warehouse_id: this.fb.control('', Validators.required),
    partner_id: this.fb.control(''),
    agreement_number: this.fb.control('', Validators.maxLength(50)),
    period: this.fb.control<Date[]>([], Validators.required),
    billing_frequency: this.fb.control<ConsignmentBillingFrequency>('monthly'),
    payment_terms_days: this.fb.control(30, [Validators.min(0), Validators.max(365)]),
    notes: this.fb.control(''),
  });

  protected readonly warehouseOptions = computed(() =>
    this.warehouses()
      .filter((w) => w.warehouse_type === 'customer_consignment' || w.warehouse_type === 'vendor_consignment')
      .map((w) => ({ value: w.id, label: `${w.code} — ${w.name}` })),
  );
  protected readonly partnerOptions = computed(() =>
    this.partners().map((p) => ({ value: p.id, label: this.partnerName(p) })),
  );
  protected readonly frequencyOptions = computed(() =>
    CONSIGNMENT_BILLING_FREQUENCIES.map((value) => ({
      value,
      label: this.i18n.translate(`LOGISTICS.AGREEMENT.FREQUENCY.${value.toUpperCase()}`),
    })),
  );

  ngOnInit(): void {
    this.reload();
    this.api.warehouses().subscribe((res) => this.warehouses.set(res.data));
    this.api.partners().subscribe((res) => this.partners.set(res.data));
  }

  protected reload(): void {
    this.loading.set(true);
    this.api.listAgreements().subscribe({
      next: (res) => {
        this.agreements.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected warehouseName(id: string): string {
    const w = this.warehouses().find((x) => x.id === id);
    return w ? `${w.code} — ${w.name}` : id;
  }

  protected partnerLabel(id: string): string {
    const p = this.partners().find((x) => x.id === id);
    return p ? this.partnerName(p) : id;
  }

  protected openCreate(): void {
    this.form.reset({ billing_frequency: 'monthly', payment_terms_days: 30, period: [] });
    this.createVisible.set(true);
  }

  protected create(): void {
    if (this.form.invalid || this.busy()) return;
    const v = this.form.getRawValue();
    const [from, to] = v.period;
    if (!from) return;
    this.busy.set(true);
    this.api
      .createAgreement({
        warehouse_id: v.warehouse_id,
        partner_id: v.partner_id || undefined,
        agreement_number: v.agreement_number.trim() || undefined,
        valid_from: toIsoDate(from),
        valid_to: to ? toIsoDate(to) : undefined,
        billing_frequency: v.billing_frequency,
        payment_terms_days: v.payment_terms_days,
        notes: v.notes.trim() || undefined,
      })
      .subscribe({
        next: () => {
          this.busy.set(false);
          this.createVisible.set(false);
          this.message.success(this.i18n.translate('LOGISTICS.AGREEMENT.CREATED'));
          this.reload();
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  protected confirmTerminate(agreement: ConsignmentAgreement): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('LOGISTICS.AGREEMENT.TERMINATE_CONFIRM'),
      nzOkDanger: true,
      nzOkText: this.i18n.translate('LOGISTICS.AGREEMENT.TERMINATE'),
      nzCancelText: this.i18n.translate('LOGISTICS.CANCEL'),
      nzOnOk: () => this.terminate(agreement),
    });
  }

  private terminate(agreement: ConsignmentAgreement): void {
    this.api.terminateAgreement(agreement.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('LOGISTICS.AGREEMENT.TERMINATED'));
        this.reload();
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private partnerName(p: LookupPartner): string {
    return p.company_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || p.id;
  }

  private fail(err: unknown): void {
    this.busy.set(false);
    this.message.error(apiErrorMessage(err) ?? this.i18n.translate('LOGISTICS.ERRORS.GENERIC'));
  }
}
