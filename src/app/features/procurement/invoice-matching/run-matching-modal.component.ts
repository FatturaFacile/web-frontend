import { Component, effect, inject, model, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { matchStatusKey } from './invoice-matching.helpers';
import { InvoiceMatchingStore } from './invoice-matching.store';

/** "Run matching" dialog: evaluates one purchase invoice, optionally against a chosen purchase order. */
@Component({
  selector: 'app-run-matching-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    NzButtonModule,
    NzFormModule,
    NzInputModule,
    NzModalModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'invoiceMatching.form.runModalTitle' | translate"
      [nzOkText]="'invoiceMatching.button.runMatching' | translate"
      [nzCancelText]="'invoiceMatching.button.cancel' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="visible.set(false)"
      data-testid="run-matching-modal"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzRequired nzFor="run-invoice">{{
              'invoiceMatching.form.passiveInvoiceId' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'invoiceMatching.form.required' | translate">
              <input nz-input id="run-invoice" formControlName="passive_invoice_id" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzFor="run-order">{{
              'invoiceMatching.form.purchaseOrderId' | translate
            }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="run-order" formControlName="purchase_order_id" />
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class RunMatchingModalComponent {
  protected readonly store = inject(InvoiceMatchingStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly visible = model(false);
  readonly completed = output<void>();

  protected readonly form = this.fb.group({
    passive_invoice_id: this.fb.control('', Validators.required),
    purchase_order_id: this.fb.control(''),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ passive_invoice_id: '', purchase_order_id: '' });
      }
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const { passive_invoice_id, purchase_order_id } = this.form.getRawValue();
    const orderId = purchase_order_id.trim();
    const outcome = await this.store.run({
      passive_invoice_id: passive_invoice_id.trim(),
      ...(orderId ? { purchase_order_id: orderId } : {}),
    });

    if (outcome.ok && outcome.result) {
      this.message.success(
        this.i18n.translate('invoiceMatching.message.runSuccess', {
          status: this.i18n.translate(matchStatusKey(outcome.result.status)),
        }),
      );
      this.visible.set(false);
      this.completed.emit();
    } else {
      this.message.error(
        outcome.message || this.i18n.translate('invoiceMatching.message.genericError'),
      );
    }
  }
}
