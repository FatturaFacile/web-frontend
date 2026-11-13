import { Component, DestroyRef, inject, OnInit, signal } from '@angular/core';
import { FormArray, FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  applyServerErrors,
  CreateRecurringJournalPayload,
  GeneralLedgerApiService,
  I18nService,
  PermissionsService,
  RecurringFrequency,
  RecurringJournal,
  RecurringStatus,
  ScheduledRunResult,
} from '@core';
import { TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective, GridSortPipe, GridFilterListPipe, GridFilterFnPipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { GlLookupStore } from '../shared/gl-lookup.store';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

const STATUS_COLORS: Record<RecurringStatus, string> = { active: 'green', paused: 'gold', ended: 'default' };

@Component({
  selector: 'app-gl-recurring',
  styleUrl: './gl-recurring.component.scss',
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
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  templateUrl: './gl-recurring.component.html',
})
export class GlRecurringComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly lookups = inject(GlLookupStore);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly frequencies: RecurringFrequency[] = ['monthly', 'quarterly', 'semiannual', 'yearly'];
  protected readonly items = signal<RecurringJournal[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly error = signal<unknown>(null);
  protected readonly formErrors = signal<string[]>([]);
  protected readonly scheduledResult = signal<ScheduledRunResult | null>(null);
  protected scheduledAsOf = '';

  protected readonly form = this.fb.group({
    name: this.fb.control('', [Validators.required, Validators.maxLength(190)]),
    description: this.fb.control('', [Validators.required, Validators.maxLength(450)]),
    frequency: this.fb.control<RecurringFrequency>('monthly', Validators.required),
    start_date: this.fb.control('', Validators.required),
    end_date: this.fb.control('', endsNotBefore('start_date')),
    reverse_next_day: this.fb.control(false),
    lines: this.fb.array([this.newLine(), this.newLine()]),
  });

  constructor() {
    // The API requires end_date on or after start_date.
    revalidateOnStartChange(this.form, 'start_date', 'end_date', this.destroyRef);
  }

  ngOnInit(): void {
    this.lookups.load();
    this.load();
  }

  protected get lines(): FormArray {
    return this.form.controls.lines;
  }

  protected statusColor(status: RecurringStatus): string {
    return STATUS_COLORS[status];
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getRecurringJournals().subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.form.reset({ frequency: 'monthly', reverse_next_day: false });
    this.lines.clear();
    this.lines.push(this.newLine());
    this.lines.push(this.newLine());
    this.formErrors.set([]);
    this.modalOpen.set(true);
  }

  protected addLine(): void {
    this.lines.push(this.newLine());
  }

  protected removeLine(index: number): void {
    if (this.lines.length > 2) {
      this.lines.removeAt(index);
    }
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    const value = this.form.getRawValue();
    const payload: CreateRecurringJournalPayload = {
      name: value.name,
      description: value.description,
      frequency: value.frequency,
      start_date: value.start_date,
      end_date: value.end_date || null,
      reverse_next_day: value.reverse_next_day,
      lines: value.lines.map((line) => ({
        account_id: line.account_id,
        debit_amount: line.debit_amount ?? null,
        credit_amount: line.credit_amount ?? null,
        description: line.description || null,
        cost_center_id: line.cost_center_id || null,
        profit_center_id: null,
      })),
    };
    this.saving.set(true);
    this.api.createRecurringJournal(payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.message.success(this.i18n.translate('GL.RECURRING_CREATED'));
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.formErrors.set(applyServerErrors(this.form, err));
      },
    });
  }

  protected setStatus(item: RecurringJournal, status: RecurringStatus): void {
    this.api.setRecurringJournalStatus(item.id, status).subscribe({ next: () => this.load() });
  }

  protected run(item: RecurringJournal): void {
    this.error.set(null);
    this.api.runRecurringJournal(item.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.RECURRING_RUN_DONE'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected runScheduled(): void {
    this.error.set(null);
    this.api.runScheduledJournals(this.scheduledAsOf || null).subscribe({
      next: (res) => {
        this.scheduledResult.set(res.data);
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  private newLine() {
    return this.fb.group({
      account_id: this.fb.control('', Validators.required),
      debit_amount: this.fb.control<number | null>(null),
      credit_amount: this.fb.control<number | null>(null),
      description: this.fb.control(''),
      cost_center_id: this.fb.control(''),
    });
  }
}
