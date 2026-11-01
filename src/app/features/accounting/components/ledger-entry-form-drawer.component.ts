import { Component, inject, model, output, signal } from '@angular/core';
import {
  FormArray,
  FormControl,
  FormGroup,
  NonNullableFormBuilder,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzDatePickerModule } from 'ng-zorro-antd/date-picker';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { AccountingApiService, CreateLedgerEntryPayload } from '@core';

@Component({
  selector: 'app-ledger-entry-form-drawer',
  imports: [
    ReactiveFormsModule,
    NzDrawerModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzDatePickerModule,
    NzButtonModule,
    NzIconModule,
  ],
  templateUrl: './ledger-entry-form-drawer.component.html',
  styleUrl: './ledger-entry-form-drawer.component.scss',
})
export class LedgerEntryFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);

  readonly open = model.required<boolean>();
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);

  protected readonly form = this.fb.group({
    entry_number: this.fb.control<string>(
      `GL-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`,
      [Validators.required],
    ),
    date: this.fb.control<Date | string>(new Date(), [Validators.required]),
    description: this.fb.control<string>('', [Validators.required]),
    lines: this.fb.array([
      this.createLine('1010-Cassa', 100, 0),
      this.createLine('2010-Fornitori', 0, 100),
    ]),
  });

  get linesArray(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  createLine(accountId = '', debit = 0, credit = 0): FormGroup {
    return this.fb.group({
      account_id: this.fb.control<string>(accountId, [Validators.required]),
      debit: this.fb.control<number>(debit, [Validators.min(0)]),
      credit: this.fb.control<number>(credit, [Validators.min(0)]),
      description: this.fb.control<string>(''),
    });
  }

  addLine(): void {
    this.linesArray.push(this.createLine());
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 2) {
      this.linesArray.removeAt(index);
    }
  }

  totalDebit(): number {
    return this.linesArray.value.reduce(
      (sum: number, line: { debit?: number }) => sum + (Number(line.debit) || 0),
      0,
    );
  }

  totalCredit(): number {
    return this.linesArray.value.reduce(
      (sum: number, line: { credit?: number }) => sum + (Number(line.credit) || 0),
      0,
    );
  }

  submit(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    if (this.totalDebit() !== this.totalCredit()) {
      this.message.error('La scrittura deve essere in pareggio: Dare = Avere');
      return;
    }

    this.isSaving.set(true);
    const val = this.form.getRawValue();
    const dateStr =
      val.date instanceof Date ? val.date.toISOString().split('T')[0] : String(val.date);

    const rawLines = val.lines as Array<{
      account_id: string;
      debit: number;
      credit: number;
      description?: string;
    }>;
    const payload: CreateLedgerEntryPayload = {
      entry_number: val.entry_number,
      date: dateStr,
      description: val.description,
      lines: rawLines.map((l) => ({
        account_id: l.account_id,
        debit: Number(l.debit) || 0,
        credit: Number(l.credit) || 0,
        description: l.description || undefined,
      })),
    };

    this.api.createLedgerEntry(payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.message.success('Registrazione a libro giornale completata');
        this.open.set(false);
        this.saved.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
