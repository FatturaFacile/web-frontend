import { Component, inject, OnInit } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDrawerModule } from 'ng-zorro-antd/drawer';
import { NzEmptyModule } from 'ng-zorro-antd/empty';
import { NzProgressModule } from 'ng-zorro-antd/progress';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { DcBatch, PermissionsService } from '@core';
import { MoneyPipe, TranslatePipe } from '@shared';
import { DcFeedback } from './dc-feedback.service';
import {
  batchProgress,
  batchStatusColor,
  canRetryBatch,
  DEBT_COLLECTION_MODULE,
  noticeStatusColor,
} from './debt-collection.util';
import { NoticesStore } from './notices.store';

/** Dispatch batches: progress of sent and failed notices per batch, the notices of a batch and the retry of the failed ones. */
@Component({
  selector: 'app-dc-batches',
  imports: [
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDrawerModule,
    NzEmptyModule,
    NzProgressModule,
    NzSpinModule,
    NzTableModule,
    NzTagModule,
  ],
  providers: [NoticesStore],
  styleUrl: './debt-collection.scss',
  template: `
    <div class="toolbar">
      <button nz-button type="button" (click)="store.loadBatches()">
        {{ 'debtCollection.action.refresh' | translate }}
      </button>
    </div>

    @if (store.error(); as error) {
      <nz-alert class="feedback" nzType="error" nzShowIcon [nzMessage]="error | translate" />
    }

    <nz-spin [nzSpinning]="store.loadingBatches()">
      <nz-table #table nzSize="small" [nzData]="store.batches()" [nzShowPagination]="false">
        <thead>
          <tr>
            <th scope="col">{{ 'debtCollection.field.createdAt' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.channel' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
            <th scope="col">{{ 'debtCollection.field.progress' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.noticeStatus.sent' | translate }}</th>
            <th scope="col" class="num">{{ 'debtCollection.noticeStatus.failed' | translate }}</th>
            <th scope="col"></th>
          </tr>
        </thead>
        <tbody>
          @for (batch of table.data; track batch.id) {
            <tr>
              <th scope="row">{{ batch.created_at }}</th>
              <td>{{ 'debtCollection.channel.' + batch.channel | translate }}</td>
              <td>
                <nz-tag [nzColor]="statusTag(batch.status)">{{
                  'debtCollection.batchStatus.' + batch.status | translate
                }}</nz-tag>
              </td>
              <td>
                <nz-progress
                  nzSize="small"
                  [nzPercent]="progress(batch)"
                  [nzStatus]="
                    batch.failed > 0
                      ? 'exception'
                      : batch.status === 'completed'
                        ? 'success'
                        : 'active'
                  "
                />
              </td>
              <td class="num">{{ batch.total }}</td>
              <td class="num">{{ batch.sent }}</td>
              <td class="num">{{ batch.failed }}</td>
              <td>
                <div class="row-actions">
                  <button
                    nz-button
                    nzSize="small"
                    type="button"
                    (click)="store.openBatch(batch.id)"
                  >
                    {{ 'debtCollection.action.details' | translate }}
                  </button>
                  @if (canWrite && retryable(batch)) {
                    <button
                      nz-button
                      nzSize="small"
                      nzType="primary"
                      type="button"
                      [nzLoading]="store.busyId() === batch.id"
                      (click)="retry(batch)"
                    >
                      {{ 'debtCollection.action.retry' | translate }}
                    </button>
                  }
                </div>
              </td>
            </tr>
          }
        </tbody>
      </nz-table>
      @if (!store.loadingBatches() && store.batches().length === 0) {
        <nz-empty [nzNotFoundContent]="'debtCollection.batches.empty' | translate" />
      }
    </nz-spin>

    <nz-drawer
      [nzVisible]="store.batchDetail() !== null"
      [nzWidth]="640"
      [nzTitle]="'debtCollection.batches.detail' | translate"
      (nzOnClose)="store.closeBatch()"
    >
      <ng-container *nzDrawerContent>
        @if (store.batchDetail(); as batch) {
          <nz-table nzSize="small" [nzData]="batch.notices ?? []" [nzShowPagination]="false">
            <thead>
              <tr>
                <th scope="col">{{ 'debtCollection.field.number' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.customer' | translate }}</th>
                <th scope="col" class="num">{{ 'debtCollection.field.total' | translate }}</th>
                <th scope="col">{{ 'debtCollection.field.status' | translate }}</th>
              </tr>
            </thead>
            <tbody>
              @for (notice of batch.notices ?? []; track notice.id) {
                <tr>
                  <th scope="row">{{ notice.number }}</th>
                  <td>{{ notice.customer_name }}</td>
                  <td class="num">{{ notice.total | money: notice.currency }}</td>
                  <td>
                    <nz-tag [nzColor]="noticeTag(notice.status)">{{
                      'debtCollection.noticeStatus.' + notice.status | translate
                    }}</nz-tag>
                    @if (notice.error) {
                      <small class="error-text">{{ notice.error }}</small>
                    }
                  </td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-drawer>
  `,
})
export class DcBatchesComponent implements OnInit {
  protected readonly store = inject(NoticesStore);
  private readonly feedback = inject(DcFeedback);

  protected readonly canWrite = inject(PermissionsService).canWrite(DEBT_COLLECTION_MODULE);
  protected readonly statusTag = batchStatusColor;
  protected readonly noticeTag = noticeStatusColor;
  protected readonly progress = batchProgress;
  protected readonly retryable = canRetryBatch;

  ngOnInit(): void {
    void this.store.loadBatches();
  }

  protected async retry(batch: DcBatch): Promise<void> {
    this.feedback.report(await this.store.retryBatch(batch.id), 'debtCollection.msg.retried');
  }
}
