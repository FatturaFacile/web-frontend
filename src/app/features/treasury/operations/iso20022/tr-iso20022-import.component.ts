import { Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCardModule } from 'ng-zorro-antd/card';
import { NzGridModule } from 'ng-zorro-antd/grid';
import { NzIconModule } from 'ng-zorro-antd/icon';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzStatisticModule } from 'ng-zorro-antd/statistic';
import { NzSwitchModule } from 'ng-zorro-antd/switch';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzUploadFile, NzUploadModule } from 'ng-zorro-antd/upload';
import { BankingApiService } from '@core/api/banking-api.service';
import { Iso20022ImportSummary } from '@core/models/iso20022.model';
import { MoneyPipe, TranslatePipe } from '@shared';

export const ISO20022_MAX_BYTES = 10 * 1024 * 1024;

/**
 * Upload of an ISO 20022 camt.054 notification or camt.053 statement: the API stores it, skips the movements it
 * already holds and answers at once with what the automatic reconciliation did.
 */
@Component({
  selector: 'app-tr-iso20022-import',
  imports: [
    FormsModule,
    NzAlertModule,
    NzCardModule,
    NzGridModule,
    NzIconModule,
    NzSpinModule,
    NzStatisticModule,
    NzSwitchModule,
    NzTagModule,
    NzUploadModule,
    MoneyPipe,
    TranslatePipe,
  ],
  template: `
    <nz-card [nzTitle]="'iso20022.upload.title' | translate">
      <div class="options">
        <nz-switch [ngModel]="autoReconcile()" (ngModelChange)="autoReconcile.set($event)" data-testid="auto-reconcile" />
        <span>{{ 'iso20022.upload.reconcile' | translate }}</span>
      </div>

      <nz-spin [nzSpinning]="importing()" [nzTip]="'iso20022.upload.importing' | translate">
        <nz-upload nzType="drag" nzAccept=".xml,text/xml,application/xml" [nzShowUploadList]="false" [nzBeforeUpload]="beforeUpload">
          <p class="ant-upload-drag-icon"><nz-icon nzType="inbox" /></p>
          <p class="ant-upload-text">{{ 'iso20022.upload.hint' | translate }}</p>
        </nz-upload>
      </nz-spin>

      @if (error(); as key) {
        <nz-alert class="gap" nzType="error" nzShowIcon [nzMessage]="key | translate" data-testid="import-error" />
      }
    </nz-card>

    @if (summary(); as s) {
      <nz-card class="gap" [nzTitle]="'iso20022.summary.title' | translate" data-testid="import-summary">
        <p>
          <nz-tag nzColor="blue">{{ s.format === 'camt054' ? 'camt.054' : 'camt.053' }}</nz-tag>
          <strong>{{ s.account_iban }}</strong> · {{ s.statement_date }}
        </p>
        <div nz-row [nzGutter]="16">
          <div nz-col [nzSpan]="6"><nz-statistic [nzTitle]="'iso20022.summary.entries' | translate" [nzValue]="s.entries" /></div>
          <div nz-col [nzSpan]="6"><nz-statistic [nzTitle]="'iso20022.summary.stored' | translate" [nzValue]="s.stored" /></div>
          <div nz-col [nzSpan]="6"><nz-statistic [nzTitle]="'iso20022.summary.duplicates' | translate" [nzValue]="s.duplicates" /></div>
          <div nz-col [nzSpan]="6"><nz-statistic [nzTitle]="'iso20022.summary.reconciled' | translate" [nzValue]="s.reconciled" /></div>
        </div>
        <div nz-row [nzGutter]="16" class="gap">
          <div nz-col [nzSpan]="6"><nz-statistic [nzTitle]="'iso20022.summary.unmatched' | translate" [nzValue]="s.unmatched" /></div>
          @if (s.opening_balance !== null) {
            <div nz-col [nzSpan]="9">
              <nz-statistic [nzTitle]="'iso20022.summary.opening' | translate" [nzValue]="(s.opening_balance | money: s.currency) ?? ''" />
            </div>
          }
          @if (s.closing_balance !== null) {
            <div nz-col [nzSpan]="9">
              <nz-statistic [nzTitle]="'iso20022.summary.closing' | translate" [nzValue]="(s.closing_balance | money: s.currency) ?? ''" />
            </div>
          }
        </div>
        @if (s.duplicates > 0) {
          <nz-alert class="gap" nzType="info" nzShowIcon [nzMessage]="'iso20022.summary.duplicatesNote' | translate" />
        }
      </nz-card>
    }
  `,
  styles: `
    :host {
      display: block;
    }
    .options {
      display: flex;
      gap: 8px;
      align-items: center;
      margin-bottom: 16px;
    }
    .gap {
      margin-top: 16px;
    }
  `,
})
export class TrIso20022ImportComponent {
  private readonly api = inject(BankingApiService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly autoReconcile = signal(true);
  protected readonly importing = signal(false);
  protected readonly summary = signal<Iso20022ImportSummary | null>(null);
  protected readonly error = signal<string | null>(null);

  protected readonly beforeUpload = (file: NzUploadFile): boolean => {
    this.handle(file as unknown as File);
    return false;
  };

  /** Rejects other file types and oversized files before they reach the API. */
  handle(file: File): void {
    this.summary.set(null);

    if (!/\.xml$/i.test(file.name) || file.size > ISO20022_MAX_BYTES) {
      this.error.set('iso20022.upload.invalid');
      return;
    }

    this.error.set(null);
    this.importing.set(true);
    this.api
      .importIso20022(file, this.autoReconcile())
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (res) => {
          this.importing.set(false);
          this.summary.set(res.data);
        },
        error: () => {
          this.importing.set(false);
          this.error.set('iso20022.upload.failure');
        },
      });
  }
}
