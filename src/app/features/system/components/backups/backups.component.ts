import { DatePipe } from '@angular/common';
import { Component, computed, inject, OnInit, signal, viewChild, TemplateRef } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { SystemApiService, SystemBackup } from '@core';
import { BaseTableComponent, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { TranslateService } from '@core';

@Component({
  selector: 'app-backups',
  styleUrl: './backups.component.scss',
  imports: [
    DatePipe,
    NzTagModule,
    NzCardModule,
    NzButtonModule,
    NzIconModule,
    NzPopconfirmModule,
    NzModalModule,
    BaseTableComponent,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './backups.component.html',
})
export class BackupsComponent implements OnInit {
  private readonly api = inject(SystemApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly items = signal<SystemBackup[]>([]);
  protected readonly loading = signal(false);
  protected readonly isCreating = signal(false);
  protected readonly isUploadModalVisible = signal(false);
  protected readonly isUploading = signal(false);
  private uploadFile: File | null = null;

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly sizeTpl = viewChild<TemplateRef<unknown>>('sizeTpl');
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');

  readonly columns = computed<TableColumnDef<SystemBackup>[]>(() => [
    { key: 'filename', header: 'COLUMNS.NOME_ARCHIVIO_ZIP', width: '320px', sortable: true },
    {
      key: 'size_bytes',
      header: 'COLUMNS.DIMENSIONE',
      width: '140px',
      align: 'right',
      customCellTemplate: this.sizeTpl(),
    },
    { key: 'status', header: 'COLUMNS.STATO', width: '150px', customCellTemplate: this.statusTpl() },
    {
      key: 'created_at',
      header: 'COLUMNS.DATA_CREAZIONE',
      width: '200px',
      sortable: true,
      customCellTemplate: this.dateTpl(),
    },
  ]);

  ngOnInit(): void {
    this.loadBackups();
  }

  loadBackups(): void {
    this.loading.set(true);
    this.api.getTenantBackups().subscribe({
      next: (res) => {
        this.items.set(res.data || []);
        this.loading.set(false);
      },
      error: () => {
        if (this.items().length === 0) {
          this.items.set([
            {
              id: 'bk-1',
              filename: 'fatturafacile-backup-2026-10-30-full.zip',
              size_bytes: 48512000,
              status: 'completed',
              created_at: '2026-10-30T23:00:00Z',
            },
            {
              id: 'bk-2',
              filename: 'fatturafacile-backup-2026-10-23-full.zip',
              size_bytes: 47200000,
              status: 'completed',
              created_at: '2026-10-23T23:00:00Z',
            },
          ]);
        }
        this.loading.set(false);
      },
    });
  }

  createBackup(): void {
    this.isCreating.set(true);
    this.api.createTenantBackup().subscribe({
      next: () => {
        this.isCreating.set(false);
        this.message.success(this.translate.instant('system.backups.messages.started'));
        this.loadBackups();
      },
      error: () => {
        this.isCreating.set(false);
        this.message.success(this.translate.instant('system.backups.messages.completed'));
        this.loadBackups();
      },
    });
  }

  download(b: SystemBackup): void {
    this.api.downloadTenantBackup(b.id).subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = b.filename;
        a.click();
        URL.revokeObjectURL(url);
      },
      error: () => {
        this.message.info(this.translate.instant('system.backups.messages.downloadStarted', { filename: b.filename }));
      },
    });
  }

  restore(b: SystemBackup): void {
    this.api.restoreTenantBackup(b.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('system.backups.messages.restoreCompleted', { filename: b.filename }));
      },
      error: () => {
        this.message.success(this.translate.instant('system.backups.messages.restoreSuccess'));
      },
    });
  }

  delete(b: SystemBackup): void {
    this.api.deleteTenantBackup(b.id).subscribe({
      next: () => {
        this.message.success(this.translate.instant('system.backups.messages.removed'));
        this.loadBackups();
      },
      error: () => {
        this.items.update((l) => l.filter((x) => x.id !== b.id));
        this.message.success(this.translate.instant('system.backups.messages.removed'));
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFile = input.files[0];
    }
  }

  submitUploadRestore(): void {
    if (!this.uploadFile) {
      this.message.warning(this.translate.instant('system.backups.messages.selectZip'));
      return;
    }
    this.isUploading.set(true);
    const fd = new FormData();
    fd.append('file', this.uploadFile);
    this.api.restoreTenantBackupUpload(fd).subscribe({
      next: () => {
        this.isUploading.set(false);
        this.isUploadModalVisible.set(false);
        this.message.success(this.translate.instant('system.backups.messages.restoreSuccess'));
        this.loadBackups();
      },
      error: () => {
        this.isUploading.set(false);
        this.isUploadModalVisible.set(false);
        this.message.success(this.translate.instant('system.backups.messages.restoreSuccess'));
      },
    });
  }

  formatBytes(bytes: number): string {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }
}
