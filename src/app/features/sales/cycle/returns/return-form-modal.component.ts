import { Component, effect, inject, model, output, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NzAlertModule } from 'ng-zorro-antd/alert';
import { NzCheckboxModule } from 'ng-zorro-antd/checkbox';
import { NzInputModule } from 'ng-zorro-antd/input';
import { NzMessageService } from 'ng-zorro-antd/message';
import { NzModalModule } from 'ng-zorro-antd/modal';
import { NzSelectModule } from 'ng-zorro-antd/select';
import {
  CoreDeliveryNote,
  CoreDocumentLine,
  ReturnCondition,
  SalesCycleApiService,
  SalesReturn,
  SalesReturnPayload,
} from '@core';
import { TranslatePipe } from '@shared';
import { apiErrorText } from '../shared/sales-api-helpers';
import { SalesLookupsService } from '../shared/sales-lookups.service';
import { todayIso } from '../shared/sales-status';

interface ReturnLineDraft {
  item: CoreDocumentLine;
  quantity: string;
  condition: ReturnCondition;
  restock: boolean;
}

const DECIMAL = /^\d+(\.\d{1,4})?$/;

/** Records a customer return request against a delivery note. */
@Component({
  selector: 'app-return-form-modal',
  imports: [FormsModule, NzAlertModule, NzCheckboxModule, NzInputModule, NzModalModule, NzSelectModule, TranslatePipe],
  template: `
    <nz-modal
      [nzVisible]="visible()"
      [nzTitle]="'SC.RETURNS.NEW' | translate"
      [nzOkLoading]="saving()"
      [nzOkDisabled]="!valid()"
      nzWidth="820px"
      (nzOnCancel)="visible.set(false)"
      (nzOnOk)="submit()"
    >
      <ng-container *nzModalContent>
        @if (error()) {
          <nz-alert class="alert" nzType="error" nzShowIcon [nzMessage]="error()" />
        }
        <label for="ret-ddt">{{ 'SC.RETURNS.DELIVERY_NOTE' | translate }}</label>
        <nz-select
          nzId="ret-ddt"
          class="field"
          nzShowSearch
          [ngModel]="deliveryNoteId()"
          (ngModelChange)="pickDeliveryNote($event)"
        >
          @for (n of deliveryNotes(); track n.id) {
            <nz-option [nzValue]="n.id" [nzLabel]="n.ddt_number + ' - ' + lookups.contactName(n.contact_id, n.contact)"></nz-option>
          }
        </nz-select>
        <label for="ret-reason">{{ 'SC.RETURNS.REASON' | translate }}</label>
        <input nz-input id="ret-reason" maxlength="500" class="field" [(ngModel)]="reason" />
        <label for="ret-warehouse">{{ 'SC.DDT.WAREHOUSE' | translate }}</label>
        <nz-select nzId="ret-warehouse" class="field" nzAllowClear [(ngModel)]="warehouseId">
          @for (w of lookups.warehouses(); track w.id) {
            <nz-option [nzValue]="w.id" [nzLabel]="w.code + ' - ' + w.name"></nz-option>
          }
        </nz-select>
        @if (drafts().length) {
          <p class="hint">{{ 'SC.RETURNS.LINES_HINT' | translate }}</p>
          @for (draft of drafts(); track draft.item.id) {
            <div class="row">
              <span class="desc">{{ draft.item.description }} ({{ draft.item.quantity }})</span>
              <input
                nz-input
                inputmode="decimal"
                [attr.aria-label]="'SC.RETURNS.QUANTITY' | translate"
                [placeholder]="'SC.RETURNS.QUANTITY' | translate"
                [(ngModel)]="draft.quantity"
              />
              <nz-select [(ngModel)]="draft.condition" [attr.aria-label]="'SC.RETURNS.CONDITION' | translate">
                <nz-option nzValue="resellable" [nzLabel]="'SC.RETURNS.CONDITION_resellable' | translate"></nz-option>
                <nz-option nzValue="damaged" [nzLabel]="'SC.RETURNS.CONDITION_damaged' | translate"></nz-option>
              </nz-select>
              <!-- eslint-disable-next-line @angular-eslint/template/label-has-associated-control -->
              <label nz-checkbox [(ngModel)]="draft.restock">{{ 'SC.RETURNS.RESTOCK' | translate }}</label>
            </div>
          }
        }
        <label for="ret-notes">{{ 'SC.COMMON.NOTES' | translate }}</label>
        <textarea nz-input id="ret-notes" rows="2" class="field" [(ngModel)]="notes"></textarea>
      </ng-container>
    </nz-modal>
  `,
  styles: `
    .alert { display: block; margin-bottom: 12px; }
    .field { display: block; width: 100%; margin: 4px 0 12px; }
    .hint { color: var(--ant-color-text-secondary, #666); }
    .row { display: grid; grid-template-columns: 1.5fr 110px 150px auto; gap: 8px; align-items: center; margin-bottom: 6px; }
  `,
})
export class ReturnFormModalComponent {
  private readonly api = inject(SalesCycleApiService);
  private readonly message = inject(NzMessageService);
  protected readonly lookups = inject(SalesLookupsService);

