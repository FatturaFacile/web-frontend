import { Component, inject, model, output, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { catchError, map, of } from 'rxjs';
import {
  FormArray,
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
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { AccountingApiService, CreateLedgerEntryPayload, TranslateService } from '@core';
import { TranslatePipe } from '@shared';

/** Local calendar day as YYYY-MM-DD (no UTC shift). */
export function toIsoDay(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

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
    NzCheckboxModule,
    NzIconModule,
    NzSelectModule,
    TranslatePipe,
  ],
  templateUrl: './ledger-entry-form-drawer.component.html',
})
export class LedgerEntryFormDrawerComponent {
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly api = inject(AccountingApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly open = model.required<boolean>();
  readonly saved = output<void>();

  protected readonly isSaving = signal(false);

  /** Open fiscal periods: the API wants the period of the posting date (the entry number is assigned by the server). */
  protected readonly openPeriods = toSignal(
    this.api.getFiscalPeriods().pipe(
      map((res) => (res.data ?? []).filter((period) => period.status === 'open')),
      catchError(() => of([])),
    ),
    { initialValue: [] },
  );

  protected readonly form = this.fb.group({
    fiscal_period_id: this.fb.control<string>('', [Validators.required]),
    date: this.fb.control<Date | string>(new Date(), [Validators.required]),
    description: this.fb.control<string>('', [Validators.required]),
    /** A draft waits for submit/approval; only a draft can be given an automatic reversal date. */
    save_as_draft: this.fb.control<boolean>(true),
    auto_reverse_on: this.fb.control<Date | null>(null),
    lines: this.fb.array([
      this.createLine('1010-Cassa', 100, 0),
      this.createLine('2010-Fornitori', 0, 100),
    ]),
  });

  /** Date of the entry as a Date (the picker can hold a string after a reset). */
  private postingDate(): Date {
    const value = this.form.controls.date.value;
    return value instanceof Date ? value : new Date(value);
  }

  /** The reversal must fall after the posting date (the API answers 422 otherwise). */
  protected isAutoReverseInvalid(): boolean {
    const reverseOn = this.form.controls.auto_reverse_on.value;
    return !!reverseOn && toIsoDay(reverseOn) <= toIsoDay(this.postingDate());
  }

  protected disableReverseDate = (current: Date): boolean => toIsoDay(current) <= toIsoDay(this.postingDate());

  get linesArray(): FormArray {
    return this.form.get('lines') as FormArray;
  }

  createLine(accountId = '', debit = 0, credit = 0): FormGroup {
    return this.fb.group({
      account_id: this.fb.control<string>(accountId, [Validators.required]),
      debit: this.fb.control<number>(debit),
      credit: this.fb.control<number>(credit),
      description: this.fb.control<string>(''),
    });
  }

  addLine(): void {
    this.linesArray.push(this.createLine('', 0, 0));
  }

  removeLine(index: number): void {
    if (this.linesArray.length > 2) {
      this.linesArray.removeAt(index);
    }
  }

  totalDebit(): number {
    return (this.linesArray.value || []).reduce(
      (sum: number, line: { debit?: number }) => sum + (Number(line.debit) || 0),
      0,
    );
  }

  totalCredit(): number {
    return (this.linesArray.value || []).reduce(
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
      this.message.error(this.translate.instant('accounting.errors.unbalancedEntry'));
      return;
    }

    if (this.form.controls.save_as_draft.value && this.isAutoReverseInvalid()) {
      this.message.error(this.translate.instant('accounting.errors.autoReverseAfterPosting'));
      return;
    }

    this.isSaving.set(true);
    const val = this.form.getRawValue();
    const dateStr = val.date instanceof Date ? toIsoDay(val.date) : String(val.date);

    const rawLines = val.lines as {
      account_id: string;
      debit: number;
      credit: number;
      description?: string;
    }[];
    const payload: CreateLedgerEntryPayload = {
      fiscal_period_id: val.fiscal_period_id,
      posting_date: dateStr,
      description: val.description,
      status: val.save_as_draft ? 'draft' : 'posted',
      auto_reverse_on: val.save_as_draft && val.auto_reverse_on ? toIsoDay(val.auto_reverse_on) : null,
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
        this.message.success(this.translate.instant('accounting.messages.entrySaved'));
        this.open.set(false);
        this.saved.emit();
      },
      error: () => {
        this.isSaving.set(false);
      },
    });
  }
}
