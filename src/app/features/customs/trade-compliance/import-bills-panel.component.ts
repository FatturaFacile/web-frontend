import { ChangeDetectionStrategy, Component, computed, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { startWith } from 'rxjs';
import {
  applyServerErrors,
  AuthStore,
  CustomsApiService,
  CustomsDeclarationResource,
  CustomsImportBillReconciliation,
  CustomsImportBillRequest,
  CustomsImportBillResource,
  TranslateService,
} from '@core';
import { ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { billStatusColor, computeImportVat } from './trade-compliance.utils';

const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/** Import customs bills: list, guided entry with the import VAT preview, reconciliation and posting. */
@Component({
  selector: 'app-import-bills-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzEmptyModule,
    NzFormModule,
    NzIconModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSelectModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
    ModalActionsDirective,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <div class="toolbar">
      <button nz-button nzType="primary" (click)="openCreate()">
        <nz-icon nzType="plus" />
        {{ 'CUSTOMS_TRADE.NEW_BILL' | translate }}
      </button>
      <button nz-button (click)="load(page())">
        <nz-icon nzType="reload" />
        {{ 'COMMON.REFRESH' | translate }}
      </button>
    </div>

    <nz-table
      #billsTable
      nzSize="middle"
      [nzData]="bills()"
      [nzLoading]="loading()"
      [nzTotal]="total()"
      [nzPageIndex]="page()"
      [nzPageSize]="pageSize()"
      [nzFrontPagination]="false"
      (nzQueryParams)="onQueryParams($event)"
    >
      <thead>
        <tr>
          <th>{{ 'CUSTOMS_TRADE.BILL_NUMBER' | translate }}</th>
          <th>{{ 'CUSTOMS_TRADE.BILL_DATE' | translate }}</th>
          <th>{{ 'CUSTOMS_TRADE.CUSTOMS_VALUE' | translate }}</th>
          <th>{{ 'CUSTOMS_TRADE.DUTY' | translate }}</th>
          <th>{{ 'CUSTOMS_TRADE.IMPORT_VAT' | translate }}</th>
          <th>{{ 'CUSTOMS.COLS.STATUS' | translate }}</th>
          <th>{{ 'COMMON.ACTIONS' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (bill of billsTable.data; track bill.id) {
          <tr>
            <td>
              <strong>{{ bill.bill_number }}</strong>
            </td>
            <td>{{ bill.bill_date.slice(0, 10) }}</td>
            <td>{{ bill.customs_value | money: bill.currency }}</td>
            <td>{{ bill.duty_amount | money: bill.currency }}</td>
            <td>{{ bill.import_vat_amount | money: bill.currency }}</td>
            <td>
              <nz-tag [nzColor]="statusColor(bill)">{{ 'CUSTOMS_TRADE.BILL_STATUS.' + bill.status | translate }}</nz-tag>
            </td>
            <td>
              <button nz-button nzType="link" nzSize="small" (click)="openReconciliation(bill)">
                {{ 'CUSTOMS_TRADE.RECONCILIATION' | translate }}
              </button>
              @if (bill.status === 'draft') {
                <button
                  nz-button
                  nzType="link"
                  nzSize="small"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'CUSTOMS_TRADE.POST_CONFIRM' | translate"
                  (nzOnConfirm)="post(bill)"
                >
                  {{ 'CUSTOMS_TRADE.POST_BILL' | translate }}
                </button>
              }
            </td>
          </tr>
        } @empty {
          @if (!loading()) {
            <tr>
              <td colspan="7"><nz-empty nzNotFoundImage="simple" /></td>
            </tr>
          }
        }
      </tbody>
    </nz-table>

    <nz-modal
      okAction="save"
      [nzVisible]="createVisible()"
      [nzTitle]="'CUSTOMS_TRADE.NEW_BILL' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="form.invalid"
      (nzOnCancel)="createVisible.set(false)"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <ng-template #fieldTip let-control>
            @if (control.errors?.['serverError']) {
              {{ control.errors['serverError'] }}
            } @else if (control.hasError('required')) {
              {{ 'COMMON.VALIDATION.REQUIRED' | translate }}
            } @else {
              {{ 'COMMON.VALIDATION.INVALID_VALUE' | translate }}
            }
          </ng-template>
          <div class="grid">
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CUSTOMS_TRADE.BILL_NUMBER' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <input nz-input formControlName="bill_number" maxlength="40" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CUSTOMS_TRADE.BILL_DATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <input nz-input type="date" formControlName="bill_date" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CUSTOMS_TRADE.CURRENCY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <input nz-input formControlName="currency" maxlength="3" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CUSTOMS_TRADE.VAT_RATE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <nz-input-number formControlName="vat_rate" [nzMin]="0" [nzMax]="100" [nzStep]="0.1" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CUSTOMS_TRADE.CUSTOMS_VALUE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <nz-input-number formControlName="customs_value" [nzMin]="0" [nzStep]="1" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label nzRequired>{{ 'CUSTOMS_TRADE.DUTY' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <nz-input-number formControlName="duty_amount" [nzMin]="0" [nzStep]="1" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CUSTOMS_TRADE.ANCILLARY_COSTS' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <nz-input-number formControlName="ancillary_costs" [nzMin]="0" [nzStep]="1" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CUSTOMS_TRADE.VAT_PREVIEW' | translate }}</nz-form-label>
              <nz-form-control>
                <strong class="vat-preview">{{ vatPreview() | money: currencyPreview() }}</strong>
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'CUSTOMS_TRADE.DECLARATION' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="fieldTip">
              <nz-select formControlName="declaration_id" nzAllowClear nzShowSearch>
                @for (decl of declarations(); track decl.id) {
                  <nz-option [nzValue]="decl.id" [nzLabel]="decl.trader_declaration_number" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <div class="grid">
            <nz-form-item>
              <nz-form-label>{{ 'CUSTOMS_TRADE.BROKER_INVOICE_REFERENCE' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <input nz-input formControlName="broker_invoice_reference" maxlength="50" />
              </nz-form-control>
            </nz-form-item>
            <nz-form-item>
              <nz-form-label>{{ 'CUSTOMS_TRADE.PASSIVE_INVOICE_ID' | translate }}</nz-form-label>
              <nz-form-control [nzErrorTip]="fieldTip">
                <input nz-input class="mono" formControlName="passive_invoice_id" />
              </nz-form-control>
            </nz-form-item>
          </div>
          <nz-form-item>
            <nz-form-label>{{ 'CUSTOMS_TRADE.NOTES' | translate }}</nz-form-label>
            <nz-form-control [nzErrorTip]="fieldTip">
              <textarea nz-input rows="2" maxlength="2000" formControlName="notes"></textarea>
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>

    <nz-modal
      [nzVisible]="reconciliationBill() !== null"
      [nzTitle]="'CUSTOMS_TRADE.RECONCILIATION' | translate"
      [nzFooter]="null"
      (nzOnCancel)="reconciliationBill.set(null)"
    >
      <ng-container *nzModalContent>
        @if (reconciliation(); as rec) {
          <dl class="rec">
            <dt>{{ 'CUSTOMS_TRADE.BILL_TOTAL' | translate }}</dt>
            <dd>{{ rec.bill_total | money: reconciliationBill()?.currency }}</dd>
            <dt>{{ 'CUSTOMS_TRADE.SUPPLIER_TOTAL' | translate }}</dt>
            <dd>{{ rec.supplier_total === null ? '-' : (rec.supplier_total | money: reconciliationBill()?.currency) }}</dd>
            <dt>{{ 'CUSTOMS_TRADE.REMAINDER' | translate }}</dt>
            <dd>{{ rec.remainder === null ? '-' : (rec.remainder | money: reconciliationBill()?.currency) }}</dd>
          </dl>
          @if (rec.supplier_total === null) {
            <nz-alert nzType="info" nzShowIcon [nzMessage]="'CUSTOMS_TRADE.NO_SUPPLIER_INVOICE' | translate" />
          } @else if (rec.matches) {
            <nz-alert nzType="success" nzShowIcon [nzMessage]="'CUSTOMS_TRADE.RECONCILED' | translate" />
          } @else {
            <nz-alert nzType="warning" nzShowIcon [nzMessage]="'CUSTOMS_TRADE.NOT_RECONCILED' | translate" />
          }
        } @else {
          <nz-spin nzSimple />
        }
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .toolbar {
      display: flex;
      gap: var(--space-3, 12px);
      margin-bottom: var(--space-4, 16px);
    }
    .grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 0 var(--space-4, 16px);
    }
    nz-input-number,
    nz-select {
      width: 100%;
    }
    .vat-preview {
      line-height: 32px;
    }
    .mono {
      font-family: var(--font-mono, monospace);
    }
    .rec {
      display: grid;
      grid-template-columns: 1fr auto;
      gap: var(--space-2, 8px) var(--space-4, 16px);
      margin-bottom: var(--space-4, 16px);
    }
    .rec dd {
      margin: 0;
      text-align: right;
      font-weight: 600;
    }
  `,
})
export class ImportBillsPanelComponent implements OnInit {
  private readonly api = inject(CustomsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly authStore = inject(AuthStore);

  readonly loading = signal(false);
  readonly bills = signal<CustomsImportBillResource[]>([]);
  readonly total = signal(0);
  readonly page = signal(1);
  readonly pageSize = signal(10);

  readonly createVisible = signal(false);
  readonly saving = signal(false);
  /** Import declarations a bill can be attached to. */
  readonly declarations = signal<CustomsDeclarationResource[]>([]);

  readonly reconciliationBill = signal<CustomsImportBillResource | null>(null);
  readonly reconciliation = signal<CustomsImportBillReconciliation | null>(null);

  readonly form = this.fb.group({
    bill_number: this.fb.control('', [Validators.required, Validators.maxLength(40)]),
    bill_date: this.fb.control('', [Validators.required]),
    currency: this.fb.control(this.authStore.activeCurrency(), [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]),
    customs_value: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    duty_amount: this.fb.control<number | null>(0, [Validators.required, Validators.min(0)]),
    ancillary_costs: this.fb.control<number | null>(null, [Validators.min(0)]),
    vat_rate: this.fb.control<number | null>(null, [Validators.required, Validators.min(0), Validators.max(100)]),
    declaration_id: this.fb.control<string | null>(null),
    passive_invoice_id: this.fb.control('', [Validators.pattern(UUID_PATTERN)]),
    broker_invoice_reference: this.fb.control('', [Validators.maxLength(50)]),
    notes: this.fb.control('', [Validators.maxLength(2000)]),
  });

  private readonly formValue = toSignal(this.form.valueChanges.pipe(startWith(this.form.getRawValue())), {
    initialValue: this.form.getRawValue(),
  });

  /** Import VAT shown while typing: (value + duty + ancillary costs) * rate / 100, rounded to 2 decimals. */
  readonly vatPreview = computed(() => {
    const v = this.formValue();
    return computeImportVat(v.customs_value, v.duty_amount, v.ancillary_costs, v.vat_rate);
  });
  readonly currencyPreview = computed(() => (this.formValue().currency ?? '').toUpperCase() || this.authStore.activeCurrency());

  ngOnInit(): void {
    this.load(1);
  }

  load(page: number): void {
    this.page.set(page);
    this.loading.set(true);
    this.api
      .getImportBills({ page, per_page: this.pageSize() })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.bills.set(res.data);
          this.total.set(res.meta?.total ?? res.data.length);
          this.loading.set(false);
        },
        error: () => this.loading.set(false),
      });
  }

  onQueryParams(params: NzTableQueryParams): void {
    this.pageSize.set(params.pageSize);
    this.load(params.pageIndex);
  }

  statusColor(bill: CustomsImportBillResource): string {
    return billStatusColor(bill.status);
  }

  openCreate(): void {
    this.form.reset({
      bill_number: '',
      bill_date: new Date().toISOString().slice(0, 10),
      currency: this.authStore.activeCurrency(),
      customs_value: null,
      duty_amount: 0,
      ancillary_costs: null,
      vat_rate: null,
      declaration_id: null,
      passive_invoice_id: '',
      broker_invoice_reference: '',
      notes: '',
    });
    this.api
      .getDeclarations({ declaration_type: 'import', per_page: 100 })
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.declarations.set(res.data),
        error: () => this.declarations.set([]),
      });
    this.createVisible.set(true);
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const v = this.form.getRawValue();
    const payload: CustomsImportBillRequest = {
      bill_number: v.bill_number.trim(),
      bill_date: v.bill_date,
      currency: v.currency.trim().toUpperCase(),
      customs_value: v.customs_value ?? 0,
      duty_amount: v.duty_amount ?? 0,
      ancillary_costs: v.ancillary_costs,
      vat_rate: v.vat_rate ?? 0,
      declaration_id: v.declaration_id || null,
      passive_invoice_id: v.passive_invoice_id.trim() || null,
      broker_invoice_reference: v.broker_invoice_reference.trim() || null,
      notes: v.notes.trim() || null,
    };
    this.saving.set(true);
    this.api
      .createImportBill(payload)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.createVisible.set(false);
          this.message.success(this.translate.translate('CUSTOMS_TRADE.BILL_CREATED'));
          this.load(1);
        },
        error: (err: unknown) => {
          this.saving.set(false);
          const unmapped = applyServerErrors(this.form, err);
          if (unmapped.length > 0) {
            this.message.error(unmapped[0]);
          }
        },
      });
  }

  openReconciliation(bill: CustomsImportBillResource): void {
    this.reconciliationBill.set(bill);
    this.reconciliation.set(null);
    this.api
      .getImportBillReconciliation(bill.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => this.reconciliation.set(res.data),
        error: () => this.reconciliationBill.set(null),
      });
  }

  post(bill: CustomsImportBillResource): void {
    this.api
      .postImportBill(bill.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          this.message.success(this.translate.translate('CUSTOMS_TRADE.BILL_POSTED'));
          this.load(this.page());
        },
      });
  }
}
