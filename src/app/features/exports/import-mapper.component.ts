import { Component, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ExportsApiService, I18nService, SpreadsheetImportPreview, SpreadsheetImportResult } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { reportHttpError } from '../hr/shared/hr-http.util';

/** Import of contacts from a CSV or XLSX file: choose the file, map its columns to the contact fields, check with a dry run, import. */
@Component({
  selector: 'app-import-mapper',
  imports: [FormsModule, NzAlertModule, NzButtonModule, NzCardModule, NzCheckboxModule, NzSelectModule, NzTableModule, TranslatePipe],
  styles: ['.mapping-row { display: flex; align-items: center; gap: var(--space-3); margin-bottom: var(--space-2); } .mapping-row span { width: 180px; } p { margin-bottom: var(--space-3); color: var(--text-secondary); }'],
  template: `
    <nz-card [nzTitle]="'exportsPage.importTitle' | translate" class="mb-3">
      <p>{{ 'exportsPage.importHint' | translate }}</p>
      <input type="file" accept=".csv,.txt,.xlsx" [disabled]="!canWrite()" (change)="choose($event)" [attr.aria-label]="'exportsPage.importFile' | translate" />

      @if (preview(); as data) {
        <p class="mt-3">{{ 'exportsPage.importRows' | translate: { count: data.row_count } }}</p>
        @for (field of data.fields; track field) {
          <div class="mapping-row">
            <span>{{ 'exportsPage.importFields.' + field | translate }}</span>
            <nz-select style="width: 260px" nzAllowClear [ngModel]="mapping()[field] ?? null" (ngModelChange)="setMapping(field, $event)" [nzPlaceHolder]="'exportsPage.importNoColumn' | translate" [attr.aria-label]="'exportsPage.importFields.' + field | translate">
              @for (header of data.headers; track header) {
                <nz-option [nzValue]="header" [nzLabel]="header"></nz-option>
              }
            </nz-select>
          </div>
        }
        <label nz-checkbox [ngModel]="dryRun()" (ngModelChange)="dryRun.set($event)">{{ 'exportsPage.importDryRun' | translate }}</label>
        <div class="mt-3">
          <button nz-button nzType="primary" type="button" [nzLoading]="busy()" [disabled]="!canWrite() || Object.keys(mapping()).length === 0" (click)="run()">
            {{ (dryRun() ? 'exportsPage.importCheck' : 'exportsPage.importRun') | translate }}
          </button>
        </div>
      }

      @if (result(); as outcome) {
        <nz-alert class="mt-3" [nzType]="outcome.failed > 0 ? 'warning' : 'success'" nzShowIcon
          [nzMessage]="(outcome.dry_run ? 'exportsPage.importCheckResult' : 'exportsPage.importResult') | translate: { created: outcome.created, skipped: outcome.skipped, failed: outcome.failed }"></nz-alert>
        @if (outcome.errors.length > 0) {
          <nz-table nzSize="small" class="mt-3" [nzData]="outcome.errors" [nzPageSize]="10">
            <thead>
              <tr>
                <th>{{ 'exportsPage.importLine' | translate }}</th>
                <th>{{ 'exportsPage.importProblem' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (error of outcome.errors; track error.line) {
                <tr>
                  <td>{{ error.line }}</td>
                  <td>{{ error.messages.join(' ') }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      }
    </nz-card>
  `,
})
export class ImportMapperComponent {
  private readonly api = inject(ExportsApiService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(I18nService);

  readonly canWrite = input(false);

  protected readonly Object = Object;
  protected readonly preview = signal<SpreadsheetImportPreview | null>(null);
  protected readonly mapping = signal<Record<string, string>>({});
  protected readonly dryRun = signal(true);
  protected readonly result = signal<SpreadsheetImportResult | null>(null);
  protected readonly busy = signal(false);

  private file: File | null = null;

  choose(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.item(0) ?? null;
    this.file = file;
    this.preview.set(null);
    this.result.set(null);

    if (file === null) {
      return;
    }

    this.api.previewImport('contacts', file).subscribe({
      next: (response) => {
        this.preview.set(response.data);
        this.mapping.set({ ...response.data.suggested_mapping });
      },
      error: (error: unknown) => reportHttpError(error, this.message, this.i18n),
    });
  }

  setMapping(field: string, header: string | null): void {
    const next = { ...this.mapping() };

    if (header === null) {
      delete next[field];
    } else {
      next[field] = header;
    }

    this.mapping.set(next);
  }

  run(): void {
    if (this.file === null) {
      return;
    }

    this.busy.set(true);
    this.api.importFile('contacts', this.file, this.mapping(), this.dryRun()).subscribe({
      next: (response) => {
        this.result.set(response.data);
        this.busy.set(false);
      },
      error: (error: unknown) => {
        this.busy.set(false);
        reportHttpError(error, this.message, this.i18n);
      },
    });
  }
}
