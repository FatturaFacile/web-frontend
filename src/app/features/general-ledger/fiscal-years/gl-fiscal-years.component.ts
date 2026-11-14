import { Component, computed, DestroyRef, inject, signal, TemplateRef, viewChild } from '@angular/core';
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
import {
  applyServerErrors,
  FetchGridModel,
  GeneralLedgerApiService,
  GeneralLedgerFiscalApiService,
  GlFiscalYear,
  I18nService,
  PermissionsService,
  TranslateService,
} from '@core';
import { BaseTableComponent, TableColumnDef, TranslatePipe, IconActionDirective, ModalActionsDirective, GridExportDirective } from '@shared';
import { GlErrorAlertComponent } from '../shared/gl-error-alert.component';
import { currentYearEnd, currentYearStart, downloadBlob } from '../shared/gl-dates';
import { endsNotBefore, revalidateOnStartChange } from '@shared/utils/date-validators';

@Component({
  selector: 'app-gl-fiscal-years',
  styleUrl: './gl-fiscal-years.component.scss',
  imports: [
    BaseTableComponent,
    GridExportDirective,
    IconActionDirective,
    ModalActionsDirective,
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
export class GlFiscalYearsComponent {
  private readonly translate = inject(TranslateService);
  private readonly api = inject(GeneralLedgerApiService);
  private readonly fiscalApi = inject(GeneralLedgerFiscalApiService);
  private readonly fb = inject(NonNullableFormBuilder);
  private readonly destroyRef = inject(DestroyRef);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);
  protected readonly canWrite = inject(PermissionsService).canWrite('ledger');

  protected readonly grid = new FetchGridModel<GlFiscalYear>((query) => this.api.getFiscalYears(query));
  protected readonly saving = signal(false);
  protected readonly modalOpen = signal(false);
  protected readonly reopenModalOpen = signal(false);
  protected readonly agmModalOpen = signal(false);
  protected readonly anhangModalOpen = signal(false);
  protected readonly selectedYear = signal<GlFiscalYear | null>(null);
  protected readonly anhangData = signal<Record<string, unknown> | null>(null);
  protected reopenReason = '';
  protected agmResolutionRef = '';
  protected anhangFteBand = 'up_to_50';
  protected anhangPledgedAssets = '0.00';
  protected anhangLeasingCommitments = '0.00';
  protected readonly error = signal<unknown>(null);
  protected auditFrom = currentYearStart();
  protected auditTo = currentYearEnd();

  protected readonly form = this.fb.group({
    year_code: this.fb.control('', [Validators.required, Validators.maxLength(20)]),
    start_date: this.fb.control('', Validators.required),
    end_date: this.fb.control('', [Validators.required, endsNotBefore('start_date', { strict: true })]),
  });

  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: GlFiscalYear; value: unknown }>>('statusTpl');

  protected readonly columns = computed<TableColumnDef<GlFiscalYear>[]>(() => [
    { key: 'year_code', header: 'GL.YEAR_CODE' },
    { key: 'start_date', header: 'GL.START_DATE' },
    { key: 'end_date', header: 'GL.END_DATE' },
    { key: 'status', header: 'GL.STATUS', customCellTemplate: this.statusTpl() },
  ]);

  constructor() {
    // The API requires end_date after start_date.
    revalidateOnStartChange(this.form, 'start_date', 'end_date', this.destroyRef);
  }

  protected load(): void {
    this.grid.reload();
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

  protected openReopenModal(year: GlFiscalYear): void {
    this.selectedYear.set(year);
    this.reopenReason = '';
    this.reopenModalOpen.set(true);
  }

  protected confirmReopenYear(): void {
    const year = this.selectedYear();
    if (!year || !this.reopenReason.trim()) {
      return;
    }
    this.error.set(null);
    this.api.reopenFiscalYear(year.id, this.reopenReason.trim()).subscribe({
      next: () => {
        this.reopenModalOpen.set(false);
        this.message.success(this.translate.instant('GL.MSG_ESERCIZIO_RIAPERTO_PER_RETTIFICHE_PRE_AGM', { year_code: year.year_code }));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected openAgmModal(year: GlFiscalYear): void {
    this.selectedYear.set(year);
    this.agmResolutionRef = '';
    this.agmModalOpen.set(true);
  }

  protected confirmAgmApproval(): void {
    const year = this.selectedYear();
    if (!year) {
      return;
    }
    this.error.set(null);
    this.api.approveFiscalYearAtAgm(year.id, this.agmResolutionRef.trim() || undefined).subscribe({
      next: () => {
        this.agmModalOpen.set(false);
        this.message.success(this.translate.instant('GL.MSG_BILANCIO_APPROVATO_DALL_ASSEMBLEA_GENERALE_CO', { year_code: year.year_code }));
        this.load();
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected openAnhangModal(year: GlFiscalYear): void {
    this.selectedYear.set(year);
    this.fiscalApi.getSwissAnhang(year.id).subscribe({
      next: (res) => {
        this.anhangData.set(res.data);
        this.anhangFteBand = String(res.data['fte_band'] ?? 'up_to_50');
        this.anhangPledgedAssets = String(res.data['pledged_assets_amount'] ?? '0.00');
        this.anhangLeasingCommitments = String(res.data['leasing_commitments_amount'] ?? '0.00');
        this.anhangModalOpen.set(true);
      },
      error: (err: unknown) => this.error.set(err),
    });
  }

  protected saveSwissAnhang(): void {
    const year = this.selectedYear();
    if (!year) {
      return;
    }
    this.fiscalApi
      .updateSwissAnhang(year.id, {
        fte_band: this.anhangFteBand,
        pledged_assets_amount: this.anhangPledgedAssets,
        leasing_commitments_amount: this.anhangLeasingCommitments,
      })
      .subscribe({
        next: () => {
          this.anhangModalOpen.set(false);
          this.message.success(this.translate.instant('GL.MSG_NOTA_INTEGRATIVA_SVIZZERA_ANHANG_CO_ART'));
        },
        error: (err: unknown) => this.error.set(err),
      });
  }
}
