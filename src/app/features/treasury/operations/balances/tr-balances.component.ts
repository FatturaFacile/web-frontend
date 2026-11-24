import { Component, computed, DestroyRef, inject, OnInit, signal, TemplateRef, viewChild } from '@angular/core';
import { FormGroup, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTabsModule } from 'ng-zorro-antd/tabs';
import {
  applyServerErrors,
  BankBalanceSnapshot,
  FetchGridModel,
  FxBankRevaluation,
  I18nService,
  QueryFilterParams,
  PermissionsService,
  TreasuryMovement,
  TreasuryMovementType,
  TreasuryOpsApiService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { GlErrorAlertComponent } from '../../../general-ledger/shared/gl-error-alert.component';
import { TrLookupStore } from '../tr-lookup.store';
import { differentFrom, revalidateOnStartChange } from '@shared/utils/date-validators';

type ChargeType = 'bank_fee' | 'interest_income' | 'interest_expense';

@Component({
  selector: 'app-tr-balances',
  styleUrl: './tr-balances.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe, GridFilterListPipe, GridFilterFnPipe,
    IconActionDirective,
    ModalActionsDirective,
    FormsModule,
    ReactiveFormsModule,
    NzAlertModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTabsModule,
    BaseTableComponent,
    GlErrorAlertComponent,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tr-balances.component.html',
})
export class TrBalancesComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly banks = inject(TrLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly movementTypes: TreasuryMovementType[] = ['transfer', 'bank_fee', 'interest_income', 'interest_expense'];
  protected readonly chargeTypes: ChargeType[] = ['bank_fee', 'interest_income', 'interest_expense'];

  protected readonly balances = signal<BankBalanceSnapshot[]>([]);
  protected readonly revaluations = signal<FxBankRevaluation[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly modal = signal<'transfer' | 'charge' | null>(null);
  protected readonly formErrors = signal<string[]>([]);

  protected balanceDate = '';
  protected movementTypeFilter: TreasuryMovementType | null = null;

  /** Server-driven grid of the treasury movements: paging, sorting, column filters and grouping run on the API. */
  protected readonly movementGrid = new FetchGridModel<TreasuryMovement, QueryFilterParams & { movement_type?: TreasuryMovementType }>((query) =>
    this.api.getMovements(query),
  );

  private readonly movementAmountTpl = viewChild<TemplateRef<{ $implicit: TreasuryMovement; value: unknown }>>('movementAmountTpl');

  protected readonly movementColumns = computed<TableColumnDef<TreasuryMovement>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'movement_date', header: this.i18n.translate('TR.DATE'), width: '120px' },
      {
        key: 'movement_type',
        valueLabel: (value) => this.movementTypeLabel(value),
        valueGetter: (row) => this.movementTypeLabel(row.movement_type),
        header: this.i18n.translate('TR.MOVEMENT_TYPE'),
        width: '170px',
      },
      {
        key: 'bank_account_id',
        serverKey: 'bankAccount.bank_name',
        valueGetter: (row) => this.banks.label(row.bank_account_id),
        header: this.i18n.translate('TR.BANK_ACCOUNT'),
      },
      {
        key: 'counter_bank_account_id',
        serverKey: 'counterBankAccount.bank_name',
        valueGetter: (row) => (row.counter_bank_account_id ? this.banks.label(row.counter_bank_account_id) : ''),
        header: this.i18n.translate('TR.COUNTER_ACCOUNT'),
      },
      { key: 'amount', align: 'right', header: this.i18n.translate('TR.AMOUNT'), width: '150px', customCellTemplate: this.movementAmountTpl() },
      { key: 'description', header: this.i18n.translate('TR.DESCRIPTION') },
    ];
  });
  protected fxPeriodEnd = '';
  protected fxCurrency = '';

  protected readonly transferForm = this.fb.group({
    from_bank_account_id: this.fb.control('', Validators.required),
    to_bank_account_id: this.fb.control('', [Validators.required, differentFrom('from_bank_account_id')]),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    transfer_date: this.fb.control('', Validators.required),
    description: this.fb.control(''),
  });

  protected readonly chargeForm = this.fb.group({
    bank_account_id: this.fb.control('', Validators.required),
    movement_type: this.fb.control<ChargeType>('bank_fee', Validators.required),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    movement_date: this.fb.control('', Validators.required),
    description: this.fb.control(''),
  });

  constructor() {
    // The API requires the two accounts of a transfer to differ.
    revalidateOnStartChange(this.transferForm, 'from_bank_account_id', 'to_bank_account_id', inject(DestroyRef));
  }

  ngOnInit(): void {
    this.banks.load();
    this.loadBalances();
  }

  protected loadBalances(): void {
    this.loading.set(true);
    this.api.getBalances(this.balanceDate || undefined).subscribe({
      next: (res) => {
        this.balances.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected onMovementTypeChange(type: TreasuryMovementType | null): void {
    this.movementTypeFilter = type;
    this.movementGrid.setFilter({ movement_type: type ?? undefined });
  }

  private movementTypeLabel(type: string): string {
    return this.i18n.translate('TR.MOVEMENT_' + type.toUpperCase());
  }

  protected openModal(kind: 'transfer' | 'charge'): void {
    this.formErrors.set([]);
    if (kind === 'transfer') {
      this.transferForm.reset();
    } else {
      this.chargeForm.reset({ movement_type: 'bank_fee' });
    }
    this.modal.set(kind);
  }

  protected saveTransfer(): void {
    if (this.transferForm.invalid) {
      this.transferForm.markAllAsTouched();
      return;
    }
    const value = this.transferForm.getRawValue();
    this.submit(
      this.api.transfer({
        from_bank_account_id: value.from_bank_account_id,
        to_bank_account_id: value.to_bank_account_id,
        amount: value.amount ?? 0,
        transfer_date: value.transfer_date,
        description: value.description || null,
        idempotency_key: crypto.randomUUID(),
      }),
      this.transferForm,
    );
  }

  protected saveCharge(): void {
    if (this.chargeForm.invalid) {
      this.chargeForm.markAllAsTouched();
      return;
    }
    const value = this.chargeForm.getRawValue();
    this.submit(
      this.api.postBankCharge(value.bank_account_id, {
        movement_type: value.movement_type,
        amount: value.amount ?? 0,
        movement_date: value.movement_date,
        description: value.description || null,
        idempotency_key: crypto.randomUUID(),
      }),
      this.chargeForm,
    );
  }

  /** Revalues the foreign-currency bank accounts at the period end; the rate is never sent by the client. */
  protected revalue(): void {
    if (!this.fxPeriodEnd) {
      return;
    }
    this.error.set(null);
    this.api
      .revalueBankAccounts({ period_end_date: this.fxPeriodEnd, currency: this.fxCurrency.trim().toUpperCase() || null })
      .subscribe({
        next: (res) => {
          this.revaluations.set(res.data ?? []);
          this.message.success(this.i18n.translate('TR.FX_DONE'));
        },
        error: (err: unknown) => this.error.set(err),
      });
  }

  private submit(call: ReturnType<TreasuryOpsApiService['transfer']>, form: FormGroup): void {
    this.saving.set(true);
    call.subscribe({
      next: () => {
        this.saving.set(false);
        this.modal.set(null);
        this.message.success(this.i18n.translate('TR.MOVEMENT_SAVED'));
        this.loadBalances();
        this.movementGrid.reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(err);
        this.formErrors.set(applyServerErrors(form, err));
      },
    });
  }
}
