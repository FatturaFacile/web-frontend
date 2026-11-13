import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormGroup, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
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
import { NzTagModule } from 'ng-zorro-antd/tag';
import { Observable, of } from 'rxjs';
import {
  ApiResponse,
  applyServerErrors,
  CashRegister,
  CashRegisterClosing,
  CashRegisterMovement,
  FetchGridModel,
  I18nService,
  PaginatedResponse,
  PermissionsService,
  TreasuryOpsApiService,
} from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, MoneyPipe, TableColumnDef, TranslatePipe } from '@shared';
import { GlLookupStore } from '../../../general-ledger/shared/gl-lookup.store';
import { notInFuture } from '@shared/utils/date-validators';

const EMPTY_PAGE = { success: true, message: '', data: [], meta: { current_page: 1, from: null, last_page: 1, per_page: 10, to: null, total: 0 } };

@Component({
  selector: 'app-tr-cash-registers',
  styleUrl: './tr-cash-registers.component.scss',
  imports: [
    BaseTableComponent,
    IconActionDirective,
    ModalActionsDirective,
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
    NzTagModule,
    MoneyPipe,
    TranslatePipe,
  ],
  templateUrl: './tr-cash-registers.component.html',
})
export class TrCashRegistersComponent {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly gl = inject(GlLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly selected = signal<CashRegister | null>(null);
  protected readonly lastClosing = signal<CashRegisterClosing | null>(null);
  protected readonly saving = signal(false);
  protected readonly modal = signal<'register' | 'movement' | 'close' | null>(null);
  protected readonly formErrors = signal<string[]>([]);

  protected readonly registerForm = this.fb.group({
    code: this.fb.control('', [Validators.required, Validators.maxLength(30)]),
    name: this.fb.control('', [Validators.required, Validators.maxLength(150)]),
    currency: this.fb.control('EUR', [Validators.required, Validators.pattern(/^[A-Za-z]{3}$/)]),
    gl_account_id: this.fb.control('', Validators.required),
    opening_balance: this.fb.control<number | null>(null, Validators.min(0)),
  });

  protected readonly movementForm = this.fb.group({
    movement_date: this.fb.control('', [Validators.required, notInFuture]),
    direction: this.fb.control<'in' | 'out'>('in', Validators.required),
    payment_method: this.fb.control<'cash' | 'cheque'>('cash'),
    amount: this.fb.control<number | null>(null, [Validators.required, Validators.min(0.01)]),
    counter_account_id: this.fb.control('', Validators.required),
    description: this.fb.control('', [Validators.required, Validators.maxLength(255)]),
    reference: this.fb.control('', Validators.maxLength(100)),
  });

  protected readonly closeForm = this.fb.group({
    closing_date: this.fb.control('', [Validators.required, notInFuture]),
    counted_balance: this.fb.control<number | null>(null, [Validators.required, Validators.min(0)]),
    notes: this.fb.control('', Validators.maxLength(1000)),
  });

  /** Server-driven grids: paging, sorting, column filters and grouping run on the API. */
  protected readonly registerGrid = new FetchGridModel<CashRegister>((query) => this.api.getCashRegisters(query));
  protected readonly movementGrid = new FetchGridModel<CashRegisterMovement>((query) => this.forOpenRegister((id) => this.api.getCashRegisterMovements(id, query)));
  protected readonly closingGrid = new FetchGridModel<CashRegisterClosing>((query) => this.forOpenRegister((id) => this.api.getCashRegisterClosings(id, query)));

  private readonly registerBalanceTpl = viewChild<TemplateRef<{ $implicit: CashRegister; value: unknown }>>('registerBalanceTpl');
  private readonly movementDirectionTpl = viewChild<TemplateRef<{ $implicit: CashRegisterMovement; value: unknown }>>('movementDirectionTpl');
  private readonly movementAmountTpl = viewChild<TemplateRef<{ $implicit: CashRegisterMovement; value: unknown }>>('movementAmountTpl');
  private readonly closingAmountTpl = viewChild<TemplateRef<{ $implicit: CashRegisterClosing; value: unknown }>>('closingAmountTpl');

  protected readonly registerColumns = computed<TableColumnDef<CashRegister>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'code', header: this.i18n.translate('TR.CODE'), width: '140px' },
      { key: 'name', header: this.i18n.translate('TR.NAME') },
      { key: 'current_balance', align: 'right', header: this.i18n.translate('TR.CURRENT_BALANCE'), width: '160px', customCellTemplate: this.registerBalanceTpl() },
      { key: 'last_closed_date', header: this.i18n.translate('TR.LAST_CLOSED'), width: '140px' },
    ];
  });

  protected readonly movementColumns = computed<TableColumnDef<CashRegisterMovement>[]>(() => {
    this.i18n.currentLanguage();
    return [
      { key: 'movement_date', header: this.i18n.translate('TR.DATE'), width: '120px' },
      {
        key: 'direction',
        valueLabel: (value) => this.i18n.translate('TR.DIRECTION_' + value.toUpperCase()),
        valueGetter: (row) => this.i18n.translate('TR.DIRECTION_' + row.direction.toUpperCase()),
        header: this.i18n.translate('TR.DIRECTION'),
        width: '130px',
        customCellTemplate: this.movementDirectionTpl(),
      },
      { key: 'payment_method', header: this.i18n.translate('TR.PAYMENT_METHOD'), width: '140px' },
      { key: 'description', header: this.i18n.translate('TR.DESCRIPTION') },
      { key: 'amount', align: 'right', header: this.i18n.translate('TR.AMOUNT'), width: '150px', customCellTemplate: this.movementAmountTpl() },
    ];
  });

  protected readonly closingColumns = computed<TableColumnDef<CashRegisterClosing>[]>(() => {
    this.i18n.currentLanguage();
    const amount = (key: keyof CashRegisterClosing, header: string): TableColumnDef<CashRegisterClosing> => ({
      key,
      align: 'right',
      header: this.i18n.translate(header),
      width: '140px',
      customCellTemplate: this.closingAmountTpl(),
    });
    return [
      { key: 'closing_date', header: this.i18n.translate('TR.DATE'), width: '120px' },
      amount('opening_balance', 'TR.OPENING'),
      amount('total_in', 'TR.TOTAL_IN'),
      amount('total_out', 'TR.TOTAL_OUT'),
      amount('expected_balance', 'TR.EXPECTED'),
      amount('counted_balance', 'TR.COUNTED'),
      amount('difference', 'TR.CLOSING_DIFFERENCE'),
    ];
  });

  constructor() {
    this.gl.load();
  }

  /** Loads a page of a sub-list of the open cash register; nothing is requested while no register is open. */
  private forOpenRegister<T>(load: (registerId: string) => Observable<PaginatedResponse<T>>): Observable<PaginatedResponse<T>> {
    const id = this.selected()?.id;
    return id ? load(id) : of(EMPTY_PAGE as PaginatedResponse<T>);
  }

  protected open(register: CashRegister): void {
    if (this.selected()?.id !== register.id) {
      this.lastClosing.set(null);
    }
    this.selected.set(register);
    this.api.getCashRegister(register.id).subscribe({ next: (res) => this.selected.set(res.data) });
    this.movementGrid.reload();
    this.closingGrid.reload();
  }

  protected openModal(kind: 'register' | 'movement' | 'close'): void {
    this.formErrors.set([]);
    if (kind === 'register') {
      this.registerForm.reset({ currency: 'EUR' });
    } else if (kind === 'movement') {
      this.movementForm.reset({ direction: 'in', payment_method: 'cash' });
    } else {
      this.closeForm.reset();
    }
    this.modal.set(kind);
  }

  protected saveRegister(): void {
    if (this.registerForm.invalid) {
      this.registerForm.markAllAsTouched();
      return;
    }
    const value = this.registerForm.getRawValue();
    this.run(
      this.api.createCashRegister({ ...value, currency: value.currency.toUpperCase() }),
      this.registerForm,
      () => this.registerGrid.reload(),
    );
  }

  protected saveMovement(): void {
    const register = this.selected();
    if (!register || this.movementForm.invalid) {
      this.movementForm.markAllAsTouched();
      return;
    }
    const value = this.movementForm.getRawValue();
    this.run(
      this.api.addCashRegisterMovement(register.id, {
        ...value,
        amount: value.amount ?? 0,
        reference: value.reference || null,
        idempotency_key: crypto.randomUUID(),
      }),
      this.movementForm,
      () => this.open(register),
    );
  }

  protected saveClose(): void {
    const register = this.selected();
    if (!register || this.closeForm.invalid) {
      this.closeForm.markAllAsTouched();
      return;
    }
    const value = this.closeForm.getRawValue();
    this.run(
      this.api.closeCashRegisterDay(register.id, {
        closing_date: value.closing_date,
        counted_balance: value.counted_balance ?? 0,
        notes: value.notes || null,
      }),
      this.closeForm,
      () => {
        this.open(register);
        this.registerGrid.reload();
      },
      (res) => this.lastClosing.set(res as CashRegisterClosing),
    );
  }

  private run(
    call: Observable<ApiResponse<unknown>>,
    form: FormGroup,
    reload: () => void,
    onData?: (data: unknown) => void,
  ): void {
    this.saving.set(true);
    call.subscribe({
      next: (res) => {
        this.saving.set(false);
        this.modal.set(null);
        this.message.success(this.i18n.translate('TR.SAVED'));
        onData?.(res.data);
        reload();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(form, err));
      },
    });
  }
}
