import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzTableModule } from 'ng-zorro-antd/table';
import { NzTagModule } from 'ng-zorro-antd/tag';
import { TranslateService, WR_INL_FORMATS, WrInlFormat, WrInlNotification } from '@core';
import { downloadBlob, MoneyPipe, TranslatePipe } from '@shared';
import { RecipientsStore } from './recipients.store';
import {
  canCancelInl,
  canMarkInlSent,
  EMPTY_INL_FORM,
  inlPayloadOf,
  inlStatusColor,
  InlFormValue,
  isInlFormValid,
  WrOutcome,
} from './withholding-recipients.util';

/**
 * The preventive INL communication of an occasional worker (art. 14 D.Lgs. 81/2008): list of the communications with their
 * status and whether they reached the inspectorate before the work started, a form to generate one, the download in PDF,
 * XML and JSON, marking as sent with the protocol reference, and cancellation. Uses the `RecipientsStore` of the drawer.
 */
@Component({
  selector: 'app-wr-inl-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    MoneyPipe,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzTableModule,
    NzTagModule,
  ],
  template: `
    <p class="hint">{{ 'withholdingRecipients.inl.hint' | translate }}</p>

    @if (error(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="failure.errorKey ?? '' | translate"
        [nzDescription]="failure.detail ?? ''"
      ></nz-alert>
    }

    <nz-table #table nzSize="small" [nzData]="store.inlNotifications()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th scope="col">{{ 'withholdingRecipients.inl.period' | translate }}</th>
          <th scope="col">{{ 'withholdingRecipients.inl.activity' | translate }}</th>
          <th scope="col" class="num">
            {{ 'withholdingRecipients.inl.estimated' | translate }}
          </th>
          <th scope="col">{{ 'withholdingRecipients.field.status' | translate }}</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        @for (notice of table.data; track notice.id) {
          <tr>
            <td>{{ notice.work_start_date }} – {{ notice.work_end_date }}</td>
            <td>
              {{ notice.activity_description }}
              @if (notice.work_place) {
                <small class="muted">{{ notice.work_place }}</small>
              }
            </td>
            <td class="num">
              @if (notice.estimated_compensation) {
                {{ notice.estimated_compensation | money: 'EUR' }}
              }
            </td>
            <td>
              <nz-tag [nzColor]="statusColor(notice)">{{
                'withholdingRecipients.inlStatus.' + notice.status | translate
              }}</nz-tag>
              @if (notice.status === 'sent') {
                <small class="muted">
                  {{ notice.sent_at }}
                  @if (notice.protocol_reference) {
                    · {{ notice.protocol_reference }}
                  }
                </small>
                <nz-tag [nzColor]="notice.sent_before_start ? 'green' : 'red'">{{
                  (notice.sent_before_start
                    ? 'withholdingRecipients.inl.sentInTime'
                    : 'withholdingRecipients.inl.sentLate'
                  ) | translate
                }}</nz-tag>
              }
            </td>
            <td class="actions">
              @for (format of formats; track format) {
                <button
                  nz-button
                  nzSize="small"
                  type="button"
                  [disabled]="notice.status === 'cancelled'"
                  (click)="download(notice, format)"
                >
                  {{ 'withholdingRecipients.inl.format.' + format | translate }}
                </button>
              }
              @if (canWrite()) {
                @if (canSend(notice)) {
                  <button
                    nz-button
                    nzSize="small"
                    nzType="primary"
                    type="button"
                    (click)="startSend(notice)"
                  >
                    {{ 'withholdingRecipients.inl.markSent' | translate }}
                  </button>
                }
                @if (canCancel(notice)) {
                  <button
                    nz-button
                    nzSize="small"
                    nzDanger
                    type="button"
                    nz-popconfirm
                    [nzPopconfirmTitle]="'withholdingRecipients.inl.confirmCancel' | translate"
                    [nzOkText]="'withholdingRecipients.inl.cancel' | translate"
                    [nzCancelText]="'withholdingRecipients.action.cancel' | translate"
                    (nzOnConfirm)="cancel(notice)"
                  >
                    {{ 'withholdingRecipients.inl.cancel' | translate }}
                  </button>
                }
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    @if (sending(); as target) {
      <div class="send">
        <h4 class="title">{{ 'withholdingRecipients.inl.markSent' | translate }}</h4>
        <div class="grid">
          <label class="field" for="wr-inl-protocol">
            <span>{{ 'withholdingRecipients.inl.protocol' | translate }}</span>
            <input
              nz-input
              id="wr-inl-protocol"
              [ngModel]="protocol()"
              (ngModelChange)="protocol.set($event)"
            />
          </label>
          <label class="field" for="wr-inl-sent-at">
            <span>{{ 'withholdingRecipients.inl.sentAt' | translate }}</span>
            <input
              nz-input
              id="wr-inl-sent-at"
              type="date"
              [ngModel]="sentAt()"
              (ngModelChange)="sentAt.set($event)"
            />
          </label>
        </div>
        <div class="footer">
          <button nz-button type="button" (click)="sending.set(null)">
            {{ 'withholdingRecipients.action.cancel' | translate }}
          </button>
          <button
            nz-button
            nzType="primary"
            type="button"
            [nzLoading]="store.saving()"
            (click)="confirmSend(target)"
          >
            {{ 'withholdingRecipients.inl.markSent' | translate }}
          </button>
        </div>
      </div>
    }

    @if (canWrite()) {
      <h4 class="title">{{ 'withholdingRecipients.inl.generate' | translate }}</h4>
      <div class="grid">
        <label class="field" for="wr-inl-start">
          <span>{{ 'withholdingRecipients.inl.workStart' | translate }}</span>
          <input
            nz-input
            id="wr-inl-start"
            type="date"
            [ngModel]="form().work_start_date"
            (ngModelChange)="patch({ work_start_date: $event })"
          />
        </label>
        <label class="field" for="wr-inl-end">
          <span>{{ 'withholdingRecipients.inl.workEnd' | translate }}</span>
          <input
            nz-input
            id="wr-inl-end"
            type="date"
            [ngModel]="form().work_end_date"
            (ngModelChange)="patch({ work_end_date: $event })"
          />
        </label>
        <label class="field wide" for="wr-inl-activity">
          <span>{{ 'withholdingRecipients.inl.activity' | translate }}</span>
          <textarea
            nz-input
            id="wr-inl-activity"
            rows="2"
            [ngModel]="form().activity_description"
            (ngModelChange)="patch({ activity_description: $event })"
          ></textarea>
        </label>
        <label class="field" for="wr-inl-place">
          <span>{{ 'withholdingRecipients.inl.place' | translate }}</span>
          <input
            nz-input
            id="wr-inl-place"
            [ngModel]="form().work_place"
            (ngModelChange)="patch({ work_place: $event })"
          />
        </label>
        <label class="field" for="wr-inl-estimated">
          <span>{{ 'withholdingRecipients.inl.estimated' | translate }}</span>
          <nz-input-number
            nzId="wr-inl-estimated"
            [nzMin]="0"
            [nzStep]="50"
            [ngModel]="form().estimated_compensation"
            (ngModelChange)="patch({ estimated_compensation: $event })"
          ></nz-input-number>
        </label>
      </div>
      <div class="footer">
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="store.saving()"
          [disabled]="!valid()"
          (click)="generate()"
        >
          {{ 'withholdingRecipients.inl.generate' | translate }}
        </button>
      </div>
    }
  `,
  styles: `
    .hint {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .feedback {
      margin-bottom: 12px;
    }

    .title {
      margin: 16px 0 8px;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 12px;
    }

    .field {
      display: flex;
      flex-direction: column;
      gap: 4px;
      font-size: 12px;
    }

    .wide {
      grid-column: 1 / -1;
    }

    .num {
      text-align: right;
      white-space: nowrap;
    }

    .muted {
      display: block;
      color: var(--ant-text-color-secondary, #595959);
    }

    .actions {
      display: flex;
      flex-wrap: wrap;
      justify-content: flex-end;
      gap: 4px;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      gap: 8px;
      margin-top: 12px;
    }
  `,
})
export class InlPanelComponent {
  readonly store = inject(RecipientsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly recipientId = input.required<string>();
  readonly canWrite = input<boolean>(true);

  readonly formats = WR_INL_FORMATS;
  readonly form = signal<InlFormValue>({ ...EMPTY_INL_FORM });
  readonly error = signal<WrOutcome | null>(null);
  readonly valid = computed(() => isInlFormValid(this.form()));

  /** The communication whose "sent" form is open. */
  readonly sending = signal<WrInlNotification | null>(null);
  readonly protocol = signal('');
  readonly sentAt = signal('');

  readonly canSend = canMarkInlSent;
  readonly canCancel = canCancelInl;

  statusColor(notice: WrInlNotification): string {
    return inlStatusColor(notice.status);
  }

  patch(change: Partial<InlFormValue>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  async generate(): Promise<void> {
    if (!this.valid()) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.addInl(this.recipientId(), inlPayloadOf(this.form()));
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.inlGenerated'));
      this.form.set({ ...EMPTY_INL_FORM });
    } else {
      this.error.set(outcome);
    }
  }

  startSend(notice: WrInlNotification): void {
    this.protocol.set('');
    this.sentAt.set('');
    this.sending.set(notice);
  }

  async confirmSend(notice: WrInlNotification): Promise<void> {
    this.error.set(null);
    const protocol = this.protocol().trim();
    const outcome = await this.store.markInlSent(this.recipientId(), notice.id, {
      protocol_reference: protocol === '' ? null : protocol,
      sent_at: this.sentAt() === '' ? null : this.sentAt(),
    });
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.inlSent'));
      this.sending.set(null);
    } else {
      this.error.set(outcome);
    }
  }

  async cancel(notice: WrInlNotification): Promise<void> {
    this.error.set(null);
    const outcome = await this.store.cancelInl(this.recipientId(), notice.id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.inlCancelled'));
    } else {
      this.error.set(outcome);
    }
  }

  /** Hands the file to the browser; a refusal of the API (for example a cancelled communication) is shown translated. */
  async download(notice: WrInlNotification, format: WrInlFormat): Promise<void> {
    this.error.set(null);
    const file = await this.store.downloadInl(notice.id, format);
    if (file.ok && file.blob) {
      downloadBlob(file.blob, file.filename);
    } else {
      this.error.set(file);
    }
  }
}
