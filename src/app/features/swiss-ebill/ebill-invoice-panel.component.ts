import { ChangeDetectionStrategy, Component, effect, inject, input, output } from '@angular/core';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzPopconfirmModule } from 'ng-zorro-antd/popconfirm';
import { NzSpinModule } from 'ng-zorro-antd/spin';
import { EbillTransmission, PermissionsService, TranslateService } from '@core';
import { TranslatePipe } from '@shared';
import { EbillLifecycleComponent } from './ebill-lifecycle.component';
import { InvoiceEbillStore } from './invoice-ebill.store';
import { EbillOutcome, SWISS_EBILL_MODULE, saveBlob } from './swiss-ebill.util';

/**
 * The eBill block of an invoice: pre-flight violations, the "Send via eBill" action and the lifecycle of the latest transmission.
 * Emits `changed` after every action so the host can refresh the invoice row.
 */
@Component({
  selector: 'app-ebill-invoice-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [
    EbillLifecycleComponent,
    NzAlertModule,
    NzButtonModule,
    NzPopconfirmModule,
    NzSpinModule,
    TranslatePipe,
  ],
  providers: [InvoiceEbillStore],
  styleUrl: './swiss-ebill.scss',
  template: `
    <nz-spin [nzSpinning]="store.loading() || store.working()">
      <div class="stack">
        @if (store.error(); as error) {
          <nz-alert nzType="error" nzShowIcon [nzMessage]="error | translate"></nz-alert>
        }

        @if (store.lifecycle(); as lifecycle) {
          @if (lifecycle.can_send) {
            @if (canWrite) {
              <div>
                <button
                  nz-button
                  nzType="primary"
                  type="button"
                  data-test="send"
                  nz-popconfirm
                  [nzPopconfirmTitle]="'swissEbill.confirm.send.body' | translate"
                  (nzOnConfirm)="send()"
                >
                  {{
                    (latest() ? 'swissEbill.action.resend' : 'swissEbill.action.send') | translate
                  }}
                </button>
              </div>
            }
          } @else if (store.violations().length > 0) {
            <nz-alert
              data-test="violations"
              nzType="warning"
              nzShowIcon
              [nzMessage]="'swissEbill.section.preflight' | translate"
              [nzDescription]="violationList"
            ></nz-alert>
            <ng-template #violationList>
              <ul class="violations">
                @for (violation of store.violations(); track violation.code + violation.field) {
                  <li>{{ 'swissEbill.violation.' + violation.code | translate }}</li>
                }
              </ul>
            </ng-template>
          }

          @if (latest(); as transmission) {
            <app-ebill-lifecycle
              [transmission]="transmission"
              [canWrite]="canWrite"
              (revise)="run(store.revise(transmission.id))"
              (retry)="run(store.retry(transmission.id))"
              (cancelRequested)="
                run(store.cancel(transmission.id), 'swissEbill.toast.transmissionCancelled')
              "
              (download)="download(transmission)"
            ></app-ebill-lifecycle>
          } @else {
            <p class="hint">{{ 'swissEbill.empty.timeline' | translate }}</p>
          }
        }
      </div>
    </nz-spin>
  `,
})
export class EbillInvoicePanelComponent {
  readonly invoiceId = input.required<string>();
  readonly changed = output<void>();

  protected readonly store = inject(InvoiceEbillStore);
  private readonly message = inject(NzMessageService);
  private readonly i18n = inject(TranslateService);
  protected readonly canWrite = inject(PermissionsService).canWrite(SWISS_EBILL_MODULE);

  constructor() {
    effect(() => {
      void this.store.load(this.invoiceId());
    });
  }

  /** The newest transmission of the invoice, the one whose lifecycle is shown. */
  protected latest(): EbillTransmission | null {
    const list = this.store.lifecycle()?.transmissions ?? [];
    return list.length > 0 ? list[0] : null;
  }

  protected async send(): Promise<void> {
    await this.run(this.store.send(), 'swissEbill.toast.transmissionQueued');
  }

  protected async run(pending: Promise<EbillOutcome>, successKey?: string): Promise<void> {
    const outcome = await pending;
    if (outcome.ok) {
      this.message.success(this.i18n.instant(successKey ?? 'swissEbill.toast.transmissionQueued'));
      this.changed.emit();
    } else {
      this.message.error(this.i18n.instant(outcome.errorKey ?? 'swissEbill.error.unknown'));
    }
  }

  protected async download(transmission: EbillTransmission): Promise<void> {
    const blob = await this.store.download(transmission.id);
    if (blob) {
      saveBlob(blob, `ebill-${transmission.invoice_number ?? transmission.invoice_id}.xml`);
    }
  }
}
