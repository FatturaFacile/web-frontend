import { CurrencyPipe, DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { NzTimelineModule } from 'ng-zorro-antd/timeline';
import { EbillTransmission } from '@core';
import { TranslatePipe } from '@shared';
import { formatBytes, statusColor, timelineColor } from './swiss-ebill.util';

/**
 * One transmission with its audit trail: status tag, rejection / failure / discrepancy alerts, the timeline of events and the
 * identifiers kept for audit (gateway transaction, camt.054 entry, XML and PDF checksums). The actions are emitted, the host runs them.
 */
@Component({
  selector: 'app-ebill-lifecycle',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    CurrencyPipe,
    DatePipe,
    NzAlertModule,
    NzButtonModule,
    NzPopconfirmModule,
    NzTagModule,
    NzTimelineModule,
    TranslatePipe,
  ],
  styleUrl: './swiss-ebill.scss',
  template: `
    @let t = transmission();
    <div class="stack">
      <div>
        <nz-tag [nzColor]="color()">{{ 'swissEbill.status.' + t.status | translate }}</nz-tag>
        <span class="hint">{{ 'swissEbill.statusHint.' + t.status | translate }}</span>
      </div>

      @if (t.status === 'rejected_by_debtor') {
        <nz-alert
          data-test="rejection"
          nzType="error"
          nzShowIcon
          [nzMessage]="'swissEbill.alert.rejectedTitle' | translate"
          [nzDescription]="rejectionText"
        ></nz-alert>
        <ng-template #rejectionText>
          <strong>{{ rejectionTitleKey() | translate }}</strong>
          @if (t.rejection_code) {
            <span> ({{ t.rejection_code }})</span>
          }
          <div>{{ rejectionHintKey() | translate }}</div>
          @if (t.rejection_reason) {
            <div>{{ t.rejection_reason }}</div>
          }
        </ng-template>
      }
      @if (t.status === 'failed_technical') {
        <nz-alert
          data-test="failure"
          nzType="error"
          nzShowIcon
          [nzMessage]="'swissEbill.alert.failedTitle' | translate"
          [nzDescription]="t.error_details ?? t.error_code ?? ''"
        ></nz-alert>
      }
      @if (t.amount_discrepancy !== null && t.amount_discrepancy !== 0) {
        <nz-alert
          data-test="discrepancy"
          nzType="warning"
          nzShowIcon
          [nzMessage]="'swissEbill.alert.discrepancyTitle' | translate"
          [nzDescription]="
            ('swissEbill.hint.discrepancy' | translate) +
            ' (' +
            t.amount_discrepancy +
            ' ' +
            t.currency +
            ')'
          "
        ></nz-alert>
      }

      <div class="actions">
        @if (canWrite()) {
          @if (t.can_revise) {
            <button
              nz-button
              nzType="primary"
              type="button"
              data-test="revise"
              (click)="revise.emit(t)"
            >
              {{ 'swissEbill.action.reviseResend' | translate }}
            </button>
          }
          @if (t.can_retry) {
            <button nz-button type="button" data-test="retry" (click)="retry.emit(t)">
              {{ 'swissEbill.action.retry' | translate }}
            </button>
          }
          @if (t.can_cancel) {
            <button
              nz-button
              nzDanger
              type="button"
              data-test="cancel"
              nz-popconfirm
              [nzPopconfirmTitle]="'swissEbill.confirm.cancel.body' | translate"
              (nzOnConfirm)="cancelRequested.emit(t)"
            >
              {{ 'swissEbill.action.cancel' | translate }}
            </button>
          }
        }
        @if (t.xml_sha256) {
          <button nz-button type="button" data-test="download" (click)="download.emit(t)">
            {{ 'swissEbill.action.downloadXml' | translate }}
          </button>
        }
      </div>

      <h4>{{ 'swissEbill.section.lifecycle' | translate }}</h4>
      @if ((t.events ?? []).length === 0) {
        <p class="hint">{{ 'swissEbill.empty.timeline' | translate }}</p>
      } @else {
        <nz-timeline>
          @for (event of t.events ?? []; track event.id) {
            <nz-timeline-item [nzColor]="dot(event.to_status)">
              <strong>{{ 'swissEbill.event.' + event.event_type | translate }}</strong>
              <div class="hint">
                {{ event.occurred_at | date: 'medium' }} ·
                {{ 'swissEbill.source.' + event.source | translate }}
              </div>
            </nz-timeline-item>
          }
        </nz-timeline>
      }

      <h4>{{ 'swissEbill.section.audit' | translate }}</h4>
      <dl class="meta">
        @if (t.six_transaction_id) {
          <dt>{{ 'swissEbill.timeline.gatewayTransaction' | translate }}</dt>
          <dd>{{ t.six_transaction_id }}</dd>
        }
        @if (t.scheduled_payment_date) {
          <dt>{{ 'swissEbill.timeline.scheduledPayment' | translate }}</dt>
          <dd>{{ t.scheduled_payment_date | date: 'mediumDate' }}</dd>
        }
        @if (t.camt054_entry_id) {
          <dt>{{ 'swissEbill.timeline.settlementReference' | translate }}</dt>
          <dd>{{ t.camt054_entry_id }}</dd>
        }
        @if (t.settlement_value_date) {
          <dt>{{ 'swissEbill.timeline.valueDate' | translate }}</dt>
          <dd>{{ t.settlement_value_date | date: 'mediumDate' }}</dd>
        }
        @if (t.settled_amount > 0) {
          <dt>{{ 'swissEbill.timeline.settledAmount' | translate }}</dt>
          <dd>{{ t.settled_amount | currency: t.currency }}</dd>
        }
        @if (t.next_retry_at) {
          <dt>{{ 'swissEbill.timeline.nextRetry' | translate }}</dt>
          <dd>{{ t.next_retry_at | date: 'medium' }}</dd>
        }
        @if (t.xml_sha256) {
          <dt>{{ 'swissEbill.timeline.xmlChecksum' | translate }}</dt>
          <dd>{{ t.xml_sha256 }}</dd>
        }
        @if (t.pdf_sha256) {
          <dt>{{ 'swissEbill.timeline.pdfChecksum' | translate }}</dt>
          <dd>{{ t.pdf_sha256 }}</dd>
          <dt>{{ 'swissEbill.timeline.pdfSize' | translate }}</dt>
          <dd>{{ size() }}</dd>
        }
      </dl>
    </div>
  `,
})
export class EbillLifecycleComponent {
  readonly transmission = input.required<EbillTransmission>();
  readonly canWrite = input(false);

  readonly revise = output<EbillTransmission>();
  readonly retry = output<EbillTransmission>();
  readonly cancelRequested = output<EbillTransmission>();
  readonly download = output<EbillTransmission>();

  protected readonly color = computed(() => statusColor(this.transmission().status));
  protected readonly size = computed(() => formatBytes(this.transmission().pdf_size_bytes));
  private readonly code = computed(() => this.transmission().rejection_code ?? 'OTHER');
  protected readonly rejectionTitleKey = computed(
    () => `swissEbill.rejection.${this.code()}.title`,
  );
  protected readonly rejectionHintKey = computed(() => `swissEbill.rejection.${this.code()}.hint`);

  protected dot = timelineColor;
}
