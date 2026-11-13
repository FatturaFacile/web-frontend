import { Component, inject, OnInit, signal } from '@angular/core';
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
import { Observable } from 'rxjs';
import {
  ApiResponse,
  applyServerErrors,
  CashRegister,
  CashRegisterClosing,
  CashRegisterMovement,
  I18nService,
  PermissionsService,
  TreasuryOpsApiService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, MoneyPipe, TranslatePipe } from '@shared';
import { GlLookupStore } from '../../../general-ledger/shared/gl-lookup.store';
import { notInFuture } from '@shared/utils/date-validators';

@Component({
  selector: 'app-tr-cash-registers',
  styleUrl: './tr-cash-registers.component.scss',
  imports: [
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
export class TrCashRegistersComponent implements OnInit {
  private readonly api = inject(TreasuryOpsApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly gl = inject(GlLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('treasury');

  protected readonly registers = signal<CashRegister[]>([]);
  protected readonly selected = signal<CashRegister | null>(null);
  protected readonly movements = signal<CashRegisterMovement[]>([]);
  protected readonly closings = signal<CashRegisterClosing[]>([]);
  protected readonly lastClosing = signal<CashRegisterClosing | null>(null);
  protected readonly loading = signal(false);
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

  ngOnInit(): void {
    this.gl.load();
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getCashRegisters().subscribe({
      next: (res) => {
        this.registers.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected open(register: CashRegister): void {
    if (this.selected()?.id !== register.id) {
      this.lastClosing.set(null);
    }
    this.selected.set(register);
    this.api.getCashRegister(register.id).subscribe({ next: (res) => this.selected.set(res.data) });
    this.api.getCashRegisterMovements(register.id).subscribe({ next: (res) => this.movements.set(res.data ?? []) });
    this.api.getCashRegisterClosings(register.id).subscribe({ next: (res) => this.closings.set(res.data ?? []) });
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
      () => this.load(),
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
        this.load();
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
