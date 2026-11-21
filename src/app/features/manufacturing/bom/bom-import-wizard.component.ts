import { Component, DestroyRef, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzStepsModule } from 'ng-zorro-antd/steps';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { BomImportStore, ImportStep } from './bom-import.store';
import { BOM_IMPORT_FIELDS, BOM_IMPORT_REQUIRED, BomImportField } from './bom.utils';

const PREVIEW_ROWS = 5;

/**
 * BOM importer wizard: upload a CSV or Excel file (parsed in the browser), map its columns, check every row with a dry run
 * and only then create the draft BOM.
 */
@Component({
  selector: 'app-bom-import-wizard',
  providers: [BomImportStore],
  imports: [
    FormsModule,
    PageHeaderComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzSelectModule,
    NzStepsModule,
    NzTableModule,
    NzTagModule,
  ],
  styles: `
    .panel { margin: 24px 0; display: grid; gap: 16px; max-width: 960px }
    .fields { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 12px }
    .map-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 12px }
    .map-grid nz-select { width: 100% }
    .actions { display: flex; gap: 12px; flex-wrap: wrap }
    .err { color: var(--ant-color-error, #ff4d4f) }
  `,
  template: `
    <app-page-header
      [title]="'MFG_BOM.IMPORT_TITLE' | translate"
      [subtitle]="'MFG_BOM.IMPORT_SUBTITLE' | translate"
    ></app-page-header>

    <nz-steps [nzCurrent]="store.step()" nzSize="small">
      <nz-step [nzTitle]="'MFG_BOM.IMPORT_STEP_UPLOAD' | translate"></nz-step>
      <nz-step [nzTitle]="'MFG_BOM.IMPORT_STEP_MAP' | translate"></nz-step>
      <nz-step [nzTitle]="'MFG_BOM.IMPORT_STEP_CHECK' | translate"></nz-step>
      <nz-step [nzTitle]="'MFG_BOM.IMPORT_STEP_COMMIT' | translate"></nz-step>
    </nz-steps>

    <div class="panel">
      @switch (store.step()) {
        @case (0) {
          <div class="fields">
            <input
              nz-input
              [placeholder]="'MFG_BOM.PRODUCT_CODE' | translate"
              [attr.aria-label]="'MFG_BOM.PRODUCT_CODE' | translate"
              [ngModel]="store.productCode()"
              (ngModelChange)="store.productCode.set($event)"
              data-testid="product-code"
            />
            <input
              nz-input
              [placeholder]="'MFG_BOM.BOM_NAME' | translate"
              [attr.aria-label]="'MFG_BOM.BOM_NAME' | translate"
              [ngModel]="store.name()"
              (ngModelChange)="store.name.set($event)"
              data-testid="bom-name"
            />
          </div>
          <div>
            <label for="bom-file">{{ 'MFG_BOM.IMPORT_FILE' | translate }}</label><br />
            <input
              id="bom-file"
              type="file"
              accept=".csv,.txt,.xlsx"
              data-testid="file-input"
              (change)="onFile($any($event.target).files)"
            />
          </div>
          @if (store.parseError()) {
            <nz-alert nzType="error" nzShowIcon [nzMessage]="'MFG_BOM.IMPORT_PARSE_ERROR' | translate"></nz-alert>
          }
          @if (store.fileName(); as fileName) {
            <nz-alert
              nzType="success"
              nzShowIcon
              data-testid="file-info"
              [nzMessage]="'MFG_BOM.IMPORT_FILE_READ' | translate: { file: fileName, rows: store.dataRows().length }"
            ></nz-alert>
          }
        }
        @case (1) {
          <p>{{ 'MFG_BOM.IMPORT_MAP_HINT' | translate }}</p>
          <div class="map-grid">
            @for (field of fields; track field) {
              <div>
                <label [attr.for]="'map-' + field">
                  {{ fieldKey(field) | translate }}@if (isRequired(field)) { * }
                </label>
                <nz-select
                  [nzId]="'map-' + field"
                  nzAllowClear
                  [nzPlaceHolder]="'MFG_BOM.IMPORT_NOT_MAPPED' | translate"
                  [ngModel]="store.mapping()[field]"
                  (ngModelChange)="store.setMapping(field, $event ?? null)"
                >
                  @for (header of store.headers(); track $index) {
                    <nz-option [nzValue]="$index" [nzLabel]="header || ('MFG_BOM.IMPORT_COLUMN' | translate) + ' ' + ($index + 1)"></nz-option>
                  }
                </nz-select>
              </div>
            }
          </div>
          @if (store.missing().length > 0) {
            <nz-alert nzType="warning" nzShowIcon data-testid="missing" [nzMessage]="'MFG_BOM.IMPORT_MISSING_REQUIRED' | translate"></nz-alert>
          }
          <nz-table nzSize="small" [nzData]="preview()" [nzFrontPagination]="false" [nzShowPagination]="false">
            <thead>
              <tr>
                @for (field of fields; track field) {
                  <th scope="col">{{ fieldKey(field) | translate }}</th>
                }
              </tr>
            </thead>
            <tbody>
              @for (row of preview(); track $index) {
                <tr>
                  @for (field of fields; track field) {
                    <td>{{ row[field] ?? '' }}</td>
                  }
                </tr>
              }
            </tbody>
          </nz-table>
        }
        @case (2) {
          <div class="actions">
            <button nz-button nzType="primary" type="button" data-testid="dry-run" [disabled]="!store.canDryRun() || store.busy()" [nzLoading]="store.busy()" (click)="dryRun()">
              {{ 'MFG_BOM.IMPORT_RUN_CHECK' | translate }}
            </button>
          </div>
          @if (store.report(); as report) {
            <nz-alert
              data-testid="report-summary"
              [nzType]="report.valid ? 'success' : 'error'"
              nzShowIcon
              [nzMessage]="(report.valid ? 'MFG_BOM.IMPORT_VALID' : 'MFG_BOM.IMPORT_INVALID') | translate: { errors: store.errorCount(), rows: report.rows.length }"
            ></nz-alert>
            <nz-table nzSize="small" [nzData]="report.rows" [nzFrontPagination]="false" [nzShowPagination]="false">
              <thead>
                <tr>
                  <th scope="col">{{ 'MFG_BOM.IMPORT_LINE' | translate }}</th>
                  <th scope="col">{{ 'MFG_BOM.IMPORT_STATUS' | translate }}</th>
                  <th scope="col">{{ 'MFG_BOM.IMPORT_ERRORS' | translate }}</th>
                </tr>
              </thead>
              <tbody>
                @for (row of report.rows; track row.line) {
                  <tr [attr.data-testid]="'report-row-' + row.line">
                    <td>{{ row.line }}</td>
                    <td>
                      <nz-tag [nzColor]="row.errors.length > 0 ? 'red' : 'green'">{{ row.status }}</nz-tag>
                    </td>
                    <td class="err">{{ row.errors.join(' · ') }}</td>
                  </tr>
                }
              </tbody>
            </nz-table>
          }
        }
        @case (3) {
          @if (store.committed()) {
            <nz-alert nzType="success" nzShowIcon data-testid="committed" [nzMessage]="'MFG_BOM.IMPORT_DONE' | translate"></nz-alert>
            <div class="actions">
              <button nz-button type="button" (click)="store.reset()">{{ 'MFG_BOM.IMPORT_ANOTHER' | translate }}</button>
            </div>
          } @else {
            <p>{{ 'MFG_BOM.IMPORT_COMMIT_HINT' | translate }}</p>
            @if (store.report() && !store.reportCurrent()) {
              <nz-alert nzType="warning" nzShowIcon [nzMessage]="'MFG_BOM.IMPORT_STALE' | translate"></nz-alert>
            }
            @if (store.report() && store.reportCurrent() && !store.report()?.valid) {
              <nz-alert nzType="error" nzShowIcon [nzMessage]="'MFG_BOM.IMPORT_COMMIT_REFUSED' | translate"></nz-alert>
            }
            <div class="actions">
              <button nz-button nzType="primary" type="button" data-testid="commit" [disabled]="!store.canCommit() || store.busy()" [nzLoading]="store.busy()" (click)="commit()">
                {{ 'MFG_BOM.IMPORT_COMMIT' | translate }}
              </button>
            </div>
          }
        }
      }
    </div>

    @if (!store.committed()) {
      <div class="actions">
        <button nz-button type="button" data-testid="back" [disabled]="store.step() === 0" (click)="move(-1)">
          {{ 'MFG_BOM.IMPORT_BACK' | translate }}
        </button>
        <button nz-button nzType="primary" type="button" data-testid="next" [disabled]="!canNext()" (click)="move(1)">
          {{ 'MFG_BOM.IMPORT_NEXT' | translate }}
        </button>
      </div>
    }
  `,
})
export class BomImportWizardComponent {
  protected readonly store = inject(BomImportStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly fields = BOM_IMPORT_FIELDS;

  protected fieldKey(field: BomImportField): string {
    return `MFG_BOM.IMPORT_FIELD_${field.toUpperCase()}`;
  }

  protected isRequired(field: BomImportField): boolean {
    return BOM_IMPORT_REQUIRED.includes(field);
  }

  protected preview(): Record<string, unknown>[] {
    return this.store.payloadRows().slice(0, PREVIEW_ROWS) as unknown as Record<string, unknown>[];
  }

  protected canNext(): boolean {
    switch (this.store.step()) {
      case 0:
        return this.store.canMap() && this.store.productCode().trim() !== '' && this.store.name().trim() !== '';
      case 1:
        return this.store.canDryRun();
      case 2:
        return this.store.canCommit();
      default:
        return false;
    }
  }

  protected move(offset: -1 | 1): void {
    const next = Math.min(3, Math.max(0, this.store.step() + offset)) as ImportStep;
    this.store.go(next);
  }

  protected onFile(files: FileList | null): void {
    const file = files?.item(0);
    if (file) {
      void this.store.loadFile(file);
    }
  }

  protected dryRun(): void {
    this.store
      .dryRun()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({ error: () => this.message.error(this.i18n.instant('MFG_BOM.IMPORT_ERROR')) });
  }

  protected commit(): void {
    this.store
      .commit()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: () => {
          if (this.store.committed()) {
            this.message.success(this.i18n.instant('MFG_BOM.IMPORT_DONE'));
          }
        },
        error: () => this.message.error(this.i18n.instant('MFG_BOM.IMPORT_ERROR')),
      });
  }
}
