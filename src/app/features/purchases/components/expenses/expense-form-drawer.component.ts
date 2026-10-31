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
  template: `
    <nz-drawer
      [nzVisible]="open()"
      [nzTitle]="expense() ? 'Modifica Nota Spesa' : 'Nuova Nota Spesa'"
      [nzWidth]="500"
      (nzOnClose)="open.set(false)"
    >
      <ng-container *nzDrawerContent>
        <form nz-form nzLayout="vertical" [formGroup]="form" (ngSubmit)="submit()">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="date">Data Spesa</nz-form-label>
            <nz-form-control nzErrorTip="La data è obbligatoria">
              <nz-date-picker id="date" formControlName="date" style="width: 100%;" />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="amount">Importo</nz-form-label>
            <nz-form-control nzErrorTip="Inserisci un importo valido">
              <nz-input-number
                id="amount"
                formControlName="amount"
                [nzMin]="0.01"
                [nzStep]="1"
                style="width: 100%;"
              />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="currency">Valuta</nz-form-label>
            <nz-form-control>
              <nz-select id="currency" formControlName="currency">
                <nz-option nzValue="EUR" nzLabel="EUR (€)" />
                <nz-option nzValue="CHF" nzLabel="CHF (Fr.)" />
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzRequired nzFor="description">Descrizione / Causale</nz-form-label>
            <nz-form-control nzErrorTip="La descrizione è obbligatoria">
              <textarea
                nz-input
                id="description"
                formControlName="description"
                rows="3"
                placeholder="Es. Pranzo di lavoro con cliente..."
              ></textarea>
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="merchant">Fornitore / Esercente</nz-form-label>
            <nz-form-control>
              <input
                nz-input
                id="merchant"
                formControlName="merchant"
                placeholder="Es. Ristorante Da Mario"
              />
            </nz-form-control>
          </nz-form-item>

          <nz-form-item>
            <nz-form-label nzFor="status">Stato</nz-form-label>
            <nz-form-control>
              <nz-select id="status" formControlName="status">
                <nz-option nzValue="draft" nzLabel="Bozza" />
                <nz-option nzValue="pending_approval" nzLabel="In Approvazione" />
                <nz-option nzValue="approved" nzLabel="Approvata" />
                <nz-option nzValue="reimbursed" nzLabel="Rimborsata" />
                <nz-option nzValue="paid" nzLabel="Pagata" />
              </nz-select>
            </nz-form-control>
          </nz-form-item>

          <div class="footer-actions">
            <button nz-button type="button" (click)="open.set(false)">Annulla</button>
            <button nz-button nzType="primary" type="submit" [nzLoading]="isSaving()">
              Salva Spesa
            </button>
          </div>
        </form>
      </ng-container>
    </nz-drawer>
  `,
  styles: `
    .footer-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid #f0f0f0;
    }
  `,
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
    const dateStr = val.date instanceof Date ? val.date.toISOString().split('T')[0] : String(val.date);

    const payload = {
      date: dateStr,
      amount: val.amount,
      currency: val.currency,
      description: val.description,
      merchant: val.merchant || undefined,
      status: val.status,
    };

    const exp = this.expense();
    const request$ = exp ? this.api.updateExpense(exp.id, payload) : this.api.createExpense(payload);

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
