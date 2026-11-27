import { Component, computed, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { firstValueFrom } from 'rxjs';
import { BankingApiService } from '@core/api/banking-api.service';
import { IsoUploadResult, IsoUploadType } from '@core/models/iso20022.model';
import { TranslatePipe } from '@shared';
import { isIsoXmlFile, uploadErrorMessage, uploadTotals } from './iso-reconciliation.util';
import { feedbackFromPain002, PaymentLineFeedback, TrPaymentLineStatusComponent } from './tr-payment-line-status.component';

export type UploadState = 'queued' | 'uploading' | 'done' | 'failed';

export interface UploadRow {
  id: number;
  name: string;
  state: UploadState;
  result: IsoUploadResult | null;
  /** Per transaction feedback of a pain.002 report. */
  feedback: PaymentLineFeedback[];
  /** The message of the API (already translated), or empty when the file was refused locally or without detail. */
  error: string;
  /** Translation key of a local refusal (wrong extension, empty or oversized file). */
  errorKey: string | null;
}

const TYPE_COLORS: Record<IsoUploadType, string> = {
  'camt.053': 'blue',
  'camt.054': 'cyan',
  'pain.002': 'purple',
};

/**
 * Multi file upload of ISO 20022 camt.053, camt.054 and pain.002 messages. The files are sent one after the other
 * (the API detects the message type) and every file gets its own result row, plus a total of the whole drop.
 */
@Component({
  selector: 'app-tr-iso-upload',
  imports: [
    FormsModule,
    NzAlertModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzInputModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTableModule,
    NzTagModule,
    NzUploadModule,
    TrPaymentLineStatusComponent,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'treasuryIso.upload.title' | translate">
      <p class="hint">{{ 'treasuryIso.upload.subtitle' | translate }}</p>
      <div class="options">
        <nz-switch
          nzId="iso-auto-reconcile"
          [ngModel]="autoReconcile()"
          (ngModelChange)="autoReconcile.set($event)"
          data-testid="auto-reconcile"
        />
        <label for="iso-auto-reconcile">{{ 'treasuryIso.upload.autoReconcile' | translate }}</label>
        <label class="batch" for="iso-batch-id">
          <span>{{ 'treasuryIso.upload.batchId' | translate }}</span>
          <input
            nz-input
            id="iso-batch-id"
            [ngModel]="paymentBatchId()"
            (ngModelChange)="paymentBatchId.set($event ?? '')"
            [placeholder]="'treasuryIso.upload.batchIdHint' | translate"
            data-testid="batch-id"
          />
        </label>
      </div>

      <nz-upload
        nzType="drag"
        nzMultiple
        nzAccept=".xml,text/xml,application/xml"
        [nzShowUploadList]="false"
        [nzBeforeUpload]="beforeUpload"
      >
        <p class="ant-upload-drag-icon"><nz-icon nzType="inbox" /></p>
        <p class="ant-upload-text">{{ 'treasuryIso.upload.hint' | translate }}</p>
        <p class="ant-upload-hint">{{ 'treasuryIso.upload.types' | translate }}</p>
      </nz-upload>
    </nz-card>

    @if (rows().length > 0) {
      <nz-card class="gap" [nzTitle]="'treasuryIso.upload.totals' | translate" data-testid="totals">
        <div nz-row [nzGutter]="16">
          <div nz-col [nzXs]="12" [nzMd]="4">
            <nz-statistic [nzTitle]="'treasuryIso.upload.files' | translate" [nzValue]="totals().files" />
          </div>
          <div nz-col [nzXs]="12" [nzMd]="5">
            <nz-statistic [nzTitle]="'treasuryIso.upload.reconciled' | translate" [nzValue]="totals().reconciled" />
          </div>
          <div nz-col [nzXs]="12" [nzMd]="5">
            <nz-statistic [nzTitle]="'treasuryIso.upload.unmatched' | translate" [nzValue]="totals().unmatched" />
          </div>
          <div nz-col [nzXs]="12" [nzMd]="5">
            <nz-statistic [nzTitle]="'treasuryIso.upload.duplicates' | translate" [nzValue]="totals().duplicates" />
          </div>
          <div nz-col [nzXs]="12" [nzMd]="5">
            <nz-statistic [nzTitle]="'treasuryIso.upload.failed' | translate" [nzValue]="totals().failed" />
          </div>
        </div>
      </nz-card>

      <nz-card class="gap" [nzTitle]="'treasuryIso.upload.results' | translate">
        <nz-table #table nzSize="small" [nzData]="rows()" [nzShowPagination]="false">
          <thead>
            <tr>
              <th>{{ 'treasuryIso.upload.col.file' | translate }}</th>
              <th>{{ 'treasuryIso.upload.col.type' | translate }}</th>
              <th>{{ 'treasuryIso.upload.col.detail' | translate }}</th>
              <th>{{ 'treasuryIso.upload.col.outcome' | translate }}</th>
            </tr>
          </thead>
          <tbody>
            @for (row of table.data; track row.id) {
              <tr data-testid="upload-row">
                <td>{{ row.name }}</td>
                <td>
                  @if (row.result; as result) {
                    <nz-tag [nzColor]="colors[result.type]" data-testid="type-tag">{{ result.type }}</nz-tag>
                  } @else {
                    -
                  }
                </td>
                <td>
                  @if (row.result; as result) {
                    @if (result.statement; as statement) {
                      <strong>{{ statement.account_iban }}</strong> · {{ statement.statement_date }}
                      @if (statement.total_entries !== undefined) {
                        · {{ statement.total_entries }}
                      }
                    }
                    @if (result.payment_report; as report) {
                      <strong>{{ report.batch_reference }}</strong> ·
                      <nz-tag>{{ report.group_status ?? report.batch_status }}</nz-tag>
                    }
                  }
                </td>
                <td>
                  @switch (row.state) {
                    @case ('queued') {
                      <nz-tag>{{ 'treasuryIso.upload.state.queued' | translate }}</nz-tag>
                    }
                    @case ('uploading') {
                      <nz-tag nzColor="processing">{{ 'treasuryIso.upload.state.uploading' | translate }}</nz-tag>
                    }
                    @case ('failed') {
                      <nz-tag nzColor="error">{{ 'treasuryIso.upload.state.failed' | translate }}</nz-tag>
                      <span class="error" data-testid="upload-error">
                        {{ row.errorKey ? (row.errorKey | translate) : row.error }}
                      </span>
                    }
                    @case ('done') {
                      @if (row.result?.reconciliation; as summary) {
                        <span data-testid="reconciliation-summary">
                          {{ 'treasuryIso.upload.reconciled' | translate }}: {{ summary.reconciled }} ·
                          {{ 'treasuryIso.upload.unmatched' | translate }}: {{ summary.unmatched }}
                          @if (row.result?.duplicates !== undefined && row.result?.duplicates !== null) {
                            · {{ 'treasuryIso.upload.duplicates' | translate }}: {{ row.result?.duplicates }}
                          }
                        </span>
                      }
                      @if (row.result?.payment_report; as report) {
                        <span data-testid="payment-summary">
                          {{ 'treasuryIso.upload.accepted' | translate }}: {{ report.accepted }} ·
                          {{ 'treasuryIso.upload.rejected' | translate }}: {{ report.rejected }} ·
                          {{ 'treasuryIso.upload.pending' | translate }}: {{ report.pending }}
                        </span>
                      }
                    }
                  }
                </td>
              </tr>
              @if (row.feedback.length > 0) {
                <tr>
                  <td colspan="4">
                    <app-tr-payment-line-status [lines]="row.feedback" />
                  </td>
                </tr>
              }
            }
          </tbody>
        </nz-table>
      </nz-card>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: 8px 16px;
      align-items: center;
      margin-bottom: 16px;
    }
    .batch {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .hint {
      color: rgba(0, 0, 0, 0.55);
    }
    .gap {
      margin-top: 16px;
    }
    .error {
      margin-left: 8px;
    }
  `,
})
export class TrIsoUploadComponent {
  private readonly api = inject(BankingApiService);

  protected readonly colors = TYPE_COLORS;
  protected readonly autoReconcile = signal(true);
  protected readonly paymentBatchId = signal('');
  protected readonly rows = signal<UploadRow[]>([]);
  protected readonly totals = computed(() =>
    uploadTotals(this.rows().filter((row) => row.state === 'done' || row.state === 'failed')),
  );

  private files = new Map<number, File>();
  private nextId = 1;
  private running = false;

  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    this.enqueue(file as unknown as File);

    return false;
  };

  /** Adds a file to the queue; a file that cannot be an ISO 20022 XML is refused without reaching the API. */
  enqueue(file: File): void {
    const id = this.nextId++;

    if (!isIsoXmlFile(file)) {
      this.rows.update((rows) => [
        ...rows,
        { id, name: file.name, state: 'failed', result: null, feedback: [], error: '', errorKey: 'treasuryIso.upload.invalidFile' },
      ]);

      return;
    }

    this.files.set(id, file);
    this.rows.update((rows) => [
      ...rows,
      { id, name: file.name, state: 'queued', result: null, feedback: [], error: '', errorKey: null },
    ]);
    void this.drain();
  }

  /** Sends the queued files one at a time, so the API reconciles each statement before the next one arrives. */
  private async drain(): Promise<void> {
    if (this.running) {
      return;
    }

    this.running = true;

    try {
      let next = this.rows().find((row) => row.state === 'queued');

      while (next) {
        await this.send(next);
        next = this.rows().find((row) => row.state === 'queued');
      }
    } finally {
      this.running = false;
    }
  }

  private async send(row: UploadRow): Promise<void> {
    const file = this.files.get(row.id);

    this.files.delete(row.id);

    if (!file) {
      return;
    }

    this.patch(row.id, { state: 'uploading' });

    try {
      const res = await firstValueFrom(
        this.api.uploadIso20022(file, {
          autoReconcile: this.autoReconcile(),
          paymentBatchId: this.paymentBatchId().trim() || null,
        }),
      );

      this.patch(row.id, {
        state: 'done',
        result: res.data,
        feedback: feedbackFromPain002(res.data.payment_report?.transactions ?? []),
      });
    } catch (error: unknown) {
      this.patch(row.id, {
        state: 'failed',
        error: uploadErrorMessage(error),
        errorKey: uploadErrorMessage(error) === '' ? 'treasuryIso.upload.failure' : null,
      });
    }
  }

  private patch(id: number, change: Partial<UploadRow>): void {
    this.rows.update((rows) => rows.map((row) => (row.id === id ? { ...row, ...change } : row)));
  }
}