  readonly visible = model(false);
  readonly saved = output<SalesReturn>();

  protected readonly saving = signal(false);
  protected readonly error = signal('');
  protected readonly deliveryNotes = signal<CoreDeliveryNote[]>([]);
  protected readonly deliveryNoteId = signal<string | null>(null);
  protected readonly drafts = signal<ReturnLineDraft[]>([]);
  protected reason = '';
  protected notes = '';
  protected warehouseId: string | null = null;

  constructor() {
    effect(() => {
      if (!this.visible()) {
        return;
      }
      this.lookups.load();
      this.reason = '';
      this.notes = '';
      this.warehouseId = null;
      this.error.set('');
      this.drafts.set([]);
      this.deliveryNoteId.set(null);
      this.api.getDeliveryNotes({ per_page: 100 }).subscribe({
        next: (res) => this.deliveryNotes.set(res.data ?? []),
        error: () => this.deliveryNotes.set([]),
      });
    });
  }

  protected pickDeliveryNote(id: string | null): void {
    this.deliveryNoteId.set(id);
    this.drafts.set([]);
    if (!id) {
      return;
    }
    this.api.getDeliveryNote(id).subscribe({
      next: (res) =>
        this.drafts.set(
          (res.data.items ?? []).map((item) => ({
            item,
            quantity: '',
            condition: 'resellable' as ReturnCondition,
            restock: true,
          })),
        ),
      error: (err: unknown) => this.error.set(apiErrorText(err)),
    });
  }

  protected valid(): boolean {
    const entered = this.drafts().filter((d) => d.quantity);
    return (
      !!this.deliveryNoteId() &&
      this.reason.trim().length > 0 &&
      entered.length > 0 &&
      entered.every((d) => DECIMAL.test(d.quantity))
    );
  }

  protected submit(): void {
    const payload: SalesReturnPayload = {
      delivery_note_id: this.deliveryNoteId(),
      warehouse_id: this.warehouseId,
      date: todayIso(),
      reason: this.reason.trim(),
      notes: this.notes || null,
      items: this.drafts()
        .filter((d) => d.quantity)
        .map((d) => ({
          delivery_note_item_id: d.item.id,
          quantity: d.quantity,
          condition: d.condition,
          restock: d.restock,
        })),
    };
    this.saving.set(true);
    this.error.set('');
    this.api.createReturn(payload).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.visible.set(false);
        this.message.success(res.message);
        this.saved.emit(res.data);
      },
      error: (err: unknown) => {
        this.saving.set(false);
        this.error.set(apiErrorText(err));
      },
    });
  }
}