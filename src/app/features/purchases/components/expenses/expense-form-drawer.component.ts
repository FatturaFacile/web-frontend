import { Component, effect, inject, input, model, output, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzMessageService } from 'ng-zorro-antd/message';
import {
  CreateExpensePayload,
  ExpenseAttachment,
  ExpensesApiService,
  ExpenseResource,
  ExpenseStatus,
  LookupItemDto,
  LookupService,
  TranslateService,
} from '@core';
import { downloadBlob, IconActionDirective, ModalActionsDirective, TranslatePipe } from '@shared';

@Component({
  selector: 'app-expense-form-drawer',
  styleUrl: './expense-form-drawer.component.scss',
  imports: [
    ReactiveFormsModule,
    NzModalModule,
    ModalActionsDirective,
    IconActionDirective,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzSelectModule,
    NzDatePickerModule,
    NzButtonModule,
    TranslatePipe,
  ],
  templateUrl: './expense-form-drawer.component.html',
})
export class ExpenseFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(ExpensesApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly lookups = inject(LookupService);

  readonly open = model.required<boolean>();
  readonly expense = input<ExpenseResource | null>(null);
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);
  protected readonly categories = signal<LookupItemDto[]>([]);
  protected readonly attachments = signal<ExpenseAttachment[]>([]);
  protected readonly isUploading = signal(false);

  protected readonly form = this.fb.group({
    category_id: this.fb.control<string>('', [Validators.required]),
    date: this.fb.control<Date | string>(new Date(), [Validators.required]),
    amount_gross: this.fb.control<number>(0, [Validators.required, Validators.min(0.01)]),
    currency: this.fb.control<'EUR' | 'CHF'>('EUR', [Validators.required]),
    notes: this.fb.control<string>('', [Validators.maxLength(5000)]),
    merchant_name: this.fb.control<string>('', [Validators.maxLength(255)]),
    status: this.fb.control<ExpenseStatus>('draft'),
  });

  constructor() {
    void this.lookups.getLookup('expense_category').then((items) => this.categories.set(items));
    effect(() => {
      const exp = this.expense();
      if (exp) {
        this.loadAttachments(exp.id);
        this.form.patchValue({
          category_id: exp.category_id ?? '',
          date: exp.date ? new Date(exp.date) : new Date(),
          amount_gross: exp.amount_gross,
          currency: (exp.currency as 'EUR' | 'CHF') || 'EUR',
          notes: exp.notes || '',
          merchant_name: exp.merchant_name || '',
          status: exp.status || 'draft',
        });
      } else {
        this.attachments.set([]);
        this.form.reset({
          category_id: '',
          date: new Date(),
          amount_gross: 0,
          currency: 'EUR',
          notes: '',
          merchant_name: '',
          status: 'draft',
        });
      }
    });
  }

  /** Receipts of the expense come with the detail of the expense. */
  private loadAttachments(expenseId: string): void {
    this.api.getExpense(expenseId).subscribe({ next: (res) => this.attachments.set(res.data.attachments ?? []) });
  }

  protected upload(event: Event): void {
    const exp = this.expense();
    const input = event.target as HTMLInputElement;
    const files = Array.from(input.files ?? []);
    if (!exp || files.length === 0) {
      return;
    }
    const body = new FormData();
    files.forEach((file) => body.append('files[]', file));
    this.isUploading.set(true);
    this.api.uploadExpenseAttachment(exp.id, body).subscribe({
      next: () => {
        this.isUploading.set(false);
        input.value = '';
        this.message.success(this.translate.instant('expenses.messages.attachmentUploaded'));
        this.loadAttachments(exp.id);
        this.saved.emit();
      },
      error: () => this.isUploading.set(false),
    });
  }

  protected download(attachment: ExpenseAttachment): void {
    this.api.downloadExpenseAttachment(attachment.expense_id, attachment.id).subscribe({
      next: (blob) => downloadBlob(blob, attachment.original_name),
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

    const payload: CreateExpensePayload = {
      category_id: val.category_id,
      date: dateStr,
      amount_gross: val.amount_gross,
      currency: val.currency,
      notes: val.notes || null,
      merchant_name: val.merchant_name || null,
      status: val.status,
    };

    const exp = this.expense();
    const request$ = exp
      ? this.api.updateExpense(exp.id, payload)
      : this.api.createExpense(payload);

    request$.subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.success(this.translate.instant(exp ? 'expenses.messages.updated' : 'expenses.messages.created'));
        this.open.set(false);
        this.saved.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
