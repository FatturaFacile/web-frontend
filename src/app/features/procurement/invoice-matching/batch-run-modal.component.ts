import { Component, effect, inject, model, output } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { I18nService } from '@core/i18n';
import { TranslatePipe } from '@shared';
import { NzButtonModule } from 'ng-zorro-antd/button';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzFormModule } from 'ng-zorro-antd/form';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzInputNumberModule } from 'ng-zorro-antd/input-number';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { InvoiceMatchingStore } from './invoice-matching.store';

/** "Batch run" dialog: matches every pending invoice, optionally of one supplier. */
@Component({
  selector: 'app-batch-run-modal',
  imports: [
    ReactiveFormsModule,
    TranslatePipe,
    NzButtonModule,
    NzCheckboxModule,
    NzFormModule,
    NzInputModule,
    NzInputNumberModule,
    NzModalModule,
  ],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'invoiceMatching.form.batchModalTitle' | translate"
      [nzOkText]="'invoiceMatching.button.batchRun' | translate"
      [nzCancelText]="'invoiceMatching.button.cancel' | translate"
      [nzOkLoading]="store.busy()"
      [nzOkDisabled]="form.invalid"
      (nzOnOk)="submit()"
      (nzOnCancel)="visible.set(false)"
      data-testid="batch-run-modal"
    >
      <ng-container *nzModalContent>
        <form nz-form nzLayout="vertical" [formGroup]="form">
          <nz-form-item>
            <nz-form-label nzFor="batch-supplier">{{
              'invoiceMatching.form.supplierId' | translate
            }}</nz-form-label>
            <nz-form-control>
              <input nz-input id="batch-supplier" formControlName="supplier_id" />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-label nzRequired nzFor="batch-limit">{{
              'invoiceMatching.form.limit' | translate
            }}</nz-form-label>
            <nz-form-control [nzErrorTip]="'invoiceMatching.form.required' | translate">
              <nz-input-number
                nzId="batch-limit"
                formControlName="limit"
                [nzMin]="1"
                [nzMax]="500"
                [nzStep]="1"
              />
            </nz-form-control>
          </nz-form-item>
          <nz-form-item>
            <nz-form-control>
              <label
                for="batch-include-unreferenced"
                nzId="batch-include-unreferenced"
                nz-checkbox
                formControlName="include_unreferenced"
                >{{ 'invoiceMatching.form.includeUnreferenced' | translate }}</label
              >
            </nz-form-control>
          </nz-form-item>
        </form>
      </ng-container>
    </nz-modal>
  `,
})
export class BatchRunModalComponent {
  protected readonly store = inject(InvoiceMatchingStore);
  private readonly i18n = inject(I18nService);
  private readonly message = inject(NzMessageService);
  private readonly fb = inject(NonNullableFormBuilder);

  readonly visible = model(false);
  readonly completed = output<void>();

  protected readonly form = this.fb.group({
    supplier_id: this.fb.control(''),
    limit: this.fb.control(100, [Validators.required, Validators.min(1), Validators.max(500)]),
    include_unreferenced: this.fb.control(false),
  });

  constructor() {
    effect(() => {
      if (this.visible()) {
        this.form.reset({ supplier_id: '', limit: 100, include_unreferenced: false });
      }
    });
  }

  async submit(): Promise<void> {
    if (this.form.invalid) {
      return;
    }
    const { supplier_id, limit, include_unreferenced } = this.form.getRawValue();
    const supplier = supplier_id.trim();
    const outcome = await this.store.batchRun({
      ...(supplier ? { supplier_id: supplier } : {}),
      limit,
      include_unreferenced,
    });

    if (outcome.ok && outcome.result) {
      const { processed, matched, blocked, skipped } = outcome.result;
      this.message.success(
        this.i18n.translate('invoiceMatching.message.batchResult', {
          processed,
          matched,
          blocked,
          skipped,
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
