import { Component, inject, OnInit, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzDescriptionsModule } from 'ng-zorro-antd/descriptions';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { PermissionsService, TranslateService } from '@core';
import { PageHeaderComponent, TranslatePipe } from '@shared';
import { PayablesBatchSummaryComponent } from './payables-batch-summary.component';
import { PayablesBatchesStore } from './payables-batches.store';
import {
  ApOutcome,
  batchStatusColor,
  canCancelBatch,
  canDecideBatch,
  canExecuteBatch,
  canSubmitBatch,
  PAYABLES_APPROVAL_MODULE,
  PAYABLES_MODULE,
} from './payables.util';

/**
 * One payment batch: transfers grouped by creditor IBAN, credit-note set-off, Skonto and totals, with the workflow
 * actions: send to the CFO, approve / reject (CFO) and execute the payment (which posts the Skonto entry).
 */
@Component({
  selector: 'app-payables-batch-detail',
  styleUrl: './payables.scss',
  providers: [PayablesBatchesStore],
  imports: [
    FormsModule,
    PageHeaderComponent,
    PayablesBatchSummaryComponent,
    RouterLink,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzDescriptionsModule,
    NzInputModule,
    NzModalModule,
    NzPopconfirmModule,
    NzSpinModule,
    NzTagModule,
  ],
  template: `
    <app-page-header
      [title]="'AP.BATCH_DETAIL_TITLE' | translate"
      [subtitle]="store.detail()?.number ?? ''"
    >
      <a nz-button routerLink="/payables/batches">{{ 'AP.BACK_TO_BATCHES' | translate }}</a>
      @if (store.detail(); as batch) {
        @if (canWrite && canSubmit(batch)) {
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.saving()"
            (click)="run(store.submit(batch.id), 'AP.SUBMITTED')"
          >
            {{ 'AP.SUBMIT_CFO' | translate }}
          </button>
        }
        @if (canApprove && canDecide(batch)) {
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.saving()"
            (click)="run(store.approve(batch.id), 'AP.APPROVED')"
          >
            {{ 'AP.APPROVE' | translate }}
          </button>
          <button nz-button nzDanger type="button" (click)="rejectOpen.set(true)">
            {{ 'AP.REJECT' | translate }}
          </button>
        }
        @if (canApprove && canExecute(batch)) {
          <button
            nz-button
            nzType="primary"
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'AP.EXECUTE_CONFIRM' | translate"
            [nzOkText]="'AP.CONFIRM' | translate"
            [nzCancelText]="'AP.CANCEL' | translate"
            [nzLoading]="store.saving()"
            (nzOnConfirm)="run(store.execute(batch.id), 'AP.EXECUTED')"
          >
            {{ 'AP.EXECUTE' | translate }}
          </button>
        }
        @if (canWrite && canCancel(batch)) {
          <button
            nz-button
            nzDanger
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'AP.CANCEL_BATCH_CONFIRM' | translate"
            [nzOkText]="'AP.CONFIRM' | translate"
            [nzCancelText]="'AP.CANCEL' | translate"
            (nzOnConfirm)="run(store.cancel(batch.id), 'AP.CANCELLED')"
          >
            {{ 'AP.CANCEL_BATCH' | translate }}
          </button>
        }
      }
    </app-page-header>

    @if (store.error(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
    }
    @if (actionError(); as error) {
      <nz-alert class="card" nzType="error" nzShowIcon [nzMessage]="error"></nz-alert>
    }

    <nz-spin [nzSpinning]="store.loading()">
      @if (store.detail(); as batch) {
        <nz-descriptions nzBordered nzSize="small" [nzColumn]="2">
          <nz-descriptions-item [nzTitle]="'AP.STATUS' | translate">
            <nz-tag [nzColor]="color(batch.status)">{{
              'AP.BATCH_' + batch.status.toUpperCase() | translate
            }}</nz-tag>
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'AP.CUTOFF_DATE' | translate">{{
            batch.cutoff_date
          }}</nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'AP.PRIORITIZE_SKONTO' | translate">
            {{ (batch.prioritize_skonto ? 'AP.YES' : 'AP.NO') | translate }}
          </nz-descriptions-item>
          <nz-descriptions-item [nzTitle]="'AP.CURRENCY' | translate">{{
            batch.currency
          }}</nz-descriptions-item>
          @if (batch.approval; as approval) {
            <nz-descriptions-item [nzTitle]="'AP.APPROVAL' | translate" [nzSpan]="2">
              {{ 'AP.DECISION_' + approval.decision.toUpperCase() | translate }} ·
              {{ approval.user_name }} ·
              {{ approval.decided_at }}
              @if (approval.reason) {
                — {{ approval.reason }}
              }
            </nz-descriptions-item>
          }
          @if (batch.executed_at) {
            <nz-descriptions-item [nzTitle]="'AP.EXECUTED_AT' | translate" [nzSpan]="2">
              {{ batch.executed_at }}
            </nz-descriptions-item>
          }
        </nz-descriptions>

        @if (batch.status === 'executed') {
          <nz-alert
            class="card"
            nzType="success"
            nzShowIcon
            [nzMessage]="'AP.EXECUTED_NOTICE' | translate"
            [nzDescription]="
              'AP.EXECUTED_SKONTO' | translate: { amount: batch.totals.skonto_savings }
            "
          ></nz-alert>
        }

        <app-payables-batch-summary [batch]="batch"></app-payables-batch-summary>
      }
    </nz-spin>

    <nz-modal
      [nzVisible]="rejectOpen()"
      [nzTitle]="'AP.REJECT_TITLE' | translate"
      [nzOkText]="'AP.REJECT' | translate"
      [nzCancelText]="'AP.CANCEL' | translate"
      [nzOkDanger]="true"
      [nzOkLoading]="store.saving()"
      [nzOkDisabled]="rejectReason().trim().length === 0"
      (nzOnOk)="confirmReject()"
      (nzOnCancel)="rejectOpen.set(false)"
    >
      <ng-container *nzModalContent>
        <div class="field">
          <label for="ap-reject-reason">{{ 'AP.REASON' | translate }}</label>
          <textarea
            nz-input
            id="ap-reject-reason"
            rows="3"
            [ngModel]="rejectReason()"
            (ngModelChange)="rejectReason.set($event)"
          ></textarea>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class PayablesBatchDetailComponent implements OnInit {
  readonly store = inject(PayablesBatchesStore);
  private readonly route = inject(ActivatedRoute);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);
  private readonly permissions = inject(PermissionsService);

  /** Accountants prepare and send the batch; only owner / admin (CFO) approve it and execute the payment. */
  readonly canWrite = this.permissions.canWrite(PAYABLES_MODULE);
  readonly canApprove = this.permissions.canWrite(PAYABLES_APPROVAL_MODULE);

  readonly rejectOpen = signal(false);
  readonly rejectReason = signal('');
  readonly actionError = signal<string | null>(null);

  readonly canSubmit = canSubmitBatch;
  readonly canDecide = canDecideBatch;
  readonly canExecute = canExecuteBatch;
  readonly canCancel = canCancelBatch;
  readonly color = batchStatusColor;

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed()).subscribe((params) => {
      const id = params.get('id');
      if (id) {
        void this.store.loadDetail(id);
      }
    });
  }

  /** Runs a workflow transition and reports its outcome. */
  async run(call: Promise<ApOutcome>, successKey: string): Promise<void> {
    this.actionError.set(null);
    const result = await call;
    if (result.ok) {
      this.message.success(this.translate.instant(successKey));
    } else {
      this.actionError.set(result.message ?? this.translate.instant('AP.SAVE_ERROR'));
    }
  }

  async confirmReject(): Promise<void> {
    const id = this.store.detail()?.id;
    if (!id) {
      return;
    }
    await this.run(this.store.reject(id, this.rejectReason().trim()), 'AP.REJECTED');
    if (this.actionError() === null) {
      this.rejectOpen.set(false);
      this.rejectReason.set('');
    }
  }
}
