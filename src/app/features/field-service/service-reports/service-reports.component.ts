import { Component, computed, inject, signal, TemplateRef, viewChild } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { tap } from 'rxjs';
import {
  FetchGridModel,
  FieldServiceApiService,
  I18nService,
  PermissionsService,
  ServiceReportListParams,
  ServiceReportPhotoStage,
  ServiceReportSummary,
} from '@core';
import { BaseTableComponent, downloadBlob, IconActionDirective, ModalActionsDirective, MoneyPipe, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { SignatureDialogComponent, SignatureResult } from '../components/signature-dialog/signature-dialog.component';

const PHOTO_STAGES: readonly ServiceReportPhotoStage[] = ['before', 'after', 'general', 'receipt'];

@Component({
  selector: 'app-service-reports',
  styleUrl: './service-reports.component.scss',
  imports: [
    ModalActionsDirective,
    IconActionDirective,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    BaseTableComponent,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    SignatureDialogComponent,
  ],
  templateUrl: './service-reports.component.html',
})
export class ServiceReportsComponent {
  private readonly api = inject(FieldServiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));

  /** Server-side grid: paging, sorting, column filters, grouping and export run over all the service reports. */
  protected readonly grid = new FetchGridModel<ServiceReportSummary, ServiceReportListParams>((query) =>
    this.api.getServiceReports(query).pipe(
      tap({ error: () => this.message.error(this.i18n.translate('SERVICE_REPORTS.LOAD_FAILED')) }),
    ),
  );
  protected readonly saving = signal(false);
  protected readonly status = signal('');
  protected readonly fromDate = signal('');
  protected readonly toDate = signal('');
  protected readonly selectedIds = signal<ReadonlySet<string>>(new Set());

  protected readonly signTarget = signal<ServiceReportSummary | null>(null);
  protected readonly signOpen = signal(false);
  protected readonly photoTarget = signal<ServiceReportSummary | null>(null);
  protected readonly photoFile = signal<File | null>(null);
  protected readonly photoStage = signal<ServiceReportPhotoStage>('general');
  protected readonly photoCaption = signal('');
  protected readonly stages = PHOTO_STAGES;

  protected readonly canConsolidate = computed(() => this.selectedIds().size >= 2);

  private readonly selectTpl = viewChild<TemplateRef<{ $implicit: ServiceReportSummary; value: unknown }>>('selectTpl');
  private readonly numberTpl = viewChild<TemplateRef<{ $implicit: ServiceReportSummary; value: unknown }>>('numberTpl');
  private readonly totalTpl = viewChild<TemplateRef<{ $implicit: ServiceReportSummary; value: unknown }>>('totalTpl');
  private readonly statusTpl = viewChild<TemplateRef<{ $implicit: ServiceReportSummary; value: unknown }>>('statusTpl');

  /**
   * `serverKey` names what the API sorts and filters by: the relation columns `contact.name`, `technician.name` and
   * `status.code` (the status label is a translation of the code, so the code is the grouping and filter value).
   */
  protected readonly columns = computed<TableColumnDef<ServiceReportSummary>[]>(() => [
    { key: '__select', header: '', width: '48px', sortable: false, filterable: false, groupable: false, exportable: false, customCellTemplate: this.selectTpl() },
    { key: 'report_number', header: 'SERVICE_REPORTS.NUMBER', customCellTemplate: this.numberTpl() },
    { key: 'report_date', header: 'SERVICE_REPORTS.DATE' },
    { key: 'contact', serverKey: 'contact.name', valueGetter: (report) => report.contact?.name ?? '', header: 'SERVICE_REPORTS.CUSTOMER' },
    { key: 'technician', serverKey: 'technician.name', valueGetter: (report) => report.technician?.name ?? '', header: 'SERVICE_REPORTS.TECHNICIAN' },
    { key: 'total_hours', header: 'SERVICE_REPORTS.HOURS' },
    { key: 'total_gross', header: 'SERVICE_REPORTS.TOTAL', customCellTemplate: this.totalTpl() },
    { key: 'status', serverKey: 'status.code', valueGetter: (report) => report.status?.code ?? '', header: 'COMMON.STATUS', customCellTemplate: this.statusTpl() },
  ]);

  constructor() {
    this.grid.setPageSize(20);
  }

  protected applyFilters(): void {
    this.grid.setFilter({
      status: this.status() || undefined,
      from_date: this.fromDate() || undefined,
      to_date: this.toDate() || undefined,
    });
  }

  protected toggle(id: string, checked: boolean): void {
    this.selectedIds.update((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  }

  protected openSign(report: ServiceReportSummary): void {
    this.signTarget.set(report);
    this.signOpen.set(true);
  }

  protected sign(result: SignatureResult): void {
    const report = this.signTarget();
    if (!report) {
      return;
    }
    this.saving.set(true);
    this.api
      .signServiceReport(report.id, {
        signature_base64: result.signature,
        signer_name: result.signerName,
        signer_role: result.signerRole || null,
        signer_email: result.signerEmail || null,
      })
      .subscribe({
        next: () => {
          this.saving.set(false);
          this.signOpen.set(false);
          this.message.success(this.i18n.translate('SERVICE_REPORTS.SIGNED'));
          this.grid.reload();
        },
        error: (err: unknown) => this.fail(err),
      });
  }

  protected invoice(report: ServiceReportSummary): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('SERVICE_REPORTS.INVOICE_CONFIRM', { number: report.report_number }),
      nzOkText: this.i18n.translate('RES.ACTION.CONFIRM'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () =>
        this.api.generateServiceReportInvoice(report.id).subscribe({
          next: (res) => {
            this.message.success(this.i18n.translate('SERVICE_REPORTS.INVOICED', { number: res.data.invoice_number }));
            this.grid.reload();
          },
          error: (err: unknown) => this.fail(err),
        }),
    });
  }

  protected consolidate(): void {
    const ids = [...this.selectedIds()];
    this.modal.confirm({
      nzTitle: this.i18n.translate('SERVICE_REPORTS.CONSOLIDATE_CONFIRM', { count: ids.length }),
      nzOkText: this.i18n.translate('RES.ACTION.CONFIRM'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () =>
        this.api.generateConsolidatedInvoice(ids).subscribe({
          next: (res) => {
            this.selectedIds.set(new Set());
            this.message.success(this.i18n.translate('SERVICE_REPORTS.INVOICED', { number: res.data.invoice_number }));
            this.grid.reload();
          },
          error: (err: unknown) => this.fail(err),
        }),
    });
  }

  protected downloadPdf(report: ServiceReportSummary): void {
    this.api.downloadServiceReportPdf(report.id).subscribe({
      next: (blob) => downloadBlob(blob, `${report.report_number}.pdf`),
      error: (err: unknown) => this.fail(err),
    });
  }

  protected openPhoto(report: ServiceReportSummary): void {
    this.photoTarget.set(report);
    this.photoFile.set(null);
    this.photoStage.set('general');
    this.photoCaption.set('');
  }

  protected onPhotoPicked(event: Event): void {
    this.photoFile.set((event.target as HTMLInputElement).files?.item(0) ?? null);
  }

  protected uploadPhoto(): void {
    const report = this.photoTarget();
    const file = this.photoFile();
    if (!report || !file) {
      return;
    }
    this.saving.set(true);
    this.api.uploadServiceReportPhoto(report.id, file, this.photoStage(), this.photoCaption() || null).subscribe({
      next: () => {
        this.saving.set(false);
        this.photoTarget.set(null);
        this.message.success(this.i18n.translate('SERVICE_REPORTS.PHOTO_UPLOADED'));
      },
      error: (err: unknown) => this.fail(err),
    });
  }

  private fail(err: unknown): void {
    this.saving.set(false);
    const detail =
      err instanceof Object && 'error' in err && err.error instanceof Object && 'message' in err.error
        ? String(err.error.message)
        : '';
    this.message.error(detail || this.i18n.translate('SERVICE_REPORTS.ACTION_FAILED'));
  }
}
