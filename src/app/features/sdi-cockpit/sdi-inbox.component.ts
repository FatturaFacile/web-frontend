import { DatePipe } from '@angular/common';
import { Component, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FpaDocument, FpaDocumentsApiService, I18nService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSegmentedModule } from 'ng-zorro-antd/segmented';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../hr/shared/hr-http.util';
import { SdiHtmlPreviewComponent } from '../sdi-transmissions/sdi-html-preview.component';
import { SupplierFatturaPaImporterComponent } from '../sdi-transmissions/supplier-fatturapa-importer.component';

/** Inbox of supplier invoices received through SDI: upload, preview in the ministerial or AssoSoftware layout. */
@Component({
  selector: 'app-sdi-inbox',
  imports: [
    DatePipe,
    FormsModule,
    NzButtonModule,
    NzCardModule,
    NzEmptyModule,
    NzModalModule,
    NzSegmentedModule,
    NzTableModule,
    PageHeaderComponent,
    SdiHtmlPreviewComponent,
    SupplierFatturaPaImporterComponent,
    TranslatePipe,
  ],
  template: `
    <app-page-header
      [title]="'sdiInbox.title' | translate"
      [subtitle]="'sdiInbox.subtitle' | translate"
    />
    <nz-card [nzTitle]="'sdiTransmissions.import.title' | translate">
      <app-supplier-fatturapa-importer (imported)="reload()" />
    </nz-card>
    <nz-card>
      <nz-table
        #table
        nzSize="small"
        [nzFrontPagination]="false"
        [nzData]="rows()"
        [nzLoading]="loading()"
      >
        <thead>
          <tr>
            <th>{{ 'sdiCockpit.document' | translate }}</th>
            <th>{{ 'sdiCockpit.format' | translate }}</th>
            <th>{{ 'sdiInbox.file' | translate }}</th>
            <th>{{ 'sdiInbox.received' | translate }}</th>
            <th>{{ 'sdiCockpit.actions' | translate }}</th>
          </tr>
        </thead>
        <tbody>
          @for (row of table.data; track row.id) {
            <tr>
              <td>
                {{ row.document_type }} {{ row.document_number }}
                <small>{{ row.document_date }}</small>
              </td>
              <td>{{ row.format_transmission }}</td>
              <td>{{ row.file_name }}</td>
              <td>{{ row.transmitted_at ? (row.transmitted_at | date: 'short') : '-' }}</td>
              <td>
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  (click)="open(row)"
                  data-testid="inbox-preview"
                >
                  {{ 'sdiInbox.preview' | translate }}
                </button>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!loading() && rows().length === 0) {
        <nz-empty [nzNotFoundContent]="'sdiInbox.empty' | translate"></nz-empty>
      }
    </nz-card>
    <nz-modal
      [nzVisible]="selected() !== null"
      [nzTitle]="'sdiInbox.preview' | translate"
      nzWidth="900px"
      [nzFooter]="null"
      (nzOnCancel)="selected.set(null)"
    >
      <ng-container *nzModalContent>
        <nz-segmented
          [nzOptions]="styles()"
          [ngModel]="style()"
          (ngModelChange)="setStyle($event)"
          data-testid="inbox-styles"
        />
        <app-sdi-html-preview [content]="html()" />
      </ng-container>
    </nz-modal>
  `,
})
export class SdiInboxComponent implements OnInit {
  private readonly api = inject(FpaDocumentsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly rows = signal<FpaDocument[]>([]);
  protected readonly loading = signal(false);
  protected readonly selected = signal<FpaDocument | null>(null);
  protected readonly html = signal<Blob | null>(null);
  protected readonly style = signal<'ministerial' | 'assosoftware'>('ministerial');
  protected readonly styles = () =>
    (['ministerial', 'assosoftware'] as const).map((value) => ({
      value,
      label: this.i18n.translate('sdiPreflight.style.' + value),
    }));

  ngOnInit(): void {
    this.reload();
  }

  reload(): void {
    this.loading.set(true);
    this.api.list({ direction: 'inbound', per_page: 50 }).subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      },
      error: (error) => {
        this.loading.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }

  protected open(doc: FpaDocument): void {
    this.selected.set(doc);
    this.load(doc, this.style());
  }

  protected setStyle(style: 'ministerial' | 'assosoftware'): void {
    this.style.set(style);
    const doc = this.selected();
    if (doc !== null) {
      this.load(doc, style);
    }
  }

  private load(doc: FpaDocument, style: 'ministerial' | 'assosoftware'): void {
    this.api.render(doc.id, style).subscribe({
      next: (blob) => this.html.set(blob),
      error: (error) => reportHttpError(error, this.message, this.i18n),
    });
  }
}
