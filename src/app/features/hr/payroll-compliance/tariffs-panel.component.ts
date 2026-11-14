import { Component, computed, inject, input, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { I18nService, PayrollComplianceApiService, TariffSummaryRow } from '@core';
import { TranslatePipe, GridExportDirective } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzTableModule } from 'ng-zorro-antd/table';
import { Observable } from 'rxjs';
import { reportHttpError } from '../shared/hr-http.util';

/** Summary of the imported ESTV withholding tax tariffs and the import of a tariff file (or its pasted text). */
@Component({
  selector: 'app-tariffs-panel',
  styleUrl: './tariffs-panel.component.scss',
  imports: [
    GridExportDirective,
    FormsModule, NzButtonModule, NzInputModule, NzTableModule, TranslatePipe],
  template: `
    <nz-table
      #table
      [nzData]="rows()"
      [nzLoading]="loading()"
      [nzFrontPagination]="false"
      nzSize="small"
      class="mb-3"
    >
      <thead>
        <tr>
          @for (column of columns(); track column) {
            <th>{{ column }}</th>
          }
        </tr>
      </thead>
      <tbody>
        @for (row of table.data; track $index) {
          <tr>
            @for (column of columns(); track column) {
              <td>{{ text(row[column]) }}</td>
            }
          </tr>
        }
      </tbody>
    </nz-table>

    @if (canWrite()) {
      <h4>{{ 'hrmCompliance.tariffs.importTitle' | translate }}</h4>
      <div class="filter-bar">
        <div>
          <label for="tariff-file">{{ 'hrmCompliance.tariffs.file' | translate }}</label>
          <input id="tariff-file" type="file" accept=".txt,.csv,.xml" (change)="pickFile($event)" />
        </div>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="!file()"
          [nzLoading]="importing()"
          (click)="importFile()"
        >
          {{ 'hrmCompliance.tariffs.importFile' | translate }}
        </button>
      </div>
      <label for="tariff-content">{{ 'hrmCompliance.tariffs.content' | translate }}</label>
      <textarea
        nz-input
        id="tariff-content"
        rows="4"
        [ngModel]="content()"
        (ngModelChange)="content.set($event)"
      ></textarea>
      <button
        nz-button
        class="mt-2"
        type="button"
        [disabled]="!content().trim()"
        [nzLoading]="importing()"
        (click)="importContent()"
      >
        {{ 'hrmCompliance.tariffs.importContent' | translate }}
      </button>
    }
  `,
})
export class TariffsPanelComponent implements OnInit {
  readonly canWrite = input(false);

  private readonly api = inject(PayrollComplianceApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  protected readonly rows = signal<TariffSummaryRow[]>([]);
  protected readonly columns = computed(() => Object.keys(this.rows()[0] ?? {}));
  protected readonly loading = signal(false);
  protected readonly importing = signal(false);
  protected readonly file = signal<File | null>(null);
  protected readonly content = signal('');

  ngOnInit(): void {
    this.reload();
  }

  protected text(value: unknown): string {
    return value === null || value === undefined ? '' : String(value);
  }

  protected pickFile(event: Event): void {
    this.file.set((event.target as HTMLInputElement).files?.item(0) ?? null);
  }

  protected importFile(): void {
    const file = this.file();
    if (file) {
      this.runImport(this.api.importWithholdingTaxTariffs({ file }));
    }
  }

  protected importContent(): void {
    this.runImport(this.api.importWithholdingTaxTariffs({ content: this.content() }));
  }

  private runImport(request: Observable<{ data: { imported: number } }>): void {
    this.importing.set(true);
    request.subscribe({
      next: (res) => {
        this.importing.set(false);
        this.message.success(
          `${this.i18n.translate('hrmCompliance.tariffs.imported')}: ${res.data.imported}`,
        );
        this.file.set(null);
        this.content.set('');
        this.reload();
      },
      error: (err: unknown) => {
        this.importing.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }

  private reload(): void {
    this.loading.set(true);
    this.api.getWithholdingTaxTariffs().subscribe({
      next: (res) => {
        this.rows.set(res.data);
        this.loading.set(false);
      },
      error: (err: unknown) => {
        this.loading.set(false);
        reportHttpError(err, this.message, this.i18n);
      },
    });
  }
}
