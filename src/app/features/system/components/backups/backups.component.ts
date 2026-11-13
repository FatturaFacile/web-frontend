import { DatePipe } from '@angular/common';
import { Component, computed, inject, signal, viewChild, TemplateRef } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { FetchGridModel, SystemApiService, SystemBackup } from '@core';
import { BaseTableComponent, IconActionDirective, ModalActionsDirective, PageHeaderComponent, TableColumnDef, TranslatePipe } from '@shared';
import { TranslateService } from '@core';

@Component({
  selector: 'app-backups',
  styleUrl: './backups.component.scss',
  imports: [
    IconActionDirective,
    ModalActionsDirective,
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
export class BackupsComponent {
  private readonly api = inject(SystemApiService);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  protected readonly grid = new FetchGridModel<SystemBackup>((query) => this.api.getTenantBackups(query));
  protected readonly isCreating = signal(false);
  protected readonly isUploadModalVisible = signal(false);
  protected readonly isUploading = signal(false);
  protected readonly uploadFile = signal<File | null>(null);

  private readonly dateTpl = viewChild<TemplateRef<unknown>>('dateTpl');
  private readonly sizeTpl = viewChild<TemplateRef<unknown>>('sizeTpl');
  private readonly statusTpl = viewChild<TemplateRef<unknown>>('statusTpl');

  readonly columns = computed<TableColumnDef<SystemBackup>[]>(() => [
    { key: 'filename', header: 'COLUMNS.NOME_ARCHIVIO_ZIP', width: '320px' },
    {
      key: 'file_size_bytes',
      header: 'COLUMNS.DIMENSIONE',
      width: '140px',
      align: 'right',
      customCellTemplate: this.sizeTpl(),
    },
    {
      key: 'status',
      header: 'COLUMNS.STATO',
      width: '150px',
      valueLabel: (value) => this.translate.instant('system.backups.status.' + value),
      customCellTemplate: this.statusTpl(),
    },
    {
      key: 'created_at',
      header: 'COLUMNS.DATA_CREAZIONE',
      width: '200px',
      customCellTemplate: this.dateTpl(),
    },
  ]);

  loadBackups(): void {
    this.grid.reload();
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
        this.message.error(this.translate.instant('settings.messages.error'));
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
        this.message.error(this.translate.instant('settings.messages.error'));
      },
    });
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files.length > 0) {
      this.uploadFile.set(input.files[0]);
    }
  }

  submitUploadRestore(): void {
    const file = this.uploadFile();
    if (!file) {
      this.message.warning(this.translate.instant('system.backups.messages.selectZip'));
      return;
    }
    this.isUploading.set(true);
    const fd = new FormData();
    fd.append('file', file);
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
