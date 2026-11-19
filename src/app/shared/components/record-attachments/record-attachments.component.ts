import { DatePipe } from '@angular/common';
import { Component, computed, effect, inject, input, signal, untracked } from '@angular/core';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { AttachableType, AttachmentsApiService } from '@core/api/attachments-api.service';
import { ExtraRecord } from '@core/api/extra-api.types';
import { I18nService } from '@core/i18n/i18n.service';
import { downloadBlob } from '../../utils/download-blob';

const MAX_BYTES = 25 * 1024 * 1024;

/**
 * Generic file attachments of a business record (invoice, quote, ticket, service report ...): list, upload,
 * download and delete. Use `<app-record-attachments attachableType="service_report" [attachableId]="id" />`.
 */
@Component({
  selector: 'app-record-attachments',
  imports: [DatePipe, NzButtonModule, NzEmptyModule, NzPopconfirmModule],
  styles: [
    ':host { display: block; } ul { list-style: none; margin: 0 0 var(--space-3, 12px); padding: 0; } li { display: flex; gap: 8px; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--ff-color-border-subtle, #eee); } .name { flex: 1; word-break: break-all; } .meta { opacity: 0.65; font-size: 12px; }',
  ],
  template: `
    @if (items().length === 0 && !loading()) {
      <nz-empty [nzNotFoundContent]="t('ATTACHMENTS.EMPTY')" />
    } @else {
      <ul>
        @for (a of items(); track a.id) {
          <li>
            <span class="name">{{ nameOf(a) }}</span>
            @if (a['created_at']) {
              <span class="meta">{{ $any(a['created_at']) | date: 'dd/MM/yyyy HH:mm' }}</span>
            }
            <button nz-button nzSize="small" type="button" (click)="download(a)">{{ t('COMMON.DOWNLOAD') }}</button>
            @if (canWrite()) {
              <button
                nz-button
                nzSize="small"
                nzDanger
                type="button"
                nz-popconfirm
                [nzPopconfirmTitle]="t('ATTACHMENTS.DELETE_CONFIRM')"
                (nzOnConfirm)="remove(a)"
              >
                {{ t('COMMON.DELETE') }}
              </button>
            }
          </li>
        }
      </ul>
    }
    @if (canWrite()) {
      <label>
        <span class="meta">{{ t('ATTACHMENTS.ADD_FILE_HINT') }}</span><br />
        <input type="file" [disabled]="uploading()" (change)="onPick($event)" />
      </label>
    }
  `,
})
export class RecordAttachmentsComponent {
  readonly attachableType = input.required<AttachableType>();
  readonly attachableId = input.required<string>();
  readonly canWrite = input(true);

  private readonly api = inject(AttachmentsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService, { optional: true });

  protected readonly items = signal<ExtraRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly uploading = signal(false);
  private readonly key = computed(() => `${this.attachableType()}:${this.attachableId()}`);

  constructor() {
    effect(() => {
      this.key();
      untracked(() => this.load());
    });
  }

  protected t(key: string): string {
    return this.i18n ? this.i18n.translate(key) : key;
  }

  protected nameOf(a: ExtraRecord): string {
    return String(a['original_name'] ?? a['file_name'] ?? a['name'] ?? a.id);
  }

  protected load(): void {
    this.loading.set(true);
    this.api.list(this.attachableType(), this.attachableId()).subscribe({
      next: (r) => {
        this.items.set(r.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.t('ATTACHMENTS.LOAD_ERROR'));
      },
    });
  }

  protected onPick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.item(0);
    if (!file) {
      return;
    }
    if (file.size > MAX_BYTES) {
      this.message.error(this.t('ATTACHMENTS.FILE_TOO_LARGE'));
      input.value = '';
      return;
    }
    this.uploading.set(true);
    this.api.upload(this.attachableType(), this.attachableId(), file).subscribe({
      next: () => {
        this.uploading.set(false);
        input.value = '';
        this.message.success(this.t('ATTACHMENTS.UPLOAD_SUCCESS'));
        this.load();
      },
      error: () => {
        this.uploading.set(false);
        this.message.error(this.t('ATTACHMENTS.UPLOAD_ERROR'));
      },
    });
  }

  protected download(a: ExtraRecord): void {
    this.api.download(a.id).subscribe({
      next: (blob) => downloadBlob(blob, this.nameOf(a)),
      error: () => this.message.error(this.t('ATTACHMENTS.DOWNLOAD_ERROR')),
    });
  }

  protected remove(a: ExtraRecord): void {
    this.api.delete(a.id).subscribe({
      next: () => {
        this.message.success(this.t('ATTACHMENTS.DELETE_SUCCESS'));
        this.load();
      },
      error: () => this.message.error(this.t('ATTACHMENTS.DELETE_ERROR')),
    });
  }
}
