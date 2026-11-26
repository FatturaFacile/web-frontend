import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PC_IMPORT_MODES, PcImportMode, PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { CatalogTransferStore } from './catalog-transfer.store';
import { PcOutcome, PRODUCT_CATALOG_MODULE } from './product-catalog.util';

const ACCEPTED = /\.(csv|xlsx)$/i;

/**
 * Bulk import and export of the catalog as csv or xlsx: the file schema, the template, the export, and the import in dry-run,
 * atomic or partial mode with the errors of every row.
 */
@Component({
  selector: 'app-pc-transfer',
  imports: [
    FormsModule,
    NzAlertModule,
    NzButtonModule,
    NzSelectModule,
    NzTableModule,
    NzTagModule,
    PageHeaderComponent,
    TranslatePipe,
  ],
  providers: [CatalogTransferStore],
  styleUrl: './product-catalog.scss',
  template: `
    <app-page-header [title]="'PAGE_TITLE.PRODUCT_CATALOG_TRANSFER' | translate"></app-page-header>

    @if (failure(); as problem) {
      <nz-alert
        nzType="error"
        nzShowIcon
        nzCloseable
        class="form-alert"
        [nzMessage]="problem.errorKey ?? '' | translate: problem.params"
        [nzDescription]="problem.detail"
        (nzOnClose)="failure.set(null)"
      ></nz-alert>
    }
    @if (store.error(); as key) {
      <nz-alert
        nzType="error"
        nzShowIcon
        class="form-alert"
        [nzMessage]="key | translate"
      ></nz-alert>
    }

    <h3>{{ 'productCatalog.action.export' | translate }}</h3>
    <div class="actions">
      <button nz-button type="button" [disabled]="store.busy()" (click)="export('xlsx')">
        XLSX
      </button>
      <button nz-button type="button" [disabled]="store.busy()" (click)="export('csv')">CSV</button>
      <button nz-button type="button" [disabled]="store.busy()" (click)="template('xlsx')">
        {{ 'productCatalog.action.template' | translate }} XLSX
      </button>
      <button nz-button type="button" [disabled]="store.busy()" (click)="template('csv')">
        {{ 'productCatalog.action.template' | translate }} CSV
      </button>
    </div>

    @if (store.schema(); as schema) {
      <p class="hint">
        {{ 'productCatalog.hint.schema' | translate: { max: schema.max_rows } }}
      </p>
      <p class="columns">
        @for (column of schema.columns; track column) {
          <nz-tag [nzColor]="schema.required.includes(column) ? 'blue' : 'default'">{{
            column
          }}</nz-tag>
        }
      </p>
    }

    @if (canWrite) {
      <h3>{{ 'productCatalog.action.import' | translate }}</h3>
      <div class="toolbar">
        <label class="field" for="pc-import-file">
          <span>{{ 'productCatalog.field.file' | translate }}</span>
          <input id="pc-import-file" type="file" accept=".csv,.xlsx" (change)="pick($event)" />
        </label>
        <label class="field" for="pc-import-mode">
          <span>{{ 'productCatalog.field.mode' | translate }}</span>
          <nz-select nzId="pc-import-mode" [ngModel]="mode()" (ngModelChange)="mode.set($event)">
            @for (option of modes; track option) {
              <nz-option
                [nzValue]="option"
                [nzLabel]="'productCatalog.mode.' + option | translate"
              ></nz-option>
            }
          </nz-select>
          <small>{{ 'productCatalog.hint.mode.' + mode() | translate }}</small>
        </label>
        <button
          nz-button
          nzType="primary"
          type="button"
          [disabled]="file() === null || store.busy()"
          [nzLoading]="store.busy()"
          (click)="runImport()"
        >
          {{ 'productCatalog.action.import' | translate }}
        </button>
      </div>
    }

    @if (store.report(); as report) {
      <nz-alert
        class="form-alert"
        nzShowIcon
        [nzType]="report.failed === 0 ? 'success' : 'warning'"
        [nzMessage]="
          (report.committed
            ? 'productCatalog.message.imported'
            : 'productCatalog.message.validated'
          ) | translate
        "
        [nzDescription]="summary()"
      ></nz-alert>

      @if (report.errors.length > 0) {
        <h4>{{ 'productCatalog.section.errors' | translate }}</h4>
        <nz-table #errorTable [nzData]="report.errors" nzSize="small" [nzPageSize]="20">
          <thead>
            <tr>
              <th>{{ 'productCatalog.column.line' | translate }}</th>
              <th>{{ 'productCatalog.column.sku' | translate }}</th>
              <th>{{ 'productCatalog.column.field' | translate }}</th>
              <th>{{ 'productCatalog.column.message' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of errorTable.data; track $index) {
              <tr class="error-row">
                <td>{{ row.line }}</td>
                <td>{{ row.sku }}</td>
                <td>{{ row.field }}</td>
                <td>{{ row.message }}</td>
              </tr>
            }
          </tbody>
        </nz-table>
      }
    }
  `,
})
export class CatalogTransferComponent implements OnInit {
  protected readonly store = inject(CatalogTransferStore);
  private readonly permissions = inject(PermissionsService);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly canWrite = this.permissions.canWrite(PRODUCT_CATALOG_MODULE);
  protected readonly modes = PC_IMPORT_MODES;
  protected readonly mode = signal<PcImportMode>('dry_run');
  protected readonly file = signal<File | null>(null);
  protected readonly failure = signal<PcOutcome | null>(null);

  protected readonly summary = computed(() => {
    const report = this.store.report();
    return report === null
      ? ''
      : this.i18n.instant('productCatalog.message.importSummary', {
          total: report.total,
          created: report.created,
          updated: report.updated,
          failed: report.failed,
        });
  });

  ngOnInit(): void {
    void this.store.init();
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    const picked = input.files?.item(0) ?? null;
    this.store.clearReport();
    this.file.set(picked !== null && ACCEPTED.test(picked.name) ? picked : null);
  }

  protected async export(format: 'csv' | 'xlsx'): Promise<void> {
    const outcome = await this.store.export(format);
    this.failure.set(outcome.ok ? null : outcome);
    if (outcome.ok) {
      this.message.success(this.i18n.instant('productCatalog.message.exported'));
    }
  }

  protected async template(format: 'csv' | 'xlsx'): Promise<void> {
    const outcome = await this.store.template(format);
    this.failure.set(outcome.ok ? null : outcome);
  }

  protected async runImport(): Promise<void> {
    const picked = this.file();
    if (picked === null) {
      return;
    }
    const outcome = await this.store.import(picked, this.mode());
    this.failure.set(outcome.ok ? null : outcome);
  }
}
