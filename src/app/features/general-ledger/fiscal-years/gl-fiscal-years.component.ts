import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule, NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { applyServerErrors, GeneralLedgerApiService, GlFiscalYear, I18nService, PermissionsService } from '@core';
import { TranslatePipe } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { currentYearEnd, currentYearStart, downloadBlob } from '../shared/gl-dates';

@Component({
  selector: 'app-gl-fiscal-years',
  imports: [
    FormsModule,
    ReactiveFormsModule,
    NzButtonModule,
    NzCardModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
    GlErrorAlertComponent,
    TranslatePipe,
  ],
  templateUrl: './gl-fiscal-years.component.html',
})
export class GlFiscalYearsComponent implements OnInit {
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly items = signal<GlFiscalYear[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly error = signal<unknown>(null);
  protected expandedYears: Record<string, boolean> = {};
  protected auditFrom = currentYearStart();
  protected auditTo = currentYearEnd();

  protected readonly form = this.fb.group({
    year_code: this.fb.control('', [Validators.required, Validators.maxLength(20)]),
    start_date: this.fb.control('', Validators.required),
    end_date: this.fb.control('', Validators.required),
  });

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getFiscalYears().subscribe({
      next: (res) => {
        this.items.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  protected openCreate(): void {
    this.form.reset();
    this.modalOpen.set(true);
  }

  protected save(): void {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.saving.set(true);
    this.api.createFiscalYear(this.form.getRawValue()).subscribe({
      next: () => {
        this.saving.set(false);
        this.modalOpen.set(false);
        this.load();
      },
      error: (err: unknown) => {
        this.saving.set(false);
        applyServerErrors(this.form, err);
      },
    });
  }

  /** Closing needs the retained-earnings account: a 422 is shown with a link to the settings. */
  protected closeYear(year: GlFiscalYear): void {
    this.error.set(null);
    this.api.closeFiscalYear(year.id).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('GL.YEAR_CLOSED'));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected carryForward(year: GlFiscalYear): void {
    this.error.set(null);
    this.api.carryForwardFiscalYear(year.id).subscribe({
      next: (res) => this.message.success(`${this.i18n.translate('GL.CARRY_FORWARD_DONE')} ${res.data.entry_number ?? ''}`),
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected exportJournalBook(year: GlFiscalYear): void {
    this.api.exportJournalBook({ fiscal_year_id: year.id }).subscribe({
      next: (blob) => downloadBlob(blob, `journal-book-${year.year_code}.csv`),
    });
  }

  protected exportAuditTrail(): void {
    this.api.exportAuditTrail({ from: this.auditFrom, to: this.auditTo, format: 'csv' }).subscribe({
      next: (blob) => downloadBlob(blob, `audit-trail-${this.auditFrom}-${this.auditTo}.csv`),
    });
  }
}
