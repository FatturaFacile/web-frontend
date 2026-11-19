import { Component, inject, output, signal } from '@angular/core';
import { I18nService, SdiPassiveImportResult, SdiTransmissionsApiService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { reportHttpError } from '../hr/shared/hr-http.util';
import { SdiHtmlPreviewComponent } from './sdi-html-preview.component';

/**
 * Drag-and-drop importer of supplier FatturaPA files (.xml and CAdES .xml.p7m): the file is first rendered as readable
 * HTML without saving anything, then the user confirms and the received-invoice drafts are created.
 */
@Component({
  selector: 'app-supplier-fatturapa-importer',
  imports: [NzAlertModule, NzButtonModule, NzIconModule, NzUploadModule, SdiHtmlPreviewComponent, TranslatePipe],
  styles: [':host { display: block; margin-bottom: var(--space-3); } .actions { display: flex; gap: var(--space-2); margin: var(--space-2) 0; align-items: center; }'],
  template: `
    <nz-upload nzType="drag" nzAccept=".xml,.p7m" [nzShowUploadList]="false" [nzBeforeUpload]="beforeUpload">
      <p class="ant-upload-drag-icon"><nz-icon nzType="inbox" /></p>
      <p class="ant-upload-text">{{ 'sdiTransmissions.import.drop' | translate }}</p>
      <p class="ant-upload-hint">{{ 'sdiTransmissions.import.hint' | translate }}</p>
    </nz-upload>

    @if (file(); as selected) {
      <div class="actions">
        <strong data-testid="import-file-name">{{ selected.name }}</strong>
        @if (signatureVerified() === false) {
          <nz-alert nzType="warning" nzShowIcon [nzMessage]="'sdiTransmissions.import.badSignature' | translate" />
        }
        <button nz-button nzType="primary" type="button" [disabled]="!preview() || busy()" (click)="confirm()" data-testid="import-confirm">
          {{ 'sdiTransmissions.import.confirm' | translate }}
        </button>
        <button nz-button type="button" (click)="reset()">{{ 'sdiTransmissions.import.cancel' | translate }}</button>
      </div>
      <app-sdi-html-preview [content]="preview()" />
    }
  `,
})
export class SupplierFatturaPaImporterComponent {
  private readonly api = inject(SdiTransmissionsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  /** Emits once the drafts were created, so the page can refresh. */
  readonly imported = output<void>();

  protected readonly file = signal<File | null>(null);
  protected readonly preview = signal<string | null>(null);
  protected readonly signatureVerified = signal<boolean | null>(null);
  protected readonly busy = signal(false);

  protected readonly beforeUpload = (selected: NzUploadFile): boolean => {
    this.select(selected as unknown as File);

    return false;
  };

  select(file: File): void {
    this.file.set(file);
    this.preview.set(null);
    this.signatureVerified.set(null);
    this.busy.set(true);

    this.api.importPassive(file, true).subscribe({
      next: (response) => this.applyPreview(response.data),
      error: (error: unknown) => {
        this.busy.set(false);
        this.file.set(null);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }

  confirm(): void {
    const file = this.file();

    if (file === null) {
      return;
    }

    this.busy.set(true);
    this.api.importPassive(file, false).subscribe({
      next: (response) => {
        this.busy.set(false);
        const duplicates = (response.data.invoices ?? []).filter((entry) => entry.duplicate).length;
        this.message.success(this.i18n.translate(duplicates > 0 ? 'sdiTransmissions.import.duplicate' : 'sdiTransmissions.import.done'));
        this.reset();
        this.imported.emit();
      },
      error: (error: unknown) => {
        this.busy.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }

  reset(): void {
    this.file.set(null);
    this.preview.set(null);
    this.signatureVerified.set(null);
  }

  private applyPreview(result: SdiPassiveImportResult): void {
    this.busy.set(false);
    this.preview.set(result.preview_html);
    this.signatureVerified.set(result.signature_verified);
  }
}
