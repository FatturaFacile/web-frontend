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
import { TranslateService, WrCertificate } from '@core';
import { TranslatePipe } from '@shared';
import { RecipientsStore } from './recipients.store';
import {
  CertificateFormValue,
  certificatePayloadOf,
  certStatusColor,
  emptyCertificateForm,
  isCertificateFormValid,
  WrOutcome,
} from './withholding-recipients.util';

/**
 * The yearly declarations of an agent that opt into the 20% withholding base (art. 25-bis): list with the validity and expiry
 * status, whether each one arrived before the start of its validity, and a form to record a new one. Uses the
 * `RecipientsStore` of the drawer that hosts it.
 */
@Component({
  selector: 'app-wr-certificates-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    FormsModule,
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
    <p class="hint">{{ 'withholdingRecipients.certificates.hint' | translate }}</p>

    @if (error(); as failure) {
      <nz-alert
        class="feedback"
        nzType="error"
        nzShowIcon
        [nzMessage]="failure.errorKey ?? '' | translate"
        [nzDescription]="failure.detail ?? ''"
      ></nz-alert>
    }

    <nz-table #table nzSize="small" [nzData]="store.certificates()" [nzShowPagination]="false">
      <thead>
        <tr>
          <th scope="col">{{ 'withholdingRecipients.field.fiscalYear' | translate }}</th>
          <th scope="col">{{ 'withholdingRecipients.certificates.validity' | translate }}</th>
          <th scope="col">{{ 'withholdingRecipients.certificates.receivedOn' | translate }}</th>
          <th scope="col">{{ 'withholdingRecipients.field.status' | translate }}</th>
          <th scope="col">{{ 'withholdingRecipients.certificates.pec' | translate }}</th>
          <th scope="col"></th>
        </tr>
      </thead>
      <tbody>
        @for (cert of table.data; track cert.id) {
          <tr>
            <th scope="row">{{ cert.fiscal_year }}</th>
            <td>{{ cert.valid_from }} – {{ cert.valid_to }}</td>
            <td>
              {{ cert.received_on }}
              @if (!cert.received_in_time) {
                <nz-tag nzColor="orange">{{
                  'withholdingRecipients.certificates.late' | translate
                }}</nz-tag>
              }
            </td>
            <td>
              <nz-tag [nzColor]="statusColor(cert)">{{
                'withholdingRecipients.certStatus.' + cert.status | translate
              }}</nz-tag>
            </td>
            <td>{{ cert.pec_archive_reference ?? cert.pec_message_id ?? '' }}</td>
            <td class="actions">
              @if (canWrite()) {
                <button
                  nz-button
                  nzSize="small"
                  nzDanger
                  type="button"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'withholdingRecipients.action.confirmDelete' | translate"
                  [nzOkText]="'withholdingRecipients.action.delete' | translate"
                  [nzCancelText]="'withholdingRecipients.action.cancel' | translate"
                  (nzOnConfirm)="remove(cert)"
                >
                  {{ 'withholdingRecipients.action.delete' | translate }}
                </button>
              }
            </td>
          </tr>
        }
      </tbody>
    </nz-table>

    @if (canWrite()) {
      <h4 class="title">{{ 'withholdingRecipients.certificates.new' | translate }}</h4>
      <div class="grid">
        <label class="field" for="wr-cert-year">
          <span>{{ 'withholdingRecipients.field.fiscalYear' | translate }}</span>
          <nz-input-number
            nzId="wr-cert-year"
            [nzMin]="2000"
            [nzMax]="2100"
            [ngModel]="form().fiscal_year"
            (ngModelChange)="patch({ fiscal_year: $event })"
          ></nz-input-number>
        </label>
        <label class="field" for="wr-cert-received">
          <span>{{ 'withholdingRecipients.certificates.receivedOn' | translate }}</span>
          <input
            nz-input
            id="wr-cert-received"
            type="date"
            [ngModel]="form().received_on"
            (ngModelChange)="patch({ received_on: $event })"
          />
        </label>
        <label class="field" for="wr-cert-from">
          <span>{{ 'withholdingRecipients.field.validFrom' | translate }}</span>
          <input
            nz-input
            id="wr-cert-from"
            type="date"
            [ngModel]="form().valid_from"
            (ngModelChange)="patch({ valid_from: $event })"
          />
        </label>
        <label class="field" for="wr-cert-to">
          <span>{{ 'withholdingRecipients.field.validTo' | translate }}</span>
          <input
            nz-input
            id="wr-cert-to"
            type="date"
            [ngModel]="form().valid_to"
            (ngModelChange)="patch({ valid_to: $event })"
          />
        </label>
        <label class="field" for="wr-cert-pec-id">
          <span>{{ 'withholdingRecipients.certificates.pecMessageId' | translate }}</span>
          <input
            nz-input
            id="wr-cert-pec-id"
            [ngModel]="form().pec_message_id"
            (ngModelChange)="patch({ pec_message_id: $event })"
          />
        </label>
        <label class="field" for="wr-cert-pec-ref">
          <span>{{ 'withholdingRecipients.certificates.pecArchive' | translate }}</span>
          <input
            nz-input
            id="wr-cert-pec-ref"
            [ngModel]="form().pec_archive_reference"
            (ngModelChange)="patch({ pec_archive_reference: $event })"
          />
        </label>
      </div>
      <div class="footer">
        <button
          nz-button
          nzType="primary"
          type="button"
          [nzLoading]="store.saving()"
          [disabled]="!valid()"
          (click)="add()"
        >
          {{ 'withholdingRecipients.certificates.add' | translate }}
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

    .actions {
      text-align: right;
    }

    .footer {
      display: flex;
      justify-content: flex-end;
      margin-top: 12px;
    }
  `,
})
export class CertificatesPanelComponent {
  readonly store = inject(RecipientsStore);
  private readonly message = inject(NzMessageService);
  private readonly translate = inject(TranslateService);

  readonly recipientId = input.required<string>();
  readonly canWrite = input<boolean>(true);

  readonly form = signal<CertificateFormValue>(emptyCertificateForm());
  readonly error = signal<WrOutcome | null>(null);
  readonly valid = computed(() => isCertificateFormValid(this.form()));

  statusColor(cert: WrCertificate): string {
    return certStatusColor(cert.status);
  }

  patch(change: Partial<CertificateFormValue>): void {
    this.form.update((current) => ({ ...current, ...change }));
  }

  async add(): Promise<void> {
    if (!this.valid()) {
      return;
    }
    this.error.set(null);
    const outcome = await this.store.addCertificate(
      this.recipientId(),
      certificatePayloadOf(this.form()),
    );
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.saved'));
      this.form.set(emptyCertificateForm());
    } else {
      this.error.set(outcome);
    }
  }

  async remove(cert: WrCertificate): Promise<void> {
    this.error.set(null);
    const outcome = await this.store.removeCertificate(this.recipientId(), cert.id);
    if (outcome.ok) {
      this.message.success(this.translate.instant('withholdingRecipients.message.deleted'));
    } else {
      this.error.set(outcome);
    }
  }
}
