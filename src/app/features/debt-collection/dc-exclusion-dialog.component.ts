import { Component, computed, effect, inject, input, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import { DcExclusionPayload, DcExclusionType } from '@core';
import { TranslatePipe } from '@shared';
import { ArCustomerSelectComponent } from '../receivables/ar-customer-select.component';
import { DcLookupsStore } from './lookups.store';

/** Dialog that flags a customer: a dispute, a legal hold or a manual exclusion keeps the open items out of the dunning queue. */
@Component({
  selector: 'app-dc-exclusion-dialog',
  imports: [
    FormsModule,
    TranslatePipe,
    ArCustomerSelectComponent,
    NzInputModule,
    NzModalModule,
    NzSelectModule,
  ],
  styleUrl: './debt-collection.scss',
  template: `
    <nz-modal
      [nzVisible]="open()"
      [nzTitle]="'debtCollection.exclusion.dialogTitle' | translate"
      [nzOkText]="'debtCollection.action.save' | translate"
      [nzCancelText]="'debtCollection.action.cancel' | translate"
      [nzOkDisabled]="!valid()"
      [nzOkLoading]="saving()"
      (nzOnOk)="submit()"
      (nzOnCancel)="closed.emit()"
    >
      <ng-container *nzModalContent>
        <div class="stack">
          @if (!customerId()) {
            <div class="field">
              <span>{{ 'debtCollection.field.customer' | translate }}</span>
              <app-ar-customer-select
                [customerId]="pickedCustomer()"
                (customerChange)="pickedCustomer.set($event?.id ?? null)"
              />
            </div>
          }
          <label class="field" for="dc-x-type">
            <span>{{ 'debtCollection.field.exclusionType' | translate }}</span>
            <nz-select nzId="dc-x-type" [ngModel]="type()" (ngModelChange)="type.set($event)">
              @for (value of lookups.lookups().exclusion_types; track value) {
                <nz-option
                  [nzValue]="value"
                  [nzLabel]="'debtCollection.exclusionType.' + value | translate"
                />
              }
            </nz-select>
          </label>
          <label class="field" for="dc-x-reason">
            <span>{{ 'debtCollection.field.reason' | translate }}</span>
            <input
              nz-input
              id="dc-x-reason"
              maxlength="255"
              [ngModel]="reason()"
              (ngModelChange)="reason.set($event)"
            />
          </label>
          <label class="field" for="dc-x-notes">
            <span>{{ 'debtCollection.field.notes' | translate }}</span>
            <textarea
              nz-input
              id="dc-x-notes"
              rows="3"
              maxlength="1000"
              [ngModel]="notes()"
              (ngModelChange)="notes.set($event)"
            ></textarea>
          </label>
        </div>
      </ng-container>
    </nz-modal>
  `,
})
export class DcExclusionDialogComponent {
  protected readonly lookups = inject(DcLookupsStore);

  readonly open = input(false);
  /** The customer the exclusion is for; without it the dialog offers a customer picker. */
  readonly customerId = input<string | null>(null);
  readonly presetType = input<DcExclusionType>('manual');
  readonly saving = input(false);
  readonly submitted = output<DcExclusionPayload>();
  readonly closed = output<void>();

  protected readonly pickedCustomer = signal<string | null>(null);
  protected readonly type = signal<DcExclusionType>('manual');
  protected readonly reason = signal('');
  protected readonly notes = signal('');

  protected readonly valid = computed(
    () => (this.customerId() ?? this.pickedCustomer()) !== null && this.reason().trim() !== '',
  );

  constructor() {
    // Each time the dialog opens it starts from a clean form with the preset type.
    effect(() => {
      if (this.open()) {
        this.type.set(this.presetType());
        this.reason.set('');
        this.notes.set('');
        this.pickedCustomer.set(null);
      }
    });
  }

  protected submit(): void {
    const customer = this.customerId() ?? this.pickedCustomer();
    if (!customer) {
      return;
    }
    const notes = this.notes().trim();
    this.submitted.emit({
      customer_id: customer,
      type: this.type(),
      reason: this.reason().trim(),
      ...(notes ? { notes } : {}),
    });
  }
}
