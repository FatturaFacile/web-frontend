import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { firstValueFrom } from 'rxjs';
import {
  ExmLinePayload,
  ExmLookups,
  ExmReceiptScan,
  ExmReport,
  ExpenseManagementApiService,
  TranslateService,
} from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { failureOf } from './expense-management.util';
import { FiscalNoticesComponent } from './fiscal-notices.component';
import { LineFormComponent, LinePrefill } from './line-form.component';
import { ReceiptViewerComponent } from './receipt-viewer.component';
import { ViolationBadgesComponent } from './violation-badges.component';

/** Below this OCR confidence the reviewer is asked to check every field. */
export const LOW_OCR_CONFIDENCE = 0.6;

/**
 * Receipt workbench (Mod 075): upload a receipt, read it with the OCR of the API and review it side by side. The previewer
 * (zoom, pan, rotate) sits next to the expense line form, filled with the extracted merchant, date, currency, amount and
 * VAT. Duplicate warnings (same file, or same merchant, date and amount) and the violations show while the line is typed.
 */
@Component({
  selector: 'app-exm-receipt-workbench',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FiscalNoticesComponent,
    FormsModule,
    LineFormComponent,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzProgressModule,
    NzSelectModule,
    NzSpinModule,
    PageHeaderComponent,
    ReceiptViewerComponent,
    RouterLink,
    TranslatePipe,
    ViolationBadgesComponent,
  ],
  template: `
    <app-page-header
      [title]="'PAGE_TITLE.EXPENSE_MANAGEMENT_WORKBENCH' | translate"
    ></app-page-header>

    <app-exm-fiscal-notices
      [jurisdiction]="lookups()?.jurisdiction ?? 'IT'"
      [noticeCodes]="lookups()?.fiscal_notice_codes ?? []"
    ></app-exm-fiscal-notices>

    <div class="toolbar">
      <label class="field" for="exm-wb-report">
        <span>{{ 'expenseManagement.field.report' | translate }}</span>
        <nz-select
          nzId="exm-wb-report"
          nzShowSearch
          [ngModel]="reportId()"
          (ngModelChange)="reportId.set($event)"
        >
          @for (report of reports(); track report.id) {
            <nz-option
              [nzValue]="report.id"
              [nzLabel]="report.report_number + ' · ' + (report.employee?.name ?? '')"
            ></nz-option>
          }
        </nz-select>
      </label>
      <label class="field" for="exm-wb-file">
        <span>{{ 'expenseManagement.workbench.file' | translate }}</span>
        <input
          id="exm-wb-file"
          type="file"
          accept="image/*,application/pdf,text/plain"
          (change)="pick($event)"
        />
      </label>
      <label class="field wide" for="exm-wb-ocr">
        <span>{{ 'expenseManagement.workbench.ocrText' | translate }}</span>
        <input
          nz-input
          id="exm-wb-ocr"
          [ngModel]="ocrText()"
          (ngModelChange)="ocrText.set($event)"
        />
      </label>
      <button
        nz-button
        nzType="primary"
        type="button"
        [disabled]="!file() || scanning()"
        [nzLoading]="scanning()"
        (click)="scan()"
      >
        {{ 'expenseManagement.action.scan' | translate }}
      </button>
      @if (reportId()) {
        <a nz-button [routerLink]="['/expense-management/reports', reportId()]">
          {{ 'expenseManagement.action.openReport' | translate }}
        </a>
      }
    </div>

    @if (errorKey(); as error) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="error | translate"
      ></nz-alert>
    }

    @if (result(); as scanned) {
      <div class="summary" role="status">
        <span>{{ 'expenseManagement.workbench.confidence' | translate }}</span>
        <nz-progress
          class="confidence"
          [nzPercent]="confidencePercent()"
          nzSize="small"
          [nzStatus]="lowConfidence() ? 'exception' : 'success'"
        ></nz-progress>
        <span class="muted">{{ scanned.file_name }}</span>
      </div>
      @if (lowConfidence()) {
        <nz-alert
          class="feedback"
          nzType="warning"
          nzShowIcon
          [nzMessage]="'expenseManagement.violation.low_ocr_confidence' | translate"
        ></nz-alert>
      }
      @if (scanned.duplicate_warnings.length > 0) {
        <nz-alert
          class="feedback"
          nzType="warning"
          nzShowIcon
          [nzMessage]="'expenseManagement.workbench.duplicates' | translate"
          [nzDescription]="duplicates"
        ></nz-alert>
        <ng-template #duplicates>
          <app-exm-violation-badges
            [violations]="scanned.duplicate_warnings"
          ></app-exm-violation-badges>
          @for (warning of scanned.duplicate_warnings; track $index) {
            @if (warning.matched_report_number) {
              <div class="muted">{{ warning.matched_report_number }}</div>
            }
          }
        </ng-template>
      }

      <div class="split">
        <section class="pane" [attr.aria-label]="'expenseManagement.workbench.viewer' | translate">
          <app-exm-receipt-viewer [receiptId]="scanned.receipt_id"></app-exm-receipt-viewer>
        </section>
        <section class="pane" [attr.aria-label]="'expenseManagement.section.line' | translate">
          <app-exm-line-form
            [categories]="lookups()?.categories ?? []"
            [currency]="lookups()?.base_currency ?? 'EUR'"
            [jurisdiction]="lookups()?.jurisdiction ?? 'IT'"
            [prefill]="prefill()"
            [reported]="scanned.duplicate_warnings"
            [saving]="saving()"
            [errorKey]="saveError()"
            (saved)="save($event)"
            (cancelled)="discard()"
          ></app-exm-line-form>
        </section>
      </div>
    }
  `,
  styles: `
    .toolbar {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
      align-items: flex-end;
      margin-bottom: 16px;
    }
    .field {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      gap: 4px;
    }
    .wide {
      min-width: 280px;
    }
    .feedback {
      margin-bottom: 12px;
    }
    .summary {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
    }
    .confidence {
      width: 160px;
    }
    .split {
      display: grid;
      grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
      gap: 24px;
    }
    @media (max-width: 960px) {
      .split {
        grid-template-columns: 1fr;
      }
    }
    .muted {
      opacity: 0.65;
    }
  `,
})
export class ReceiptWorkbenchComponent implements OnInit {
  private readonly api = inject(ExpenseManagementApiService);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);

  protected readonly lookups = signal<ExmLookups | null>(null);
  protected readonly reports = signal<ExmReport[]>([]);
  protected readonly reportId = signal<string | null>(null);
  protected readonly file = signal<File | null>(null);
  protected readonly ocrText = signal('');
  protected readonly scanning = signal(false);
  protected readonly saving = signal(false);
  protected readonly result = signal<ExmReceiptScan | null>(null);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly saveError = signal<string | null>(null);

  protected readonly prefill = computed<LinePrefill | null>(() => {
    const scanned = this.result();
    return scanned ? { ocr: scanned.ocr, receiptId: scanned.receipt_id } : null;
  });
  protected readonly confidencePercent = computed(() =>
    Math.round((this.result()?.ocr.confidence ?? 0) * 100),
  );
  protected readonly lowConfidence = computed(
    () => (this.result()?.ocr.confidence ?? 1) < LOW_OCR_CONFIDENCE,
  );

  ngOnInit(): void {
    this.reportId.set(this.route.snapshot.queryParamMap.get('report'));
    void firstValueFrom(this.api.getLookups())
      .then((response) => this.lookups.set(response.data))
      .catch(() => this.lookups.set(null));
    void this.loadReports();
  }

  protected pick(event: Event): void {
    const input = event.target as HTMLInputElement;
    this.file.set(input.files?.item(0) ?? null);
  }

  protected async scan(): Promise<void> {
    const file = this.file();
    if (!file) {
      return;
    }
    this.scanning.set(true);
    this.errorKey.set(null);
    this.result.set(null);
    try {
      const response = await firstValueFrom(
        this.api.scanReceipt(file, this.ocrText() || undefined, this.reportId() ?? undefined),
      );
      this.result.set(response.data);
    } catch (error) {
      this.errorKey.set((await failureOf(error)).errorKey);
    } finally {
      this.scanning.set(false);
    }
  }

  protected async save(payload: ExmLinePayload): Promise<void> {
    const reportId = this.reportId();
    if (!reportId) {
      this.saveError.set('expenseManagement.workbench.selectReport');
      return;
    }
    this.saving.set(true);
    this.saveError.set(null);
    try {
      await firstValueFrom(this.api.addLine(reportId, payload));
      this.message.success(this.i18n.instant('expenseManagement.message.saved'));
      this.discard();
    } catch (error) {
      this.saveError.set((await failureOf(error)).errorKey);
    } finally {
      this.saving.set(false);
    }
  }

  /** Leaves the review and gets ready for the next receipt. */
  protected discard(): void {
    this.result.set(null);
    this.file.set(null);
    this.ocrText.set('');
  }

  private async loadReports(): Promise<void> {
    try {
      const [draft, rejected] = await Promise.all([
        firstValueFrom(this.api.listReports({ status: 'draft', per_page: 100 })),
        firstValueFrom(this.api.listReports({ status: 'rejected', per_page: 100 })),
      ]);
      this.reports.set([...draft.data, ...rejected.data]);
    } catch {
      this.reports.set([]);
    }
  }
}
