import { HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Service, signal } from '@angular/core';
import { BomImportReport, ManufacturingApiService } from '@core';
import { catchError, finalize, Observable, of, tap, throwError } from 'rxjs';
import { readSpreadsheetFile } from './bom-spreadsheet';
import {
  autoMapColumns,
  BOM_IMPORT_FIELDS,
  BomImportField,
  mapRows,
  missingRequired,
} from './bom.utils';

export type ImportStep = 0 | 1 | 2 | 3;
export type ColumnMapping = Record<BomImportField, number | null>;

const EMPTY_MAPPING = Object.fromEntries(BOM_IMPORT_FIELDS.map((field) => [field, null])) as ColumnMapping;

/**
 * State of the BOM importer wizard: upload (parsed on the client), column mapping, dry-run report per row and commit. Nothing
 * reaches the server before the dry run, and the commit is only offered once the dry run came back valid for the rows now mapped.
 */
@Service()
export class BomImportStore {
  private readonly api = inject(ManufacturingApiService);

  readonly step = signal<ImportStep>(0);
  readonly fileName = signal<string | null>(null);
  readonly matrix = signal<string[][]>([]);
  readonly mapping = signal<ColumnMapping>(EMPTY_MAPPING);
  readonly productCode = signal('');
  readonly name = signal('');
  readonly report = signal<BomImportReport | null>(null);
  readonly busy = signal(false);
  readonly committed = signal(false);
  readonly parseError = signal(false);
  private readonly reportedRows = signal<string | null>(null);

  readonly headers = computed(() => this.matrix()[0] ?? []);
  readonly dataRows = computed(() => this.matrix().slice(1));
  readonly payloadRows = computed(() => mapRows(this.dataRows(), this.mapping()));
  readonly missing = computed(() => missingRequired(this.mapping()));
  readonly canMap = computed(() => this.dataRows().length > 0);
  readonly canDryRun = computed(
    () =>
      this.missing().length === 0 &&
      this.payloadRows().length > 0 &&
      this.productCode().trim() !== '' &&
      this.name().trim() !== '',
  );
  /** The report on screen belongs to the rows and header data in the form now. */
  readonly reportCurrent = computed(() => this.report() !== null && this.reportedRows() === this.signature());
  readonly canCommit = computed(() => this.reportCurrent() && this.report()?.valid === true && !this.committed());
  readonly errorCount = computed(() => this.report()?.rows.filter((row) => row.errors.length > 0).length ?? 0);

  /** Reads and parses the file on the client, then maps the columns by header name. */
  async loadFile(file: File): Promise<void> {
    this.parseError.set(false);
    try {
      const matrix = await readSpreadsheetFile(file);
      this.matrix.set(matrix);
      this.fileName.set(file.name);
      this.mapping.set(matrix.length > 0 ? autoMapColumns(matrix[0]) : EMPTY_MAPPING);
      this.report.set(null);
      this.committed.set(false);
      if (!this.name()) {
        this.name.set(file.name.replace(/\.[^.]+$/, ''));
      }
    } catch {
      this.matrix.set([]);
      this.fileName.set(null);
      this.parseError.set(true);
    }
  }

  setMapping(field: BomImportField, column: number | null): void {
    this.mapping.update((current) => ({ ...current, [field]: column }));
  }

  go(step: ImportStep): void {
    this.step.set(step);
  }

  dryRun(): Observable<unknown> {
    return this.send(true);
  }

  commit(): Observable<unknown> {
    return this.send(false);
  }

  reset(): void {
    this.step.set(0);
    this.fileName.set(null);
    this.matrix.set([]);
    this.mapping.set(EMPTY_MAPPING);
    this.report.set(null);
    this.committed.set(false);
    this.parseError.set(false);
  }

  private send(dryRun: boolean): Observable<unknown> {
    this.busy.set(true);

    return this.api
      .importBom({
        product_code: this.productCode().trim(),
        name: this.name().trim(),
        dry_run: dryRun,
        rows: this.payloadRows(),
      })
      .pipe(
        tap((res) => {
          if (dryRun) {
            this.report.set(res.data);
            this.reportedRows.set(this.signature());
          } else {
            // 201: the draft BOM was created; the body is the BOM, not a report.
            this.committed.set(true);
          }
        }),
        catchError((error: unknown) => {
          // A refused commit answers 422 with the same per-row report as the dry run.
          const body = error instanceof HttpErrorResponse && error.status === 422 ? error.error : null;
          const report = (body?.data ?? body) as BomImportReport | null;
          if (report && Array.isArray(report.rows)) {
            this.report.set(report);
            this.reportedRows.set(this.signature());

            return of(null);
          }

          return throwError(() => error);
        }),
        finalize(() => this.busy.set(false)),
      );
  }

  private signature(): string {
    return JSON.stringify([this.productCode().trim(), this.name().trim(), this.payloadRows()]);
  }
}
