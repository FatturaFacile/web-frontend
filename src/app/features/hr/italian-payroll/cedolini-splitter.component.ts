import { HttpErrorResponse, HttpEvent, HttpEventType } from '@angular/common/http';
import { Component, DestroyRef, inject, input, output, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { CedoliniImportResult, ItalianPayrollApiService } from '@core';
import { TranslatePipe } from '@shared';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { serverMessage } from '../shared/hr-http.util';

/** The API accepts bundles up to 50 MB. */
export const CEDOLINI_MAX_BYTES = 50 * 1024 * 1024;

export type SplitterPhase = 'idle' | 'uploading' | 'processing' | 'done' | 'error';

/** True for a PDF within the size limit (the API checks again; this spares a doomed upload). */
export function isAcceptableBundle(file: Pick<File, 'name' | 'size'>): boolean {
  return /\.pdf$/i.test(file.name) && file.size > 0 && file.size <= CEDOLINI_MAX_BYTES;
}

/**
 * Drag-and-drop upload of the consultant's bulk payslip PDF. The upload percentage is real; the split by codice
 * fiscale and the matching to the employees happen in one server call, so they show as running until the answer
 * arrives and then report what they found (matched payslips and the pages that matched nobody).
 */
@Component({
  selector: 'app-cedolini-splitter',
  imports: [
    NzAlertModule,
    NzIconModule,
    NzProgressModule,
    NzTableModule,
    NzTagModule,
    NzUploadModule,
    TranslatePipe,
  ],
  template: `
    <nz-upload
      nzType="drag"
      nzAccept=".pdf,application/pdf"
      [nzDisabled]="disabled() || busy()"
      [nzShowUploadList]="false"
      [nzBeforeUpload]="beforeUpload"
    >
      <p class="ant-upload-drag-icon"><nz-icon nzType="inbox" /></p>
      <p class="ant-upload-text">{{ 'itPayroll.splitter.hint' | translate }}</p>
    </nz-upload>

    @if (phase() !== 'idle') {
      <ol class="phases" aria-live="polite" data-testid="splitter-phases">
        <li data-testid="phase-upload">
          <nz-tag [nzColor]="phase() === 'uploading' ? 'processing' : 'success'">{{
            'itPayroll.splitter.phase.upload' | translate
          }}</nz-tag>
          @if (phase() === 'uploading') {
            <nz-progress [nzPercent]="percent()" nzSize="small" />
          }
        </li>
        <li data-testid="phase-split">
          <nz-tag [nzColor]="phaseColor('split')">{{
            'itPayroll.splitter.phase.split' | translate
          }}</nz-tag>
        </li>
        <li data-testid="phase-match">
          <nz-tag [nzColor]="phaseColor('match')">{{
            'itPayroll.splitter.phase.match' | translate
          }}</nz-tag>
        </li>
      </ol>
    }

    @if (error(); as key) {
      <nz-alert
        class="gap"
        nzType="error"
        nzShowIcon
        [nzMessage]="key | translate"
        [nzDescription]="detail()"
        data-testid="splitter-error"
      />
    }

    @if (result(); as r) {
      <div class="gap" data-testid="splitter-result">
        <nz-alert
          nzShowIcon
          [nzType]="r.unmatched.length ? 'warning' : 'success'"
          [nzMessage]="
            'itPayroll.splitter.done'
              | translate: { matched: r.matched.length, unmatched: r.unmatched.length }
          "
        />
        @if (r.matched.length) {
          <nz-table
            #matched
            [nzData]="r.matched"
            nzSize="small"
            [nzShowPagination]="false"
            class="gap"
          >
            <thead>
              <tr>
                <th>{{ 'itPayroll.splitter.employee' | translate }}</th>
                <th>{{ 'itPayroll.splitter.codeEnd' | translate }}</th>
                <th>{{ 'itPayroll.splitter.pages' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (row of matched.data; track row.employee_id) {
                <tr>
                  <td>{{ row.employee_id }}</td>
                  <td>…{{ row.tax_code_suffix }}</td>
                  <td>{{ row.pages }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
        @if (r.unmatched.length) {
          <h4 class="gap">{{ 'itPayroll.splitter.unmatched' | translate }}</h4>
          <ul data-testid="splitter-unmatched">
            @for (row of r.unmatched; track row.pages) {
              <li>
                {{ 'itPayroll.splitter.pages' | translate }} {{ row.pages }}:
                @if (row.tax_code_suffix) {
                  …{{ row.tax_code_suffix }}
                } @else {
                  {{ 'itPayroll.splitter.noCode' | translate }}
                }
              </li>
            }
          </ul>
        }
      </div>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .phases {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      align-items: center;
      list-style: none;
      margin: 16px 0 0;
      padding: 0;
    }
    .gap {
      margin-top: 16px;
    }
  `,
})
export class CedoliniSplitterComponent {
  private readonly api = inject(ItalianPayrollApiService);
  private readonly destroyRef = inject(DestroyRef);

  readonly periodId = input.required<string>();
  /** The workflow does not accept payslips in the current state. */
  readonly disabled = input(false);
  readonly imported = output<CedoliniImportResult>();

  protected readonly phase = signal<SplitterPhase>('idle');
  protected readonly percent = signal(0);
  protected readonly result = signal<CedoliniImportResult | null>(null);
  protected readonly error = signal<string | null>(null);
  protected readonly detail = signal<string>('');

  protected busy(): boolean {
    return this.phase() === 'uploading' || this.phase() === 'processing';
  }

  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    this.handle(file as unknown as File);

    return false;
  };

  /** Colour of the two server-side phases: running while the answer is awaited, done or failed after it. */
  protected phaseColor(phase: 'split' | 'match'): string {
    switch (this.phase()) {
      case 'processing':
        return phase === 'split' ? 'processing' : 'default';
      case 'done':
        return 'success';
      case 'error':
        return 'default';
      default:
        return 'default';
    }
  }

  handle(file: File): void {
    this.result.set(null);
    this.detail.set('');

    if (!isAcceptableBundle(file)) {
      this.phase.set('error');
      this.error.set('itPayroll.splitter.invalid');

      return;
    }

    this.error.set(null);
    this.percent.set(0);
    this.phase.set('uploading');

    this.api
      .importCedolini(this.periodId(), file)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (event) => this.onEvent(event),
        error: (err: unknown) => this.onError(err),
      });
  }

  private onEvent(event: HttpEvent<{ data: CedoliniImportResult }>): void {
    if (event.type === HttpEventType.UploadProgress) {
      const percent = event.total ? Math.round((event.loaded / event.total) * 100) : 0;
      this.percent.set(percent);

      if (percent >= 100) {
        this.phase.set('processing');
      }
    } else if (event.type === HttpEventType.Response && event.body) {
      this.result.set(event.body.data);
      this.phase.set('done');
      this.imported.emit(event.body.data);
    }
  }

  private onError(err: unknown): void {
    this.phase.set('error');
    this.error.set('itPayroll.splitter.failure');
    this.detail.set(err instanceof HttpErrorResponse ? (serverMessage(err) ?? '') : '');
  }
}
