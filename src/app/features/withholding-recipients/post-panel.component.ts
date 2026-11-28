import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { TranslateService, WrSimulation } from '@core';
import { TranslatePipe } from '@shared';
import { InlGateComponent } from './inl-gate.component';
import { SimulationResultComponent } from './simulation-result.component';
import { SettlementsStore } from './settlements.store';
import {
  emptyPaymentForm,
  inlCoverage,
  isInlBlocking,
  isPaymentFormValid,
  PaymentFormValue,
  WrOutcome,
} from './withholding-recipients.util';

/** Pause after the last keystroke before the preview of the payment is computed. */
const PREVIEW_DEBOUNCE_MS = 350;

/**
 * Post-payment form (settle ability): a compensation paid on a date (cash basis) with its live preview and the INL gate of
 * the occasional workers. Posting registers the withholdings, the F24 lines and the CU data. Uses the `SettlementsStore`.
 */
@Component({
  selector: 'app-wr-post-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
    InlGateComponent,
    SimulationResultComponent,
    TranslatePipe,
    NzAlertModule,
    NzButtonModule,
    NzInputModule,
    NzInputNumberModule,
    NzPopconfirmModule,
    NzSelectModule,
  ],
  template: `
    <p class="hint">{{ 'withholdingRecipients.post.hint' | translate }}</p>

    @if (error(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="failure.errorKey ?? '' | translate"
        [nzDescription]="failure.detail ?? ''"
      ></nz-alert>
    }

    <div class="layout">
      <div>
        <div class="grid">
          <label class="field wide" for="wr-post-recipient">
            <span>{{ 'withholdingRecipients.field.recipient' | translate }}</span>
            <nz-select
              nzId="wr-post-recipient"
              nzShowSearch
              [ngModel]="form().recipient_profile_id"
              (ngModelChange)="pickRecipient($event ?? null)"
            >
              @for (entry of store.activeRecipients(); track entry.id) {
                <nz-option [nzValue]="entry.id" [nzLabel]="entry.display_name"></nz-option>
              }
            </nz-select>
          </label>
          <label class="field" for="wr-post-gross">
            <span>{{ 'withholdingRecipients.field.grossAmount' | translate }}</span>
            <nz-input-number
              nzId="wr-post-gross"
              [nzMin]="0"
              [nzStep]="100"
              [ngModel]="form().gross_amount"
              (ngModelChange)="patch({ gross_amount: $event })"
            ></nz-input-number>
          </label>
          <label class="field" for="wr-post-payment">
            <span>{{ 'withholdingRecipients.field.paymentDate' | translate }}</span>
            <input
              nz-input
              id="wr-post-payment"
              type="date"
              [ngModel]="form().payment_date"
              (ngModelChange)="patch({ payment_date: $event })"
            />
          </label>
          <label class="field" for="wr-post-service">
            <span>{{ 'withholdingRecipients.field.serviceDate' | translate }}</span>
            <input
              nz-input
              id="wr-post-service"
              type="date"
              [ngModel]="form().service_date"
              (ngModelChange)="patch({ service_date: $event })"
            />
          </label>
          <label class="field" for="wr-post-document">
            <span>{{ 'withholdingRecipients.field.documentNumber' | translate }}</span>
            <input
              nz-input
              id="wr-post-document"
              [ngModel]="form().document_number"
              (ngModelChange)="patch({ document_number: $event })"
            />
          </label>
          <label class="field" for="wr-post-reference">
            <span>{{ 'withholdingRecipients.field.paymentReference' | translate }}</span>
            <input
              nz-input
              id="wr-post-reference"
              [ngModel]="form().payment_reference"
              (ngModelChange)="patch({ payment_reference: $event })"
            />
          </label>
          @if (recipientRegime() === 'swiss_foreign_artist') {
            <label class="field" for="wr-post-days">
              <span>{{ 'withholdingRecipients.field.performanceDays' | translate }}</span>
              <nz-input-number
                nzId="wr-post-days"
                [nzMin]="1"
                [nzMax]="366"
                [ngModel]="form().performance_days"
                (ngModelChange)="patch({ performance_days: $event })"
              ></nz-input-number>
            </label>
            <label class="field" for="wr-post-expenses">
              <span>{{ 'withholdingRecipients.field.acquisitionExpenses' | translate }}</span>
              <nz-input-number
                nzId="wr-post-expenses"
                [nzMin]="0"
                [ngModel]="form().acquisition_expenses"
                (ngModelChange)="patch({ acquisition_expenses: $event })"
              ></nz-input-number>
            </label>
          }
          <label class="field wide" for="wr-post-notes">
            <span>{{ 'withholdingRecipients.field.notes' | translate }}</span>
            <textarea
              nz-input
              id="wr-post-notes"
              rows="2"
              [ngModel]="form().notes"
              (ngModelChange)="patch({ notes: $event })"
            ></textarea>
          </label>
        </div>

        @if (form().recipient_profile_id) {
          <app-wr-inl-gate
            class="gate"
            [regime]="recipientRegime()"
            [notifications]="inl()"
            [date]="coverageDate()"
          ></app-wr-inl-gate>
        }

        <div class="footer">
          <button
            nz-button
            nzType="primary"
            type="button"
            nz-popconfirm
            [nzPopconfirmTitle]="'withholdingRecipients.post.confirm' | translate"
            [nzOkText]="'withholdingRecipients.post.submit' | translate"
            [nzCancelText]="'withholdingRecipients.action.cancel' | translate"
            [nzLoading]="store.posting()"
            [disabled]="!canPost()"
            (nzOnConfirm)="post()"
          >
            {{ 'withholdingRecipients.post.submit' | translate }}
          </button>
        </div>
      </div>

      <div>
        <h4 class="title">{{ 'withholdingRecipients.post.preview' | translate }}</h4>
        @if (preview(); as result) {
          <app-wr-simulation-result [result]="result"></app-wr-simulation-result>
        } @else {
          <p class="hint">{{ 'withholdingRecipients.post.previewEmpty' | translate }}</p>
        }
      </div>
    </div>
  `,
  styles: `
    .hint {
      font-size: 12px;
      color: var(--ant-text-color-secondary, #595959);
    }

    .feedback {
      margin-bottom: 12px;
    }

    .layout {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
      gap: 24px;
      align-items: start;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 16px;
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

    .gate {
      display: block;
      margin-top: 16px;
    }

    .title {
      margin: 0 0 8px;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 16px;
    }
  `,
})
export class PostPanelComponent implements OnDestroy {
  readonly store = inject(SettlementsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly form = signal<PaymentFormValue>(emptyPaymentForm());
  readonly preview = signal<WrSimulation | null>(null);
  readonly error = signal<WrOutcome | null>(null);

  private timer: ReturnType<typeof setTimeout> | null = null;
  private ticket = 0;

  readonly recipient = computed(
    () =>
      this.store.recipients().find((entry) => entry.id === this.form().recipient_profile_id) ??
      null,
  );
  readonly recipientRegime = computed(() => this.recipient()?.regime ?? null);
  readonly inl = computed(
    () => this.store.inlByRecipient()[this.form().recipient_profile_id ?? ''] ?? [],
  );
  /** The date the INL communication has to cover: the service, or the payment when no service date is given. */
  readonly coverageDate = computed(() => this.form().service_date || this.form().payment_date);
  /** The posting is blocked while an occasional worker has no communication sent before the work started. */
  readonly blocked = computed(() =>
    isInlBlocking(inlCoverage(this.recipientRegime(), this.inl(), this.coverageDate())),
  );
  readonly canPost = computed(() => isPaymentFormValid(this.form()) && !this.blocked());

  ngOnDestroy(): void {
    this.cancelTimer();
    this.ticket++;
  }

  patch(change: Partial<PaymentFormValue>): void {
    this.form.update((current) => ({ ...current, ...change }));
    this.schedulePreview();
  }

  pickRecipient(id: string | null): void {
    this.patch({ recipient_profile_id: id });
    if (id) {
      void this.store.loadCoverage(id);
    }
  }

  private cancelTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private schedulePreview(): void {
    this.cancelTimer();
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refreshPreview();
    }, PREVIEW_DEBOUNCE_MS);
  }

  async refreshPreview(): Promise<void> {
    const ticket = ++this.ticket;
    const result = await this.store.preview(this.form());
    if (ticket === this.ticket) {
      this.preview.set(result);
    }
  }

  async post(): Promise<void> {
    if (!this.canPost()) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.post(this.form());
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.posted'));
      const recipientId = this.form().recipient_profile_id;
      this.form.set(emptyPaymentForm());
      this.preview.set(null);
      if (recipientId) {
        void this.store.loadCoverage(recipientId);
      }
    } else {
      this.error.set(outcome);
    }
  }
}
