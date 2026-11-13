import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { EmployeeDocumentResource, HrSelfServiceApiService, I18nService } from '@core';
import { TranslatePipe, GridExportDirective, GridSortPipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError, saveBlob } from '../shared/hr-http.util';

@Component({
  selector: 'app-ss-documents',
  styleUrl: './ss-documents.component.scss',
  imports: [
    GridExportDirective,
    GridSortPipe,
    DatePipe, NzButtonModule, NzIconModule, NzTableModule, TranslatePipe],
  template: `
    <nz-table #table [nzData]="documents()" [nzLoading]="loading()" [nzFrontPagination]="false" nzSize="middle">
      <thead>
        <tr>
          <th [nzSortFn]="'title' | gridSort">{{ 'hrmCommon.title' | translate }}</th>
          <th [nzSortFn]="'document_type' | gridSort">{{ 'hrmCommon.type' | translate }}</th>
          <th [nzSortFn]="'issue_date' | gridSort">{{ 'hrmSelfService.issueDate' | translate }}</th>
          <th [nzSortFn]="'expiry_date' | gridSort">{{ 'hrmSelfService.expiryDate' | translate }}</th>
          <th>{{ 'hrmCommon.actions' | translate }}</th>
        </tr>
      </thead>
      <tbody>
        @for (doc of table.data; track doc.id) {
          <tr>
            <td>{{ doc.title }}</td>
            <td>{{ doc.document_type }}</td>
            <td>{{ doc.issue_date | date: 'mediumDate' }}</td>
            <td>{{ doc.expiry_date | date: 'mediumDate' }}</td>
            <td>
              <button
                nz-button
                nzSize="small"
                type="button"
                [nzLoading]="downloadingId() === doc.id"
                [attr.aria-label]="('hrmCommon.download' | translate) + ' ' + doc.title"
                (click)="download(doc)"
              >
                <nz-icon nzType="download" />
                {{ 'hrmCommon.download' | translate }}
              </button>
            </td>
          </tr>
        }
      </tbody>
    </nz-table>
  `,
})
export class SsDocumentsComponent implements OnInit {
  private readonly api = inject(HrSelfServiceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly documents = signal<EmployeeDocumentResource[]>([]);
  protected readonly loading = signal(true);
  protected readonly downloadingId = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getDocuments().subscribe({
      next: (res) => {
        this.documents.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.loading.set(false);
      },
    });
  }

  protected download(doc: EmployeeDocumentResource): void {
    this.downloadingId.set(doc.id);
    this.api.downloadDocument(doc.id).subscribe({
      next: (blob) => {
        saveBlob(blob, doc.original_name ?? doc.title);
        this.downloadingId.set(null);
      },
      error: (err: unknown) => {
        reportHttpError(err, this.message, this.i18n);
        this.downloadingId.set(null);
      },
    });
  }
}
