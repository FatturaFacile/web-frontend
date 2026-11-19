import { DatePipe } from '@angular/common';
import { Component, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DocumentEmailRecord, DocumentEmailType, I18nService } from '@core';
import { DocumentsExtraApiService } from '@core/api/documents-extra-api.service';
import { TranslatePipe } from '@shared';

/** Sends a sales document by e-mail and lists the e-mails already sent for it (`/documents/{type}/{id}/emails`). */
@Component({
  selector: 'app-document-emails-dialog',
  imports: [DatePipe, FormsModule, NzButtonModule, NzInputModule, NzModalModule, NzTableModule, NzTagModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="documentId() !== null"
      [nzTitle]="'LOGISTICS.DOCUMENT_EMAILS.TITLE' | translate"
      [nzFooter]="null"
      nzWidth="720px"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <label for="document-email-to">{{ 'LOGISTICS.DOCUMENT_EMAILS.TO' | translate }}</label>
        <input id="document-email-to" nz-input type="email" maxlength="190" [ngModel]="to()" (ngModelChange)="to.set($event)" />
        <label for="document-email-message">{{ 'LOGISTICS.DOCUMENT_EMAILS.MESSAGE' | translate }}</label>
        <textarea id="document-email-message" nz-input rows="3" maxlength="2000" [ngModel]="body()" (ngModelChange)="body.set($event)"></textarea>
        <p>
          <button nz-button nzType="primary" type="button" [nzLoading]="sending()" (click)="send()">
            {{ 'LOGISTICS.DOCUMENT_EMAILS.SEND' | translate }}
          </button>
        </p>

        <nz-table #table [nzData]="emails()" [nzLoading]="loading()" nzSize="small" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'LOGISTICS.DOCUMENT_EMAILS.RECIPIENT' | translate }}</th>
              <th>{{ 'LOGISTICS.DOCUMENT_EMAILS.SUBJECT' | translate }}</th>
              <th>{{ 'LOGISTICS.DOCUMENT_EMAILS.SENT_AT' | translate }}</th>
              <th>{{ 'LOGISTICS.DOCUMENT_EMAILS.STATUS' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.id) {
              <tr>
                <td>{{ row.recipient }}</td>
                <td>{{ row.subject || row.attachment_name || '-' }}</td>
                <td>{{ row.sent_at ? (row.sent_at | date: 'dd.MM.yyyy HH:mm') : '-' }}</td>
                <td>
                  <nz-tag [nzColor]="row.error ? 'red' : 'green'" [title]="row.error ?? ''">{{ row.status }}</nz-tag>
                </td>
              </tr>
            }
          </tbody>
        </nz-table>
      </ng-container>
    </nz-modal>
  `,
})
export class DocumentEmailsDialogComponent {
  private readonly api = inject(DocumentsExtraApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly type = input.required<DocumentEmailType>();
  /** Id of the document; null keeps the dialog closed. */
  readonly documentId = input<string | null>(null);
  readonly closed = output<void>();

  protected readonly emails = signal<DocumentEmailRecord[]>([]);
  protected readonly loading = signal(false);
  protected readonly sending = signal(false);
  protected readonly to = signal('');
  protected readonly body = signal('');

  constructor() {
    effect(() => {
      if (this.documentId() !== null) {
        this.to.set('');
        this.body.set('');
        this.load();
      }
    });
  }

  protected send(): void {
    const id = this.documentId();
    if (id === null) return;
    this.sending.set(true);
    this.api.sendByEmail(this.type(), id, { to: this.to().trim() || null, message: this.body().trim() || null }).subscribe({
      next: () => {
        this.sending.set(false);
        this.message.success(this.i18n.translate('LOGISTICS.DOCUMENT_EMAILS.SENT'));
        this.load();
      },
      error: () => {
        this.sending.set(false);
        this.message.error(this.i18n.translate('LOGISTICS.DOCUMENT_EMAILS.ERROR'));
      },
    });
  }

  private load(): void {
    const id = this.documentId();
    if (id === null) return;
    this.loading.set(true);
    this.api.getEmails(this.type(), id).subscribe({
      next: (response) => {
        this.emails.set(response.data);
        this.loading.set(false);
      },
      error: () => {
        this.emails.set([]);
        this.loading.set(false);
      },
    });
  }
}
