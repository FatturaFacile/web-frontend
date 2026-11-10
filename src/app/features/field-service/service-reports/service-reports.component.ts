import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule, NzTableQueryParams } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import {
  FieldServiceApiService,
  I18nService,
  PermissionsService,
  ServiceReportListParams,
  ServiceReportPhotoStage,
  ServiceReportSummary,
} from '@core';
import { downloadBlob, MoneyPipe, PageHeaderComponent, TranslatePipe } from '@shared';
import { SignatureDialogComponent, SignatureResult } from '../components/signature-dialog/signature-dialog.component';

const PHOTO_STAGES: readonly ServiceReportPhotoStage[] = ['before', 'after', 'general', 'receipt'];

@Component({
  selector: 'app-service-reports',
  imports: [
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    MoneyPipe,
    PageHeaderComponent,
    TranslatePipe,
    SignatureDialogComponent,
  ],
  templateUrl: './service-reports.component.html',
  styles: `
    .sr-filters {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 16px;
    }
    .sr-filter {
      width: 180px;
    }
    .sr-spacer {
      flex: 1;
    }
    .sr-label {
      display: block;
      margin: 12px 0 4px;
      font-weight: 500;
    }
    .sr-select {
      width: 100%;
    }
  `,
})
export class ServiceReportsComponent implements OnInit {
  private readonly api = inject(FieldServiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);
  protected readonly canWrite = computed(() => this.permissions.canWrite('service'));

  protected readonly reports = signal<ServiceReportSummary[]>([]);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly total = signal(0);
  protected readonly pageIndex = signal(1);
  protected readonly pageSize = signal(20);
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

  ngOnInit(): void {
    this.load();
  }

  protected load(): void {
    this.loading.set(true);
    const params: ServiceReportListParams = {
      page: this.pageIndex(),
      per_page: this.pageSize(),
      status: this.status() || undefined,
      from_date: this.fromDate() || undefined,
      to_date: this.toDate() || undefined,
    };
    this.api.getServiceReports(params).subscribe({
      next: (res) => {
        this.reports.set(res.data ?? []);
        this.total.set(res.meta?.total ?? 0);
        this.loading.set(false);
      },
      error: () => {
        this.reports.set([]);
        this.loading.set(false);
        this.message.error(this.i18n.translate('SERVICE_REPORTS.LOAD_FAILED'));
      },
    });
  }

  protected onQueryParams(params: NzTableQueryParams): void {
    this.pageIndex.set(params.pageIndex);
    this.pageSize.set(params.pageSize);
    this.load();
  }

  protected applyFilters(): void {
    this.pageIndex.set(1);
    this.load();
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
          this.load();
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
            this.load();
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
            this.load();
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
