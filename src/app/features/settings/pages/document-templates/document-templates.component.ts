import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule, NzModalService } from 'ng-zorro-antd/modal';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzInputModule } from 'ng-zorro-antd/input';
import {
  DOCUMENT_TEMPLATE_TYPES,
  DocumentQuota,
  DocumentTemplate,
  I18nService,
  PermissionsService,
  SaveDocumentTemplatePayload,
  SettingsApiService,
} from '@core';
import { IconActionDirective, ModalActionsDirective, PageHeaderComponent, TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';

const MAX_LOGO_BYTES = 512 * 1024;
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

interface TemplateRow {
  type: string;
  template: DocumentTemplate | null;
}

@Component({
  selector: 'app-document-templates',
  styleUrl: './document-templates.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    FormsModule,
    IconActionDirective,
    ModalActionsDirective,
    NzButtonModule,
    NzCardModule,
    NzInputModule,
    NzModalModule,
    NzStatisticModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  templateUrl: './document-templates.component.html',
})
export class DocumentTemplatesComponent implements OnInit {
  private readonly api = inject(SettingsApiService);
  private readonly message = inject(NzMessageService);
  private readonly modal = inject(NzModalService);
  private readonly i18n = inject(I18nService);
  private readonly permissions = inject(PermissionsService);

  protected readonly canWrite = computed(() => this.permissions.canWrite('integrations'));
  protected readonly templates = signal<DocumentTemplate[]>([]);
  protected readonly quota = signal<DocumentQuota | null>(null);
  protected readonly loading = signal(false);
  protected readonly saving = signal(false);
  protected readonly rows = computed<TemplateRow[]>(() =>
    DOCUMENT_TEMPLATE_TYPES.map((type) => ({
      type,
      template: this.templates().find((template) => template.document_type === type) ?? null,
    })),
  );

  protected readonly editing = signal<string | null>(null);
  protected readonly primaryColor = signal('');
  protected readonly secondaryColor = signal('');
  protected readonly footerText = signal('');
  protected readonly logoBase64 = signal<string | null>(null);
  protected readonly logoPreview = signal<string | null>(null);
  protected readonly logoError = signal(false);
  protected readonly colorsValid = computed(
    () =>
      (this.primaryColor() === '' || HEX_COLOR.test(this.primaryColor())) &&
      (this.secondaryColor() === '' || HEX_COLOR.test(this.secondaryColor())),
  );

  ngOnInit(): void {
    this.load();
    this.api.getDocumentQuota().subscribe({
      next: (res) => this.quota.set(res.data),
      error: () => this.quota.set(null),
    });
  }

  protected load(): void {
    this.loading.set(true);
    this.api.getDocumentTemplates().subscribe({
      next: (res) => {
        this.templates.set(res.data ?? []);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.message.error(this.i18n.translate('DOCUMENT_TEMPLATES.LOAD_FAILED'));
      },
    });
  }

  protected edit(row: TemplateRow): void {
    this.editing.set(row.type);
    this.primaryColor.set(row.template?.primary_color ?? '');
    this.secondaryColor.set(row.template?.secondary_color ?? '');
    this.footerText.set(row.template?.footer_text ?? '');
    this.logoBase64.set(null);
    this.logoPreview.set(row.template?.logo_data_uri ?? null);
    this.logoError.set(false);
  }

  protected onLogoPicked(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0);
    this.logoError.set(false);
    if (!file) {
      return;
    }
    if (!['image/png', 'image/jpeg'].includes(file.type) || file.size > MAX_LOGO_BYTES) {
      this.logoError.set(true);
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      this.logoPreview.set(result);
      this.logoBase64.set(result.slice(result.indexOf(',') + 1));
    };
    reader.readAsDataURL(file);
  }

  protected save(): void {
    const type = this.editing();
    if (!type || !this.colorsValid()) {
      return;
    }
    const payload: SaveDocumentTemplatePayload = {
      primary_color: this.primaryColor() || null,
      secondary_color: this.secondaryColor() || null,
      footer_text: this.footerText() || null,
    };
    if (this.logoBase64()) {
      payload.logo_base64 = this.logoBase64();
    }
    this.saving.set(true);
    this.api.saveDocumentTemplate(type, payload).subscribe({
      next: () => {
        this.saving.set(false);
        this.editing.set(null);
        this.message.success(this.i18n.translate('DOCUMENT_TEMPLATES.SAVED'));
        this.load();
      },
      error: () => {
        this.saving.set(false);
        this.message.error(this.i18n.translate('DOCUMENT_TEMPLATES.SAVE_FAILED'));
      },
    });
  }

  protected reset(row: TemplateRow): void {
    this.modal.confirm({
      nzTitle: this.i18n.translate('DOCUMENT_TEMPLATES.RESET_CONFIRM', {
        type: this.i18n.translate(`DOCUMENT_TEMPLATES.TYPE_${row.type}`),
      }),
      nzOkDanger: true,
      nzOkText: this.i18n.translate('DOCUMENT_TEMPLATES.RESET'),
      nzCancelText: this.i18n.translate('COMMON.CANCEL'),
      nzOnOk: () =>
        this.api.deleteDocumentTemplate(row.type).subscribe({
          next: () => {
            this.message.success(this.i18n.translate('DOCUMENT_TEMPLATES.RESET_DONE'));
            this.load();
          },
          error: () => this.message.error(this.i18n.translate('DOCUMENT_TEMPLATES.SAVE_FAILED')),
        }),
    });
  }
}
