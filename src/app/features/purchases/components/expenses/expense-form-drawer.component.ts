import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import { ExpensesApiService, ExpenseResource, ExpenseStatus } from '@core';

@Component({
  selector: 'app-expense-form-drawer',
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
  ],
  templateUrl: './expense-form-drawer.component.html',
  styleUrl: './expense-form-drawer.component.scss',
})
export class ExpenseFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ExpensesApiService);
  private readonly message = inject(NzMessageService);

  readonly open = model.required<boolean>();
  readonly expense = input<ExpenseResource | null>(null);
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);

  protected readonly form = this.fb.group({
    date: this.fb.control<Date | string>(new Date(), [Validators.required]),
    amount: this.fb.control<number>(0, [Validators.required, Validators.min(0.01)]),
    currency: this.fb.control<'EUR' | 'CHF'>('EUR', [Validators.required]),
    description: this.fb.control<string>('', [Validators.required]),
    merchant: this.fb.control<string>(''),
    status: this.fb.control<ExpenseStatus>('draft'),
  });

  constructor() {
    effect(() => {
      const exp = this.expense();
      if (exp) {
        this.form.patchValue({
          date: exp.date ? new Date(exp.date) : new Date(),
          amount: exp.amount,
          currency: (exp.currency as 'EUR' | 'CHF') || 'EUR',
          description: exp.description || '',
          merchant: exp.merchant || '',
          status: exp.status || 'draft',
        });
      } else {
        this.form.reset({
          date: new Date(),
          amount: 0,
          currency: 'EUR',
          description: '',
          merchant: '',
          status: 'draft',
        });
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.isSaving.set(true);
    const val = this.form.getRawValue();
    const dateStr =
      val.date instanceof Date ? val.date.toISOString().split('T')[0] : String(val.date);

    const payload = {
      date: dateStr,
      amount: val.amount,
      currency: val.currency,
      description: val.description,
      merchant: val.merchant || undefined,
      status: val.status,
    };

    const exp = this.expense();
    const request$ = exp
      ? this.api.updateExpense(exp.id, payload)
      : this.api.createExpense(payload);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.success(exp ? 'Spesa aggiornata con successo' : 'Spesa creata con successo');
        this.open.set(false);
        this.saved.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
