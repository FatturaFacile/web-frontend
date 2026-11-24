import { Component, effect, inject, input, model, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { DISPATCH_CHANNELS, DispatchChannel } from '@domain/procurement/purchase-order-fulfilment.models';
import { DateFormatPipe, TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { NzTableModule } from 'ng-zorro-antd/table';
import { extractApiErrorMessage } from '../requisitions/pr-status.helpers';
import { PurchaseOrderFulfilmentStore } from './purchase-order-fulfilment.store';

/** Transmits a purchase order to the supplier (PDF, email, EDI or Peppol) and lists the dispatch log. */
@Component({
  selector: 'app-po-dispatch-modal',
  imports: [ReactiveFormsModule, DateFormatPipe, TranslatePipe, NzButtonModule, NzFormModule, NzInputModule, NzModalModule, NzSelectModule, NzTableModule],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'purchases.fulfilment.dispatch.title' | translate"
      [nzOkText]="'purchases.fulfilment.dispatch.submit' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="visible.set(false)"
      data-testid="po-dispatch-modal"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="dispatch-channel">{{ 'purchases.fulfilment.dispatch.channel' | translate }}</nz-form-label>
            <nz-form-control>
              <nz-select nzId="dispatch-channel" formControlName="channel">
                @for (channel of channels; track channel) {
                  <nz-option [nzValue]="channel" [nzLabel]="'purchases.channels.' + channel | translate" />
                }
              </nz-select>
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="dispatch-recipient">{{ 'purchases.fulfilment.dispatch.recipient' | translate }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="dispatch-recipient" formControlName="recipient" maxlength="190" />
            </nz-form-control>
          </nz-form-item>
        </form>
        @if (store.dispatches().length > 0) {
          <h4>{{ 'purchases.fulfilment.dispatch.history' | translate }}</h4>
          <nz-table #historyTable [nzData]="store.dispatches()" nzSize="small" [nzShowPagination]="false" data-testid="po-dispatch-history">
            <tbody>
              @for (row of historyTable.data; track row.id) {
                <tr>
                  <td>{{ 'purchases.channels.' + row.channel | translate }}</td>
                  <td>{{ row.recipient || '-' }}</td>
                  <td>{{ row.dispatched_at | appDate }}</td>
                </tr>
              }
            </tbody>
          </nz-table>
        }
      </ng-container>
    </nz-modal>
  `,
})
export class PoDispatchModalComponent {
  protected readonly store = inject(PurchaseOrderFulfilmentStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly orderId = input.required<string>();
  readonly defaultRecipient = input<string | null>(null);
  readonly visible = model(false);
  readonly dispatched = output<void>();

  protected readonly channels = DISPATCH_CHANNELS;
  protected readonly form = this.fb.group({
    channel: this.fb.control<DispatchChannel>('pdf', Validators.required),
    recipient: this.fb.control('', Validators.maxLength(190)),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.patchValue({ recipient: this.defaultRecipient() ?? '' });
        this.store.loadDispatches(this.orderId()).subscribe();
      }
    });
  }

  submit(): void {
    if (this.form.invalid) {
      return;
    }
    const { channel, recipient } = this.form.getRawValue();
    this.store.dispatch(this.orderId(), { channel, recipient: recipient.trim() || null }).subscribe({
      next: () => {
        this.message.success(this.i18n.translate('purchases.fulfilment.dispatch.success'));
        this.visible.set(false);
        this.dispatched.emit();
      },
      error: (err: unknown) => this.message.error(extractApiErrorMessage(err) || this.i18n.translate('common.errors.generic')),
    });
  }
}
